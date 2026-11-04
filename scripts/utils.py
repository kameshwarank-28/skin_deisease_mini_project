import numpy as np
import matplotlib
import matplotlib.cm as cm

CLEAN_NAME_MAP = {
    "1. Eczema 1677": "Eczema",
    "10. Warts Molluscum and other Viral Infections - 2103": "Viral Infections (Warts & Molluscum)",
    "2. Melanoma 15.75k": "Melanoma",
    "3. Atopic Dermatitis - 1.25k": "Atopic Dermatitis",
    "4. Basal Cell Carcinoma (BCC) 3323": "Basal Cell Carcinoma (BCC)",
    "5. Melanocytic Nevi (NV) - 7970": "Melanocytic Nevi (NV)",
    "6. Benign Keratosis-like Lesions (BKL) 2624": "Benign Keratosis (BKL)",
    "7. Psoriasis pictures Lichen Planus and related diseases - 2k": "Psoriasis & Lichen Planus",
    "8. Seborrheic Keratoses and other Benign Tumors - 1.8k": "Seborrheic Keratoses & Benign Tumors",
    "9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k": "Fungal Infections (Tinea & Candidiasis)",
    "11. Normal Skin": "Normal / Healthy Skin",
    "12. Normal_Skin": "Normal / Healthy Skin",
    "12. Normal Skin": "Normal / Healthy Skin",
    "Normal_Skin": "Normal / Healthy Skin",
    "Normal Skin": "Normal / Healthy Skin"
}

def clean_class_name(raw_name: str) -> str:
    """
    Maps raw folder names to exact, elegant clinical medical condition names.
    """
    if raw_name in CLEAN_NAME_MAP:
        return CLEAN_NAME_MAP[raw_name]
    
    # Partial match fallback
    for k, v in CLEAN_NAME_MAP.items():
        if raw_name in k or k in raw_name:
            return v

    parts = str(raw_name).split(".", 1)
    name = parts[1].strip() if len(parts) > 1 else str(raw_name)
    tokens = name.split()
    if tokens and tokens[-1].replace("k", "").replace(".", "").replace("-", "").isdigit():
        tokens.pop()
    return " ".join(tokens).strip().rstrip("-").strip()

def calculate_entropy(probs: np.ndarray, eps: float = 1e-9) -> np.ndarray:
    """
    Calculates Shannon Entropy H(p) = -sum(p * log(p)) as a measure of predictive uncertainty.
    """
    return -np.sum(probs * np.log(probs + eps), axis=-1)

def get_jet_colormap():
    """
    Safely retrieves the 'jet' colormap across matplotlib versions.
    """
    try:
        return matplotlib.colormaps.get_cmap("jet")
    except Exception:
        return cm.get_cmap("jet")
