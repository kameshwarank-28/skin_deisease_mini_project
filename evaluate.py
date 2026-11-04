import os
import sys
import json
import time
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
from torchvision import transforms
from torch.utils.data import Dataset, DataLoader
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

def compute_ece(probs: np.ndarray, targets: np.ndarray, n_bins: int = 10) -> float:
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == targets)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total_samples = len(targets)

    for i in range(n_bins):
        b_low, b_high = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > b_low) & (confidences <= b_high)
        if np.sum(in_bin) > 0:
            bin_acc = np.mean(accuracies[in_bin])
            bin_conf = np.mean(confidences[in_bin])
            ece += np.abs(bin_acc - bin_conf) * (np.sum(in_bin) / total_samples)

    return float(ece)

def compute_brier(probs: np.ndarray, targets: np.ndarray) -> float:
    one_hot = np.zeros_like(probs)
    for i, t in enumerate(targets):
        one_hot[i, t] = 1.0
    return float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))

class SimpleTestDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform, image_size: int = 224):
        self.file_paths = df["file_path"].tolist()
        self.labels = df["label"].tolist()
        self.transform = transform
        self.image_size = image_size

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        path = self.file_paths[idx]
        label = self.labels[idx]
        try:
            with Image.open(path) as img:
                tensor = self.transform(img.convert("RGB"))
        except Exception:
            tensor = self.transform(Image.new("RGB", (self.image_size, self.image_size), (128, 128, 128)))
        return tensor, torch.tensor(label, dtype=torch.long)

