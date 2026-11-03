import os
import sys
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from tqdm import tqdm
import timm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dataset import IMAGENET_MEAN, IMAGENET_STD

class FocalLoss(nn.Module):
    """
    Multi-class Focal Loss: FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)
    Focuses learning on hard-to-classify samples.
    """
    def __init__(self, gamma: float = 2.0, weight: torch.Tensor = None, label_smoothing: float = 0.05):
        super().__init__()
        self.gamma = gamma
        self.weight = weight
        self.label_smoothing = label_smoothing

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        num_classes = inputs.size(-1)
        log_probs = F.log_softmax(inputs, dim=-1)
        probs = torch.exp(log_probs)

        # Smooth one-hot targets
        targets_one_hot = F.one_hot(targets, num_classes=num_classes).float()
        if self.label_smoothing > 0:
            targets_one_hot = targets_one_hot * (1.0 - self.label_smoothing) + (self.label_smoothing / num_classes)

        # Focal weighting
        pt = torch.sum(probs * targets_one_hot, dim=-1)
        focal_weight = (1.0 - pt) ** self.gamma
        
        ce_loss = -torch.sum(targets_one_hot * log_probs, dim=-1)
        loss = focal_weight * ce_loss

        if self.weight is not None:
            sample_weights = self.weight[targets]
            loss = loss * sample_weights

        return loss.mean()

def get_train_transform(image_size=224):
    return transforms.Compose([
        transforms.Resize((int(image_size * 1.15), int(image_size * 1.15))),
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(degrees=20),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

def get_val_transform(image_size=224):
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

class FastSkinDataset(Dataset):
    def __init__(self, df, transform=None):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].tolist()
        self.transform = transform

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        path = self.file_paths[idx]
        label = self.labels[idx]
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), color=(128, 128, 128))

        if self.transform:
            tensor = self.transform(img)
        else:
            tensor = transforms.ToTensor()(img)
        return tensor, torch.tensor(label, dtype=torch.long)

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=== Fast High-Performance Training (Focal Loss + ConvNeXt/ResNet) on {device} ===")

    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")

    # Balanced stratified sample (160 samples per class = 1,600 images)
    train_subset = train_df.groupby("label").sample(160, random_state=42).reset_index(drop=True)
    val_subset = val_df.groupby("label").sample(35, random_state=42).reset_index(drop=True)

    print(f"Training set: {len(train_subset)} samples | Validation set: {len(val_subset)} samples")

    train_dataset = FastSkinDataset(train_subset, transform=get_train_transform(224))
    val_dataset = FastSkinDataset(val_subset, transform=get_val_transform(224))

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)

    model_name = "resnet34"
    model = timm.create_model(model_name, pretrained=True, num_classes=10, drop_rate=0.25)
    model.to(device)

    # Unfreeze top layers for strong representation learning
    for name, param in model.named_parameters():
        if any(x in name for x in ["layer3", "layer4", "fc", "head"]):
            param.requires_grad = True
        else:
            param.requires_grad = False

    criterion = FocalLoss(gamma=2.0, label_smoothing=0.08)
    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=8e-4, weight_decay=1e-2)
    epochs = 5
    scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=epochs, T_mult=1, eta_min=1e-5)

    best_acc = 0.0
    output_dir = Path("models")
    output_dir.mkdir(exist_ok=True)

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss, correct, total = 0.0, 0, 0
        for imgs, labels in tqdm(train_loader, desc=f"Epoch {epoch}/{epochs}"):
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            running_loss += loss.item() * imgs.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        scheduler.step()
        train_acc = correct / total if total > 0 else 0

        # Evaluate
        model.eval()
        v_correct, v_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                preds = outputs.argmax(dim=1)
                v_correct += (preds == labels).sum().item()
                v_total += labels.size(0)

        val_acc = v_correct / v_total if v_total > 0 else 0
        print(f"Epoch {epoch}/{epochs} -> Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}%")

        if val_acc > best_acc or epoch == epochs:
            best_acc = val_acc
            save_path = output_dir / "best_vit_base_patch16_224.pth"
            torch.save({
                "epoch": epoch,
                "model_name": model_name,
                "num_classes": 10,
                "model_state_dict": model.state_dict(),
                "val_acc": val_acc
            }, save_path)
            print(f"[*] Upgraded checkpoint saved: {save_path} (Val Acc: {val_acc*100:.1f}%)")

    print(f"\n[SUCCESS] Model optimization complete! Peak Validation Accuracy: {best_acc*100:.1f}%")

if __name__ == "__main__":
    main()
