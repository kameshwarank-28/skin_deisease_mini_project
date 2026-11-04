import os
import sys
import json
import time
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score, f1_score
from scipy.optimize import minimize_scalar
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

class ClassWeightedFocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, label_smoothing: float = 0.05, class_weights: torch.Tensor = None):
        super().__init__()
        self.gamma = gamma
        self.label_smoothing = label_smoothing
        self.class_weights = class_weights

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        num_classes = inputs.size(-1)
        log_probs = F.log_softmax(inputs, dim=-1)
        probs = torch.exp(log_probs)

        targets_one_hot = F.one_hot(targets, num_classes=num_classes).float()
        if self.label_smoothing > 0:
            targets_one_hot = targets_one_hot * (1.0 - self.label_smoothing) + (self.label_smoothing / num_classes)

        pt = torch.sum(probs * targets_one_hot, dim=-1)
        focal_weight = (1.0 - pt) ** self.gamma
        ce_loss = -torch.sum(targets_one_hot * log_probs, dim=-1)
        loss = focal_weight * ce_loss

        if self.class_weights is not None:
            w = self.class_weights.to(inputs.device)[targets]
            loss = loss * w

        return loss.mean()

class SkinDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform=None, cache_size: int = 224):
        self.df = df.reset_index(drop=True)
        self.file_paths = self.df["file_path"].tolist()
        self.labels = self.df["label"].astype(int).tolist()
        self.transform = transform
        self.cache_size = cache_size

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        path = self.file_paths[idx]
        label = self.labels[idx]
        try:
            with Image.open(path) as img:
                img_t = img.convert("RGB")
        except Exception:
            img_t = Image.new("RGB", (self.cache_size, self.cache_size), (128, 128, 128))

        if self.transform:
            tensor = self.transform(img_t)
        else:
            tensor = transforms.ToTensor()(img_t)
        return tensor, torch.tensor(label, dtype=torch.long)

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

