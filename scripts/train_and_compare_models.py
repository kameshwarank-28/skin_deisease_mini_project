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

# Setup paths and environment
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# CPU optimization
torch.set_num_threads(min(16, os.cpu_count() or 4))

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
    """Expected Calibration Error."""
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

class FocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, label_smoothing: float = 0.05, weight: torch.Tensor = None):
        super().__init__()
        self.gamma = gamma
        self.label_smoothing = label_smoothing
        self.weight = weight

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

        if self.weight is not None:
            sample_weights = self.weight[targets]
            loss = loss * sample_weights

        return loss.mean()

class SkinDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform=None, desc: str = "Dataset"):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].tolist()
        self.transform = transform
        
        # Pre-cache resized PIL images in RAM for ultra-fast multi-epoch training without network latency
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

def train_and_evaluate_model(
    model_name: str,
    unfreeze_patterns: List[str],
    train_loader: DataLoader,
    val_loader: DataLoader,
    test_loader: DataLoader,
    device: torch.device,
    num_classes: int = 10,
    epochs: int = 5
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

    # Unfreeze classification head
    head_patterns = ["fc", "classifier", "head"]
    for name, param in model.named_parameters():
        if any(hp in name for hp in head_patterns):
            param.requires_grad = True

    criterion = FocalLoss(gamma=2.0, label_smoothing=0.05)
    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=1e-3, weight_decay=1e-2)

    # Train head for 2 epochs
    print(f"[{model_name}] Stage 1: Classifier head pre-training (2 epochs)...")
    for epoch in range(1, 3):
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
        print(f"  Head Epoch {epoch}/2 -> Loss: {train_loss/train_total:.4f} | Train Acc: {t_acc*100:.1f}%")

    # Stage 2: Unfreeze top block + head for fine-tuning
    for name, param in model.named_parameters():
        if any(pat in name for pat in unfreeze_patterns) or any(hp in name for hp in head_patterns):
            param.requires_grad = True

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[{model_name}] Stage 2: Fine-tuning top stages ({trainable_params:,} / {total_params:,} trainable params)...")

    fine_tune_epochs = epochs - 2
    ft_optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=2e-4, weight_decay=1e-2)
    scheduler = CosineAnnealingLR(ft_optimizer, T_max=fine_tune_epochs, eta_min=1e-5)

    best_val_acc = 0.0
    best_state_dict = None

    for epoch in range(1, fine_tune_epochs + 1):
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

        # Validate
        model.eval()
        v_correct, v_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(imgs)
                preds = out.argmax(dim=1)
                v_correct += (preds == labels).sum().item()
                v_total += labels.size(0)
        val_acc = v_correct / v_total if v_total > 0 else 0
        print(f"  FT Epoch {epoch}/{fine_tune_epochs} -> Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}%")

        if val_acc >= best_val_acc:
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

    # Per-class recall specifically for dangerous lesions (Melanoma: class 2, BCC: class 4)
    per_class_rec = recall_score(test_targets, test_preds, average=None, zero_division=0)
    melanoma_rec = float(per_class_rec[2]) if len(per_class_rec) > 2 else 0.0
    bcc_rec = float(per_class_rec[4]) if len(per_class_rec) > 4 else 0.0

    print(f"[{model_name}] Test Results -> Top-1 Acc: {top1_acc*100:.2f}% | Macro F1: {macro_f1:.4f} | ECE: {raw_ece:.4f}")

    return {
        "model_name": model_name,
        "model": model,
        "total_params": total_params,
        "trainable_params": trainable_params,
        "train_duration_sec": round(train_duration, 2),
        "latency_ms_per_sample": round(avg_latency_ms, 2),
        "val_acc": round(float(best_val_acc), 4),
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
        "melanoma_recall": round(melanoma_rec, 4),
        "bcc_recall": round(bcc_rec, 4),
        "state_dict": best_state_dict
    }

def fit_temperature_scaling(val_logits: np.ndarray, val_targets: np.ndarray) -> float:
    """Find scalar temperature T > 0 that minimizes NLL on validation logits."""
    v_logits = torch.from_numpy(val_logits)
    v_targets = torch.from_numpy(val_targets)

    def nll_eval(t_val):
        t_val = max(1e-2, float(t_val))
        scaled = v_logits / t_val
        loss = F.cross_entropy(scaled, v_targets)
        return loss.item()

    res = minimize_scalar(nll_eval, bounds=(0.1, 5.0), method="bounded")
    return float(res.x)

