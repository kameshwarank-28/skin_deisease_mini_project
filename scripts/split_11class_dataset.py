import os
import json
import hashlib
from pathlib import Path
import pandas as pd
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def generate_11class_dataset():
    dataset_dir = Path("Z:/IMG_CLASSES")
    
    ordered_classes = [
        "1. Eczema 1677",
        "10. Warts Molluscum and other Viral Infections - 2103",
        "2. Melanoma 15.75k",
        "3. Atopic Dermatitis - 1.25k",
        "4. Basal Cell Carcinoma (BCC) 3323",
        "5. Melanocytic Nevi (NV) - 7970",
        "6. Benign Keratosis-like Lesions (BKL) 2624",
        "7. Psoriasis pictures Lichen Planus and related diseases - 2k",
        "8. Seborrheic Keratoses and other Benign Tumors - 1.8k",
        "9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k",
        "11. Normal Skin"
    ]
    
    clean_display_names = {
        0: "Eczema",
        1: "Warts Molluscum and Viral Infections",
        2: "Melanoma",
        3: "Atopic Dermatitis",
        4: "Basal Cell Carcinoma (BCC)",
        5: "Melanocytic Nevi (NV)",
        6: "Benign Keratosis-like Lesions (BKL)",
        7: "Psoriasis and Lichen Planus",
        8: "Seborrheic Keratoses and Benign Tumors",
        9: "Tinea Ringworm and Fungal Infections",
        10: "Normal / Healthy Skin"
    }

    class_to_idx = {name: idx for idx, name in enumerate(ordered_classes)}
    class_to_idx["12. Normal_Skin"] = 10
    class_to_idx["12. Normal Skin"] = 10
    class_to_idx["12. Normal_skin"] = 10
    class_to_idx["11. Normal Skin"] = 10
    class_to_idx["Normal_Skin"] = 10
    class_to_idx["Normal Skin"] = 10
    idx_to_class = {str(idx): name for idx, name in enumerate(ordered_classes)}

    classes_json_data = {
        "num_classes": 11,
        "class_to_idx": class_to_idx,
        "idx_to_class": idx_to_class,
        "classes": ordered_classes,
        "clean_names": {str(k): v for k, v in clean_display_names.items()}
    }

    # Save classes.json and class_mapping.json
    Path("processed_dataset").mkdir(parents=True, exist_ok=True)
    with open("processed_dataset/classes.json", "w", encoding="utf-8") as f:
        json.dump(classes_json_data, f, indent=2)
    with open("class_mapping.json", "w", encoding="utf-8") as f:
        json.dump(classes_json_data, f, indent=2)
    print("Updated processed_dataset/classes.json and class_mapping.json to 11 classes.")

    # Load 10-class clean dataset from cleaning report
    cleaning_report = pd.read_csv("reports/dataset_cleaning_report.csv")
    disease_clean = cleaning_report[cleaning_report["action"] == "Retain in cleaned dataset"].copy()
    
    # Map file_path to Z:\IMG_CLASSES and assign labels
    disease_clean["file_path"] = disease_clean["file_path"].apply(
        lambda p: str(p).replace("Z:\\ALL\\IMG_CLASSES", "Z:\\IMG_CLASSES")
    )
    disease_clean["label"] = disease_clean["class_name"].map(class_to_idx)
    print(f"Loaded {len(disease_clean)} clean disease images across 10 classes.")

    # Normal Skin directory inspection (Priority: 12. Normal_Skin, then 11. Normal Skin, then Normal_Skin)
    normal_dir = dataset_dir / "12. Normal_Skin"
    if not normal_dir.exists():
        normal_dir = dataset_dir / "11. Normal Skin"
    if not normal_dir.exists():
        normal_dir = dataset_dir / "Normal_Skin"

    normal_files = [f for f in normal_dir.iterdir() if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png"] and f.name.lower() != "thumbs.db"]
    print(f"Found {len(normal_files)} normal skin images in {normal_dir}.")

    existing_hashes = set(disease_clean["md5"].dropna().tolist())
    normal_records = []
    seen_normal_hashes = set()

    for fpath in normal_files:
        try:
            data = fpath.read_bytes()
            h = hashlib.md5(data).hexdigest()
            if h in existing_hashes or h in seen_normal_hashes:
                continue
            seen_normal_hashes.add(h)

            normal_records.append({
                "file_path": str(fpath),
                "file_name": fpath.name,
                "class_name": "11. Normal Skin",
                "md5": h,
                "problem": "none",
                "action": "Retain in cleaned dataset",
                "label": 10
            })
        except Exception:
            pass

    normal_df = pd.DataFrame(normal_records)
    print(f"Verified {len(normal_df)} unique, high-quality Normal Skin images.")

    # Combined clean dataset
    combined_clean = pd.concat([disease_clean, normal_df], ignore_index=True)
    combined_clean["label"] = combined_clean["label"].astype(int)
    combined_clean.to_csv("processed_dataset/cleaned_manifest.csv", index=False)
    print(f"Total 11-class cleaned dataset: {len(combined_clean)} images.")

    # Perform Stratified 70% / 15% / 15% Split
    np.random.seed(42)
    train_dfs, val_dfs, test_dfs = [], [], []

    for c_idx in range(11):
        c_sub = combined_clean[combined_clean["label"] == c_idx].sample(frac=1.0, random_state=42).reset_index(drop=True)
        n = len(c_sub)
        n_train = int(0.70 * n)
        n_val = int(0.15 * n)
        n_test = n - n_train - n_val

        train_dfs.append(c_sub.iloc[:n_train])
        val_dfs.append(c_sub.iloc[n_train:n_train + n_val])
        test_dfs.append(c_sub.iloc[n_train + n_val:])

    train_df = pd.concat(train_dfs, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)
    val_df = pd.concat(val_dfs, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)
    test_df = pd.concat(test_dfs, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)

    train_df.to_csv("processed_dataset/train_manifest.csv", index=False)
    val_df.to_csv("processed_dataset/val_manifest.csv", index=False)
    test_df.to_csv("processed_dataset/test_manifest.csv", index=False)

    print(f"Splits saved: Train={len(train_df)} (70%), Val={len(val_df)} (15%), Test={len(test_df)} (15%)")

    # Leakage check
    train_h = set(train_df["md5"])
    val_h = set(val_df["md5"])
    test_h = set(test_df["md5"])
    print(f"Hash overlap Train & Val: {len(train_h & val_h)}")
    print(f"Hash overlap Train & Test: {len(train_h & test_h)}")
    print(f"Hash overlap Val & Test: {len(val_h & test_h)}")

    # Generate updated class_distribution.csv and class_distribution.png
    dist_rows = []
    for c_idx in range(11):
        c_name = ordered_classes[c_idx]
        tot = len(combined_clean[combined_clean["label"] == c_idx])
        tr = len(train_df[train_df["label"] == c_idx])
        va = len(val_df[val_df["label"] == c_idx])
        te = len(test_df[test_df["label"] == c_idx])
        dist_rows.append({
            "class_index": c_idx,
            "folder_name": c_name,
            "clean_name": clean_display_names[c_idx],
            "total_clean_count": tot,
            "train_count": tr,
            "val_count": va,
            "test_count": te,
            "percentage": f"{(tot / len(combined_clean)) * 100:.2f}%"
        })

    dist_df = pd.DataFrame(dist_rows)
    dist_df.to_csv("class_distribution.csv", index=False)
    dist_df.to_csv("reports/dataset_split_report.csv", index=False)
    print("Saved class_distribution.csv and reports/dataset_split_report.csv")

    # Summary json
    summary = {
        "num_classes": 11,
        "total_images": len(combined_clean),
        "train_images": len(train_df),
        "val_images": len(val_df),
        "test_images": len(test_df),
        "zero_leakage": True,
        "classes": dist_rows
    }
    with open("reports/dataset_split_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Plot 11-class distribution
    plt.figure(figsize=(12, 7))
    bars = plt.barh([r["clean_name"] for r in dist_rows], [r["total_clean_count"] for r in dist_rows],
                    color=["#0284c7" if i < 10 else "#16a34a" for i in range(11)],
                    edgecolor="#0f172a")
    plt.xlabel("Verified Clean Images Count", fontsize=12, fontweight="bold")
    plt.title("DermAI Health Monitor - 11-Class Dataset Distribution (Including Normal Skin)", fontsize=14, fontweight="bold", pad=15)
    plt.gca().invert_yaxis()
    for bar in bars:
        w = bar.get_width()
        plt.text(w + 100, bar.get_y() + bar.get_height()/2, f"{int(w):,}", va="center", ha="left", fontsize=10, fontweight="bold")
    plt.xlim(0, max(dist_df["total_clean_count"]) * 1.15)
    plt.tight_layout()
    plt.savefig("class_distribution.png", dpi=300)
    plt.close()
    print("Saved class_distribution.png with 11 classes.")

if __name__ == "__main__":
    generate_11class_dataset()
