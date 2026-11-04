import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from PIL import Image
import yaml

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from sklearn.metrics import f1_score, accuracy_score, balanced_accuracy_score
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def clean_class_name(raw_name: str) -> str:
    parts = raw_name.split(".", 1)
    name = parts[1].strip() if len(parts) > 1 else raw_name
    tokens = name.split()
    if tokens and tokens[-1].replace("k", "").replace(".", "").isdigit():
        tokens.pop()
    return " ".join(tokens).strip()

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
    def __init__(self, df: pd.DataFrame, transform=None, desc: str = "Dataset", cache_size: int = 224):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].tolist()
        self.transform = transform
        
        print(f"Pre-caching {len(self.file_paths)} {desc} images in RAM ({cache_size}x{cache_size})...")
        self.cached_images = []
        for path in self.file_paths:
            try:
                with Image.open(path) as img:
                    self.cached_images.append(img.convert("RGB").resize((cache_size, cache_size)))
            except Exception:
                self.cached_images.append(Image.new("RGB", (cache_size, cache_size), color=(128, 128, 128)))
        print(f"Pre-cached {len(self.cached_images)} {desc} images.")

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        img = self.cached_images[idx]
        label = self.labels[idx]
        if self.transform:
            tensor = self.transform(img)
        else:
            tensor = transforms.ToTensor()(img)
        return tensor, torch.tensor(label, dtype=torch.long)

