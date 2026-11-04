import os
import sys
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn.functional as F
from torchvision import transforms
from torch.utils.data import Dataset, DataLoader
from scipy.optimize import minimize_scalar
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

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

class ValDataset(Dataset):
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
                t = self.transform(img.convert("RGB"))
        except Exception:
            t = self.transform(Image.new("RGB", (self.image_size, self.image_size), (128, 128, 128)))
        return t, torch.tensor(label, dtype=torch.long)

def fit_temperature(val_logits: np.ndarray, val_targets: np.ndarray) -> float:
    v_logits = torch.from_numpy(val_logits)
    v_targets = torch.from_numpy(val_targets)

    def nll_eval(t_val):
        t_val = max(1e-2, float(t_val))
        scaled = v_logits / t_val
        loss = F.cross_entropy(scaled, v_targets)
        return loss.item()

    res = minimize_scalar(nll_eval, bounds=(0.1, 5.0), method="bounded")
    return float(res.x)

def main():
    parser = argparse.ArgumentParser(description="DermAI Probability Calibration CLI")
    parser.add_argument("--checkpoint", type=str, default="models/best_model.pth")
    parser.add_argument("--val_manifest", type=str, default="processed_dataset/val_manifest.csv")
    parser.add_argument("--max_samples", type=int, default=400, help="Max validation samples for fast calibration")
    parser.add_argument("--output_diagram", type=str, default="reports/evaluation/calibration_diagram.png")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 65)
    print(f"DERMAI PROBABILITY CALIBRATION: {args.checkpoint}")
    print("=" * 65)

    ckpt_path = Path(args.checkpoint)
    checkpoint = torch.load(ckpt_path, map_location=device)
    model_name = checkpoint.get("model_name", "efficientnetv2_s")
    timm_key = checkpoint.get("timm_model_name", checkpoint.get("timm_key", model_name))
    if timm_key in ["efficientnetv2_s", "efficientnet_v2_s"]: timm_key = "tf_efficientnetv2_s"
    elif timm_key in ["dinov2_vitb14", "dinov2"]: timm_key = "vit_base_patch14_dinov2.lvd142m"

    num_classes = checkpoint.get("num_classes", 10)
    image_size = int(checkpoint.get("training_resolution", 224))

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

    val_df = pd.read_csv(args.val_manifest)
    if args.max_samples and len(val_df) > args.max_samples:
        per_class = max(1, args.max_samples // num_classes)
        val_df = val_df.groupby("label").sample(per_class, random_state=42).reset_index(drop=True)
    print(f"Loaded {len(val_df):,} validation images for calibration.")
    val_loader = DataLoader(ValDataset(val_df, eval_tf, image_size=image_size), batch_size=32, shuffle=False)

    logits_list, targets_list = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs = imgs.to(device)
            logits_list.append(model(imgs).cpu().numpy())
            targets_list.append(labels.numpy())

    val_logits = np.concatenate(logits_list, axis=0)
    val_targets = np.concatenate(targets_list, axis=0)

    # Raw metrics
    raw_probs = torch.softmax(torch.from_numpy(val_logits), dim=-1).numpy()
    raw_ece = compute_ece(raw_probs, val_targets)
    raw_brier = compute_brier(raw_probs, val_targets)

    # Temperature scaling
    optimal_t = fit_temperature(val_logits, val_targets)
    cal_logits = val_logits / optimal_t
    cal_probs = torch.softmax(torch.from_numpy(cal_logits), dim=-1).numpy()
    cal_ece = compute_ece(cal_probs, val_targets)
    cal_brier = compute_brier(cal_probs, val_targets)

    print(f"\nOptimization Results:")
    print(f"  Optimal Temperature T:    {optimal_t:.4f}")
    print(f"  Uncalibrated ECE:         {raw_ece:.4f}")
    print(f"  Calibrated ECE:           {cal_ece:.4f}  (Improvement: {raw_ece/cal_ece:.2f}x)")
    print(f"  Uncalibrated Brier Score: {raw_brier:.4f}")
    print(f"  Calibrated Brier Score:   {cal_brier:.4f}")

    # Update checkpoint with calibrated temperature
    checkpoint["temperature"] = optimal_t
    checkpoint["calibrated_ece"] = cal_ece
    checkpoint["raw_ece"] = raw_ece
    checkpoint["calibrated_brier"] = cal_brier
    torch.save(checkpoint, ckpt_path)
    print(f"\nUpdated checkpoint with calibrated temperature: {ckpt_path}")

    # Generate Reliability Diagram
    bin_boundaries = np.linspace(0, 1, 11)
    raw_confs = np.max(raw_probs, axis=1)
    cal_confs = np.max(cal_probs, axis=1)
    preds = np.argmax(raw_probs, axis=1)
    correct = (preds == val_targets)

    raw_bin_accs, cal_bin_accs, bin_centers = [], [], []
    for i in range(10):
        b_low, b_high = bin_boundaries[i], bin_boundaries[i+1]
        bin_centers.append((b_low + b_high) / 2)
        raw_mask = (raw_confs > b_low) & (raw_confs <= b_high)
        cal_mask = (cal_confs > b_low) & (cal_confs <= b_high)
        raw_bin_accs.append(np.mean(correct[raw_mask]) if np.sum(raw_mask) > 0 else np.nan)
        cal_bin_accs.append(np.mean(correct[cal_mask]) if np.sum(cal_mask) > 0 else np.nan)

    os.makedirs(Path(args.output_diagram).parent, exist_ok=True)
    plt.figure(figsize=(7, 6))
    plt.plot([0, 1], [0, 1], "k--", label="Perfect Calibration (Ideal)")
    plt.plot(bin_centers, raw_bin_accs, "s-", color="#dc2626", label=f"Uncalibrated (ECE={raw_ece:.3f})")
    plt.plot(bin_centers, cal_bin_accs, "o-", color="#059669", label=f"Calibrated (T={optimal_t:.2f}, ECE={cal_ece:.3f})")
    plt.xlabel("Mean Predicted Confidence")
    plt.ylabel("Observed Empirical Accuracy")
    plt.title("Reliability Diagram: Validation Set Temperature Scaling", fontweight="bold")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(args.output_diagram, dpi=300)
    plt.close()
    print(f"Saved reliability diagram to: {args.output_diagram}")
    print("=" * 65)

if __name__ == "__main__":
    main()