def main():
    parser = argparse.ArgumentParser(description="DermAI Model Evaluation CLI")
    parser.add_argument("--checkpoint", type=str, default="models/best_model.pth")
    parser.add_argument("--test_manifest", type=str, default="processed_dataset/test_manifest.csv")
    parser.add_argument("--output_dir", type=str, default="reports/evaluation")
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--max_samples", type=int, default=700, help="Max test samples to evaluate for fast CLI response")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 65)
    print(f"DERMAI MODEL EVALUATION: {args.checkpoint}")
    print(f"Device: {device}")
    print("=" * 65)

    ckpt_path = Path(args.checkpoint)
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    checkpoint = torch.load(ckpt_path, map_location=device)
    model_name = checkpoint.get("model_name", "efficientnetv2_s")
    timm_key = checkpoint.get("timm_model_name", checkpoint.get("timm_key", model_name))
    num_classes = checkpoint.get("num_classes", 10)
    classes_list = checkpoint.get("classes", [])
    clean_names = [clean_class_name(c) for c in classes_list]
    temperature = float(checkpoint.get("temperature", 1.0))
    image_size = int(checkpoint.get("training_resolution", 224))

    # Clean name translation for timm
    if timm_key in ["efficientnetv2_s", "efficientnet_v2_s"]:
        timm_key = "tf_efficientnetv2_s"
    elif timm_key in ["dinov2_vitb14", "dinov2"]:
        timm_key = "vit_base_patch14_dinov2.lvd142m"

    print(f"Loading {timm_key} (Temperature T={temperature:.4f}, Res={image_size}x{image_size})...")
    model = timm.create_model(timm_key, pretrained=False, num_classes=num_classes)
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)
    model.to(device)
    model.eval()

    eval_tf = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    test_df = pd.read_csv(args.test_manifest)
    if args.max_samples and len(test_df) > args.max_samples:
        per_class = max(1, args.max_samples // num_classes)
        test_df = test_df.groupby("label").sample(per_class, random_state=42).reset_index(drop=True)
    print(f"Loaded {len(test_df):,} test images for evaluation.")
    test_loader = DataLoader(SimpleTestDataset(test_df, eval_tf, image_size=image_size), batch_size=args.batch_size, shuffle=False)

    logits_list, targets_list, latencies = [], [], []
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs = imgs.to(device)
            t0 = time.time()
            out = model(imgs)
            latencies.append((time.time() - t0) / imgs.size(0))
            logits_list.append(out.cpu().numpy())
            targets_list.append(labels.numpy())

    logits = np.concatenate(logits_list, axis=0)
    targets = np.concatenate(targets_list, axis=0)
    avg_latency_ms = float(np.mean(latencies) * 1000.0)

    # Raw probabilities
    raw_probs = torch.softmax(torch.from_numpy(logits), dim=-1).numpy()
    raw_preds = np.argmax(raw_probs, axis=1)

    # Calibrated probabilities
    cal_probs = torch.softmax(torch.from_numpy(logits / temperature), dim=-1).numpy()
    cal_preds = np.argmax(cal_probs, axis=1)

    # Compute Metrics
    top1_acc = float(accuracy_score(targets, raw_preds))
    top3_acc = float(top_k_accuracy_score(targets, raw_probs, k=3))
    bal_acc = float(balanced_accuracy_score(targets, raw_preds))
    macro_prec = float(precision_score(targets, raw_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(targets, raw_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(targets, raw_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(targets, raw_preds, average="weighted", zero_division=0))

    raw_ece = compute_ece(raw_probs, targets)
    cal_ece = compute_ece(cal_probs, targets)
    raw_brier = compute_brier(raw_probs, targets)
    cal_brier = compute_brier(cal_probs, targets)

    print("\n" + "=" * 65)
    print("INDEPENDENT TEST SET RESULTS")
    print("=" * 65)
    print(f"Top-1 Accuracy:       {top1_acc*100:.2f}%")
    print(f"Top-3 Accuracy:       {top3_acc*100:.2f}%")
    print(f"Balanced Accuracy:    {bal_acc*100:.2f}%")
    print(f"Macro F1-Score:       {macro_f1:.4f}")
    print(f"Weighted F1-Score:    {weighted_f1:.4f}")
    print(f"Macro Precision:      {macro_prec:.4f}")
    print(f"Macro Recall:         {macro_rec:.4f}")
    print(f"Inference Latency:    {avg_latency_ms:.2f} ms/sample")
    print(f"Calibration ECE:      {raw_ece:.4f} -> {cal_ece:.4f} (Calibrated)")
    print(f"Brier Score:          {raw_brier:.4f} -> {cal_brier:.4f} (Calibrated)")
    print("=" * 65)

    os.makedirs(args.output_dir, exist_ok=True)
    out_path = Path(args.output_dir)

    # Classification Report
    clf_rep = classification_report(targets, raw_preds, target_names=clean_names, output_dict=True, zero_division=0)
    pd.DataFrame(clf_rep).transpose().to_csv(out_path / f"classification_report_{model_name}.csv")

    # Confusion Matrix Plot
    cm = confusion_matrix(targets, raw_preds)
    cm_norm = cm.astype("float") / cm.sum(axis=1)[:, np.newaxis]
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=[clean_names[i][:15] for i in range(num_classes)],
                yticklabels=[clean_names[i][:15] for i in range(num_classes)])
    plt.xlabel("Predicted Disease Class", fontweight="bold")
    plt.ylabel("True Disease Class", fontweight="bold")
    plt.title(f"Normalized Confusion Matrix: {model_name.upper()} (Test Set)", fontweight="bold")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig(out_path / f"confusion_matrix_{model_name}.png", dpi=300)
    plt.close()

    # Per-Class F1 Plot
    per_f1 = [clf_rep[cn]["f1-score"] for cn in clean_names]
    plt.figure(figsize=(9, 5))
    bars = plt.barh(clean_names, per_f1, color="#0d9488")
    plt.xlabel("F1-Score")
    plt.title(f"Per-Class F1-Scores: {model_name.upper()}", fontweight="bold")
    plt.xlim(0, 1.0)
    for b in bars:
        w_val = b.get_width()
        plt.text(w_val + 0.01, b.get_y() + b.get_height()/2, f"{w_val:.2f}", va="center", fontsize=9)
    plt.tight_layout()
    plt.savefig(out_path / f"per_class_f1_{model_name}.png", dpi=300)
    plt.close()

    # Save JSON summary
    summary = {
        "checkpoint": str(ckpt_path),
        "model_name": model_name,
        "temperature": temperature,
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "raw_ece": round(raw_ece, 4),
        "calibrated_ece": round(cal_ece, 4),
        "raw_brier": round(raw_brier, 4),
        "calibrated_brier": round(cal_brier, 4),
        "inference_latency_ms": round(avg_latency_ms, 2)
    }
    with open(out_path / f"eval_summary_{model_name}.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved evaluation artifacts to: {out_path}")

if __name__ == "__main__":
    main()
