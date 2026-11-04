import os
import sys
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path
from PIL import Image

DISEASE_SEARCH_QUERIES = {
    "1. Eczema 1677": [
        "Eczema acute dermatitis clinical skin",
        "Dyshidrotic eczema hand skin",
        "Nummular dermatitis lesion skin",
        "Eczema erythematous skin lesion"
    ],
    "2. Melanoma 15.75k": [
        "Superficial spreading melanoma skin",
        "Nodular melanoma clinical skin",
        "Melanoma lesion dermoscopy skin",
        "Acral lentiginous melanoma skin"
    ],
    "3. Atopic Dermatitis - 1.25k": [
        "Atopic dermatitis skin child",
        "Atopic eczema rash clinical",
        "Flexural eczema atopic skin",
        "Infantile atopic dermatitis rash"
    ],
    "4. Basal Cell Carcinoma (BCC) 3323": [
        "Nodular basal cell carcinoma skin",
        "Superficial basal cell carcinoma lesion",
        "Pigmented basal cell carcinoma dermoscopy",
        "Basal cell carcinoma facial skin"
    ],
    "5. Melanocytic Nevi (NV) - 7970": [
        "Intradermal melanocytic nevus skin",
        "Compound melanocytic nevus skin",
        "Junctional nevus skin lesion",
        "Dysplastic nevus mole skin"
    ],
    "6. Benign Keratosis-like Lesions (BKL) 2624": [
        "Lichen planus-like keratosis skin",
        "Solar lentigo skin lesion",
        "Lichenoid keratosis clinical",
        "Benign keratosis macule skin"
    ],
    "7. Psoriasis pictures Lichen Planus and related diseases - 2k": [
        "Psoriasis plaque extensor skin",
        "Guttate psoriasis papules skin",
        "Lichen planus violaceous papules",
        "Psoriasis vulgaris erythematous plaque"
    ],
    "8. Seborrheic Keratoses and other Benign Tumors - 1.8k": [
        "Seborrheic keratosis waxy stuck-on",
        "Seborrheic keratosis verrucous skin",
        "Dermatosis papulosa nigra facial",
        "Irritated seborrheic keratosis lesion"
    ],
    "9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k": [
        "Tinea corporis ringworm skin lesion",
        "Tinea cruris erythematous border",
        "Cutaneous candidiasis erythematous skin",
        "Tinea versicolor pityriasis macules"
    ],
    "10. Warts Molluscum and other Viral Infections - 2103": [
        "Verruca vulgaris common wart skin",
        "Molluscum contagiosum papules skin",
        "Verruca plana flat warts skin",
        "Plantar wart hyperkeratotic foot skin"
    ]
}

EXCLUDE_KEYWORDS = [
    "histopath", "microscop", "biopsy", "slide", "stain", "h&e", "section",
    "drawing", "diagram", "chart", "map", "logo", "book", "text", "page",
    "table", "graph", "schematic", "illustration", "cover", "portrait"
]

def search_wikimedia_urls(query, limit=10):
    headers = {"User-Agent": "DermAI-MedicalImageCollector/1.0 (academic dermatological research)"}
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrnamespace=6&gsrlimit={limit*3}&prop=imageinfo&iiprop=url|mime|size&format=json"
    req = urllib.request.Request(url, headers=headers)
    urls = []
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
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

                urls.append(img_url)
    except Exception as e:
        print(f"Notice during search '{query}': {e}")
    return urls

def download_and_verify_image(img_url, out_path):
    headers = {"User-Agent": "DermAI-MedicalImageCollector/1.0 (academic dermatological research)"}
    req = urllib.request.Request(img_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()

        out_path.write_bytes(data)

        # Verify using PIL
        with Image.open(out_path) as img:
            w, h = img.size
            if w < 180 or h < 180:
                out_path.unlink(missing_ok=True)
                return False
            rgb = img.convert("RGB")
            # Save clean normalized JPEG
            rgb.save(out_path, "JPEG", quality=92)
        return True
    except Exception:
        out_path.unlink(missing_ok=True)
        return False

def collect_internet_dataset():
    print("=" * 80)
    print("COLLECTING CLINICAL SKIN DISEASE IMAGES FROM THE INTERNET")
    print("=" * 80)

    base_dir = Path("internet_disease_dataset")
    base_dir.mkdir(parents=True, exist_ok=True)

    summary = {}
    target_per_class = 12

    for folder_name, queries in DISEASE_SEARCH_QUERIES.items():
        class_dir = base_dir / folder_name
        class_dir.mkdir(parents=True, exist_ok=True)

        existing = [f for f in class_dir.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
        print(f"\nProcessing [{folder_name}]: {len(existing)} existing images.")

        if len(existing) >= target_per_class:
            summary[folder_name] = len(existing)
            continue

        candidate_urls = []
        for q in queries:
            if len(candidate_urls) >= target_per_class * 3:
                break
            found = search_wikimedia_urls(q, limit=8)
            for u in found:
                if u not in candidate_urls:
                    candidate_urls.append(u)

        downloaded = len(existing)
        for i, u in enumerate(candidate_urls):
            if downloaded >= target_per_class:
                break
            out_file = class_dir / f"internet_{folder_name[:2]}_{downloaded+1:03d}.jpg"
            if download_and_verify_image(u, out_file):
                downloaded += 1
                print(f"  [{downloaded}/{target_per_class}] Downloaded & verified: {out_file.name}")
            time.sleep(0.3)

        summary[folder_name] = downloaded
        print(f"Total verified internet images for [{folder_name}]: {downloaded}")

    print("\n" + "=" * 80)
    print("INTERNET CLINICAL DATASET COLLECTION SUMMARY:")
    print("=" * 80)
    for folder, count in summary.items():
        print(f"  {folder:65s}: {count:2d} images")

    with open(base_dir / "internet_collection_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary

if __name__ == "__main__":
    collect_internet_dataset()

