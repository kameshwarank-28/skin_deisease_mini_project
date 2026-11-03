import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    top_k_accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score
)
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dataset import SkinDiseaseDataset, DataLoader
from models import build_model

def parse_args():
    parser = argparse.ArgumentParser(description="Comprehensive Dermatological Model Evaluation Suite")
    parser.add_argument("--checkpoint", type=str, default="models/best_vit_base_patch16_224.pth", help="Path to checkpoint")
    parser.add_argument("--manifest", type=str, default="processed_dataset/test_manifest.csv", help="Test manifest CSV")
    parser.add_argument("--classes", type=str, default="processed_dataset/classes.json", help="Classes JSON file")
    parser.add_argument("--output-dir", type=str, default="reports/evaluation", help="Directory for evaluation metrics")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--max-samples", type=int, default=None, help="Limit test samples for quick evaluation")
    parser.add_argument("--device", type=str, default=None, help="Device (cuda or cpu)")
    return parser.parse_args()

def clean_class_name(raw_name: str) -> str:
    parts = raw_name.split(".", 1)
    name = parts[1].strip() if len(parts) > 1 else raw_name
    tokens = name.split()
    if tokens and tokens[-1].replace("k", "").replace(".", "").isdigit():
        tokens.pop()
    return " ".join(tokens).strip()

def calculate_entropy(probs):
    eps = 1e-9
    return -np.sum(probs * np.log(probs + eps), axis=-1)

