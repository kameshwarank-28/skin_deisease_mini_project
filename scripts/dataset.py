import os
from pathlib import Path
from typing import Tuple, List, Optional
import pandas as pd
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

# ImageNet normalization statistics
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def get_transforms(image_size: int = 224, is_training: bool = True) -> transforms.Compose:
    """
    Build dynamic augmentation pipeline for training or deterministic transform for val/test.
    """
    if is_training:
        return transforms.Compose([
            transforms.Resize((int(image_size * 1.14), int(image_size * 1.14))),
            transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.2),
            transforms.RandomRotation(degrees=15),
            transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10, hue=0.05),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])
    else:
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])

class SkinDiseaseDataset(Dataset):
    """
    PyTorch Dataset for skin disease images loaded from manifest CSV.
    """
    def __init__(self, manifest_csv: str, image_size: int = 224, is_training: bool = False, transform=None):
        self.manifest_path = Path(manifest_csv)
        if not self.manifest_path.exists():
            raise FileNotFoundError(f"Manifest file not found: {self.manifest_path}")

        self.df = pd.read_csv(self.manifest_path)
        self.image_paths: List[str] = self.df["file_path"].tolist()
        self.labels: List[int] = self.df["label"].tolist()
        self.class_names: List[str] = self.df["class_name"].tolist()

        if transform is not None:
            self.transform = transform
        else:
            self.transform = get_transforms(image_size=image_size, is_training=is_training)

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path = self.image_paths[idx]
        label = self.labels[idx]

        try:
            with Image.open(img_path) as img:
                img_rgb = img.convert("RGB")
        except Exception as e:
            print(f"Warning: Failed to read {img_path}: {e}")
            img_rgb = Image.new("RGB", (224, 224), color=(128, 128, 128))

        tensor = self.transform(img_rgb)
        return tensor, torch.tensor(label, dtype=torch.long)

def compute_class_weights(train_manifest_csv: str, num_classes: int = 10, method: str = "balanced") -> torch.Tensor:
    """
    Compute inverse-frequency class weights from training manifest to handle class imbalance.
    """
    df = pd.read_csv(train_manifest_csv)
    label_counts = df["label"].value_counts().to_dict()

    total_samples = len(df)
    weights = np.zeros(num_classes, dtype=np.float32)

    for c in range(num_classes):
        count = label_counts.get(c, 0)
        if count > 0:
            if method == "balanced":
                weights[c] = total_samples / (num_classes * count)
            elif method == "sqrt":
                weights[c] = np.sqrt(total_samples / count)
            else:
                weights[c] = 1.0
        else:
            weights[c] = 1.0

    # Normalize weights so sum equals num_classes
    weights = weights / weights.sum() * num_classes
    return torch.tensor(weights, dtype=torch.float32)

def create_data_loaders(
    train_manifest: str = "processed_dataset/train_manifest.csv",
    val_manifest: str = "processed_dataset/val_manifest.csv",
    test_manifest: str = "processed_dataset/test_manifest.csv",
    image_size: int = 224,
    batch_size: int = 32,
    num_workers: int = 0
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Create PyTorch DataLoaders for Train, Validation, and Test splits.
    """
    train_dataset = SkinDiseaseDataset(train_manifest, image_size=image_size, is_training=True)
    val_dataset = SkinDiseaseDataset(val_manifest, image_size=image_size, is_training=False)
    test_dataset = SkinDiseaseDataset(test_manifest, image_size=image_size, is_training=False)

    use_cuda = torch.cuda.is_available()

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=use_cuda
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=use_cuda
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=use_cuda
    )

    return train_loader, val_loader, test_loader
