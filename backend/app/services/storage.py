import os
import io
import hashlib
import base64
from pathlib import Path
from PIL import Image
from fastapi import HTTPException

UPLOAD_DIR = Path("backend/app/data/uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def compute_image_hash(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()

def save_image_bytes(image_bytes: bytes, user_id: int, original_filename: str = "image.jpg") -> tuple[str, str, str]:
    """
    Saves image with deduplication based on SHA-256 hash.
    Returns: (stored_filename, image_hash, thumbnail_b64)
    """
    image_hash = compute_image_hash(image_bytes)
    ext = original_filename.split(".")[-1].lower() if "." in original_filename else "jpg"
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        ext = "jpg"
    
    user_upload_dir = UPLOAD_DIR / str(user_id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    stored_filename = f"{image_hash[:16]}.{ext}"
    target_path = user_upload_dir / stored_filename
    
    # Write only if not already existing (deduplication)
    if not target_path.exists():
        with open(target_path, "wb") as f:
            f.write(image_bytes)

    # Generate thumbnail
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    thumb = pil_image.copy()
    thumb.thumbnail((200, 200))
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=75)
    thumbnail_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    return stored_filename, image_hash, thumbnail_b64

def get_image_path(user_id: int, filename: str) -> Path:
    # Protect against path traversal
    safe_name = os.path.basename(filename)
    path = (UPLOAD_DIR / str(user_id) / safe_name).resolve()
    if not str(path).startswith(str(UPLOAD_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    return path

