import os
import sys
import shutil
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from huggingface_hub import hf_hub_download, HfApi
from PIL import Image

def prepare_normal_skin():
    api = HfApi()
    repo_id = 'TheKarna/skin-disease-acne-rosacea-normal'
    
    target_dir = Path('Z:/IMG_CLASSES/Normal_Skin')
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Also create numbered alias for folder indexing compatibility
    alt_dir = Path('Z:/IMG_CLASSES/11. Normal Skin')
    alt_dir.mkdir(parents=True, exist_ok=True)
    
    print("Listing files from Hugging Face repository...")
    all_files = api.list_repo_files(repo_id, repo_type='dataset')
    normal_files = [f for f in all_files if 'normal' in f.lower() and f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Found {len(normal_files)} normal skin files in repository.")
    
    # Select up to 1,500 images for class balance (matching ~1,526 Eczema and ~1,149 Atopic Dermatitis)
    selected_files = normal_files[:1500]
    print(f"Downloading and auditing {len(selected_files)} images...")
    
    def process_file(rel_path):
        try:
            cached_path = hf_hub_download(repo_id=repo_id, filename=rel_path, repo_type='dataset')
            # Verify image readability
            with Image.open(cached_path) as img:
                img_rgb = img.convert('RGB')
                w, h = img_rgb.size
                if w < 100 or h < 100:
                    return None
            
            # Compute hash
            data = Path(cached_path).read_bytes()
            md5_str = hashlib.md5(data).hexdigest()
            
            clean_name = f"normal_skin_{md5_str[:12]}.jpg"
            dest_file = target_dir / clean_name
            dest_alt = alt_dir / clean_name
            
            if not dest_file.exists():
                shutil.copy2(cached_path, dest_file)
            if not dest_alt.exists():
                shutil.copy2(cached_path, dest_alt)
                
            return {
                "filename": clean_name,
                "md5": md5_str,
                "width": w,
                "height": h,
                "source": f"hf:{repo_id}/{rel_path}"
            }
        except Exception as e:
            return None

    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(process_file, selected_files))
        
    valid_results = [r for r in results if r is not None]
    print(f"Successfully processed and verified {len(valid_results)} normal skin images.")
    print(f"Stored in: {target_dir} and {alt_dir}")

if __name__ == "__main__":
    prepare_normal_skin()

