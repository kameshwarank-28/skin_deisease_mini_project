import os
import hashlib
from pathlib import Path
from PIL import Image
import numpy as np

def extract_user_skin_crops():
    source_dir = Path("user_normal_samples")
    target_dir = Path("Z:/IMG_CLASSES/Normal_Skin")
    alt_dir = Path("Z:/IMG_CLASSES/11. Normal Skin")
    target_dir.mkdir(parents=True, exist_ok=True)
    alt_dir.mkdir(parents=True, exist_ok=True)

    crop_records = []
    
    # 3 user images
    for i in [1, 2, 3]:
        p = source_dir / f"user_normal_{i}.jpg"
        if not p.exists():
            continue
        
        with Image.open(p) as img:
            rgb_img = img.convert("RGB")
            w, h = rgb_img.size
            
            # Save full image
            full_dest = target_dir / f"user_normal_full_{i}.jpg"
            rgb_img.save(full_dest, "JPEG", quality=95)
            rgb_img.save(alt_dir / f"user_normal_full_{i}.jpg", "JPEG", quality=95)
            crop_records.append(full_dest)
            
            # Extract high-resolution patches (e.g., 600x600 grid across the 3060x4080 photo)
            crop_size = 600
            step_x = (w - crop_size) // 4
            step_y = (h - crop_size) // 5
            
            crop_idx = 0
            for x in range(0, w - crop_size + 1, step_x):
                for y in range(0, h - crop_size + 1, step_y):
                    box = (x, y, x + crop_size, y + crop_size)
                    patch = rgb_img.crop(box)
                    
                    # Verify patch has valid skin characteristics (not dark corner or edge)
                    np_patch = np.array(patch)
                    mean_val = np.mean(np_patch)
                    std_val = np.std(np_patch)
                    
                    if 50 < mean_val < 220 and std_val > 10:
                        c_name = f"user_normal_img{i}_crop_{crop_idx:03d}.jpg"
                        dest1 = target_dir / c_name
                        dest2 = alt_dir / c_name
                        patch.save(dest1, "JPEG", quality=95)
                        patch.save(dest2, "JPEG", quality=95)
                        crop_records.append(dest1)
                        crop_idx += 1

    print(f"Extracted and saved {len(crop_records)} user normal skin instances into {target_dir} and {alt_dir}.")
    return crop_records

if __name__ == "__main__":
    extract_user_skin_crops()
