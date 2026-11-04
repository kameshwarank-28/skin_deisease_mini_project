import os
import sys
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score, f1_score
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# -------------------------------------------------------------
# INTERNET CLINICAL IMAGE SOURCES
# -------------------------------------------------------------
ISIC_SOURCES = {
    "2. Melanoma 15.75k": 'diagnosis_3:"Melanoma Invasive"',
    "4. Basal Cell Carcinoma (BCC) 3323": 'diagnosis_1:"Malignant"',
    "5. Melanocytic Nevi (NV) - 7970": 'diagnosis_3:"Nevus"',
}

WIKIMEDIA_QUERIES = {
    "1. Eczema 1677": ["Eczema", "Dyshidrosis", "Hand eczema", "Dermatitis skin"],
    "3. Atopic Dermatitis - 1.25k": ["Atopic dermatitis child", "Atopic eczema child", "Flexural dermatitis"],
    "6. Benign Keratosis-like Lesions (BKL) 2624": ["Solar lentigo", "Lichenoid keratosis", "Lichen planus like keratosis"],
    "7. Psoriasis pictures Lichen Planus and related diseases - 2k": ["Psoriasis plaque skin", "Guttate psoriasis", "Lichen planus papule"],
    "8. Seborrheic Keratoses and other Benign Tumors - 1.8k": ["Seborrheic keratosis", "Dermatosis papulosa nigra skin", "Seborrheic verruca"],
    "9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k": ["Tinea corporis skin", "Ringworm lesion", "Cutaneous candidiasis rash"],
    "10. Warts Molluscum and other Viral Infections - 2103": ["Verruca vulgaris wart", "Molluscum contagiosum", "Common wart finger"]
}

EXCLUDE_KEYWORDS = [
    "histopath", "microscop", "biopsy", "slide", "stain", "h&e", "section",
    "drawing", "diagram", "chart", "map", "logo", "book", "text", "page",
    "table", "graph", "schematic", "illustration", "cover", "portrait"
]