def get_transforms(image_size: int = 224):
    train_transform = transforms.Compose([
        transforms.Resize((int(image_size * 1.12), int(image_size * 1.12))),
        transforms.RandomResizedCrop(image_size, scale=(0.85, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.12, contrast=0.12, saturation=0.08),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    eval_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    return train_transform, eval_transform

def build_model(model_name: str, num_classes: int = 10, dropout: float = 0.25) -> Tuple[nn.Module, str]:
    clean_name = model_name.lower().replace("-", "_")
    if clean_name in ["dinov2_vitb14", "dinov2", "dinov2_vit_base"]:
        timm_key = "vit_base_patch14_dinov2.lvd142m"
    elif clean_name in ["convnext", "convnext_tiny"]:
        timm_key = "convnext_tiny"
    elif clean_name in ["efficientnetv2_s", "efficientnetv2s", "tf_efficientnetv2_s"]:
        timm_key = "tf_efficientnetv2_s"
    elif clean_name in ["densenet121", "densenet"]:
        timm_key = "densenet121"
    else:
        timm_key = model_name

    print(f"Instantiating model from timm: {timm_key} (num_classes={num_classes})")
    model = timm.create_model(timm_key, pretrained=True, num_classes=num_classes, drop_rate=dropout)
    return model, timm_key

def main():
    parser = argparse.ArgumentParser(description="DermAI Model Training CLI")
    parser.add_argument("--model", type=str, default="convnext_tiny", choices=["convnext_tiny", "dinov2_vitb14", "efficientnetv2_s", "densenet121"])
    parser.add_argument("--config", type=str, default="training_config.yaml")
    parser.add_argument("--stage1_epochs", type=int, default=2)
    parser.add_argument("--stage2_epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--image_size", type=int, default=224)
    parser.add_argument("--train_samples_per_class", type=int, default=200)
    parser.add_argument("--val_samples_per_class", type=int, default=40)
    parser.add_argument("--output_dir", type=str, default="models")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 65)
    print(f"DERMAI MODEL TRAINING: {args.model.upper()}")
    print(f"Device: {device} | Threads: {torch.get_num_threads()}")
    print("=" * 65)

    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    
    with open("class_mapping.json", "r", encoding="utf-8") as f:
        class_map = json.load(f)
    num_classes = class_map["num_classes"]
    classes_list = [class_map["idx_to_class"][str(i)] for i in range(num_classes)]

    # Compute Class Weights
    class_counts = train_df["label"].value_counts().sort_index().values
    total_samples = len(train_df)
    class_weights = torch.tensor([total_samples / (num_classes * count) for count in class_counts], dtype=torch.float32)

    # Subsets for fast convergence
    train_subset = train_df.groupby("label").sample(args.train_samples_per_class, random_state=42).reset_index(drop=True)
    val_subset = val_df.groupby("label").sample(args.val_samples_per_class, random_state=42).reset_index(drop=True)

    train_tf, eval_tf = get_transforms(args.image_size)
    train_loader = DataLoader(SkinDataset(train_subset, transform=train_tf, desc="Train", cache_size=args.image_size), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(SkinDataset(val_subset, transform=eval_tf, desc="Val", cache_size=args.image_size), batch_size=args.batch_size, shuffle=False)

    model, timm_key = build_model(args.model, num_classes=num_classes)
    model.to(device)

    # Stage 1: Freeze Backbone & Pretrain Head
    print("\n[Stage 1] Head Pre-Training (Backbone frozen)...")
    for p in model.parameters():
        p.requires_grad = False

    head_params = []
    for name, param in model.named_parameters():
        if any(h in name for h in ["head", "classifier", "fc"]):
            param.requires_grad = True
            head_params.append(param)

    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.05, class_weights=class_weights)
    optimizer_head = AdamW(head_params, lr=1e-3, weight_decay=1e-2)

    for epoch in range(1, args.stage1_epochs + 1):
        model.train()
        t_loss, t_correct, t_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer_head.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer_head.step()

            t_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            t_correct += (preds == labels).sum().item()
            t_total += labels.size(0)

        print(f"  Head Epoch {epoch}/{args.stage1_epochs} -> Loss: {t_loss/t_total:.4f} | Train Acc: {t_correct/t_total*100:.2f}%")

    # Stage 2: Differential Learning Rate Fine-Tuning
    print("\n[Stage 2] Differential Learning Rate Fine-Tuning...")
    for p in model.parameters():
        p.requires_grad = True

    backbone_params = [p for n, p in model.named_parameters() if not any(h in n for h in ["head", "classifier", "fc"])]
    optimizer_ft = AdamW([
        {"params": backbone_params, "lr": 1e-5, "weight_decay": 1e-2},
        {"params": head_params, "lr": 2e-4, "weight_decay": 1e-2}
    ])
    scheduler = CosineAnnealingLR(optimizer_ft, T_max=args.stage2_epochs, eta_min=1e-6)

    best_val_f1 = 0.0
    best_state_dict = None

    for epoch in range(1, args.stage2_epochs + 1):
        model.train()
        t_loss, t_correct, t_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer_ft.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer_ft.step()

            t_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            t_correct += (preds == labels).sum().item()
            t_total += labels.size(0)

        scheduler.step()

        # Validate
        model.eval()
        v_preds, v_targets = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs = imgs.to(device)
                out = model(imgs)
                v_preds.extend(out.argmax(dim=1).cpu().numpy())
                v_targets.extend(labels.numpy())

        val_acc = accuracy_score(v_targets, v_preds)
        val_f1 = f1_score(v_targets, v_preds, average="macro", zero_division=0)
        print(f"  FT Epoch {epoch}/{args.stage2_epochs} -> Train Acc: {t_correct/t_total*100:.2f}% | Val Acc: {val_acc*100:.2f}% | Val Macro F1: {val_f1:.4f}")

        if val_f1 >= best_val_f1:
            best_val_f1 = val_f1
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    os.makedirs(args.output_dir, exist_ok=True)
    save_path = Path(args.output_dir) / f"{args.model}_trained.pth"
    torch.save({
        "model_name": args.model,
        "timm_key": timm_key,
        "num_classes": num_classes,
        "classes": classes_list,
        "model_state_dict": best_state_dict,
        "best_val_macro_f1": best_val_f1,
        "image_size": args.image_size
    }, save_path)
    print(f"\nTrained checkpoint successfully saved to: {save_path}")

if __name__ == "__main__":
    main()
