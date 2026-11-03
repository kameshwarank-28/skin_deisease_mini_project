import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class PredictionRecord(Base):
    """
    SQLAlchemy model for logging prediction transactions and performance metrics.
    """
    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    predicted_class = Column(String(255), index=True, nullable=False)
    confidence = Column(Float, nullable=False)
    uncertainty_entropy = Column(Float, nullable=False)
    is_uncertain = Column(Boolean, default=False, index=True)
    processing_time_ms = Column(Float, default=0.0)
    top_3_json = Column(Text, nullable=True)
    image_preview_b64 = Column(Text, nullable=True)