def train_and_evaluate_11class():
    print("=" * 70)
    print("DERMAI 11-CLASS MODEL RETRAINING (INCLUDING NORMAL / HEALTHY SKIN)")
    print("=" * 70)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Executing on: {device}")

    # Load manifests
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")
    with open("processed_dataset/classes.json", "r", encoding="utf-8") as f:
        classes_data = json.load(f)

    num_classes = classes_data.get("num_classes", 11)
    classes_list = classes_data.get("classes", [])
    clean_names = [classes_data["clean_names"][str(i)] for i in range(num_classes)]
    print(f"Classes ({num_classes}): {clean_names}")

    # Calculate class weights for focal loss
    class_counts = train_df["label"].value_counts().sort_index().values
    total_samples = len(train_df)
    class_weights = total_samples / (num_classes * class_counts.astype(np.float32))
    class_weights = class_weights / np.mean(class_weights)
    weight_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)
    print(f"Inverse class weights: {[round(w, 3) for w in class_weights.tolist()]}")

    # Transformations
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    eval_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    # Subsample balanced batches for responsive CPU training
    # 120 samples per class = 1,320 balanced training samples
    # 30 samples per class = 330 balanced validation samples
    # 70 samples per class = 770 balanced independent test samples
    def get_balanced_sample(df, n_per_class, seed=42):
        dfs = []
        for l_val, grp in df.groupby("label"):
            dfs.append(grp.sample(min(n_per_class, len(grp)), random_state=seed))
        return pd.concat(dfs, ignore_index=True)

    train_sub = get_balanced_sample(train_df, 120, seed=42)
    val_sub = get_balanced_sample(val_df, 30, seed=42)
    test_sub = get_balanced_sample(test_df, 70, seed=42)

    print(f"Active training cohort: {len(train_sub)} samples across {num_classes} classes.")
    print(f"Active validation cohort: {len(val_sub)} samples.")
    print(f"Active independent test cohort: {len(test_sub)} samples.")

    train_ds = SkinDataset(train_sub, transform=train_transform)
    val_ds = SkinDataset(val_sub, transform=eval_transform)
    test_ds = SkinDataset(test_sub, transform=eval_transform)

    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=0)

    # Instantiate EfficientNetV2-S with 11 classes
    print("\nInstantiating EfficientNetV2-S with 11-class classification head...")
    model = timm.create_model("tf_efficientnetv2_s", pretrained=True, num_classes=num_classes, drop_rate=0.25)
    model.to(device)

    # Stage 1: Warmup frozen backbone, train linear head
    for name, param in model.named_parameters():
        if "classifier" not in name:
            param.requires_grad = False

    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.05, class_weights=weight_tensor)
    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=1e-3, weight_decay=1e-2)

    history = {"train_loss": [], "val_loss": [], "val_acc": [], "val_macro_f1": []}

    print("\n--- STAGE 1: CLASSIFIER HEAD WARM-UP (2 Epochs) ---")
    for epoch in range(1, 3):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * len(y)
        train_loss = running_loss / len(train_ds)

        # Validation
        model.eval()
        v_loss, v_preds, v_targets = 0.0, [], []
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                loss = criterion(out, y)
                v_loss += loss.item() * len(y)
                v_preds.extend(out.argmax(dim=1).cpu().numpy())
                v_targets.extend(y.cpu().numpy())
        val_loss = v_loss / len(val_ds)
        val_acc = accuracy_score(v_targets, v_preds)
        val_f1 = f1_score(v_targets, v_preds, average="macro", zero_division=0)
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_macro_f1"].append(val_f1)
        print(f"Epoch {epoch}/2 (Head) | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:.2f}% | Macro F1: {val_f1:.4f} ({time.time()-t0:.1f}s)")

    # Stage 2: Unfreeze conv_head and blocks.5 for fine-tuning
    print("\n--- STAGE 2: DIFFERENTIAL BACKBONE FINE-TUNING (2 Epochs) ---")
    for name, param in model.named_parameters():
        if "conv_head" in name or "blocks.5" in name or "classifier" in name:
            param.requires_grad = True

    param_groups = [
        {"params": [p for n, p in model.named_parameters() if ("conv_head" in n or "blocks.5" in n) and p.requires_grad], "lr": 2e-5},
        {"params": [p for n, p in model.named_parameters() if "classifier" in n and p.requires_grad], "lr": 3e-4}
    ]
    optimizer = AdamW(param_groups, weight_decay=1e-2)
    scheduler = CosineAnnealingLR(optimizer, T_max=2, eta_min=1e-6)

    for epoch in range(3, 5):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * len(y)
        scheduler.step()
        train_loss = running_loss / len(train_ds)

        # Validation
        model.eval()
        v_loss, v_preds, v_targets = 0.0, [], []
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                loss = criterion(out, y)
                v_loss += loss.item() * len(y)
                v_preds.extend(out.argmax(dim=1).cpu().numpy())
                v_targets.extend(y.cpu().numpy())
        val_loss = v_loss / len(val_ds)
        val_acc = accuracy_score(v_targets, v_preds)
        val_f1 = f1_score(v_targets, v_preds, average="macro", zero_division=0)
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_macro_f1"].append(val_f1)
        print(f"Epoch {epoch}/4 (Fine-tune) | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:.2f}% | Macro F1: {val_f1:.4f} ({time.time()-t0:.1f}s)")

    # Temperature Scaling Probability Calibration
    print("\n--- POST-HOC TEMPERATURE SCALING CALIBRATION ---")
    model.eval()
    val_logits_list, val_labels_list = [], []
    with torch.no_grad():
        for x, y in val_loader:
            x = x.to(device)
            logits = model(x)
            val_logits_list.append(logits.cpu().numpy())
            val_labels_list.append(y.numpy())

    v_logits = np.concatenate(val_logits_list, axis=0)
    v_labels = np.concatenate(val_labels_list, axis=0)

    raw_probs = F.softmax(torch.from_numpy(v_logits), dim=-1).numpy()
    raw_ece = compute_ece(raw_probs, v_labels)

    def nll_eval(t_val):
        t_val = max(0.1, float(t_val))
        scaled = torch.from_numpy(v_logits) / t_val
        return F.cross_entropy(scaled, torch.from_numpy(v_labels)).item()

    res = minimize_scalar(nll_eval, bounds=(0.5, 3.5), method="bounded")
    optimal_t = float(res.x)
    calib_probs = F.softmax(torch.from_numpy(v_logits) / optimal_t, dim=-1).numpy()
    calib_ece = compute_ece(calib_probs, v_labels)
    print(f"Raw Val ECE: {raw_ece:.4f} -> Optimal Temperature T: {optimal_t:.4f} -> Calibrated Val ECE: {calib_ece:.4f}")

    # Independent Test Set Evaluation
    print("\n--- INDEPENDENT TEST SET EVALUATION (770 Samples) ---")
    test_logits_list, test_targets_list = [], []
    with torch.no_grad():
        for x, y in test_loader:
            x = x.to(device)
            logits = model(x)
            test_logits_list.append(logits.cpu().numpy())
            test_targets_list.append(y.numpy())

    t_logits = np.concatenate(test_logits_list, axis=0)
    t_targets = np.concatenate(test_targets_list, axis=0)

    # Calibrated probabilities
    test_probs = F.softmax(torch.from_numpy(t_logits) / optimal_t, dim=-1).numpy()
    test_preds = np.argmax(test_probs, axis=1)

    top1_acc = accuracy_score(t_targets, test_preds)
    balanced_acc = balanced_accuracy_score(t_targets, test_preds)
    macro_f1 = f1_score(t_targets, test_preds, average="macro", zero_division=0)
    weighted_f1 = f1_score(t_targets, test_preds, average="weighted", zero_division=0)

    top3_correct = 0
    for i in range(len(t_targets)):
        top3_indices = np.argsort(test_probs[i])[::-1][:3]
        if t_targets[i] in top3_indices:
            top3_correct += 1
    top3_acc = top3_correct / len(t_targets)

    print(f"\nFinal Test Set Results (11 Classes):")
    print(f"Top-1 Accuracy:     {top1_acc*100:.2f}%")
    print(f"Top-3 Accuracy:     {top3_acc*100:.2f}%")
    print(f"Balanced Accuracy:  {balanced_acc*100:.2f}%")
    print(f"Macro F1-Score:     {macro_f1:.4f}")
    print(f"Weighted F1-Score:  {weighted_f1:.4f}")

    # Classification report
    target_names = [clean_names[i] for i in range(num_classes)]
    cls_dict = classification_report(t_targets, test_preds, target_names=target_names, output_dict=True, zero_division=0)
    cls_df = pd.DataFrame(cls_dict).transpose()
    cls_df.to_csv("reports/evaluation/classification_report_11class.csv")
    print("\nPer-Class Classification Report:")
    print(cls_df[["precision", "recall", "f1-score", "support"]])

    # Specific Normal Skin Metrics
    normal_idx = 10
    normal_precision = cls_dict[clean_names[normal_idx]]["precision"]
    normal_recall = cls_dict[clean_names[normal_idx]]["recall"]
    normal_f1 = cls_dict[clean_names[normal_idx]]["f1-score"]

    cm = confusion_matrix(t_targets, test_preds, labels=list(range(num_classes)))
    normal_true = (t_targets == normal_idx)
    normal_pred = (test_preds == normal_idx)
    tn = np.sum((~normal_true) & (~normal_pred))
    fp = np.sum((~normal_true) & (normal_pred))
    fn = np.sum((normal_true) & (~normal_pred))
    tp = np.sum((normal_true) & (normal_pred))
    normal_specificity = tn / (tn + fp + 1e-9)
    normal_fpr = fp / (fp + tn + 1e-9)

    print(f"\nSpecific Normal Skin Evaluation Metrics:")
    print(f"Normal Skin Precision:    {normal_precision*100:.2f}%")
    print(f"Normal Skin Recall:       {normal_recall*100:.2f}%")
    print(f"Normal Skin F1-Score:     {normal_f1:.4f}")
    print(f"Normal Skin Specificity:  {normal_specificity*100:.2f}%")
    print(f"Normal Skin False Pos Rate:{normal_fpr*100:.2f}%")

    # Generate 11-Class Confusion Matrix Plot
    plt.figure(figsize=(11, 9))
    cm_norm = cm.astype("float") / (cm.sum(axis=1)[:, np.newaxis] + 1e-9)
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=[c.split()[0] for c in clean_names],
                yticklabels=clean_names)
    plt.title("DermAI 11-Class Normalized Confusion Matrix (Including Normal Skin)", fontsize=13, fontweight="bold", pad=12)
    plt.xlabel("Predicted Class", fontweight="bold")
    plt.ylabel("True Clinical Label", fontweight="bold")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig("reports/evaluation/confusion_matrix_11class.png", dpi=300)
    plt.close()
    print("Saved reports/evaluation/confusion_matrix_11class.png")

    # Generate Normal vs Disease Confusion Focus Matrix
    # Shows Normal Skin predicted as Normal vs predicted as Fungal, Atopic, etc.
    normal_samples_mask = (t_targets == normal_idx)
    normal_predictions = test_preds[normal_samples_mask]
    pred_counts = pd.Series(normal_predictions).value_counts().sort_index()

    fp_rows = []
    for c_i in range(num_classes):
        fp_rows.append({
            "predicted_class_index": c_i,
            "predicted_class_name": clean_names[c_i],
            "sample_count": int(pred_counts.get(c_i, 0)),
            "percentage": f"{(pred_counts.get(c_i, 0) / len(normal_predictions)) * 100:.2f}%"
        })
    fp_df = pd.DataFrame(fp_rows)
    fp_df.to_csv("reports/evaluation/normal_skin_confusion_breakdown.csv", index=False)
    print("Saved reports/evaluation/normal_skin_confusion_breakdown.csv")

    # Save Checkpoint
    checkpoint_payload = {
        "model_name": "efficientnetv2_s",
        "timm_model_name": "tf_efficientnetv2_s",
        "num_classes": 11,
        "classes": classes_list,
        "clean_names": clean_names,
        "temperature": optimal_t,
        "raw_ece": raw_ece,
        "calibrated_ece": calib_ece,
        "top1_acc": top1_acc,
        "top3_acc": top3_acc,
        "balanced_acc": balanced_acc,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "normal_precision": normal_precision,
        "normal_recall": normal_recall,
        "normal_f1": normal_f1,
        "normal_specificity": normal_specificity,
        "normal_fpr": normal_fpr,
        "model_state_dict": model.state_dict(),
        "training_resolution": 224
    }

    torch.save(checkpoint_payload, "models/best_model.pth")
    torch.save(checkpoint_payload, "models/efficientnetv2_s_11class_best.pth")
    print("\nCheckpoint saved to models/best_model.pth and models/efficientnetv2_s_11class_best.pth!")

    # Update metadata
    metadata = {
        "model_architecture": "EfficientNetV2-S (tf_efficientnetv2_s)",
        "num_classes": 11,
        "classes": clean_names,
        "date_trained": time.strftime("%Y-%m-%d %H:%M:%S"),
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "macro_f1": round(macro_f1, 4),
        "calibrated_temperature": round(optimal_t, 4),
        "calibrated_ece": round(calib_ece, 4),
        "normal_skin_metrics": {
            "precision": round(normal_precision, 4),
            "recall": round(normal_recall, 4),
            "f1_score": round(normal_f1, 4),
            "specificity": round(normal_specificity, 4),
            "false_positive_rate": round(normal_fpr, 4)
        }
    }
    with open("model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("Updated model_metadata.json.")

if __name__ == "__main__":
    train_and_evaluate_11class()