def plot_confusion_matrices(cm, class_names, output_dir: Path):
    # 1. Raw Count CM
    plt.figure(figsize=(12, 10))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=class_names, yticklabels=class_names)
    plt.title("Confusion Matrix (Counts) — Skin Disease Classification", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Predicted Label", fontsize=12)
    plt.ylabel("Ground Truth Label", fontsize=12)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(output_dir / "confusion_matrix_counts.png", dpi=300)
    plt.close()

    # 2. Normalized CM
    cm_norm = cm.astype("float") / (cm.sum(axis=1)[:, np.newaxis] + 1e-9)
    plt.figure(figsize=(12, 10))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues", xticklabels=class_names, yticklabels=class_names)
    plt.title("Normalized Confusion Matrix (Recall / Sensitivity)", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Predicted Label", fontsize=12)
    plt.ylabel("Ground Truth Label", fontsize=12)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    plt.savefig(output_dir / "confusion_matrix_normalized.png", dpi=300)
    plt.close()

def plot_per_class_metrics(report_df, class_names, output_dir: Path):
    metrics_subset = report_df.loc[class_names, ["precision", "recall", "f1-score"]]
    ax = metrics_subset.plot(kind="bar", figsize=(14, 7), colormap="viridis", width=0.8)
    plt.title("Per-Class Performance Metrics (Precision, Recall, F1-Score)", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Dermatological Condition", fontsize=12)
    plt.ylabel("Score (0.0 - 1.0)", fontsize=12)
    plt.ylim(0, 1.05)
    plt.xticks(rotation=40, ha="right", fontsize=9)
    plt.grid(axis="y", linestyle="--", alpha=0.5)
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(output_dir / "class_metrics_bar.png", dpi=300)
    plt.close()

def plot_uncertainty_analysis(entropies, correct_mask, output_dir: Path):
    plt.figure(figsize=(10, 6))
    sns.histplot(entropies[correct_mask], color="#34d399", label="Correct Predictions", kde=True, stat="density", bins=25, alpha=0.6)
    sns.histplot(entropies[~correct_mask], color="#f87171", label="Incorrect Predictions", kde=True, stat="density", bins=25, alpha=0.6)
    plt.axvline(x=1.5, color="#f59e0b", linestyle="--", label="Entropy Threshold (1.5)")
    plt.title("Shannon Entropy / Uncertainty Distribution Analysis", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Prediction Entropy H(p)", fontsize=12)
    plt.ylabel("Density", fontsize=12)
    plt.legend(loc="upper right")
    plt.tight_layout()
    plt.savefig(output_dir / "uncertainty_distribution.png", dpi=300)
    plt.close()

def main():
    args = parse_args()
    device = torch.device(args.device if args.device else ("cuda" if torch.cuda.is_available() else "cpu"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"============================================================")
    print(f"       DermAI Thorough Model Evaluation Suite               ")
    print(f"============================================================")
    print(f"Device: {device} | Output Directory: {output_dir}")

    # Load classes
    with open(args.classes, "r", encoding="utf-8") as f:
        class_info = json.load(f)
    classes_list = class_info.get("classes", [])
    clean_names = [clean_class_name(c) for c in classes_list]
    num_classes = len(classes_list)

    # Load test dataset
    test_manifest_df = pd.read_csv(args.manifest)
    if args.max_samples and len(test_manifest_df) > args.max_samples:
        test_manifest_df = test_manifest_df.groupby("label").sample(
            n=max(1, args.max_samples // num_classes), random_state=42
        ).reset_index(drop=True)
        print(f"Sampled {len(test_manifest_df)} test images for evaluation.")

    test_dataset = SkinDiseaseDataset(args.manifest, is_training=False)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    # Load model
    checkpoint_path = Path(args.checkpoint)
    if checkpoint_path.exists():
        print(f"Loading checkpoint weights from: {checkpoint_path}")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model_name = checkpoint.get("model_name", "resnet34")
        model = build_model(model_name=model_name, num_classes=num_classes, pretrained=False)
        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
        else:
            model.load_state_dict(checkpoint)
    else:
        print(f"Checkpoint not found at {checkpoint_path}. Testing with base model...")
        model = build_model(model_name="resnet34", num_classes=num_classes, pretrained=True)

    model.to(device)
    model.eval()

    all_preds, all_targets, all_probs, all_paths = [], [], [], []

    with torch.no_grad():
        for batch_idx, (images, targets) in enumerate(tqdm(test_loader, desc="Running Test Inference")):
            if args.max_samples and len(all_targets) >= args.max_samples:
                break
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1).cpu().numpy()
            preds = np.argmax(probs, axis=1)

            all_probs.extend(probs)
            all_preds.extend(preds)
            all_targets.extend(targets.numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)
    all_probs = np.array(all_probs)
    correct_mask = (all_preds == all_targets)

    # Comprehensive Metrics Computation
    acc_top1 = accuracy_score(all_targets, all_preds)
    try:
        acc_top3 = top_k_accuracy_score(all_targets, all_probs, k=min(3, num_classes))
    except Exception:
        acc_top3 = acc_top1

    macro_prec = precision_score(all_targets, all_preds, average="macro", zero_division=0)
    weighted_prec = precision_score(all_targets, all_preds, average="weighted", zero_division=0)
    macro_rec = recall_score(all_targets, all_preds, average="macro", zero_division=0)
    weighted_rec = recall_score(all_targets, all_preds, average="weighted", zero_division=0)
    macro_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)
    weighted_f1 = f1_score(all_targets, all_preds, average="weighted", zero_division=0)

    entropies = calculate_entropy(all_probs)
    mean_entropy = float(np.mean(entropies))
    uncertain_count = int(np.sum(entropies > 1.5))

    # Confusion matrix
    cm = confusion_matrix(all_targets, all_preds, labels=range(num_classes))

    # Top confused pairs
    confused_pairs = []
    for i in range(num_classes):
        for j in range(num_classes):
            if i != j and cm[i, j] > 0:
                confused_pairs.append({
                    "true_class": clean_names[i],
                    "predicted_as": clean_names[j],
                    "count": int(cm[i, j])
                })
    confused_pairs = sorted(confused_pairs, key=lambda x: x["count"], reverse=True)[:5]

    # Classification Report
    report_dict = classification_report(
        all_targets,
        all_preds,
        target_names=clean_names,
        labels=range(num_classes),
        output_dict=True,
        zero_division=0
    )
    report_df = pd.DataFrame(report_dict).transpose()
    report_df.to_csv(output_dir / "classification_report.csv")
    with open(output_dir / "classification_report.json", "w", encoding="utf-8") as f:
        json.dump(report_dict, f, indent=2)

    # Summary dictionary
    summary = {
        "evaluation_dataset_size": int(len(all_targets)),
        "metrics": {
            "top1_accuracy": round(float(acc_top1), 4),
            "top3_accuracy": round(float(acc_top3), 4),
            "macro_precision": round(float(macro_prec), 4),
            "weighted_precision": round(float(weighted_prec), 4),
            "macro_recall": round(float(macro_rec), 4),
            "weighted_recall": round(float(weighted_rec), 4),
            "macro_f1": round(float(macro_f1), 4),
            "weighted_f1": round(float(weighted_f1), 4),
            "mean_uncertainty_entropy": round(mean_entropy, 4),
            "high_uncertainty_samples": uncertain_count,
            "high_uncertainty_pct": f"{uncertain_count / len(all_targets) * 100:.2f}%"
        },
        "top_confused_class_pairs": confused_pairs
    }
    with open(output_dir / "evaluation_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Visual Artifacts
    plot_confusion_matrices(cm, clean_names, output_dir)
    plot_per_class_metrics(report_df, clean_names, output_dir)
    plot_uncertainty_analysis(entropies, correct_mask, output_dir)

    print("\n" + "="*55)
    print("           EVALUATION SUITE RESULTS SUMMARY")
    print("="*55)
    print(f"  * Total Test Samples:       {len(all_targets)}")
    print(f"  * Top-1 Accuracy:           {acc_top1 * 100:.2f}%")
    print(f"  * Top-3 Accuracy:           {acc_top3 * 100:.2f}%")
    print(f"  * Macro F1-Score:           {macro_f1:.4f}")
    print(f"  * Weighted F1-Score:        {weighted_f1:.4f}")
    print(f"  * Macro Precision:          {macro_prec:.4f}")
    print(f"  * Macro Recall:             {macro_rec:.4f}")
    print(f"  * Mean Entropy Uncertainty: {mean_entropy:.4f}")
    print("="*55)
    print(f"[OK] Artifacts Generated in '{output_dir}/':")
    print(f"    - confusion_matrix_counts.png")
    print(f"    - confusion_matrix_normalized.png")
    print(f"    - class_metrics_bar.png")
    print(f"    - uncertainty_distribution.png")
    print(f"    - classification_report.csv / .json")
    print(f"    - evaluation_summary.json")

if __name__ == "__main__":
    main()
