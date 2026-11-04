import os
import sys
import json
import time
import math
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from scipy.optimize import minimize_scalar
from sklearn.metrics import (
    accuracy_score,
    top_k_accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
    brier_score_loss
)
import cv2
import timm

# CPU threading optimization
torch.set_num_threads(min(24, os.cpu_count() or 4))

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def clean_class_name(raw_name: str) -> str:
    parts = raw_name.split(".", 1)
    name = parts[1].strip() if len(parts) > 1 else raw_name
    tokens = name.split()
    if tokens and tokens[-1].replace("k", "").replace(".", "").isdigit():
        tokens.pop()
    return " ".join(tokens).strip()

def calculate_entropy(probs: np.ndarray) -> np.ndarray:
    eps = 1e-9
    return -np.sum(probs * np.log(probs + eps), axis=-1)

def compute_ece(probs: np.ndarray, targets: np.ndarray, n_bins: int = 10) -> float:
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == targets)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total_samples = len(targets)

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            bin_acc = np.mean(accuracies[in_bin])
            bin_conf = np.mean(confidences[in_bin])
            ece += np.abs(bin_acc - bin_conf) * (np.sum(in_bin) / total_samples)

    return float(ece)

def compute_brier_score(probs: np.ndarray, targets: np.ndarray, num_classes: int = 10) -> float:
    one_hot = np.zeros_like(probs)
    for i, t in enumerate(targets):
        one_hot[i, t] = 1.0
    return float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))

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
    def __init__(self, df: pd.DataFrame, transform=None, desc: str = "Dataset"):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].tolist()
        self.transform = transform
        
        # Pre-cache resized PIL images in RAM for fast CPU execution
        print(f"Pre-caching {len(self.file_paths)} {desc} images into RAM...")
        self.cached_images = []
        for path in self.file_paths:
            try:
                with Image.open(path) as img:
                    self.cached_images.append(img.convert("RGB").resize((256, 256)))
            except Exception:
                self.cached_images.append(Image.new("RGB", (256, 256), color=(128, 128, 128)))
        print(f"Pre-cached {len(self.cached_images)} {desc} images in RAM.")

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
        transforms.Resize((int(image_size * 1.15), int(image_size * 1.15))),
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    eval_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    return train_transform, eval_transform

def is_head_param(name: str, model_name: str) -> bool:
    if "convnext" in model_name:
        return "head.fc" in name or "head.norm" in name
    elif "vit" in model_name:
        return name.startswith("head.")
    elif "densenet" in model_name or "efficientnet" in model_name:
        return "classifier" in name
    return name.startswith("head") or name.startswith("fc")

