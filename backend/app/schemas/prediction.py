from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class PredictionProbability(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    class_idx: int = Field(..., description="Numerical class index 0-9")
    class_name: str = Field(..., description="Full dataset class directory name")
    clean_name: str = Field(..., description="Cleaned medical condition name")
    probability: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence probability")
    percentage: str = Field(..., description="Formatted probability percentage string")

class ImageQualityInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    valid: bool
    width: int
    height: int
    blur_score: float
    is_blurry: bool
    is_low_res: bool
    warnings: List[str] = Field(default_factory=list)

class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    prediction_id: Optional[int] = None
    prediction: str
    class_name: str
    confidence: float
    confidence_pct: str
    uncertainty_entropy: float
    is_uncertain: bool
    recommendation: str
    top_5: List[PredictionProbability]
    image_quality: ImageQualityInfo
    disease_info: Optional[Dict[str, Any]] = None
    heatmap_overlay: Optional[str] = None
    processing_time_ms: float

class CameraPredictRequest(BaseModel):
    image_base64: str = Field(..., min_length=20, description="Base64 encoded JPEG or PNG image")

class DiseaseDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    name: str
    scientific_name: str
    type: str
    risk_level: str
    description: str
    symptoms: List[str]
    common_triggers: List[str]
    when_to_see_doctor: str
    care_tips: List[str]

class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: str
    predicted_class: str
    confidence: float
    is_uncertain: bool
    processing_time_ms: float
    image_preview: Optional[str] = None
