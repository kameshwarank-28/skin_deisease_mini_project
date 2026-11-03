import os
import sys
import json
import argparse
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split

def split_dataset(
    cleaned_manifest_csv: str = "processed_dataset/cleaned_manifest.csv",
    output_dir: str = "processed_dataset",
    reports_dir: str = "reports",
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42
):
    print("=" * 65)
    print("Phase 3 & 4: Stratified Train / Validation / Test Splitting")
    print(f"Split ratios: {train_ratio*100:.0f}% Train / {val_ratio*100:.0f}% Val / {test_ratio*100:.0f}% Test (Seed={seed})")
    print("=" * 65)

    manifest_path = Path(cleaned_manifest_csv)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Cleaned manifest not found: {manifest_path}. Please run clean_dataset.py first.")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    rep_path = Path(reports_dir)
    rep_path.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(manifest_path)
    total_images = len(df)
    print(f"Loaded {total_images:,} cleaned images.")

    # Generate Class Mapping
    unique_classes = sorted(df["class_name"].unique())
    class_to_idx = {c: idx for idx, c in enumerate(unique_classes)}
    idx_to_class = {idx: c for idx, c in enumerate(unique_classes)}

    df["label"] = df["class_name"].map(class_to_idx)

    # Save classes.json
    classes_info = {
        "num_classes": len(unique_classes),
        "class_to_idx": class_to_idx,
        "idx_to_class": idx_to_class,
        "classes": unique_classes
    }
    classes_json_path = out_path / "classes.json"
    with open(classes_json_path, "w", encoding="utf-8") as f:
        json.dump(classes_info, f, indent=2)
    print(f"Saved class metadata mapping ({len(unique_classes)} classes) to: {classes_json_path}")

    # First split: Train vs Temp (Val + Test)
    temp_ratio = val_ratio + test_ratio
    train_df, temp_df = train_test_split(
        df,
        test_size=temp_ratio,
        stratify=df["label"],
        random_state=seed
    )

    # Second split: Val vs Test
    relative_test_ratio = test_ratio / temp_ratio
    val_df, test_df = train_test_split(
        temp_df,
        test_size=relative_test_ratio,
        stratify=temp_df["label"],
        random_state=seed
    )

    # Verification: Zero Hash Leakage Across Splits
    train_hashes = set(train_df["md5"])
    val_hashes = set(val_df["md5"])
    test_hashes = set(test_df["md5"])

    leak_train_val = train_hashes.intersection(val_hashes)
    leak_train_test = train_hashes.intersection(test_hashes)
    leak_val_test = val_hashes.intersection(test_hashes)

    if leak_train_val or leak_train_test or leak_val_test:
        raise ValueError(
            f"DATA LEAKAGE DETECTED! "
            f"Train-Val: {len(leak_train_val)}, Train-Test: {len(leak_train_test)}, Val-Test: {len(leak_val_test)}"
        )
    print("VERIFIED: Zero data leakage. 0 shared image hashes between Train, Val, and Test splits.")

    # Save manifests
    train_manifest_path = out_path / "train_manifest.csv"
    val_manifest_path = out_path / "val_manifest.csv"
    test_manifest_path = out_path / "test_manifest.csv"

    train_df.to_csv(train_manifest_path, index=False)
    val_df.to_csv(val_manifest_path, index=False)
    test_df.to_csv(test_manifest_path, index=False)

    print(f"Saved Train manifest: {train_manifest_path} ({len(train_df):,} images, {len(train_df)/total_images*100:.1f}%)")
    print(f"Saved Val manifest:   {val_manifest_path} ({len(val_df):,} images, {len(val_df)/total_images*100:.1f}%)")
    print(f"Saved Test manifest:  {test_manifest_path} ({len(test_df):,} images, {len(test_df)/total_images*100:.1f}%)")

    # Per-class split statistics
    split_stats = []
    for c_name, c_idx in class_to_idx.items():
        n_train = len(train_df[train_df["label"] == c_idx])
        n_val = len(val_df[val_df["label"] == c_idx])
        n_test = len(test_df[test_df["label"] == c_idx])
        n_total = n_train + n_val + n_test

        split_stats.append({
            "class_idx": c_idx,
            "class_name": c_name,
            "train_count": n_train,
            "val_count": n_val,
            "test_count": n_test,
            "total_count": n_total,
            "train_pct": round(n_train / n_total * 100, 1),
            "val_pct": round(n_val / n_total * 100, 1),
            "test_pct": round(n_test / n_total * 100, 1),
        })

    split_stats_df = pd.DataFrame(split_stats)
    split_report_path = rep_path / "dataset_split_report.csv"
    split_stats_df.to_csv(split_report_path, index=False)
    print(f"Saved split distribution report to: {split_report_path}")

    # High-level split summary
    summary = {
        "random_seed": seed,
        "total_images": total_images,
        "train_count": len(train_df),
        "val_count": len(val_df),
        "test_count": len(test_df),
        "train_ratio": train_ratio,
        "val_ratio": val_ratio,
        "test_ratio": test_ratio,
        "leakage_verified": True,
        "class_counts": split_stats
    }
    split_json_path = rep_path / "dataset_split_summary.json"
    with open(split_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved split summary JSON to: {split_json_path}")
    print("=" * 65)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Split cleaned skin disease dataset")
    parser.add_argument("--cleaned_manifest", type=str, default="processed_dataset/cleaned_manifest.csv")
    parser.add_argument("--output_dir", type=str, default="processed_dataset")
    parser.add_argument("--reports_dir", type=str, default="reports")
    parser.add_argument("--train_ratio", type=float, default=0.70)
    parser.add_argument("--val_ratio", type=float, default=0.15)
    parser.add_argument("--test_ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    split_dataset(
        args.cleaned_manifest,
        args.output_dir,
        args.reports_dir,
        args.train_ratio,
        args.val_ratio,
        args.test_ratio,
        args.seed
    )
