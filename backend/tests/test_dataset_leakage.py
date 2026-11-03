import pandas as pd
from pathlib import Path

def test_manifest_files_exist():
    train_p = Path("processed_dataset/train_manifest.csv")
    val_p = Path("processed_dataset/val_manifest.csv")
    test_p = Path("processed_dataset/test_manifest.csv")
    assert train_p.exists(), "Train manifest missing"
    assert val_p.exists(), "Val manifest missing"
    assert test_p.exists(), "Test manifest missing"

def test_zero_data_leakage_across_splits():
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")

    train_hashes = set(train_df["md5"])
    val_hashes = set(val_df["md5"])
    test_hashes = set(test_df["md5"])

    overlap_train_val = train_hashes.intersection(val_hashes)
    overlap_train_test = train_hashes.intersection(test_hashes)
    overlap_val_test = val_hashes.intersection(test_hashes)

    assert len(overlap_train_val) == 0, f"Leakage between train and val: {len(overlap_train_val)}"
    assert len(overlap_train_test) == 0, f"Leakage between train and test: {len(overlap_train_test)}"
    assert len(overlap_val_test) == 0, f"Leakage between val and test: {len(overlap_val_test)}"

def test_class_count_consistency():
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    assert train_df["label"].nunique() == 10, "Expected exactly 10 distinct classes"