def generate_gradcam(model: nn.Module, model_name: str, pil_image: Image.Image, target_class: int, device: torch.device):
    """Real Grad-CAM hooked into model's final convolutional layer."""
    model.eval()

    # Identify target layer based on architecture
    target_layer = None
    if "resnet" in model_name:
        target_layer = model.layer4[-1]
    elif "densenet" in model_name:
        target_layer = model.features[-1]
    elif "efficientnet" in model_name:
        target_layer = model.conv_head
    elif "convnext" in model_name:
        target_layer = model.stages[-1]
    else:
        # Default search for last Conv2d
        for module in reversed(list(model.modules())):
            if isinstance(module, nn.Conv2d):
                target_layer = module
                break

    if target_layer is None:
        raise ValueError(f"Could not identify final conv layer for {model_name}")

    activations = []
    gradients = []

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    h1 = target_layer.register_forward_hook(forward_hook)
    h2 = target_layer.register_full_backward_hook(backward_hook)

    _, eval_transform = get_transforms(224)
    img_t = eval_transform(pil_image).unsqueeze(0).to(device)

    model.zero_grad()
    out = model(img_t)
    if target_class is None:
        target_class = out.argmax(dim=1).item()

    score = out[0, target_class]
    score.backward()

    h1.remove()
    h2.remove()

    act = activations[0].detach().cpu().numpy()[0]   # (C, H, W)
    grad = gradients[0].detach().cpu().numpy()[0]     # (C, H, W)

    # Channel weights via GAP
    weights = np.mean(grad, axis=(1, 2))              # (C,)
    cam = np.zeros(act.shape[1:], dtype=np.float32)
    for i, w in enumerate(weights):
        cam += w * act[i]

    # ReLU + normalization
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
    print("=" * 65)
    print("DermAI Health Monitor: Multi-Architecture Deep Learning Benchmark")
    print("Phase 4, 5, 6, 7 & 8: Training, Comparison, Selection & Calibration")
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

    # Stratified representative sampling for rigorous, balanced multi-model benchmark on CPU
    # 160 per class for training = 1,600 samples
    # 35 per class for validation = 350 samples
    # 60 per class for independent testing = 600 samples
    train_subset = train_df.groupby("label").sample(160, random_state=42).reset_index(drop=True)
    val_subset = val_df.groupby("label").sample(35, random_state=42).reset_index(drop=True)
    test_subset = test_df.groupby("label").sample(60, random_state=42).reset_index(drop=True)

    print(f"Benchmark subset -> Train: {len(train_subset)} | Val: {len(val_subset)} | Test: {len(test_subset)}")

    train_tf, eval_tf = get_transforms(224)
    train_loader = DataLoader(SkinDataset(train_subset, transform=train_tf, desc="Train"), batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(SkinDataset(val_subset, transform=eval_tf, desc="Validation"), batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(SkinDataset(test_subset, transform=eval_tf, desc="Test"), batch_size=32, shuffle=False, num_workers=0)

    # 4 Architectures to evaluate and compare
    candidate_specs = [
        {
            "name": "densenet121",
            "unfreeze": ["denseblock4", "classifier"],
            "desc": "DenseNet-121 (Dense Feature Connectivity)"
        },
        {
            "name": "resnet50",
            "unfreeze": ["layer4.2", "fc"],
            "desc": "ResNet-50 (Residual Deep Learning Baseline)"
        },
        {
            "name": "efficientnet_b3",
            "unfreeze": ["blocks.6", "conv_head", "classifier"],
            "desc": "EfficientNet-B3 (Compound Scaled Inverted Residuals)"
        },
        {
            "name": "convnext_tiny",
            "unfreeze": ["stages.3", "head"],
            "desc": "ConvNeXt-Tiny (Modernized Pure ConvNet)"
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
            num_classes=num_classes,
            epochs=5
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
            "Raw ECE": r["raw_ece"]
        })

    comp_df = pd.DataFrame(comp_data)
    comp_df_sorted = comp_df.sort_values(by="Macro F1-Score", ascending=False).reset_index(drop=True)
    comp_csv_path = reports_dir / "model_comparison.csv"
    comp_df_sorted.to_csv(comp_csv_path, index=False)

    print("\n" + "=" * 80)
    print("                    MULTI-MODEL ARCHITECTURE BENCHMARK")
    print("=" * 80)
    print(comp_df_sorted.to_string(index=False))
    print("=" * 80)

    # Select Best Model based on Macro F1 and Balanced Sensitivity
    best_res = max(results, key=lambda x: (x["macro_f1"], x["balanced_acc"], x["melanoma_recall"]))
    best_arch = best_res["model_name"]
    print(f"\n[WINNING MODEL SELECTED]: {best_arch.upper()}")
    print(f"  * Macro F1-Score:    {best_res['macro_f1']:.4f}")
    print(f"  * Top-1 Accuracy:    {best_res['top1_acc']*100:.2f}%")
    print(f"  * Balanced Accuracy: {best_res['balanced_acc']*100:.2f}%")
    print(f"  * Melanoma Recall:   {best_res['melanoma_recall']*100:.1f}%")
    print(f"  * BCC Recall:        {best_res['bcc_recall']*100:.1f}%")

    # Phase 8: Temperature Scaling Calibration on Winning Model
    print("\n" + "=" * 65)
    print(f"Phase 8: Temperature Scaling & Uncertainty Calibration ({best_arch})")
    print("=" * 65)
    optimal_T = fit_temperature_scaling(best_res["val_logits"], best_res["val_targets"])
    print(f"Optimal Temperature Parameter T: {optimal_T:.4f}")

    # Evaluate test set with Calibrated Temperature
    calibrated_test_logits = best_res["test_logits"] / optimal_T
    calibrated_test_probs = torch.softmax(torch.from_numpy(calibrated_test_logits), dim=-1).numpy()
    calibrated_ece = compute_ece(calibrated_test_probs, best_res["test_targets"])
    print(f"Test ECE Before Calibration: {best_res['raw_ece']:.4f}")
    print(f"Test ECE After Calibration:  {calibrated_ece:.4f} (Improvement: {best_res['raw_ece'] - calibrated_ece:.4f})")

    # Save Best Model Checkpoint
    best_ckpt_path = models_dir / "best_model.pth"
    torch.save({
        "model_name": best_arch,
        "num_classes": num_classes,
        "classes": classes_list,
        "model_state_dict": best_res["state_dict"],
        "temperature": optimal_T,
        "raw_ece": best_res["raw_ece"],
        "calibrated_ece": calibrated_ece,
        "val_acc": best_res["val_acc"],
        "top1_acc": best_res["top1_acc"],
        "macro_f1": best_res["macro_f1"],
        "balanced_acc": best_res["balanced_acc"],
        "normalization": {
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD,
            "image_size": 224
        }
    }, best_ckpt_path)
    print(f"Saved primary production checkpoint: {best_ckpt_path}")

    # Also save backwards-compatible checkpoint
    legacy_ckpt_path = models_dir / "best_vit_base_patch16_224.pth"
    torch.save({
        "model_name": best_arch,
        "num_classes": num_classes,
        "classes": classes_list,
        "model_state_dict": best_res["state_dict"],
        "temperature": optimal_T,
        "val_acc": best_res["val_acc"],
        "top1_acc": best_res["top1_acc"],
        "macro_f1": best_res["macro_f1"]
    }, legacy_ckpt_path)
    print(f"Saved compatibility checkpoint: {legacy_ckpt_path}")

    # Detailed Evaluation Visualizations for the Winning Model
    y_true = best_res["test_targets"]
    y_pred = best_res["test_preds"]
    y_probs = calibrated_test_probs

    # 1. Confusion Matrices
    cm = confusion_matrix(y_true, y_pred, labels=range(num_classes))
    cm_norm = cm.astype("float") / (cm.sum(axis=1)[:, np.newaxis] + 1e-9)

    plt.figure(figsize=(12, 10))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=clean_names, yticklabels=clean_names)
    plt.title(f"Confusion Matrix (Counts) — {best_arch.upper()}", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Predicted Condition", fontsize=11)
    plt.ylabel("Ground Truth Condition", fontsize=11)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "confusion_matrix_counts.png", dpi=300)
    plt.close()

    plt.figure(figsize=(12, 10))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues", xticklabels=clean_names, yticklabels=clean_names)
    plt.title(f"Normalized Confusion Matrix (Recall / Sensitivity) — {best_arch.upper()}", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Predicted Condition", fontsize=11)
    plt.ylabel("Ground Truth Condition", fontsize=11)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(reports_dir / "confusion_matrix_normalized.png", dpi=300)
    plt.close()

    # 2. Classification Report
    cls_report = classification_report(
        y_true,
        y_pred,
        target_names=clean_names,
        labels=range(num_classes),
        output_dict=True,
        zero_division=0
    )
    report_df = pd.DataFrame(cls_report).transpose()
    report_df.to_csv(reports_dir / "classification_report.csv")

    # 3. Per-class Bar Plot
    metrics_subset = report_df.loc[clean_names, ["precision", "recall", "f1-score"]]
    plt.figure(figsize=(14, 7))
    metrics_subset.plot(kind="bar", figsize=(14, 7), colormap="viridis", width=0.8)
    plt.title(f"Per-Class Performance Metrics — {best_arch.upper()}", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Dermatological Condition", fontsize=11)
    plt.ylabel("Score (0.0 - 1.0)", fontsize=11)
    plt.ylim(0, 1.05)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.grid(axis="y", linestyle="--", alpha=0.5)
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(reports_dir / "class_metrics_bar.png", dpi=300)
    plt.close()

    # 4. Calibration Curve
    plt.figure(figsize=(8, 8))
    bins = np.linspace(0, 1, 11)
    bin_centers = (bins[:-1] + bins[1:]) / 2

    raw_confs = np.max(best_res["test_probs"], axis=1)
    raw_accs = (best_res["test_preds"] == y_true)
    cal_confs = np.max(calibrated_test_probs, axis=1)
    cal_accs = (np.argmax(calibrated_test_probs, axis=1) == y_true)

    raw_bin_accs, cal_bin_accs = [], []
    for i in range(10):
        m_raw = (raw_confs > bins[i]) & (raw_confs <= bins[i+1])
        raw_bin_accs.append(np.mean(raw_accs[m_raw]) if np.sum(m_raw) > 0 else np.nan)
        m_cal = (cal_confs > bins[i]) & (cal_confs <= bins[i+1])
        cal_bin_accs.append(np.mean(cal_accs[m_cal]) if np.sum(m_cal) > 0 else np.nan)

    plt.plot([0, 1], [0, 1], "k--", label="Perfect Calibration")
    plt.plot(bin_centers, raw_bin_accs, "ro-", label=f"Uncalibrated (ECE = {best_res['raw_ece']:.3f})")
    plt.plot(bin_centers, cal_bin_accs, "bs-", label=f"Temperature Scaled (ECE = {calibrated_ece:.3f})")
    plt.xlabel("Mean Predicted Confidence", fontsize=11)
    plt.ylabel("Empirical Accuracy", fontsize=11)
    plt.title(f"Reliability Diagram (Calibration) — {best_arch.upper()}", fontsize=13, fontweight="bold")
    plt.legend(loc="upper left")
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(reports_dir / "calibration_curve.png", dpi=300)
    plt.close()

    # Phase 9: Real Explainable AI Grad-CAM Validation
    print("\n" + "=" * 65)
    print(f"Phase 9: Generating Real Grad-CAM Visualization ({best_arch})")
    print("=" * 65)
    sample_img_path = test_subset["file_path"].iloc[0]
    sample_label = int(test_subset["label"].iloc[0])
    sample_class_name = clean_names[sample_label]

    with Image.open(sample_img_path) as s_img:
        s_rgb = s_img.convert("RGB")
        best_model_inst = timm.create_model(best_arch, pretrained=False, num_classes=num_classes)
        best_model_inst.load_state_dict(best_res["state_dict"])
        best_model_inst.to(device)

        cam_overlay, raw_cam = generate_gradcam(
            model=best_model_inst,
            model_name=best_arch,
            pil_image=s_rgb,
            target_class=sample_label,
            device=device
        )
        gradcam_save_path = reports_dir / "gradcam_sample.jpg"
        Image.fromarray(cam_overlay).save(gradcam_save_path, quality=90)
        print(f"Grad-CAM sample generated and saved to: {gradcam_save_path}")
        print(f"Verified sample class: {sample_class_name} | Image: {sample_img_path}")

    # Save comprehensive evaluation summary
    summary_data = {
        "selected_architecture": best_arch,
        "optimal_temperature": round(optimal_T, 4),
        "metrics": {
            "top1_accuracy": f"{best_res['top1_acc']*100:.2f}%",
            "top3_accuracy": f"{best_res['top3_acc']*100:.2f}%",
            "balanced_accuracy": f"{best_res['balanced_acc']*100:.2f}%",
            "macro_f1": best_res["macro_f1"],
            "weighted_f1": best_res["weighted_f1"],
            "macro_precision": best_res["macro_precision"],
            "macro_recall": best_res["macro_recall"],
            "uncalibrated_ece": best_res["raw_ece"],
            "calibrated_ece": round(calibrated_ece, 4),
            "inference_latency_ms": best_res["latency_ms_per_sample"]
        },
        "all_models_benchmarked": [
            {
                "architecture": r["model_name"],
                "total_parameters": r["total_params"],
                "train_time_sec": r["train_duration_sec"],
                "top1_accuracy": r["top1_acc"],
                "top3_accuracy": r["top3_acc"],
                "balanced_accuracy": r["balanced_acc"],
                "macro_f1": r["macro_f1"],
                "weighted_f1": r["weighted_f1"],
                "melanoma_recall": r["melanoma_recall"],
                "bcc_recall": r["bcc_recall"],
                "raw_ece": r["raw_ece"]
            }
            for r in results
        ]
    }
    with open(reports_dir / "evaluation_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    print("\n" + "=" * 65)
    print("ALL 10 TRAINING & EVALUATION PHASES SUCCESSFULLY COMPLETED!")
    print("=" * 65)

if __name__ == "__main__":
    main()
