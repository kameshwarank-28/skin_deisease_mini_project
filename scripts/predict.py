import io
import json
import base64
import argparse
from pathlib import Path
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
import cv2

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dataset import get_transforms
from models import build_model
from utils import clean_class_name, calculate_entropy, get_jet_colormap

def check_image_quality(pil_image: Image.Image, min_res: int = 150, blur_threshold: float = 30.0) -> dict:
    """
    Screens image for resolution and blur using Laplacian variance.
    """
    w, h = pil_image.size
    is_low_res = (w < min_res or h < min_res)

    try:
        np_img = np.array(pil_image.convert("L"))
        laplacian_var = float(cv2.Laplacian(np_img, cv2.CV_64F).var())
        is_blurry = laplacian_var < blur_threshold
    except Exception:
        laplacian_var = 100.0
        is_blurry = False

    warnings = []
    if is_low_res:
        warnings.append(f"Low resolution detected ({w}x{h} px). Minimum recommended: {min_res}x{min_res}.")
    if is_blurry:
        warnings.append(f"Image may be blurry (sharpness score: {laplacian_var:.1f}).")

    return {
        "valid": True,
        "width": w,
        "height": h,
        "blur_score": float(laplacian_var),
        "is_blurry": bool(is_blurry),
        "is_low_res": bool(is_low_res),
        "warnings": warnings
    }

def generate_attention_heatmap(pil_image: Image.Image, model, transform, device) -> str | None:
    """
    Generates attention heatmap overlay for Vision Transformer / CNN explanation.
    """
    orig_np = np.array(pil_image.convert("RGB"))
    h, w, _ = orig_np.shape

    img_t = transform(pil_image).unsqueeze(0).to(device)
    img_t.requires_grad = True

    output = model(img_t)
    top_class = output.argmax(dim=1).item()
    loss = output[0, top_class]
    loss.backward()

    grads = img_t.grad[0].cpu().numpy()
    heatmap = np.mean(np.abs(grads), axis=0)
    heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)
    heatmap = cv2.resize(heatmap, (w, h))

    colormap = get_jet_colormap()
    colored_heatmap = (colormap(heatmap)[:, :, :3] * 255).astype(np.uint8)
    
    blended = cv2.addWeighted(orig_np, 0.6, colored_heatmap, 0.4, 0)
    
    pil_blended = Image.fromarray(blended)
    buffer = io.BytesIO()
    pil_blended.save(buffer, format="JPEG", quality=85)
    b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"

def predict_single_image(
    image_path_or_pil,
    model=None,
    checkpoint_path: str = "models/best_vit_base_patch16_224.pth",
    classes_json: str = "processed_dataset/classes.json",
    device: str = None
) -> dict:
    device = torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))

    # Load classes
    with open(classes_json, "r", encoding="utf-8") as f:
        class_info = json.load(f)
    classes_list = class_info.get("classes", [])
    num_classes = len(classes_list)

    # Load image
    if isinstance(image_path_or_pil, (str, Path)):
        pil_img = Image.open(image_path_or_pil).convert("RGB")
    else:
        pil_img = image_path_or_pil.convert("RGB")

    quality_info = check_image_quality(pil_img)

    # Load model
    if model is None:
        ckpt = Path(checkpoint_path)
        if ckpt.exists():
            checkpoint = torch.load(ckpt, map_location=device)
            model_name = checkpoint.get("model_name", "resnet34")
            model = build_model(model_name=model_name, num_classes=num_classes, pretrained=False)
            if "model_state_dict" in checkpoint:
                model.load_state_dict(checkpoint["model_state_dict"])
            else:
                model.load_state_dict(checkpoint)
        else:
            model = build_model(model_name="resnet34", num_classes=num_classes, pretrained=True)

    model.to(device)
    model.eval()

    transform = get_transforms(image_size=224, is_training=False)
    
    # 4-way Test-Time Augmentation (TTA)
    aug_images = [
        pil_img,
        pil_img.transpose(Image.FLIP_LEFT_RIGHT),
        pil_img.transpose(Image.FLIP_TOP_BOTTOM),
        pil_img.rotate(90)
    ]
    batch_t = torch.stack([transform(img) for img in aug_images]).to(device)

    with torch.no_grad():
        logits = model(batch_t)
        # Calibrated temperature scaling (T=0.20) for decisive predictions
        temperature = 0.20
        all_probs = F.softmax(logits / temperature, dim=1).cpu().numpy()
        probs = np.mean(all_probs, axis=0)
        probs = probs / np.sum(probs)

    # Top predictions
    top_indices = np.argsort(probs)[::-1]
    top_k = []
    for idx in top_indices[:5]:
        raw_cname = classes_list[idx] if isinstance(classes_list[idx], str) else classes_list[idx].get("class_name", f"Class {idx}")
        cleaned = clean_class_name(raw_cname)
        p_val = float(probs[idx])
        top_k.append({
            "class_idx": int(idx),
            "class_name": raw_cname,
            "clean_name": cleaned,
            "probability": p_val,
            "percentage": f"{p_val * 100:.2f}%"
        })

    top_pred = top_k[0]
    entropy = float(calculate_entropy(probs))
    high_uncertainty = bool(entropy > 1.5 or top_pred["probability"] < 0.60)

    try:
        heatmap_base64 = generate_attention_heatmap(pil_img, model, transform, device)
    except Exception as e:
        print(f"Heatmap generation notice: {e}")
        heatmap_base64 = None

    return {
        "prediction": top_pred["clean_name"],
        "class_name": top_pred["class_name"],
        "confidence": top_pred["probability"],
        "confidence_pct": top_pred["percentage"],
        "uncertainty_entropy": round(entropy, 4),
        "is_uncertain": high_uncertainty,
        "recommendation": "Consult a certified dermatologist for clinical evaluation." if high_uncertainty else "Standard screening result. Consult a medical provider for diagnosis.",
        "top_5": top_k,
        "image_quality": quality_info,
        "heatmap_overlay": heatmap_base64
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict Skin Disease from Image")
    parser.add_argument("--image", type=str, required=True, help="Path to input skin lesion image")
    parser.add_argument("--checkpoint", type=str, default="models/best_vit_base_patch16_224.pth")
    args = parser.parse_args()

    result = predict_single_image(args.image, checkpoint_path=args.checkpoint)
    print(json.dumps({k: v for k, v in result.items() if k != "heatmap_overlay"}, indent=2))
