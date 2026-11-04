import os
import sys
import json
import time
import argparse
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

import torch
import torch.nn.functional as F
from torchvision import transforms
import timm

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def clean_class_name(raw_name: str) -> str:
    parts = raw_name.split(".", 1)
    name = parts[1].strip() if len(parts) > 1 else raw_name
    tokens = name.split()
    if tokens and tokens[-1].replace("k", "").replace(".", "").isdigit():
        tokens.pop()
    return " ".join(tokens).strip()

def check_image_quality(pil_image: Image.Image) -> dict:
    w, h = pil_image.size
    is_low_res = (w < 150 or h < 150)
    
    np_gray = np.array(pil_image.convert("L"))
    blur_score = float(cv2.Laplacian(np_gray, cv2.CV_64F).var())
    is_blurry = blur_score < 30.0

    mean_brightness = float(np.mean(np_gray))
    is_too_dark = mean_brightness < 35.0
    is_overexposed = mean_brightness > 225.0

    warnings = []
    if is_low_res: warnings.append(f"Low resolution: {w}x{h} px (recommended min 150x150).")
    if is_blurry: warnings.append(f"Image appears blurry (sharpness score: {blur_score:.1f}).")
    if is_too_dark: warnings.append(f"Severely underexposed/dark image (mean brightness: {mean_brightness:.1f}).")
    if is_overexposed: warnings.append(f"Severely overexposed image (mean brightness: {mean_brightness:.1f}).")

    is_rejected = is_too_dark or is_overexposed or (is_low_res and is_blurry)
    return {
        "width": w,
        "height": h,
        "blur_score": round(blur_score, 1),
        "mean_brightness": round(mean_brightness, 1),
        "is_rejected": is_rejected,
        "warnings": warnings
    }

def generate_gradcam(model, pil_image: Image.Image, target_class: int, device: torch.device, image_size: int = 224):
    model.eval()
    target_layer = getattr(model, "conv_head", None)
    if target_layer is None:
        stages = getattr(model, "stages", None)
        if stages is not None:
            target_layer = stages[-1]
    if target_layer is None:
        for module in reversed(list(model.modules())):
            if isinstance(module, torch.nn.Conv2d):
                target_layer = module
                break

    eval_tf = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    img_t = eval_tf(pil_image).unsqueeze(0).to(device)

    orig_np = np.array(pil_image.convert("RGB"))
    h, w, _ = orig_np.shape

    if target_layer is not None:
        activations, gradients = [], []
        def forward_hook(module, inp, output): activations.append(output)
        def backward_hook(module, gin, gout): gradients.append(gout[0])
        h1 = target_layer.register_forward_hook(forward_hook)
        h2 = target_layer.register_full_backward_hook(backward_hook)

        model.zero_grad()
        out = model(img_t)
        if target_class is None:
            target_class = out.argmax(dim=1).item()
        out[0, target_class].backward()
        h1.remove()
        h2.remove()

        act = activations[0].detach().cpu().numpy()[0]
        grad = gradients[0].detach().cpu().numpy()[0]
        weights = np.mean(grad, axis=(1, 2))
        cam = np.zeros(act.shape[1:], dtype=np.float32)
        for i, weight_val in enumerate(weights):
            cam += weight_val * act[i]
        cam = np.maximum(cam, 0)
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-9)
        cam_resized = cv2.resize(cam, (w, h))
    else:
        # Fallback to smoothed saliency
        img_t.requires_grad = True
        model.zero_grad()
        out = model(img_t)
        if target_class is None: target_class = out.argmax(dim=1).item()
        out[0, target_class].backward()
        grad = img_t.grad.data.abs().sum(dim=1).squeeze().cpu().numpy()
        grad = cv2.GaussianBlur(grad, (15, 15), 0)
        norm_map = (grad - grad.min()) / (grad.max() - grad.min() + 1e-9)
        cam_resized = cv2.resize(norm_map, (w, h))

    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    blended = cv2.addWeighted(orig_np, 0.65, heatmap, 0.35, 0)
    return blended