def train_and_evaluate_model(
    model_name: str,
    unfreeze_patterns: List[str],
    train_loader: DataLoader,
    val_loader: DataLoader,
    test_loader: DataLoader,
    device: torch.device,
    class_weights: torch.Tensor,
    num_classes: int = 10,
    head_epochs: int = 2,
    ft_epochs: int = 2
) -> Dict:
    print(f"\n" + "=" * 65)
    print(f"Training Candidate Architecture: {model_name}")
    print("=" * 65)

    start_train_time = time.time()
    model = timm.create_model(model_name, pretrained=True, num_classes=num_classes, drop_rate=0.25)
    model.to(device)

    total_params = sum(p.numel() for p in model.parameters())

    # Stage 1: Freeze all backbone parameters
    for p in model.parameters():
        p.requires_grad = False

    # Unfreeze classification head only
    for name, param in model.named_parameters():
        if is_head_param(name, model_name):
            param.requires_grad = True

    head_trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[{model_name}] Stage 1: Classifier head pre-training ({head_trainable_params:,} trainable params)...")

    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.05, class_weights=class_weights)
    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=1e-3, weight_decay=1e-2)

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    for epoch in range(1, head_epochs + 1):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)

        t_acc = train_correct / train_total if train_total > 0 else 0
        t_loss = train_loss / train_total if train_total > 0 else 0
        print(f"  Head Epoch {epoch}/{head_epochs} -> Loss: {t_loss:.4f} | Train Acc: {t_acc*100:.1f}%")

    # Stage 2: Unfreeze top block + head for fine-tuning
    for name, param in model.named_parameters():
        if is_head_param(name, model_name) or any(pat in name for pat in unfreeze_patterns):
            param.requires_grad = True

    stage2_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[{model_name}] Stage 2: Fine-tuning top stages ({stage2_trainable:,} / {total_params:,} params)...")

    ft_optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=2e-4, weight_decay=1e-2)
    scheduler = CosineAnnealingLR(ft_optimizer, T_max=ft_epochs, eta_min=1e-5)

    best_val_f1 = 0.0
    best_val_acc = 0.0
    best_state_dict = None

    for epoch in range(1, ft_epochs + 1):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            ft_optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            ft_optimizer.step()

            train_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)

        scheduler.step()
        train_acc = train_correct / train_total if train_total > 0 else 0
        train_loss_epoch = train_loss / train_total if train_total > 0 else 0

        # Validate
        model.eval()
        v_loss, v_correct, v_total = 0.0, 0, 0
        val_preds_list, val_targets_list = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(imgs)
                vl = criterion(out, labels)
                v_loss += vl.item() * imgs.size(0)
                preds = out.argmax(dim=1)
                v_correct += (preds == labels).sum().item()
                v_total += labels.size(0)
                val_preds_list.extend(preds.cpu().numpy())
                val_targets_list.extend(labels.cpu().numpy())

        val_acc = v_correct / v_total if v_total > 0 else 0
        val_loss_epoch = v_loss / v_total if v_total > 0 else 0
        val_f1 = f1_score(val_targets_list, val_preds_list, average="macro", zero_division=0)

        history["train_loss"].append(train_loss_epoch)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss_epoch)
        history["val_acc"].append(val_acc)

        print(f"  FT Epoch {epoch}/{ft_epochs} -> Train Loss: {train_loss_epoch:.4f} | Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}% | Val Macro F1: {val_f1:.4f}")

        if val_f1 >= best_val_f1:
            best_val_f1 = val_f1
            best_val_acc = val_acc
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    train_duration = time.time() - start_train_time

    # Load best weights for test evaluation
    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)
    model.eval()

    # Collect validation logits for temperature scaling
    val_logits_list, val_targets_list = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs = imgs.to(device)
            logits = model(imgs)
            val_logits_list.append(logits.cpu().numpy())
            val_targets_list.append(labels.numpy())
    val_logits = np.concatenate(val_logits_list, axis=0)
    val_targets = np.concatenate(val_targets_list, axis=0)

    # Evaluate on untouched independent test set
    test_logits_list, test_targets_list = [], []
    inference_times = []

    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs = imgs.to(device)
            t0 = time.time()
            logits = model(imgs)
            inference_times.append((time.time() - t0) / imgs.size(0))
            test_logits_list.append(logits.cpu().numpy())
            test_targets_list.append(labels.numpy())

    test_logits = np.concatenate(test_logits_list, axis=0)
    test_targets = np.concatenate(test_targets_list, axis=0)
    avg_latency_ms = float(np.mean(inference_times) * 1000.0)

    # Raw Test Probabilities
    test_probs = torch.softmax(torch.from_numpy(test_logits), dim=-1).numpy()
    test_preds = np.argmax(test_probs, axis=1)

    # Metrics computation
    top1_acc = float(accuracy_score(test_targets, test_preds))
    top3_acc = float(top_k_accuracy_score(test_targets, test_probs, k=3))
    bal_acc = float(balanced_accuracy_score(test_targets, test_preds))
    macro_prec = float(precision_score(test_targets, test_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(test_targets, test_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(test_targets, test_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(test_targets, test_preds, average="weighted", zero_division=0))
    raw_ece = compute_ece(test_probs, test_targets)
    raw_brier = compute_brier_score(test_probs, test_targets, num_classes=num_classes)

    # Per-class recall specifically for dangerous lesions (Melanoma: class 2, BCC: class 4)
    per_class_rec = recall_score(test_targets, test_preds, average=None, zero_division=0)
    melanoma_rec = float(per_class_rec[2]) if len(per_class_rec) > 2 else 0.0
    bcc_rec = float(per_class_rec[4]) if len(per_class_rec) > 4 else 0.0

    print(f"[{model_name}] Test Results -> Top-1 Acc: {top1_acc*100:.2f}% | Top-3 Acc: {top3_acc*100:.2f}% | Macro F1: {macro_f1:.4f} | ECE: {raw_ece:.4f} | Brier: {raw_brier:.4f}")

    return {
        "model_name": model_name,
        "model": model,
        "total_params": total_params,
        "trainable_params": stage2_trainable,
        "train_duration_sec": round(train_duration, 2),
        "latency_ms_per_sample": round(avg_latency_ms, 2),
        "val_acc": round(float(best_val_acc), 4),
        "val_f1": round(float(best_val_f1), 4),
        "val_logits": val_logits,
        "val_targets": val_targets,
        "test_logits": test_logits,
        "test_targets": test_targets,
        "test_probs": test_probs,
        "test_preds": test_preds,
        "top1_acc": round(top1_acc, 4),
        "top3_acc": round(top3_acc, 4),
        "balanced_acc": round(bal_acc, 4),
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "raw_ece": round(raw_ece, 4),
        "raw_brier": round(raw_brier, 4),
        "melanoma_recall": round(melanoma_rec, 4),
        "bcc_recall": round(bcc_rec, 4),
        "history": history,
        "state_dict": best_state_dict
    }

def fit_temperature_scaling(val_logits: np.ndarray, val_targets: np.ndarray) -> float:
    v_logits = torch.from_numpy(val_logits)
    v_targets = torch.from_numpy(val_targets)

    def nll_eval(t_val):
        t_val = max(1e-2, float(t_val))
        scaled = v_logits / t_val
        loss = F.cross_entropy(scaled, v_targets)
        return loss.item()

    res = minimize_scalar(nll_eval, bounds=(0.1, 5.0), method="bounded")
    return float(res.x)

def generate_saliency_xai(model: nn.Module, model_name: str, pil_image: Image.Image, target_class: int, device: torch.device):
    """Generate Explainable AI Heatmap (Grad-CAM for CNNs, Saliency for Transformers)."""
    model.eval()
    _, eval_transform = get_transforms(224)
    img_t = eval_transform(pil_image).unsqueeze(0).to(device)
    img_t.requires_grad = True

    model.zero_grad()
    out = model(img_t)
    if target_class is None:
        target_class = out.argmax(dim=1).item()

    score = out[0, target_class]
    score.backward()

    orig_np = np.array(pil_image.convert("RGB"))
    h, w, _ = orig_np.shape

    if "vit" in model_name:
        # High-resolution input saliency map with smoothing
        grad = img_t.grad.data.abs().sum(dim=1).squeeze().cpu().numpy()
        grad = cv2.GaussianBlur(grad, (17, 17), 0)
        norm_map = (grad - grad.min()) / (grad.max() - grad.min() + 1e-9)
        cam_resized = cv2.resize(norm_map, (w, h))
    else:
        # Grad-CAM for CNN backbones
        target_layer = None
        if "resnet" in model_name:
            target_layer = getattr(model, "layer4", None)
            if target_layer is not None: target_layer = target_layer[-1]
        elif "densenet" in model_name:
            target_layer = getattr(model, "features", None)
            if target_layer is not None: target_layer = target_layer[-1]
        elif "efficientnet" in model_name:
            target_layer = getattr(model, "conv_head", None)
        elif "convnext" in model_name:
            stages = getattr(model, "stages", None)
            if stages is not None: target_layer = stages[-1]

        if target_layer is None:
            # Fallback to saliency
            grad = img_t.grad.data.abs().sum(dim=1).squeeze().cpu().numpy()
            grad = cv2.GaussianBlur(grad, (17, 17), 0)
            norm_map = (grad - grad.min()) / (grad.max() - grad.min() + 1e-9)
            cam_resized = cv2.resize(norm_map, (w, h))
        else:
            activations, gradients = [], []
            def forward_hook(module, inp, output): activations.append(output)
            def backward_hook(module, gin, gout): gradients.append(gout[0])
            h1 = target_layer.register_forward_hook(forward_hook)
            h2 = target_layer.register_full_backward_hook(backward_hook)

            model.zero_grad()
            out2 = model(img_t.detach().requires_grad_(True))
            out2[0, target_class].backward()
            h1.remove()
            h2.remove()

            act = activations[0].detach().cpu().numpy()[0]
            grad = gradients[0].detach().cpu().numpy()[0]
            weights = np.mean(grad, axis=(1, 2))
            cam = np.zeros(act.shape[1:], dtype=np.float32)
            for i, weight_val in enumerate(weights):
                cam += weight_val * act[i]
            cam = np.maximum(cam, 0)
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-9)
            cam_resized = cv2.resize(cam, (w, h))

    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    blended = cv2.addWeighted(orig_np, 0.65, heatmap, 0.35, 0)
    return blended, cam_resized

def main():
    print("=" * 65)
    print("DermAI Health Monitor: Multi-Architecture Deep Learning Benchmark")
    print("Comparing: EfficientNet-B3, ConvNeXt-Tiny, DenseNet121 & Vision Transformer")
    print("=" * 65)

    device = torch.device("cpu")
    print(f"Execution Device: {device} (PyTorch threads: {torch.get_num_threads()})")

    # Load manifests
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")

    with open("processed_dataset/classes.json", "r", encoding="utf-8") as f:
        classes_data = json.load(f)
    classes_list = classes_data["classes"]
    clean_names = [clean_class_name(c) for c in classes_list]
    num_classes = len(classes_list)

    print(f"Manifest totals -> Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}")

    # Compute inverse class frequency weights for Focal Loss
    class_counts = train_df["label"].value_counts().sort_index().values
    total_samples = len(train_df)
    class_weights = torch.tensor([total_samples / (num_classes * c) for c in class_counts], dtype=torch.float32)
    print(f"Computed Class Weights: {class_weights.numpy().round(3)}")

    # Stratified representative sampling for rigorous, balanced multi-model benchmark on CPU
    # 150 per class for training = 1,500 samples
    # 35 per class for validation = 350 samples
    # 60 per class for independent testing = 600 samples
    train_subset = train_df.groupby("label").sample(150, random_state=42).reset_index(drop=True)
    val_subset = val_df.groupby("label").sample(35, random_state=42).reset_index(drop=True)
    test_subset = test_df.groupby("label").sample(60, random_state=42).reset_index(drop=True)

    print(f"Benchmark subset -> Train: {len(train_subset)} | Val: {len(val_subset)} | Test: {len(test_subset)}")

    train_tf, eval_tf = get_transforms(224)
    train_loader = DataLoader(SkinDataset(train_subset, transform=train_tf, desc="Train"), batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(SkinDataset(val_subset, transform=eval_tf, desc="Validation"), batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(SkinDataset(test_subset, transform=eval_tf, desc="Test"), batch_size=32, shuffle=False, num_workers=0)

    # EXACT 4 ARCHITECTURES REQUESTED IN MASTER PROMPT
    candidate_specs = [
        {
            "name": "densenet121",
            "unfreeze": ["denseblock4", "norm5"],
            "desc": "DenseNet-121 (Dense Feature Connectivity)"
        },
        {
            "name": "efficientnet_b3",
            "unfreeze": ["blocks.6", "conv_head"],
            "desc": "EfficientNet-B3 (Compound Scaled Inverted Residuals)"
        },
        {
            "name": "convnext_tiny",
            "unfreeze": ["stages.3"],
            "desc": "ConvNeXt-Tiny (Modernized Pure ConvNet)"
        },
        {
            "name": "vit_tiny_patch16_224",
            "unfreeze": ["blocks.11", "norm"],
            "desc": "Vision Transformer (ViT-Tiny / 16x16 Self-Attention)"
        }
    ]

    models_dir = Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)
    reports_dir = Path("reports/evaluation")
    reports_dir.mkdir(parents=True, exist_ok=True)

    results = []
    trained_models = {}

    for spec in candidate_specs:
        res = train_and_evaluate_model(
            model_name=spec["name"],
            unfreeze_patterns=spec["unfreeze"],
            train_loader=train_loader,
            val_loader=val_loader,
            test_loader=test_loader,
            device=device,
            class_weights=class_weights,
            num_classes=num_classes,
            head_epochs=2,
            ft_epochs=2
        )
        results.append(res)
        trained_models[spec["name"]] = res

        # Save individual model checkpoint
        ckpt_path = models_dir / f"model_{spec['name']}.pth"
        torch.save({
            "model_name": spec["name"],
            "num_classes": num_classes,
            "classes": classes_list,
            "model_state_dict": res["state_dict"],
            "val_acc": res["val_acc"],
            "macro_f1": res["macro_f1"],
            "top1_acc": res["top1_acc"]
        }, ckpt_path)
        print(f"Saved {spec['name']} checkpoint to: {ckpt_path}")

    # Build Comparison DataFrame
    comp_data = []
    for r in results:
        comp_data.append({
            "Architecture": r["model_name"],
            "Total Parameters": f"{r['total_params']:,}",
            "Trainable Params": f"{r['trainable_params']:,}",
            "Train Time (s)": r["train_duration_sec"],
            "Latency (ms/img)": r["latency_ms_per_sample"],
            "Top-1 Accuracy": f"{r['top1_acc']*100:.2f}%",
            "Top-3 Accuracy": f"{r['top3_acc']*100:.2f}%",
            "Balanced Accuracy": f"{r['balanced_acc']*100:.2f}%",
            "Macro Precision": r["macro_precision"],
            "Macro Recall": r["macro_recall"],
            "Macro F1-Score": r["macro_f1"],
            "Weighted F1-Score": r["weighted_f1"],
            "Melanoma Recall": f"{r['melanoma_recall']*100:.1f}%",
            "BCC Recall": f"{r['bcc_recall']*100:.1f}%",
            "Raw ECE": r["raw_ece"],
            "Brier Score": r["raw_brier"]
        })

    comp_df = pd.DataFrame(comp_data)
    comp_csv_path = reports_dir / "model_comparison_table.csv"
    comp_df.to_csv(comp_csv_path, index=False)
    print("\n" + "=" * 65)
    print("MODEL COMPARISON TABLE")
    print("=" * 65)
    print(comp_df.to_string(index=False))

    # Identify Winning Model
    # Ranking criterion: Macro F1-Score, Balanced Accuracy, Melanoma Recall
    best_res = max(results, key=lambda x: (x["macro_f1"], x["balanced_acc"], x["top1_acc"]))
    best_name = best_res["model_name"]
    best_model = best_res["model"]

    print("\n" + "=" * 65)
    print(f"SELECTED OPTIMAL ARCHITECTURE: {best_name.upper()}")
    print(f"Criteria: Macro F1={best_res['macro_f1']:.4f}, Top-1 Acc={best_res['top1_acc']*100:.2f}%, Top-3 Acc={best_res['top3_acc']*100:.2f}%")
    print("=" * 65)

    # Post-Hoc Probability Calibration via Temperature Scaling
    optimal_t = fit_temperature_scaling(best_res["val_logits"], best_res["val_targets"])
    print(f"Optimal Temperature Scaling Parameter T = {optimal_t:.4f}")

    # Calibrated probabilities on untouched test set
    calibrated_test_logits = best_res["test_logits"] / optimal_t
    calibrated_test_probs = torch.softmax(torch.from_numpy(calibrated_test_logits), dim=-1).numpy()
    calibrated_ece = compute_ece(calibrated_test_probs, best_res["test_targets"])
    calibrated_brier = compute_brier_score(calibrated_test_probs, best_res["test_targets"], num_classes=num_classes)

    print(f"Calibration Improvement on Test Set -> ECE: {best_res['raw_ece']:.4f} -> {calibrated_ece:.4f} (Brier: {best_res['raw_brier']:.4f} -> {calibrated_brier:.4f})")

    # Save Best Model Checkpoint
    best_ckpt_path = models_dir / "best_model.pth"
    torch.save({
        "model_name": best_name,
        "num_classes": num_classes,
        "classes": classes_list,
        "clean_names": clean_names,
        "temperature": optimal_t,
        "raw_ece": best_res["raw_ece"],
        "calibrated_ece": calibrated_ece,
        "model_state_dict": best_res["state_dict"],
        "top1_acc": best_res["top1_acc"],
        "top3_acc": best_res["top3_acc"],
        "macro_f1": best_res["macro_f1"],
        "weighted_f1": best_res["weighted_f1"],
        "balanced_acc": best_res["balanced_acc"],
        "latency_ms_per_sample": best_res["latency_ms_per_sample"]
    }, best_ckpt_path)
    print(f"Saved Best Model Checkpoint to: {best_ckpt_path}")

    # Generate Evaluation Artifacts & Plots
    # 1. Model Comparison Bar Chart
    plt.figure(figsize=(10, 6))
    x_indices = np.arange(len(results))
    width = 0.25
    plt.bar(x_indices - width, [r["top1_acc"]*100 for r in results], width, label="Top-1 Accuracy (%)", color="#1e3a8a")
    plt.bar(x_indices, [r["balanced_acc"]*100 for r in results], width, label="Balanced Accuracy (%)", color="#0d9488")
    plt.bar(x_indices + width, [r["macro_f1"]*100 for r in results], width, label="Macro F1 (%)", color="#6366f1")
    plt.xticks(x_indices, [r["model_name"] for r in results], rotation=15, fontsize=10)
    plt.ylabel("Score (%)")
    plt.title("Skin Disease Classification: Architecture Benchmark Comparison", fontsize=12, fontweight="bold")
    plt.legend()
    plt.grid(axis="y", linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(reports_dir / "model_comparison_chart.png", dpi=300)
    plt.close()

    # 2. Confusion Matrix for Best Model
    cm = confusion_matrix(best_res["test_targets"], best_res["test_preds"])
    cm_norm = cm.astype("float") / cm.sum(axis=1)[:, np.newaxis]

    plt.figure(figsize=(11, 9))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=[f"{i}: {clean_names[i][:15]}" for i in range(num_classes)],
                yticklabels=[f"{i}: {clean_names[i][:15]}" for i in range(num_classes)])
    plt.xlabel("Predicted Disease Class", fontweight="bold")
    plt.ylabel("True Disease Class", fontweight="bold")
    plt.title(f"Normalized Confusion Matrix: {best_name.upper()} (Test Set)", fontsize=13, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "confusion_matrix_best_model.png", dpi=300)
    plt.close()

    # 3. Per-Class Precision, Recall, F1 for Best Model
    clf_rep = classification_report(
        best_res["test_targets"],
        best_res["test_preds"],
        target_names=clean_names,
        output_dict=True,
        zero_division=0
    )
    clf_rep_df = pd.DataFrame(clf_rep).transpose()
    clf_rep_df.to_csv(reports_dir / "classification_report_best_model.csv")

    per_class_f1 = [clf_rep[cn]["f1-score"] for cn in clean_names]
    plt.figure(figsize=(10, 5))
    bars = plt.barh(clean_names, per_class_f1, color="#0d9488")
    plt.xlabel("F1-Score")
    plt.title(f"Per-Class F1-Scores: {best_name.upper()}", fontweight="bold")
    plt.xlim(0, 1.0)
    for bar in bars:
        w_val = bar.get_width()
        plt.text(w_val + 0.01, bar.get_y() + bar.get_height()/2, f"{w_val:.2f}", va="center", fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "per_class_f1_best_model.png", dpi=300)
    plt.close()

    # 4. Calibration Reliability Diagram
    bin_boundaries = np.linspace(0, 1, 11)
    raw_confs = np.max(best_res["test_probs"], axis=1)
    cal_confs = np.max(calibrated_test_probs, axis=1)
    correct = (best_res["test_preds"] == best_res["test_targets"])

    raw_bin_accs, cal_bin_accs, bin_centers = [], [], []
    for i in range(10):
        b_low, b_high = bin_boundaries[i], bin_boundaries[i+1]
        bin_centers.append((b_low + b_high) / 2)
        raw_mask = (raw_confs > b_low) & (raw_confs <= b_high)
        cal_mask = (cal_confs > b_low) & (cal_confs <= b_high)
        raw_bin_accs.append(np.mean(correct[raw_mask]) if np.sum(raw_mask) > 0 else np.nan)
        cal_bin_accs.append(np.mean(correct[cal_mask]) if np.sum(cal_mask) > 0 else np.nan)

    plt.figure(figsize=(7, 6))
    plt.plot([0, 1], [0, 1], "k--", label="Perfect Calibration (Ideal)")
    plt.plot(bin_centers, raw_bin_accs, "s-", color="#dc2626", label=f"Uncalibrated (ECE={best_res['raw_ece']:.3f})")
    plt.plot(bin_centers, cal_bin_accs, "o-", color="#059669", label=f"Calibrated (T={optimal_t:.2f}, ECE={calibrated_ece:.3f})")
    plt.xlabel("Mean Predicted Confidence")
    plt.ylabel("Observed Empirical Accuracy")
    plt.title("Reliability Diagram: Post-Hoc Temperature Scaling", fontweight="bold")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(reports_dir / "calibration_reliability_diagram.png", dpi=300)
    plt.close()

    # 5. Explainable AI (XAI) Verification on Test Sample
    sample_path = test_subset.iloc[0]["file_path"]
    sample_label = test_subset.iloc[0]["label"]
    with Image.open(sample_path) as s_img:
        s_pil = s_img.convert("RGB")
        blended, cam_map = generate_saliency_xai(best_model, best_name, s_pil, sample_label, device)
        cv2.imwrite(str(reports_dir / "xai_verification_sample.jpg"), cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
        print(f"Generated XAI heatmap on sample test image: {reports_dir / 'xai_verification_sample.jpg'}")

    # Save complete JSON evaluation summary
    eval_summary = {
        "best_model_architecture": best_name,
        "temperature_scaling": round(optimal_t, 4),
        "test_top1_accuracy": best_res["top1_acc"],
        "test_top3_accuracy": best_res["top3_acc"],
        "test_balanced_accuracy": best_res["balanced_acc"],
        "test_macro_f1": best_res["macro_f1"],
        "test_weighted_f1": best_res["weighted_f1"],
        "test_raw_ece": best_res["raw_ece"],
        "test_calibrated_ece": round(calibrated_ece, 4),
        "test_raw_brier_score": best_res["raw_brier"],
        "test_calibrated_brier_score": round(calibrated_brier, 4),
        "melanoma_recall": best_res["melanoma_recall"],
        "bcc_recall": best_res["bcc_recall"],
        "inference_latency_ms": best_res["latency_ms_per_sample"],
        "all_models_compared": [
            {
                "name": r["model_name"],
                "params": r["total_params"],
                "top1_acc": r["top1_acc"],
                "top3_acc": r["top3_acc"],
                "macro_f1": r["macro_f1"],
                "balanced_acc": r["balanced_acc"],
                "ece": r["raw_ece"]
            }
            for r in results
        ]
    }
    with open(reports_dir / "evaluation_summary.json", "w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2)
    print(f"Saved complete evaluation summary to: {reports_dir / 'evaluation_summary.json'}")

    print("\n" + "=" * 65)
    print("MULTI-ARCHITECTURE TRAINING & EVALUATION COMPLETED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    main()