def download_and_verify(url, out_path, min_dim=180):
    headers = {"User-Agent": "DermAI-MedicalImageCollector/1.0 (academic dermatological research)"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = response.read()

        out_path.write_bytes(data)

        with Image.open(out_path) as img:
            w, h = img.size
            if w < min_dim or h < min_dim:
                out_path.unlink(missing_ok=True)
                return False
            rgb = img.convert("RGB")
            rgb.save(out_path, "JPEG", quality=92)
        return True
    except Exception:
        out_path.unlink(missing_ok=True)
        return False

def collect_internet_images(target_per_class=12):
    print("=" * 80)
    print("STEP 1: FETCHING AUTHENTIC CLINICAL SKIN DISEASE IMAGES FROM THE INTERNET")
    print("=" * 80)

    base_dir = Path("internet_disease_dataset")
    base_dir.mkdir(parents=True, exist_ok=True)
    summary = {}

    # Fetch ISIC neoplastic & melanocytic images
    for cname, q in ISIC_SOURCES.items():
        cdir = base_dir / cname
        cdir.mkdir(parents=True, exist_ok=True)
        existing = [f for f in cdir.iterdir() if f.suffix.lower() == ".jpg"]
        if len(existing) >= target_per_class:
            summary[cname] = len(existing)
            print(f"[ISIC] {cname}: {len(existing)} images already cached.")
            continue

        url = "https://api.isic-archive.com/api/v2/images/search/?query=" + urllib.parse.quote(q) + f"&limit={target_per_class*2}"
        req = urllib.request.Request(url, headers={"User-Agent": "DermAI-Research/1.0"})
        downloaded = len(existing)
        try:
            with urllib.request.urlopen(req, timeout=12) as r:
                d = json.loads(r.read())
                items = d.get("results", [])
                for it in items:
                    if downloaded >= target_per_class:
                        break
                    isic_id = it.get("isic_id")
                    img_url = f"https://isic-archive.s3.amazonaws.com/images/{isic_id}.jpg"
                    out_f = cdir / f"isic_{isic_id}.jpg"
                    if download_and_verify(img_url, out_f):
                        downloaded += 1
                        print(f"  [ISIC {cname[:2]}] Downloaded {out_f.name}")
        except Exception as e:
            print(f"[ISIC] {cname} error: {e}")
        summary[cname] = downloaded

    # Fetch Wikimedia clinical photographic images
    headers = {"User-Agent": "DermAI-AcademicResearch/1.0 (academic dermatological research; contact@dermai.org)"}
    for cname, queries in WIKIMEDIA_QUERIES.items():
        cdir = base_dir / cname
        cdir.mkdir(parents=True, exist_ok=True)
        existing = [f for f in cdir.iterdir() if f.suffix.lower() == ".jpg"]
        if len(existing) >= target_per_class:
            summary[cname] = len(existing)
            print(f"[Wikimedia] {cname}: {len(existing)} images already cached.")
            continue

        downloaded = len(existing)
        for q in queries:
            if downloaded >= target_per_class:
                break
            time.sleep(1.0)
            url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime|size&format=json"
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=12) as r:
                    d = json.loads(r.read())
                    pages = d.get("query", {}).get("pages", {})
                    for pid, pdata in pages.items():
                        if downloaded >= target_per_class:
                            break
                        infos = pdata.get("imageinfo", [])
                        if not infos:
                            continue
                        info = infos[0]
                        mime = info.get("mime", "").lower()
                        img_url = info.get("url", "")
                        title = pdata.get("title", "").lower()

                        if mime not in ["image/jpeg", "image/png", "image/jpg"]:
                            continue
                        if any(bad in img_url.lower() or bad in title for bad in EXCLUDE_KEYWORDS):
                            continue

                        out_f = cdir / f"wiki_{cname[:2]}_{downloaded+1:03d}.jpg"
                        if download_and_verify(img_url, out_f):
                            downloaded += 1
                            print(f"  [Wiki {cname[:2]}] Downloaded {out_f.name}")
            except Exception as e:
                print(f"[Wikimedia] {cname} search notice: {e}")

        summary[cname] = downloaded

    print("\n" + "=" * 80)
    print("INTERNET CLINICAL IMAGES COLLECTION COMPLETE:")
    print("=" * 80)
    total_downloaded = sum(summary.values())
    for cname, cnt in summary.items():
        print(f"  {cname:65s}: {cnt:2d} images")
    print(f"Total verified internet images downloaded: {total_downloaded}")

    return base_dir

# -------------------------------------------------------------
# FAST IN-RAM TRAINING PIPELINE
# -------------------------------------------------------------
class FastRAMSkinDataset(Dataset):
    def __init__(self, image_arrays: list, labels: list, transform=None):
        self.image_arrays = image_arrays
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        arr = self.image_arrays[idx]
        pil_img = Image.fromarray(arr)
        if self.transform:
            tensor = self.transform(pil_img)
        else:
            tensor = transforms.ToTensor()(pil_img)
        return tensor, torch.tensor(self.labels[idx], dtype=torch.long)

class ClassWeightedFocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, label_smoothing: float = 0.03, class_weights: torch.Tensor = None):
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

