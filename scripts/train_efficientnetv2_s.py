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
    confusion_matrix
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

def compute_brier_score(probs: np.ndarray, targets: np.ndarray) -> float:
    num_classes = probs.shape[1]
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
    def __init__(self, df: pd.DataFrame, transform=None, desc: str = "Dataset", cache_size: int = 256):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].tolist()
        self.transform = transform
        
        print(f"Pre-caching {len(self.file_paths)} {desc} images in RAM (resolution {cache_size}x{cache_size})...")
        self.cached_images = []
        for path in self.file_paths:
            try:
                with Image.open(path) as img:
                    self.cached_images.append(img.convert("RGB").resize((cache_size, cache_size)))
            except Exception:
                self.cached_images.append(Image.new("RGB", (cache_size, cache_size), color=(128, 128, 128)))
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

def get_transforms(image_size: int = 256):
    train_transform = transforms.Compose([
        transforms.Resize((int(image_size * 1.12), int(image_size * 1.12))),
        transforms.RandomResizedCrop(image_size, scale=(0.85, 1.0)),
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

def generate_gradcam(model: nn.Module, pil_image: Image.Image, target_class: int, device: torch.device, image_size: int = 256):
    model.eval()
    target_layer = getattr(model, "conv_head", None)
    if target_layer is None:
        for module in reversed(list(model.modules())):
            if isinstance(module, nn.Conv2d):
                target_layer = module
                break

    activations, gradients = [], []
    def forward_hook(module, inp, output): activations.append(output)
    def backward_hook(module, gin, gout): gradients.append(gout[0])

    h1 = target_layer.register_forward_hook(forward_hook)
    h2 = target_layer.register_full_backward_hook(backward_hook)

    _, eval_transform = get_transforms(image_size)
    img_t = eval_transform(pil_image).unsqueeze(0).to(device)

    model.zero_grad()
    out = model(img_t)
    if target_class is None:
        target_class = out.argmax(dim=1).item()

    score = out[0, target_class]
    score.backward()

    h1.remove()
    h2.remove()

    act = activations[0].detach().cpu().numpy()[0]
    grad = gradients[0].detach().cpu().numpy()[0]
    weights = np.mean(grad, axis=(1, 2))
    cam = np.zeros(act.shape[1:], dtype=np.float32)
    for i, w in enumerate(weights):
        cam += w * act[i]

    cam = np.maximum(cam, 0)
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-9)

    orig_np = np.array(pil_image.convert("RGB"))
    h, w, _ = orig_np.shape
    cam_resized = cv2.resize(cam, (w, h))

    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    blended = cv2.addWeighted(orig_np, 0.65, heatmap, 0.35, 0)

    return blended, cam_resized

def main():
    print("=" * 70)
    print("DERMAI: EFFICIENTNETV2-S ADVANCED SKIN DISEASE CLASSIFICATION MODEL")
    print("=" * 70)

    device = torch.device("cpu")
    print(f"Device: {device} | Logical Cores: {os.cpu_count()} | Active Threads: {torch.get_num_threads()}")

    # 1. Dataset Manifests
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")

    with open("processed_dataset/classes.json", "r", encoding="utf-8") as f:
        classes_data = json.load(f)
    classes_list = classes_data["classes"]
    clean_names = [clean_class_name(c) for c in classes_list]
    num_classes = len(classes_list)

    print(f"Classes ({num_classes}): {clean_names}")
    print(f"Full Manifest Totals -> Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}")

    # Inverse Class Frequency Weights for Focal Loss
    class_counts = train_df["label"].value_counts().sort_index().values
    total_train = len(train_df)
    class_weights = torch.tensor([total_train / (num_classes * count) for count in class_counts], dtype=torch.float32)
    print(f"Class Weights (Inverse Frequency): {class_weights.numpy().round(3)}")

    # Balanced Representative Subsets for CPU Convergence
    # 200 per class for training = 2,000 images
    # 40 per class for validation = 400 images
    # 70 per class for testing = 700 images
    train_subset = train_df.groupby("label").sample(200, random_state=42).reset_index(drop=True)
    val_subset = val_df.groupby("label").sample(40, random_state=42).reset_index(drop=True)
    test_subset = test_df.groupby("label").sample(70, random_state=42).reset_index(drop=True)

    print(f"Active Training Subset -> Train: {len(train_subset)} | Val: {len(val_subset)} | Test: {len(test_subset)}")

    IMAGE_RES = 256
    train_tf, eval_tf = get_transforms(image_size=IMAGE_RES)
    train_loader = DataLoader(SkinDataset(train_subset, transform=train_tf, desc="Train", cache_size=IMAGE_RES), batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(SkinDataset(val_subset, transform=eval_tf, desc="Val", cache_size=IMAGE_RES), batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(SkinDataset(test_subset, transform=eval_tf, desc="Test", cache_size=IMAGE_RES), batch_size=32, shuffle=False, num_workers=0)

    # 2. Instantiate EfficientNetV2-S with ImageNet Pretrained Weights
    print("\nInstantiating EfficientNetV2-S (tf_efficientnetv2_s) with ImageNet Pretrained Weights...")
    model = timm.create_model("tf_efficientnetv2_s", pretrained=True, num_classes=num_classes, drop_rate=0.25)
    model.to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total Parameters: {total_params:,}")
    print(f"Classifier Structure: {model.classifier}")

    # 3. Stage 1: Freeze Backbone & Pre-Train Classification Head
    for p in model.parameters():
        p.requires_grad = False
    for p in model.classifier.parameters():
        p.requires_grad = True

    head_params = sum(p.numel() for p in model.classifier.parameters() if p.requires_grad)
    print(f"\n[Stage 1] Head Pre-Training: {head_params:,} trainable parameters (Backbone frozen)...")

    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.05, class_weights=class_weights)
    head_optimizer = AdamW(model.classifier.parameters(), lr=1e-3, weight_decay=1e-2)

    STAGE1_EPOCHS = 2
    for epoch in range(1, STAGE1_EPOCHS + 1):
        model.train()
        t_loss, t_correct, t_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            head_optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            head_optimizer.step()

            t_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            t_correct += (preds == labels).sum().item()
            t_total += labels.size(0)

        acc = t_correct / t_total
        print(f"  Head Epoch {epoch}/{STAGE1_EPOCHS} -> Loss: {t_loss/t_total:.4f} | Train Acc: {acc*100:.2f}%")

    # 4. Stage 2: Unfreeze Backbone with Differential Learning Rates
    # Backbone: 1e-5, Head: 2e-4
    for p in model.parameters():
        p.requires_grad = True

    backbone_params = [p for n, p in model.named_parameters() if "classifier" not in n]
    classifier_params = list(model.classifier.parameters())

    print(f"\n[Stage 2] Full Network Fine-Tuning:")
    print(f"  Backbone Params: {sum(p.numel() for p in backbone_params):,} (lr=1e-5)")
    print(f"  Head Params:     {sum(p.numel() for p in classifier_params):,} (lr=2e-4)")

    ft_optimizer = AdamW([
        {"params": backbone_params, "lr": 1e-5, "weight_decay": 1e-2},
        {"params": classifier_params, "lr": 2e-4, "weight_decay": 1e-2}
    ])

    STAGE2_EPOCHS = 3
    scheduler = CosineAnnealingLR(ft_optimizer, T_max=STAGE2_EPOCHS, eta_min=1e-6)

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_f1": []}
    best_val_f1 = 0.0
    best_state_dict = None

    for epoch in range(1, STAGE2_EPOCHS + 1):
        model.train()
        t_loss, t_correct, t_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            ft_optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            ft_optimizer.step()

            t_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            t_correct += (preds == labels).sum().item()
            t_total += labels.size(0)

        scheduler.step()
        train_acc = t_correct / t_total
        train_loss = t_loss / t_total

        # Validation
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

        val_acc = v_correct / v_total
        val_loss = v_loss / v_total
        val_f1 = float(f1_score(val_targets_list, val_preds_list, average="macro", zero_division=0))

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(val_f1)

        print(f"  Fine-Tune Epoch {epoch}/{STAGE2_EPOCHS} -> Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | Val Acc: {val_acc*100:.2f}% | Val Macro F1: {val_f1:.4f}")

        if val_f1 >= best_val_f1:
            best_val_f1 = val_f1
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Load best checkpoint
    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)
    model.eval()

    # 5. Collect Validation Logits for Temperature Scaling
    val_logits_list, val_targets_list = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs = imgs.to(device)
            val_logits_list.append(model(imgs).cpu().numpy())
            val_targets_list.append(labels.numpy())
    val_logits = np.concatenate(val_logits_list, axis=0)
    val_targets = np.concatenate(val_targets_list, axis=0)

    optimal_t = fit_temperature_scaling(val_logits, val_targets)
    print(f"\n[Post-Hoc Probability Calibration] Optimal Temperature T = {optimal_t:.4f}")

    # 6. Evaluation on Untouched Independent Test Set
    test_logits_list, test_targets_list, inference_latencies = [], [], []
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs = imgs.to(device)
            t0 = time.time()
            logits = model(imgs)
            inference_latencies.append((time.time() - t0) / imgs.size(0))
            test_logits_list.append(logits.cpu().numpy())
            test_targets_list.append(labels.numpy())

    test_logits = np.concatenate(test_logits_list, axis=0)
    test_targets = np.concatenate(test_targets_list, axis=0)
    avg_latency_ms = float(np.mean(inference_latencies) * 1000.0)

    # Raw Test Probabilities
    test_probs = torch.softmax(torch.from_numpy(test_logits), dim=-1).numpy()
    test_preds = np.argmax(test_probs, axis=1)

    # Calibrated Test Probabilities
    cal_test_logits = test_logits / optimal_t
    cal_test_probs = torch.softmax(torch.from_numpy(cal_test_logits), dim=-1).numpy()

    # Metrics
    top1_acc = float(accuracy_score(test_targets, test_preds))
    top3_acc = float(top_k_accuracy_score(test_targets, test_probs, k=3))
    bal_acc = float(balanced_accuracy_score(test_targets, test_preds))
    macro_prec = float(precision_score(test_targets, test_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(test_targets, test_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(test_targets, test_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(test_targets, test_preds, average="weighted", zero_division=0))

    raw_ece = compute_ece(test_probs, test_targets)
    cal_ece = compute_ece(cal_test_probs, test_targets)
    raw_brier = compute_brier_score(test_probs, test_targets)
    cal_brier = compute_brier_score(cal_test_probs, test_targets)

    per_class_rec = recall_score(test_targets, test_preds, average=None, zero_division=0)
    melanoma_recall = float(per_class_rec[2])
    bcc_recall = float(per_class_rec[4])

    print("\n" + "=" * 70)
    print("EFFICIENTNETV2-S INDEPENDENT TEST SET EVALUATION RESULTS")
    print("=" * 70)
    print(f"Top-1 Accuracy:       {top1_acc*100:.2f}%")
    print(f"Top-3 Accuracy:       {top3_acc*100:.2f}%")
    print(f"Balanced Accuracy:    {bal_acc*100:.2f}%")
    print(f"Macro F1-Score:       {macro_f1:.4f}")
    print(f"Weighted F1-Score:    {weighted_f1:.4f}")
    print(f"Macro Precision:      {macro_prec:.4f}")
    print(f"Macro Recall:         {macro_rec:.4f}")
    print(f"Melanoma Recall:      {melanoma_recall*100:.1f}%")
    print(f"BCC Recall:           {bcc_recall*100:.1f}%")
    print(f"Inference Latency:    {avg_latency_ms:.2f} ms/sample")
    print(f"Calibration ECE:      {raw_ece:.4f} -> {cal_ece:.4f} (Calibrated)")
    print(f"Brier Score:          {raw_brier:.4f} -> {cal_brier:.4f} (Calibrated)")
    print("=" * 70)

    # 7. Save Checkpoints
    models_dir = Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)
    reports_dir = Path("reports/evaluation")
    reports_dir.mkdir(parents=True, exist_ok=True)

    ckpt_payload = {
        "model_name": "efficientnetv2_s",
        "timm_model_name": "tf_efficientnetv2_s",
        "num_classes": num_classes,
        "classes": classes_list,
        "clean_names": clean_names,
        "temperature": optimal_t,
        "raw_ece": raw_ece,
        "calibrated_ece": cal_ece,
        "raw_brier": raw_brier,
        "calibrated_brier": cal_brier,
        "model_state_dict": best_state_dict,
        "top1_acc": top1_acc,
        "top3_acc": top3_acc,
        "balanced_acc": bal_acc,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "melanoma_recall": melanoma_recall,
        "bcc_recall": bcc_recall,
        "latency_ms_per_sample": avg_latency_ms,
        "training_resolution": IMAGE_RES
    }

    best_ckpt_path = models_dir / "best_model.pth"
    v2s_ckpt_path = models_dir / "efficientnetv2_s_best.pth"
    torch.save(ckpt_payload, best_ckpt_path)
    torch.save(ckpt_payload, v2s_ckpt_path)
    print(f"Saved primary model checkpoint to: {best_ckpt_path}")
    print(f"Saved backup model checkpoint to:  {v2s_ckpt_path}")

    # 8. Visual Plots & Reports
    # A. Training Curves
    plt.figure(figsize=(10, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history["train_loss"], label="Train Loss", marker="o", color="#dc2626")
    plt.plot(history["val_loss"], label="Val Loss", marker="s", color="#2563eb")
    plt.title("Fine-Tuning Loss", fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Focal Loss")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)

    plt.subplot(1, 2, 2)
    plt.plot([a*100 for a in history["train_acc"]], label="Train Acc (%)", marker="o", color="#16a34a")
    plt.plot([a*100 for a in history["val_acc"]], label="Val Acc (%)", marker="s", color="#0d9488")
    plt.plot([f*100 for f in history["val_f1"]], label="Val Macro F1 (%)", marker="^", color="#7c3aed")
    plt.title("Fine-Tuning Accuracy & Macro F1", fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Score (%)")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(reports_dir / "training_validation_curves_efficientnetv2_s.png", dpi=300)
    plt.close()

    # B. Confusion Matrix
    cm = confusion_matrix(test_targets, test_preds)
    cm_norm = cm.astype("float") / cm.sum(axis=1)[:, np.newaxis]
    plt.figure(figsize=(11, 9))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=[f"{i}: {clean_names[i][:15]}" for i in range(num_classes)],
                yticklabels=[f"{i}: {clean_names[i][:15]}" for i in range(num_classes)])
    plt.xlabel("Predicted Disease Class", fontweight="bold")
    plt.ylabel("True Disease Class", fontweight="bold")
    plt.title("Normalized Confusion Matrix: EfficientNetV2-S (Test Set)", fontsize=13, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "confusion_matrix_efficientnetv2_s.png", dpi=300)
    plt.close()

    # C. Per-Class F1-Scores
    clf_rep = classification_report(test_targets, test_preds, target_names=clean_names, output_dict=True, zero_division=0)
    pd.DataFrame(clf_rep).transpose().to_csv(reports_dir / "classification_report_efficientnetv2_s.csv")

    per_class_f1 = [clf_rep[cn]["f1-score"] for cn in clean_names]
    plt.figure(figsize=(10, 5))
    bars = plt.barh(clean_names, per_class_f1, color="#0d9488")
    plt.xlabel("F1-Score")
    plt.title("Per-Class F1-Scores: EfficientNetV2-S", fontweight="bold")
    plt.xlim(0, 1.0)
    for bar in bars:
        w_val = bar.get_width()
        plt.text(w_val + 0.01, bar.get_y() + bar.get_height()/2, f"{w_val:.2f}", va="center", fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "per_class_f1_efficientnetv2_s.png", dpi=300)
    plt.close()

    # D. Calibration Reliability Diagram
    bin_boundaries = np.linspace(0, 1, 11)
    raw_confs = np.max(test_probs, axis=1)
    cal_confs = np.max(cal_test_probs, axis=1)
    correct = (test_preds == test_targets)

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
    plt.plot(bin_centers, raw_bin_accs, "s-", color="#dc2626", label=f"Uncalibrated (ECE={raw_ece:.3f})")
    plt.plot(bin_centers, cal_bin_accs, "o-", color="#059669", label=f"Calibrated (T={optimal_t:.2f}, ECE={cal_ece:.3f})")
    plt.xlabel("Mean Predicted Confidence")
    plt.ylabel("Observed Empirical Accuracy")
    plt.title("Reliability Diagram: EfficientNetV2-S Temperature Scaling", fontweight="bold")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(reports_dir / "calibration_reliability_diagram_efficientnetv2_s.png", dpi=300)
    plt.close()

    # E. Grad-CAM Sample Verification
    sample_path = test_subset.iloc[0]["file_path"]
    sample_label = test_subset.iloc[0]["label"]
    with Image.open(sample_path) as s_img:
        s_pil = s_img.convert("RGB")
        blended, cam_map = generate_gradcam(model, s_pil, sample_label, device, image_size=IMAGE_RES)
        cv2.imwrite(str(reports_dir / "gradcam_sample_efficientnetv2_s.jpg"), cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
        print(f"Generated Grad-CAM visualization on sample test image: {reports_dir / 'gradcam_sample_efficientnetv2_s.jpg'}")

    # F. Save JSON Summary
    eval_summary = {
        "architecture": "EfficientNetV2-S (tf_efficientnetv2_s)",
        "pretrained_weights": "ImageNet-21k/1k",
        "num_classes": num_classes,
        "optimal_temperature_T": round(optimal_t, 4),
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "melanoma_recall": round(melanoma_recall, 4),
        "bcc_recall": round(bcc_recall, 4),
        "raw_ece": round(raw_ece, 4),
        "calibrated_ece": round(cal_ece, 4),
        "raw_brier_score": round(raw_brier, 4),
        "calibrated_brier_score": round(cal_brier, 4),
        "inference_latency_ms": round(avg_latency_ms, 2),
        "total_parameters": total_params,
        "training_resolution": f"{IMAGE_RES}x{IMAGE_RES}"
    }
    with open(reports_dir / "efficientnetv2_s_evaluation_summary.json", "w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2)

    print("\n" + "=" * 70)
    print("EFFICIENTNETV2-S TRAINING & EVALUATION COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()

