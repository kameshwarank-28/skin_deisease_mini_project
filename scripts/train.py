import os
import sys
import time
import json
import argparse
from pathlib import Path
import yaml
import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dataset import SkinDiseaseDataset, create_data_loaders, compute_class_weights
from models import build_model

def parse_args():
    parser = argparse.ArgumentParser(description="Train Skin Disease Classification Models")
    parser.add_argument("--config", type=str, default="configs/config.yaml", help="Path to config file")
    parser.add_argument("--model", type=str, default="vit_base_patch16_224", help="Model architecture")
    parser.add_argument("--epochs", type=int, default=None, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=None, help="Batch size")
    parser.add_argument("--lr", type=float, default=None, help="Learning rate")
    parser.add_argument("--smoke-test", action="store_true", help="Run a quick 1-epoch dry run on subset of batches")
    parser.add_argument("--output-dir", type=str, default="models", help="Directory to save model checkpoints")
    parser.add_argument("--device", type=str, default=None, help="Device (cuda or cpu)")
    return parser.parse_args()

def load_config(config_path: str):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def train_one_epoch(model, dataloader, criterion, optimizer, device, max_batches=None):
    model.train()
    running_loss = 0.0
    all_preds, all_targets = [], []

    pbar = tqdm(dataloader, desc="Training", leave=False)
    for batch_idx, (images, targets) in enumerate(pbar):
        if max_batches and batch_idx >= max_batches:
            break

        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, targets)
        loss.backward()
        
        # Gradient clipping
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        preds = torch.argmax(outputs, dim=1).detach().cpu().numpy()
        all_preds.extend(preds)
        all_targets.extend(targets.detach().cpu().numpy())

        pbar.set_postfix({"loss": f"{loss.item():.4f}"})

    total_samples = len(all_targets)
    epoch_loss = running_loss / total_samples if total_samples > 0 else 0.0
    epoch_acc = accuracy_score(all_targets, all_preds)
    epoch_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)
    return epoch_loss, epoch_acc, epoch_f1

def validate(model, dataloader, criterion, device, max_batches=None):
    model.eval()
    running_loss = 0.0
    all_preds, all_targets = [], []

    with torch.no_grad():
        pbar = tqdm(dataloader, desc="Validating", leave=False)
        for batch_idx, (images, targets) in enumerate(pbar):
            if max_batches and batch_idx >= max_batches:
                break

            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)

            outputs = model(images)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * images.size(0)
            preds = torch.argmax(outputs, dim=1).detach().cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(targets.detach().cpu().numpy())

    total_samples = len(all_targets)
    val_loss = running_loss / total_samples if total_samples > 0 else 0.0
    val_acc = accuracy_score(all_targets, all_preds)
    val_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)
    return val_loss, val_acc, val_f1

def main():
    args = parse_args()
    config = load_config(args.config) if Path(args.config).exists() else {}

    # Hyperparameters
    model_name = args.model or config.get("model", {}).get("architecture", "vit_base_patch16_224")
    epochs = args.epochs or (1 if args.smoke_test else config.get("training", {}).get("epochs", 20))
    batch_size = args.batch_size or (4 if args.smoke_test else config.get("training", {}).get("batch_size", 32))
    lr = args.lr or config.get("training", {}).get("learning_rate", 1e-4)
    weight_decay = config.get("training", {}).get("weight_decay", 0.01)
    image_size = config.get("model", {}).get("image_size", 224)
    dropout = config.get("model", {}).get("dropout", 0.2)
    
    device = torch.device(args.device if args.device else ("cuda" if torch.cuda.is_available() else "cpu"))
    print(f"=== Training Configuration ===")
    print(f"Model: {model_name} | Device: {device} | Epochs: {epochs} | Batch Size: {batch_size} | LR: {lr}")
    print(f"Smoke Test Mode: {args.smoke_test}")

    # Output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Class mappings
    classes_json = Path("processed_dataset/classes.json")
    num_classes = 10
    if classes_json.exists():
        with open(classes_json, "r", encoding="utf-8") as f:
            classes_info = json.load(f)
            num_classes = classes_info.get("num_classes", 10)

    # Compute class weights
    train_manifest = "processed_dataset/train_manifest.csv"
    val_manifest = "processed_dataset/val_manifest.csv"
    test_manifest = "processed_dataset/test_manifest.csv"

    class_weights = compute_class_weights(train_manifest, num_classes=num_classes).to(device)
    print(f"Class Weights: {class_weights.cpu().numpy().round(3)}")

    # Dataloaders
    train_loader, val_loader, _ = create_data_loaders(
        train_manifest=train_manifest,
        val_manifest=val_manifest,
        test_manifest=test_manifest,
        image_size=image_size,
        batch_size=batch_size,
        num_workers=0 if os.name == 'nt' else 2
    )

    # Model
    model = build_model(
        model_name=model_name,
        num_classes=num_classes,
        pretrained=True,
        dropout=dropout
    ).to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_f1 = 0.0
    history = {"train_loss": [], "train_acc": [], "train_f1": [], "val_loss": [], "val_acc": [], "val_f1": []}
    max_batches = 5 if args.smoke_test else None

    start_time = time.time()
    for epoch in range(1, epochs + 1):
        print(f"\n--- Epoch {epoch}/{epochs} ---")
        train_loss, train_acc, train_f1 = train_one_epoch(model, train_loader, criterion, optimizer, device, max_batches)
        val_loss, val_acc, val_f1 = validate(model, val_loader, criterion, device, max_batches)
        scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["train_f1"].append(train_f1)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(val_f1)

        print(f"Train - Loss: {train_loss:.4f}, Acc: {train_acc*100:.2f}%, Macro F1: {train_f1:.4f}")
        print(f"Val   - Loss: {val_loss:.4f}, Acc: {val_acc*100:.2f}%, Macro F1: {val_f1:.4f}")

        # Save Best Model
        if val_f1 > best_val_f1 or args.smoke_test:
            best_val_f1 = val_f1
            ckpt_name = f"best_{model_name.replace('/', '_')}.pth"
            ckpt_path = output_dir / ckpt_name
            torch.save({
                "epoch": epoch,
                "model_name": model_name,
                "num_classes": num_classes,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "val_f1": val_f1,
                "history": history
            }, ckpt_path)
            print(f"[*] Checkpoint saved to: {ckpt_path}")

    elapsed = time.time() - start_time
    print(f"\nTraining completed in {elapsed/60:.2f} minutes. Best Val Macro F1: {best_val_f1:.4f}")

    # Save training history log
    history_file = output_dir / f"training_history_{model_name.replace('/', '_')}.json"
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    print(f"History logged to {history_file}")

if __name__ == "__main__":
    main()
