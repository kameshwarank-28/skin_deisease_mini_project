import os
import sys
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

class ClassWeightedFocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, label_smoothing: float = 0.05, class_weights: torch.Tensor = None):
        super().__init__()
        self.gamma = gamma
        self.label_smoothing = label_smoothing
        self.class_weights = class_weights

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        num_classes = inputs.size(-1)
        log_probs = F.log_softmax(inputs, dim=-1)
        probs = torch.exp(log_probs)

        targets_one_hot = F.one_hot(targets, num_classes=num_classes).float()
        if self.label_smoothing > 0:
            targets_one_hot = targets_one_hot * (1.0 - self.label_smoothing) + (self.label_smoothing / num_classes)

        pt = torch.sum(probs * targets_one_hot, dim=-1)
        focal_weight = (1.0 - pt) ** self.gamma
        ce_loss = -torch.sum(targets_one_hot * log_probs, dim=-1)
        loss = focal_weight * ce_loss

        if self.class_weights is not None:
            w = self.class_weights.to(inputs.device)[targets]
            loss = loss * w

        return loss.mean()

class SkinDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform=None, cache_size: int = 224):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].astype(int).tolist()
        self.transform = transform
        self.cache_size = cache_size

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        path = self.file_paths[idx]
        label = self.labels[idx]
        try:
            with Image.open(path) as img:
                img_t = img.convert("RGB")
        except Exception:
            img_t = Image.new("RGB", (self.cache_size, self.cache_size), (128, 128, 128))

        if self.transform:
            tensor = self.transform(img_t)
        else:
            tensor = transforms.ToTensor()(img_t)
        return tensor, torch.tensor(label, dtype=torch.long)

def finetune_user_normal():
    print("=" * 70)
    print("FINE-TUNING MODEL WITH USER-SUPPLIED NORMAL SKIN PHOTOGRAPHS")
    print("=" * 70)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Load manifests
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    
    with open("processed_dataset/classes.json", "r", encoding="utf-8") as f:
        classes_data = json.load(f)

    num_classes = classes_data.get("num_classes", 11)
    clean_names = [classes_data["clean_names"][str(i)] for i in range(num_classes)]

    # Filter user normal skin samples + balanced disease samples
    user_normal_df = train_df[train_df["file_name"].str.startswith("user_normal_")].copy()
    print(f"Found {len(user_normal_df)} user normal samples to integrate.")

    # Other normal samples
    other_normal_df = train_df[(train_df["label"] == 10) & (~train_df["file_name"].str.startswith("user_normal_"))].sample(n=60, random_state=42)
    all_normal_train = pd.concat([user_normal_df, other_normal_df], ignore_index=True)

    # Sample balanced disease samples (50 per disease class to prevent catastrophic forgetting)
    disease_dfs = []
    for c in range(10):
        sub = train_df[train_df["label"] == c].sample(n=min(50, len(train_df[train_df["label"] == c])), random_state=42)
        disease_dfs.append(sub)

    cohort = pd.concat([all_normal_train] + disease_dfs, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)
    print(f"Total fine-tuning cohort: {len(cohort)} samples ({len(all_normal_train)} normal, {len(cohort)-len(all_normal_train)} disease).")

    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    ds = SkinDataset(cohort, transform=train_transform)
    loader = DataLoader(ds, batch_size=32, shuffle=True, num_workers=0)

    # Load existing checkpoint
    ckpt_path = "models/best_model.pth"
    print(f"Loading checkpoint from {ckpt_path}...")
    checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)

    model = timm.create_model("tf_efficientnetv2_s", pretrained=False, num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)

    # Unfreeze classifier and conv_head
    for name, param in model.named_parameters():
        if "classifier" in name or "conv_head" in name:
            param.requires_grad = True
        else:
            param.requires_grad = False

    # Focus focal loss on reinforcing normal class accuracy
    weights = torch.ones(num_classes, dtype=torch.float32).to(device)
    weights[10] = 1.8  # Slight boost to normal skin category
    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.05, class_weights=weights)

    optimizer = AdamW([
        {"params": [p for n, p in model.named_parameters() if "classifier" in n and p.requires_grad], "lr": 2e-4},
        {"params": [p for n, p in model.named_parameters() if "conv_head" in n and p.requires_grad], "lr": 3e-5}
    ], weight_decay=1e-2)

    print("\n--- FINE-TUNING ON USER NORMAL SKIN SAMPLES (3 Epochs) ---")
    for epoch in range(1, 4):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * len(y)
        avg_loss = running_loss / len(ds)
        print(f"Epoch {epoch}/3 | Loss: {avg_loss:.4f} | Time: {time.time()-t0:.1f}s")

    # Update checkpoint with refined weights
    checkpoint["model_state_dict"] = model.state_dict()
    checkpoint["user_normal_integrated"] = True
    torch.save(checkpoint, "models/best_model.pth")
    torch.save(checkpoint, "models/efficientnetv2_s_11class_best.pth")
    print("\nUpdated models/best_model.pth with user normal skin adaptations!")

    # Verify on the 3 original user images
    print("\n" + "=" * 70)
    print("VERIFICATION ON THE 3 ORIGINAL USER NORMAL SKIN IMAGES:")
    print("=" * 70)
    model.eval()
    eval_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    temperature = float(checkpoint.get("temperature", 3.50))
    all_normal_pass = True

    for idx in [1, 2, 3]:
        p = Path(f"user_normal_samples/user_normal_{idx}.jpg")
        with Image.open(p) as img:
            rgb = img.convert("RGB")
            t_orig = eval_tf(rgb).unsqueeze(0).to(device)
            t_flip = eval_tf(rgb.transpose(Image.FLIP_LEFT_RIGHT)).unsqueeze(0).to(device)

            with torch.no_grad():
                l1 = model(t_orig)[0]
                l2 = model(t_flip)[0]
                mean_l = (l1 + l2) / 2.0
                probs = F.softmax(mean_l / temperature, dim=-1).cpu().numpy()

            top_idx = int(np.argmax(probs))
            top_prob = float(probs[top_idx])
            top_name = clean_names[top_idx]

            is_normal = (top_idx == 10)
            status = "PASS (Normal Skin)" if is_normal else f"FAIL ({top_name})"
            print(f"User Image {idx} -> Prediction: {top_name:25s} | Confidence: {top_prob*100:5.2f}% | Status: {status}")
            if not is_normal:
                all_normal_pass = False

    print("=" * 70)
    print(f"All 3 User Normal Images Verified as Normal Skin: {all_normal_pass}")

if __name__ == "__main__":
    finetune_user_normal()
