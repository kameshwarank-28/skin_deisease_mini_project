import io
import json
import base64
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from PIL import Image

from backend.app.schemas.prediction import (
    PredictionResponse,
    CameraPredictRequest,
    DiseaseDetail,
    HistoryItem
)
from backend.app.services.classifier import classifier_service
from backend.app.services.database import get_db
from backend.app.models.history import PredictionRecord

router = APIRouter()

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "bmp"}
MAX_FILE_SIZE_MB = 10

def validate_image_file(file: UploadFile) -> Image.Image:
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    try:
        contents = file.file.read()
        if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {MAX_FILE_SIZE_MB}MB.")
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode uploaded image: {str(e)}")

def decode_base64_image(base64_str: str) -> Image.Image:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        image_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(image_data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

def make_thumbnail_b64(pil_image: Image.Image, size=(128, 128)) -> str:
    thumb = pil_image.copy()
    thumb.thumbnail(size)
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=70)
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

def log_prediction(db: Session, result: dict, pil_image: Image.Image) -> int:
    try:
        thumb_b64 = make_thumbnail_b64(pil_image)
        record = PredictionRecord(
            predicted_class=result["prediction"],
            confidence=result["confidence"],
            uncertainty_entropy=result["uncertainty_entropy"],
            is_uncertain=result["is_uncertain"],
            processing_time_ms=result["processing_time_ms"],
            top_3_json=json.dumps(result["top_5"][:3]),
            image_preview_b64=thumb_b64
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record.id
    except Exception as e:
        db.rollback()
        print(f"[DB] Log error: {e}")
        return 0

@router.get("/health", summary="Health Check")
def health_check():
    return {
        "status": "healthy",
        "service": "Skin Disease AI Classifier",
        "num_classes": len(classifier_service.classes_list),
        "device": str(classifier_service.device)
    }

@router.post("/predict", response_model=PredictionResponse, summary="Predict from Image File")
async def predict_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    pil_image = validate_image_file(file)
    result = classifier_service.predict(pil_image)
    rec_id = log_prediction(db, result, pil_image)
    result["prediction_id"] = rec_id
    return result

@router.post("/predict/camera", response_model=PredictionResponse, summary="Predict from Webcam Base64 Image")
async def predict_camera_image(
    payload: CameraPredictRequest,
    db: Session = Depends(get_db)
):
    pil_image = decode_base64_image(payload.image_base64)
    result = classifier_service.predict(pil_image)
    rec_id = log_prediction(db, result, pil_image)
    result["prediction_id"] = rec_id
    return result

@router.get("/diseases", summary="List All Skin Diseases Database")
def get_all_diseases():
    return classifier_service.diseases_db

@router.get("/diseases/{class_name}", summary="Get Single Disease Information")
def get_disease_by_name(class_name: str):
    if class_name in classifier_service.diseases_db:
        return classifier_service.diseases_db[class_name]
    # Check partial match
    for key, data in classifier_service.diseases_db.items():
        if class_name.lower() in key.lower() or class_name.lower() in data.get("name", "").lower():
            return data
    raise HTTPException(status_code=404, detail="Disease not found in encyclopedia.")

@router.get("/history", response_model=List[HistoryItem], summary="Get Prediction History")
def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    records = db.query(PredictionRecord).order_by(PredictionRecord.created_at.desc()).limit(limit).all()
    return [
        HistoryItem(
            id=r.id,
            created_at=r.created_at.isoformat() if r.created_at else "",
            predicted_class=r.predicted_class,
            confidence=r.confidence,
            is_uncertain=r.is_uncertain,
            processing_time_ms=r.processing_time_ms or 0.0,
            image_preview=r.image_preview_b64
        )
        for r in records
    ]

@router.delete("/history/{record_id}", summary="Delete History Record")
def delete_history_record(record_id: int, db: Session = Depends(get_db)):
    rec = db.query(PredictionRecord).filter(PredictionRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(rec)
    db.commit()
    return {"status": "deleted", "id": record_id}
