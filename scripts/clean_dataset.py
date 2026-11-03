import os
import sys
import json
import argparse
import pandas as pd
from pathlib import Path
from collections import defaultdict

def clean_dataset(
    metadata_csv: str = "reports/dataset_analysis/image_level_metadata.csv",
    output_dir: str = "processed_dataset",
    reports_dir: str = "reports",
    quarantine_dir: str = "quarantine"
):
    print("=" * 65)
    print("Phase 2: Dataset Cleaning & De-duplication")
    print("=" * 65)

    meta_path = Path(metadata_csv)
    if not meta_path.exists():
        raise FileNotFoundError(f"Metadata file not found: {meta_path}. Please run analyze_dataset.py first.")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    rep_path = Path(reports_dir)
    rep_path.mkdir(parents=True, exist_ok=True)
    quar_path = Path(quarantine_dir)
    quar_path.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(meta_path)
    total_images = len(df)
    print(f"Loaded metadata for {total_images:,} images.")

    cleaning_logs = []
    cleaned_records = []

    # Step 1: Identify corrupted files
    corrupted_mask = df["is_corrupted"] == True
    corrupted_count = corrupted_mask.sum()

    for _, row in df[corrupted_mask].iterrows():
        cleaning_logs.append({
            "file_path": row["file_path"],
            "file_name": row["file_name"],
            "class_name": row["class_name"],
            "md5": row.get("md5", ""),
            "problem": f"Corrupted: {row.get('corruption_error', 'Unreadable')}",
            "action": "Quarantine / Exclude"
        })

    valid_df = df[~corrupted_mask].copy()

    # Step 2: Identify Cross-Class Duplicates (Label Ambiguity/Contradiction)
    md5_to_classes = valid_df.groupby("md5")["class_name"].unique().to_dict()
    cross_class_md5s = {md5 for md5, classes in md5_to_classes.items() if len(classes) > 1}
    print(f"Identified {len(cross_class_md5s):,} MD5 hashes appearing in multiple conflicting classes.")

    # Step 3: Deduplicate Within-Class & Exclude Cross-Class Conflicts
    seen_within_class_md5 = set()

    for _, row in valid_df.iterrows():
        md5_val = row["md5"]
        class_name = row["class_name"]
        file_path = row["file_path"]
        file_name = row["file_name"]

        # Case A: Cross-Class Duplicate -> Quarantine
        if md5_val in cross_class_md5s:
            conflicting_classes = ", ".join(md5_to_classes[md5_val])
            cleaning_logs.append({
                "file_path": file_path,
                "file_name": file_name,
                "class_name": class_name,
                "md5": md5_val,
                "problem": f"Cross-class duplicate across: [{conflicting_classes}]",
                "action": "Quarantine (Excluded from clean dataset)"
            })
            continue

        # Case B: Within-Class Duplicate -> Keep first copy, drop redundant duplicates
        unique_key = (class_name, md5_val)
        if unique_key in seen_within_class_md5:
            cleaning_logs.append({
                "file_path": file_path,
                "file_name": file_name,
                "class_name": class_name,
                "md5": md5_val,
                "problem": "Exact duplicate (identical image within same class)",
                "action": "Deduplicate (Removed redundant copy, canonical copy retained)"
            })
            continue

        # Valid canonical image
        seen_within_class_md5.add(unique_key)
        cleaned_records.append(row.to_dict())
        cleaning_logs.append({
            "file_path": file_path,
            "file_name": file_name,
            "class_name": class_name,
            "md5": md5_val,
            "problem": "None",
            "action": "Retain in cleaned dataset"
        })

    # Save Cleaning Log
    cleaning_report_df = pd.DataFrame(cleaning_logs)
    cleaning_report_path = rep_path / "dataset_cleaning_report.csv"
    cleaning_report_df.to_csv(cleaning_report_path, index=False)
    print(f"Saved dataset cleaning report to: {cleaning_report_path}")

    # Save Cleaned Manifest
    cleaned_df = pd.DataFrame(cleaned_records)
    cleaned_manifest_path = out_path / "cleaned_manifest.csv"
    cleaned_df.to_csv(cleaned_manifest_path, index=False)
    print(f"Saved cleaned dataset manifest to: {cleaned_manifest_path}")

    # Print Summary
    quarantined_count = len(cleaning_report_df[cleaning_report_df["action"].str.contains("Quarantine")])
    deduped_count = len(cleaning_report_df[cleaning_report_df["action"].str.contains("Deduplicate")])
    retained_count = len(cleaned_df)

    print("\nCleaning Summary:")
    print(f"  Total Raw Images Evaluated: {total_images:,}")
    print(f"  Corrupted / Unreadable:    {corrupted_count:,}")
    print(f"  Cross-Class Quarantined:   {quarantined_count:,}")
    print(f"  Within-Class Deduplicated: {deduped_count:,}")
    print(f"  Clean Retained Images:     {retained_count:,} ({retained_count/total_images*100:.2f}%)")
    print("=" * 65)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean skin disease dataset")
    parser.add_argument("--metadata_csv", type=str, default="reports/dataset_analysis/image_level_metadata.csv")
    parser.add_argument("--output_dir", type=str, default="processed_dataset")
    parser.add_argument("--reports_dir", type=str, default="reports")
    parser.add_argument("--quarantine_dir", type=str, default="quarantine")
    args = parser.parse_args()

    clean_dataset(args.metadata_csv, args.output_dir, args.reports_dir, args.quarantine_dir)
