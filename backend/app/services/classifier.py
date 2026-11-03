import io
import json
import base64
import time
from pathlib import Path
from PIL import Image
import numpy as np

# Torch imports (with fallback handling if running in lightweight test environment)
try:
    import torch
    import torch.nn.functional as F
    import cv2
    from torchvision import transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "scripts"))

from scripts.utils import clean_class_name, calculate_entropy, get_jet_colormap

class SkinClassifierService:
    def __init__(
        self,
        checkpoint_path: str = "models/best_model.pth",
        classes_path: str = "processed_dataset/classes.json",
        diseases_path: str = "backend/app/data/diseases.json"
    ):
        self.checkpoint_path = Path(checkpoint_path)
        self.classes_path = Path(classes_path)
        self.diseases_path = Path(diseases_path)
        self.model = None
        self.model_name = "resnet50"
        self.temperature = 0.50
        self.device = "cpu"
        self.classes_list = []
        self.diseases_db = {}
        self._has_checkpoint = False
        
        self.load_metadata()
        self.init_model()

    def load_metadata(self):
        if self.classes_path.exists():
            with open(self.classes_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.classes_list = data.get("classes", [])
        else:
            self.classes_list = [
                "1. Eczema 1677",
                "10. Warts Molluscum and other Viral Infections - 2103",
                "2. Melanoma 15.75k",
                "3. Atopic Dermatitis - 1.25k",
                "4. Basal Cell Carcinoma (BCC) 3323",
                "5. Melanocytic Nevi (NV) - 7970",
                "6. Benign Keratosis-like Lesions (BKL) 2624",
                "7. Psoriasis pictures Lichen Planus and related diseases - 2k",
                "8. Seborrheic Keratoses and other Benign Tumors - 1.8k",
                "9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k"
            ]

        if self.diseases_path.exists():
            with open(self.diseases_path, "r", encoding="utf-8") as f:
                self.diseases_db = json.load(f)

    def init_model(self):
        if not TORCH_AVAILABLE:
            print("[Classifier] PyTorch not available in current environment. Using simulated mode.")
            return

        try:
            from scripts.models import build_model
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            num_classes = len(self.classes_list)

            # Check candidate checkpoint files
            target_ckpt = None
            for cand in [self.checkpoint_path, Path("models/best_model.pth"), Path("models/best_vit_base_patch16_224.pth"), Path("models/best_resnet34.pth")]:
                if cand.exists():
                    target_ckpt = cand
                    break

            if target_ckpt is not None:
                print(f"[Classifier] Loading weights from {target_ckpt}")
                checkpoint = torch.load(target_ckpt, map_location=self.device)
                model_name = checkpoint.get("model_name", "resnet50")
                self.model_name = model_name
                self.temperature = float(checkpoint.get("temperature", 0.50))
                self.model = build_model(model_name=model_name, num_classes=num_classes, pretrained=False)
                if "model_state_dict" in checkpoint:
                    self.model.load_state_dict(checkpoint["model_state_dict"])
                else:
                    self.model.load_state_dict(checkpoint)
                self._has_checkpoint = True
                print(f"[Classifier] Loaded {model_name} with calibrated temperature T={self.temperature:.4f}")
            else:
                print("[Classifier] No checkpoint found yet. Loading base pretrained backbone...")
                self.model = build_model(model_name="resnet50", num_classes=num_classes, pretrained=True)
                self._has_checkpoint = False

            self.model.to(self.device)
            self.model.eval()
            print(f"[Classifier] Model successfully loaded on {self.device}")
        except Exception as e:
            print(f"[Classifier] Error loading PyTorch model: {e}")
            self.model = None

    def check_image_quality(self, pil_image: Image.Image) -> dict:
        w, h = pil_image.size
        is_low_res = (w < 150 or h < 150)
        blur_score = 100.0
        is_blurry = False

        if TORCH_AVAILABLE:
            try:
                np_img = np.array(pil_image.convert("L"))
                blur_score = float(cv2.Laplacian(np_img, cv2.CV_64F).var())
                is_blurry = blur_score < 30.0
            except Exception:
                pass

        warnings = []
        if is_low_res:
            warnings.append(f"Image resolution ({w}x{h} px) is lower than recommended (minimum 150x150 px).")
        if is_blurry:
            warnings.append(f"Image appears blurry (sharpness score: {blur_score:.1f}).")

        return {
            "valid": True,
            "width": w,
            "height": h,
            "blur_score": blur_score,
            "is_blurry": is_blurry,
            "is_low_res": is_low_res,
            "warnings": warnings
        }

    def generate_attention_heatmap(self, pil_image: Image.Image, target_class: int = None) -> str | None:
        if not TORCH_AVAILABLE or self.model is None:
            return None

        try:
            from scripts.dataset import get_transforms
            orig_np = np.array(pil_image.convert("RGB"))
            h, w, _ = orig_np.shape

            # Target layer based on architecture for true Grad-CAM
            target_layer = None
            m_name = getattr(self, "model_name", "resnet50").lower()
            if "densenet" in m_name:
                features = getattr(self.model, "features", None)
                if features is not None:
                    target_layer = features[-1]
            elif "resnet" in m_name:
                layer4 = getattr(self.model, "layer4", None)
                if layer4 is not None:
                    target_layer = layer4[-1]
            elif "efficientnet" in m_name:
                target_layer = getattr(self.model, "conv_head", None)
            elif "convnext" in m_name:
                stages = getattr(self.model, "stages", None)
                if stages is not None:
                    target_layer = stages[-1]

            if target_layer is None:
                for module in reversed(list(self.model.modules())):
                    if isinstance(module, torch.nn.Conv2d):
                        target_layer = module
                        break

            transform = get_transforms(image_size=224, is_training=False)
            img_t = transform(pil_image).unsqueeze(0).to(self.device)

            if target_layer is not None:
                activations = []
                gradients = []

                def forward_hook(module, inp, out):
                    activations.append(out)

                def backward_hook(module, gin, gout):
                    gradients.append(gout[0])

                h_f = target_layer.register_forward_hook(forward_hook)
                h_b = target_layer.register_full_backward_hook(backward_hook)

                self.model.zero_grad()
                output = self.model(img_t)
                if target_class is None:
                    target_class = output.argmax(dim=1).item()

                loss = output[0, target_class]
                loss.backward()

                h_f.remove()
                h_b.remove()

                if activations and gradients:
                    act = activations[0].detach().cpu().numpy()[0]
                    grad = gradients[0].detach().cpu().numpy()[0]
                    weights = np.mean(grad, axis=(1, 2))
                    cam = np.zeros(act.shape[1:], dtype=np.float32)
                    for i, wt in enumerate(weights):
                        cam += wt * act[i]
                    cam = np.maximum(cam, 0)
                    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-9)
                    heatmap = cv2.resize(cam, (w, h))
                else:
                    heatmap = np.zeros((h, w), dtype=np.float32)
            else:
                img_t.requires_grad = True
                output = self.model(img_t)
                if target_class is None:
                    target_class = output.argmax(dim=1).item()
                loss = output[0, target_class]
                loss.backward()
                grads = img_t.grad[0].cpu().numpy()
                heatmap = np.mean(np.abs(grads), axis=0)
                heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)
                heatmap = cv2.resize(heatmap, (w, h))

            colormap = get_jet_colormap()
            colored_heatmap = (colormap(heatmap)[:, :, :3] * 255).astype(np.uint8)
            blended = cv2.addWeighted(orig_np, 0.65, colored_heatmap, 0.35, 0)

            pil_blended = Image.fromarray(blended)
            buffer = io.BytesIO()
            pil_blended.save(buffer, format="JPEG", quality=85)
            b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{b64_str}"
        except Exception as e:
            print(f"[Classifier] Heatmap generation notice: {e}")
            return None

    def predict(self, pil_image: Image.Image) -> dict:
        start_time = time.time()
        
        # Reload checkpoint if available and not yet loaded
        if not self._has_checkpoint:
            self.init_model()

        quality_info = self.check_image_quality(pil_image)
        num_classes = len(self.classes_list)

        if TORCH_AVAILABLE and self.model is not None:
            from scripts.dataset import get_transforms
            transform = get_transforms(image_size=224, is_training=False)
            
            # Standard medical imaging TTA: Original + Horizontal Reflection
            t_orig = transform(pil_image).unsqueeze(0).to(self.device)
            t_flip = transform(pil_image.transpose(Image.FLIP_LEFT_RIGHT)).unsqueeze(0).to(self.device)

            with torch.no_grad():
                l1 = self.model(t_orig)[0]
                l2 = self.model(t_flip)[0]
                mean_logits = (l1 + l2) / 2.0

                # Calibrated temperature scaling from checkpoint
                temperature = getattr(self, "temperature", 0.50)
                temperature = max(0.05, float(temperature))
                probs = F.softmax(mean_logits / temperature, dim=-1).cpu().numpy()
        else:
            probs = np.ones(num_classes) / num_classes

        # Calculate top predictions
        sorted_indices = np.argsort(probs)[::-1]
        top_5 = []
        for idx in sorted_indices[:5]:
            raw_cname = self.classes_list[idx] if idx < len(self.classes_list) else f"Class {idx}"
            cleaned = clean_class_name(raw_cname)
            p_val = float(probs[idx])
            top_5.append({
                "class_idx": int(idx),
                "class_name": raw_cname,
                "clean_name": cleaned,
                "probability": p_val,
                "percentage": f"{p_val * 100:.2f}%"
            })

        top_pred = top_5[0]
        entropy = float(calculate_entropy(probs))
        is_uncertain = bool(entropy > 1.5 or top_pred["probability"] < 0.60)

        # Generate attention heatmap for the top predicted disease
        heatmap_overlay = self.generate_attention_heatmap(pil_image, target_class=top_pred["class_idx"])

        # Match disease database details
        disease_info = self.diseases_db.get(top_pred["class_name"])

        elapsed_ms = (time.time() - start_time) * 1000.0

        return {
            "prediction": top_pred["clean_name"],
            "class_name": top_pred["class_name"],
            "confidence": top_pred["probability"],
            "confidence_pct": top_pred["percentage"],
            "uncertainty_entropy": round(entropy, 4),
            "is_uncertain": is_uncertain,
            "recommendation": (
                "High uncertainty detected. Strongly recommended to consult a certified dermatologist for clinical diagnosis."
                if is_uncertain else
                "Standard screening prediction. For confirmation and diagnosis, consult a medical healthcare professional."
            ),
            "top_5": top_5,
            "image_quality": quality_info,
            "disease_info": disease_info,
            "heatmap_overlay": heatmap_overlay,
            "processing_time_ms": round(elapsed_ms, 2)
        }

classifier_service = SkinClassifierService()

