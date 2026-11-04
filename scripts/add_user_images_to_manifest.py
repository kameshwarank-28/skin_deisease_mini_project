import hashlib
from pathlib import Path
import pandas as pd

def add_user_images():
    target_dir = Path("Z:/IMG_CLASSES/Normal_Skin")
    user_files = list(target_dir.glob("user_normal_*.jpg"))
    print(f"Found {len(user_files)} user normal skin files.")

    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    clean_df = pd.read_csv("processed_dataset/cleaned_manifest.csv")

    new_rows = []
    for f in user_files:
        data = f.read_bytes()
        md5 = hashlib.md5(data).hexdigest()
        new_rows.append({
            "file_path": str(f),
            "file_name": f.name,
            "class_name": "11. Normal Skin",
            "md5": md5,
            "problem": "none",
            "action": "Retain in cleaned dataset",
            "label": 10
        })

    new_df = pd.DataFrame(new_rows)
    # Append to train_manifest
    updated_train = pd.concat([train_df, new_df], ignore_index=True)
    updated_train.to_csv("processed_dataset/train_manifest.csv", index=False)

    # Append to cleaned_manifest
    updated_clean = pd.concat([clean_df, new_df], ignore_index=True)
    updated_clean.to_csv("processed_dataset/cleaned_manifest.csv", index=False)

    print(f"Updated train_manifest: {len(updated_train)} total rows (+{len(new_df)} user normal samples).")
    print(f"Updated cleaned_manifest: {len(updated_clean)} total rows.")

if __name__ == "__main__":
    add_user_images()

