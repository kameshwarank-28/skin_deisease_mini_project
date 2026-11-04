import json
from pathlib import Path
from typing import Optional, Union
import torch
import torch.nn as nn
import timm

def get_num_classes(classes_json: str = "processed_dataset/classes.json") -> int:
    """Read number of classes from classes.json if available."""
    c_path = Path(classes_json)
    if c_path.exists():
        with open(c_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("num_classes", 10)
    return 10

def build_model(
    model_name: str = "resnet34",
    num_classes: Optional[Union[int, str]] = None,
    pretrained: bool = True,
    dropout: float = 0.2
) -> nn.Module:
    """
    Factory function to instantiate Vision Transformers and CNN Baselines using timm.
    """
    if num_classes is None or num_classes == "auto":
        num_classes = get_num_classes()
    num_classes = int(num_classes)

    # Standardize architecture names and aliases
    clean_name = model_name.lower().replace("-", "_")
    if clean_name in ["efficientnetv2_s", "efficientnet_v2_s", "efficientnetv2s"]:
        target_name = "tf_efficientnetv2_s"
    else:
        target_name = model_name

    try:
        model = timm.create_model(
            target_name,
            pretrained=pretrained,
            num_classes=num_classes,
            drop_rate=dropout
        )
    except Exception as e:
        print(f"Direct creation note ({e}), attempting standard head adaptation for {target_name}...")
        model = timm.create_model(target_name, pretrained=pretrained)
        if hasattr(model, "reset_classifier"):
            model.reset_classifier(num_classes=num_classes, drop_rate=dropout)
        elif hasattr(model, "head"):
            in_features = model.head.in_features if hasattr(model.head, "in_features") else model.head.fc.in_features
            model.head = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )
        elif hasattr(model, "fc"):
            in_features = model.fc.in_features
            model.fc = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )
        else:
            raise ValueError(f"Unknown classifier head structure for model: {model_name}")

    return model

def load_trained_model(
    checkpoint_path: str,
    model_name: str = "resnet34",
    num_classes: int = 10,
    device: str = "cpu"
) -> nn.Module:
    """
    Load a trained model checkpoint from disk.
    """
    ckpt = Path(checkpoint_path)
    if not ckpt.exists():
        raise FileNotFoundError(f"Checkpoint file not found: {ckpt}")

    checkpoint = torch.load(checkpoint_path, map_location=device)
    saved_model_name = checkpoint.get("model_name", model_name) if isinstance(checkpoint, dict) else model_name
    model = build_model(model_name=saved_model_name, num_classes=num_classes, pretrained=False)

    if isinstance(checkpoint, dict):
        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
        elif "state_dict" in checkpoint:
            model.load_state_dict(checkpoint["state_dict"])
        else:
            model.load_state_dict(checkpoint)
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()
    return model