def main():
    parser = argparse.ArgumentParser(description="DermAI Standalone Prediction CLI")
    parser.add_argument("--image", type=str, required=True, help="Path to dermatological image")
    parser.add_argument("--checkpoint", type=str, default="models/best_model.pth")
    parser.add_argument("--output_heatmap", type=str, default="heatmap_prediction.jpg")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Error: Image not found at {image_path}")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt_path = Path(args.checkpoint)
    if not ckpt_path.exists():
        print(f"Error: Checkpoint not found at {ckpt_path}")
        sys.exit(1)

    checkpoint = torch.load(ckpt_path, map_location=device)
    model_name = checkpoint.get("model_name", "efficientnetv2_s")
    timm_key = checkpoint.get("timm_model_name", checkpoint.get("timm_key", model_name))
    if timm_key in ["efficientnetv2_s", "efficientnet_v2_s"]:
        timm_key = "tf_efficientnetv2_s"
    elif timm_key in ["dinov2_vitb14", "dinov2"]:
        timm_key = "vit_base_patch14_dinov2.lvd142m"

    num_classes = checkpoint.get("num_classes", 10)
    classes_list = checkpoint.get("classes", [])
    temperature = float(checkpoint.get("temperature", 1.0))
    image_size = int(checkpoint.get("training_resolution", 224))

    model = timm.create_model(timm_key, pretrained=False, num_classes=num_classes)
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)
    model.to(device)
    model.eval()

    # Load and check quality
    with Image.open(image_path) as img:
        pil_img = img.convert("RGB")

    quality = check_image_quality(pil_img)
    if quality["is_rejected"]:
        print("\n" + "!" * 65)
        print("QUALITY WARNING: Image rejected due to poor capture quality:")
        for w in quality["warnings"]:
            print(f"  - {w}")
        print("Please provide a well-lit, focused photograph of the skin lesion.")
        print("!" * 65)

    eval_tf = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    t_orig = eval_tf(pil_img).unsqueeze(0).to(device)
    t_flip = eval_tf(pil_img.transpose(Image.FLIP_LEFT_RIGHT)).unsqueeze(0).to(device)

    start_time = time.time()
    with torch.no_grad():
        l1 = model(t_orig)[0]
        l2 = model(t_flip)[0]
        mean_logits = (l1 + l2) / 2.0
        cal_logits = mean_logits / max(0.05, temperature)
        probs = F.softmax(cal_logits, dim=-1).cpu().numpy()
    latency_ms = (time.time() - start_time) * 1000.0

    sorted_indices = np.argsort(probs)[::-1]
    top_class_idx = sorted_indices[0]
    top_prob = float(probs[top_class_idx])
    top_clean_name = clean_class_name(classes_list[top_class_idx])

    entropy = float(-np.sum(probs * np.log(probs + 1e-9)))
    is_uncertain = bool(entropy > 1.6 or top_prob < 0.20 or quality["is_rejected"])

    print("\n" + "=" * 65)
    print("DERMAI CLINICAL AI PREDICTION")
    print("=" * 65)
    print(f"Image:                 {image_path.name}")
    print(f"Model Architecture:    {model_name} (T={temperature:.2f})")
    print(f"Primary Prediction:    {top_clean_name}")
    print(f"Calibrated Confidence: {top_prob*100:.2f}%")
    print(f"Uncertainty Flag:      {'HIGH UNCERTAINTY' if is_uncertain else 'STANDARD SCREENING'}")
    print(f"Inference Time:        {latency_ms:.2f} ms")

    print("\nTop-3 Differential Diagnosis Probabilities:")
    for rank, idx in enumerate(sorted_indices[:3], 1):
        cname = clean_class_name(classes_list[idx])
        p_val = float(probs[idx])
        print(f"  #{rank} {p_val*100:>6.2f}%  ->  {cname}")

    print("\nClinical Safety Notice:")
    print("  AI screening predictions are statistical estimates and do NOT constitute")
    print("  a confirmed medical diagnosis. Consult a board-certified dermatologist.")
    print("=" * 65)

    # Generate and save heatmap
    blended = generate_gradcam(model, pil_img, top_class_idx, device, image_size=image_size)
    cv2.imwrite(args.output_heatmap, cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
    print(f"\nSaved explainability heatmap to: {args.output_heatmap}")

if __name__ == "__main__":
    main()