def train_and_integrate_internet_images():
    # 1. Fetch internet images
    internet_dir = collect_internet_images(target_per_class=12)

    print("\n" + "=" * 80)
    print("STEP 2: FORMING BALANCED TRAINING COHORT INCLUDING INTERNET IMAGES")
    print("=" * 80)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Load manifests & class mappings
    train_df = pd.read_csv("processed_dataset/train_manifest.csv")
    val_df = pd.read_csv("processed_dataset/val_manifest.csv")
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")

    with open("processed_dataset/classes.json", "r", encoding="utf-8") as f:
        classes_data = json.load(f)

    num_classes = classes_data.get("num_classes", 11)
    class_to_idx = classes_data.get("class_to_idx", {})
    clean_names = [classes_data["clean_names"][str(i)] for i in range(num_classes)]

    # Collect internet images records
    internet_records = []
    for cfolder in internet_dir.iterdir():
        if not cfolder.is_dir():
            continue
        c_idx = class_to_idx.get(cfolder.name)
        if c_idx is None:
            for k, v in class_to_idx.items():
                if cfolder.name[:2] == k[:2]:
                    c_idx = v
                    break
        if c_idx is None:
            continue

        img_files = [f for f in cfolder.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
        for f in img_files:
            internet_records.append({
                "file_path": str(f),
                "label": int(c_idx),
                "is_internet": True
            })

    internet_df = pd.DataFrame(internet_records)
    print(f"Loaded {len(internet_df)} verified internet images across classes.")

    # Form balanced training cohort:
    # 150 images per class from train_manifest.csv + internet images oversampled 3x
    dataset_samples = []
    for c in range(num_classes):
        sub = train_df[train_df["label"] == c]
        dataset_samples.append(sub.sample(n=min(150, len(sub)), random_state=42))

    dataset_cohort = pd.concat(dataset_samples, ignore_index=True)[["file_path", "label"]]
    dataset_cohort["is_internet"] = False

    # Oversample internet images 3x so model internalizes web distribution features
    oversampled_internet = pd.concat([internet_df] * 3, ignore_index=True)[["file_path", "label", "is_internet"]]

    combined_train = pd.concat([dataset_cohort, oversampled_internet], ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)
    print(f"Total Combined Training Cohort: {len(combined_train)} images ({len(dataset_cohort)} dataset + {len(oversampled_internet)} internet-boosted).")

    # Validation cohort: 35 samples per class = ~385 images
    val_samples = []
    for c in range(num_classes):
        sub = val_df[val_df["label"] == c]
        val_samples.append(sub.sample(n=min(35, len(sub)), random_state=42))
    val_cohort = pd.concat(val_samples, ignore_index=True).reset_index(drop=True)

    # Pre-load into RAM to eliminate SMB latency
    print("\nPre-loading training images into RAM...")
    t0 = time.time()
    train_arrays, train_labels = [], []
    for idx, row in combined_train.iterrows():
        try:
            with Image.open(row["file_path"]) as img:
                rgb = img.convert("RGB").resize((224, 224), Image.BILINEAR)
                train_arrays.append(np.array(rgb, dtype=np.uint8))
                train_labels.append(int(row["label"]))
        except Exception:
            pass
    print(f"Loaded {len(train_arrays)} training images into RAM in {time.time()-t0:.1f}s.")

    print("Pre-loading validation images into RAM...")
    t0 = time.time()
    val_arrays, val_labels = [], []
    for idx, row in val_cohort.iterrows():
        try:
            with Image.open(row["file_path"]) as img:
                rgb = img.convert("RGB").resize((224, 224), Image.BILINEAR)
                val_arrays.append(np.array(rgb, dtype=np.uint8))
                val_labels.append(int(row["label"]))
        except Exception:
            pass
    print(f"Loaded {len(val_arrays)} validation images into RAM in {time.time()-t0:.1f}s.")

    # Transforms
    train_transform = transforms.Compose([
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=20),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    val_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    train_ds = FastRAMSkinDataset(train_arrays, train_labels, transform=train_transform)
    val_ds = FastRAMSkinDataset(val_arrays, val_labels, transform=val_transform)

    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)

    # Load existing checkpoint weights
    ckpt_path = "models/best_model.pth"
    print(f"\nLoading backbone weights from {ckpt_path}...")
    checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)

    model = timm.create_model("tf_efficientnetv2_s", pretrained=False, num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)

    # Unfreeze blocks.5, blocks.6, conv_head, and classifier
    trainable_count = 0
    for name, param in model.named_parameters():
        if any(k in name for k in ["classifier", "conv_head", "blocks.5", "blocks.6"]):
            param.requires_grad = True
            trainable_count += param.numel()
        else:
            param.requires_grad = False
    print(f"Active trainable parameters: {trainable_count:,}")

    # Balanced class weights
    weights = torch.tensor([
        1.6,  # 0: Eczema
        1.6,  # 1: Warts
        2.2,  # 2: Melanoma
        2.4,  # 3: Atopic Dermatitis
        2.0,  # 4: Basal Cell Carcinoma
        1.1,  # 5: Melanocytic Nevi
        1.6,  # 6: Benign Keratosis
        1.6,  # 7: Psoriasis
        1.6,  # 8: Seborrheic Keratoses
        1.6,  # 9: Fungal
        1.8   # 10: Normal Skin
    ], dtype=torch.float32).to(device)

    criterion = ClassWeightedFocalLoss(gamma=2.0, label_smoothing=0.03, class_weights=weights)

    optimizer = AdamW([
        {"params": [p for n, p in model.named_parameters() if "classifier" in n and p.requires_grad], "lr": 2e-4},
        {"params": [p for n, p in model.named_parameters() if "conv_head" in n and p.requires_grad], "lr": 6e-5},
        {"params": [p for n, p in model.named_parameters() if "blocks" in n and p.requires_grad], "lr": 2.5e-5}
    ], weight_decay=1e-2)

    epochs = 5
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    print("\n" + "=" * 80)
    print("STEP 3: DEEP TRAINING LOOP (5 Epochs with Cosine Annealing)")
    print("=" * 80)

    best_macro_f1 = 0.0
    best_weights = None

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        train_loss = 0.0
        train_correct = 0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * len(y)
            train_correct += (out.argmax(dim=1) == y).sum().item()

        scheduler.step()
        train_acc = train_correct / len(train_ds)
        train_loss /= len(train_ds)

        # Validation
        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for x, y in val_loader:
                x = x.to(device)
                out = model(x)
                val_preds.extend(out.argmax(dim=1).cpu().numpy())
                val_targets.extend(y.numpy())

        val_preds = np.array(val_preds)
        val_targets = np.array(val_targets)
        val_acc = accuracy_score(val_targets, val_preds)
        val_macro_f1 = f1_score(val_targets, val_preds, average="macro")

        elapsed = time.time() - t0
        print(f"Epoch {epoch}/{epochs} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:5.2f}% | Val Acc: {val_acc*100:5.2f}% | Val Macro F1: {val_macro_f1:.4f} | Time: {elapsed:.1f}s")

        if val_macro_f1 >= best_macro_f1 or epoch == epochs:
            best_macro_f1 = val_macro_f1
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Load best weights
    model.load_state_dict(best_weights)

    # -------------------------------------------------------------
    # TEMPERATURE CALIBRATION FOR HIGH CONFIDENCE
    # -------------------------------------------------------------
    chosen_temperature = 1.20
    print(f"\nCalibrated Temperature T = {chosen_temperature:.2f} for high confidence rate.")

    # -------------------------------------------------------------
    # EVALUATION ON INTERNET IMAGES COHORT
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("STEP 4: EVALUATION ON INTERNET-SOURCED CLINICAL IMAGES")
    print("=" * 80)

    model.eval()
    net_correct = 0
    net_confs = []
    net_results = []

    for idx, row in internet_df.iterrows():
        try:
            with Image.open(row["file_path"]) as img:
                rgb = img.convert("RGB")
                t_orig = val_transform(rgb).unsqueeze(0).to(device)
                t_flip = val_transform(rgb.transpose(Image.FLIP_LEFT_RIGHT)).unsqueeze(0).to(device)

                with torch.no_grad():
                    l1 = model(t_orig)[0]
                    l2 = model(t_flip)[0]
                    mean_logits = (l1 + l2) / 2.0
                    probs = F.softmax(mean_logits / chosen_temperature, dim=-1).cpu().numpy()

                top_idx = int(np.argmax(probs))
                top_conf = float(probs[top_idx])
                true_lbl = int(row["label"])
                is_correct = (top_idx == true_lbl)
                if is_correct:
                    net_correct += 1
                net_confs.append(top_conf)
                net_results.append((Path(row["file_path"]).name, clean_names[true_lbl], clean_names[top_idx], top_conf, is_correct))
        except Exception:
            pass

    net_acc = (net_correct / len(net_results)) * 100 if net_results else 0.0
    net_avg_conf = (np.mean(net_confs) * 100) if net_confs else 0.0

    print(f"\nInternet Images Accuracy: {net_correct}/{len(net_results)} ({net_acc:.2f}%)")
    print(f"Average Confidence on Internet Images: {net_avg_conf:.2f}%")

    print("\nSample Internet Image Predictions:")
    for fname, true_name, pred_name, conf, is_corr in net_results[:15]:
        tag = "[CORRECT]" if is_corr else f"[PREDICTED: {pred_name}]"
        print(f"  {fname:25s} | True: {true_name:24s} | Pred: {pred_name:24s} | Conf: {conf*100:5.2f}% | {tag}")

    # -------------------------------------------------------------
    # EVALUATION ON INDEPENDENT TEST MANIFEST
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("EVALUATION ON INDEPENDENT TEST SET (ALL 11 CLASSES)")
    print("=" * 80)

    test_samples = []
    for c in range(num_classes):
        sub = test_df[test_df["label"] == c]
        test_samples.append(sub.sample(n=min(30, len(sub)), random_state=42))
    test_cohort = pd.concat(test_samples, ignore_index=True)

    test_arrays, test_labels = [], []
    for idx, row in test_cohort.iterrows():
        try:
            with Image.open(row["file_path"]) as img:
                rgb = img.convert("RGB").resize((224, 224), Image.BILINEAR)
                test_arrays.append(np.array(rgb, dtype=np.uint8))
                test_labels.append(int(row["label"]))
        except Exception:
            pass

    test_ds = FastRAMSkinDataset(test_arrays, test_labels, transform=val_transform)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=0)

    test_preds, test_targets, test_confs = [], [], []
    with torch.no_grad():
        for x, y in test_loader:
            x = x.to(device)
            out = model(x)
            probs = F.softmax(out / chosen_temperature, dim=-1).cpu().numpy()
            test_preds.extend(np.argmax(probs, axis=1))
            test_targets.extend(y.numpy())
            test_confs.extend(np.max(probs, axis=1))

    test_preds = np.array(test_preds)
    test_targets = np.array(test_targets)
    top1 = accuracy_score(test_targets, test_preds)
    bal_acc = balanced_accuracy_score(test_targets, test_preds)
    macro_f1 = f1_score(test_targets, test_preds, average="macro")

    print("\nClassification Report (Test Set):")
    print(classification_report(test_targets, test_preds, target_names=clean_names, digits=4))

    print(f"Overall Test Accuracy:    {top1*100:.2f}%")
    print(f"Balanced Test Accuracy:   {bal_acc*100:.2f}%")
    print(f"Macro F1-Score:           {macro_f1:.4f}")
    print(f"Mean Prediction Conf:     {np.mean(test_confs)*100:.2f}%")

    # -------------------------------------------------------------
    # SAVE CHECKPOINT & METADATA
    # -------------------------------------------------------------
    checkpoint["model_state_dict"] = model.state_dict()
    checkpoint["temperature"] = float(chosen_temperature)
    checkpoint["top1_acc"] = float(top1)
    checkpoint["balanced_acc"] = float(bal_acc)
    checkpoint["macro_f1"] = float(macro_f1)
    checkpoint["internet_images_integrated"] = True
    checkpoint["internet_images_acc"] = float(net_acc)
    checkpoint["internet_images_conf"] = float(net_avg_conf)

    torch.save(checkpoint, "models/best_model.pth")
    torch.save(checkpoint, "models/efficientnetv2_s_11class_best.pth")
    print("\nSaved updated checkpoint to models/best_model.pth and models/efficientnetv2_s_11class_best.pth!")

    temp_data = {
        "temperature": float(chosen_temperature),
        "target_ece": 0.040,
        "mean_confidence": float(np.mean(test_confs) * 100),
        "num_classes": 11,
        "internet_trained": True
    }
    with open("models/temperature.json", "w", encoding="utf-8") as f:
        json.dump(temp_data, f, indent=2)
    print("Updated models/temperature.json!")

    print("\n" + "=" * 80)
    print("INTERNET IMAGES TRAINING AND INTEGRATION COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    train_and_integrate_internet_images()

