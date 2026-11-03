import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.models.history import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), default="patient", nullable=False, index=True) # "patient" | "doctor" | "admin"
    phone_number = Column(String(50), nullable=True)
    timezone = Column(String(64), default="UTC")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    skin_records = relationship("SkinHealthRecord", back_populates="user", cascade="all, delete-orphan")
    symptoms = relationship("SymptomRecord", back_populates="user", cascade="all, delete-orphan")
    consultations = relationship("DermatologistConsultation", foreign_keys="[DermatologistConsultation.user_id]", back_populates="user", cascade="all, delete-orphan")
    treatments = relationship("TreatmentRecord", foreign_keys="[TreatmentRecord.user_id]", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("FollowUpAppointment", foreign_keys="[FollowUpAppointment.user_id]", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", foreign_keys="[Notification.user_id]", back_populates="user", cascade="all, delete-orphan")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    patient_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(50), nullable=True)  # Male, Female, Non-Binary, Prefer not to say, Other
    phone_number = Column(String(50), nullable=True)
    email_address = Column(String(255), nullable=True)
    additional_details = Column(Text, nullable=True)  # e.g., skin allergies, medical history notes
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="patient_profile")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    medical_reg_no = Column(String(100), nullable=False)
    qualification = Column(String(255), nullable=False)
    specialization = Column(String(255), nullable=False)
    hospital_name = Column(String(255), nullable=False)
    years_experience = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    verification_status = Column(String(50), default="Pending Verification", nullable=False, index=True) # Pending Verification, Verified, Rejected
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="doctor_profile")


class PatientDoctorConnection(Base):
    __tablename__ = "patient_doctor_connections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(50), default="Requested", nullable=False, index=True) # Requested, Accepted, Rejected, Disconnected
    request_note = Column(Text, nullable=True)
    response_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])


class SkinHealthRecord(Base):
    __tablename__ = "skin_health_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_filename = Column(String(512), nullable=False)
    image_hash = Column(String(64), nullable=False, index=True)  # SHA-256 for deduplication
    thumbnail_b64 = Column(Text, nullable=True)
    capture_date = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    body_location = Column(String(100), nullable=False, index=True)
    user_notes = Column(Text, nullable=True)

    # Optional linkage to an AI prediction
    prediction_id = Column(Integer, ForeignKey("prediction_records.id"), nullable=True)
    predicted_disease = Column(String(255), nullable=True)
    confidence_score = Column(Float, nullable=True)

    # Relationships
    user = relationship("User", back_populates="skin_records")
    symptoms = relationship("SymptomRecord", back_populates="skin_record", cascade="all, delete-orphan")


class SymptomRecord(Base):
    __tablename__ = "symptom_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    skin_record_id = Column(Integer, ForeignKey("skin_health_records.id"), nullable=True, index=True)
    symptom_name = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False)  # Mild, Moderate, Severe
    severity_score = Column(Integer, nullable=False)  # 1=Mild, 2=Moderate, 3=Severe
    recorded_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    duration = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="symptoms")
    skin_record = relationship("SkinHealthRecord", back_populates="symptoms")


class DermatologistConsultation(Base):
    __tablename__ = "dermatologist_consultations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # Patient ID
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True) # Doctor ID
    doctor_name = Column(String(255), nullable=False)
    clinic_name = Column(String(255), nullable=False)
    consultation_date = Column(DateTime, nullable=False, index=True)
    doctor_diagnosis = Column(Text, nullable=False) # Clinical Doctor Diagnosis
    clinical_observations = Column(Text, nullable=True) # Physical findings
    recommendations = Column(Text, nullable=True)
    consultation_notes = Column(Text, nullable=True)
    follow_up_instructions = Column(Text, nullable=True)
    follow_up_date = Column(DateTime, nullable=True)
    expected_review_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="consultations")
    doctor = relationship("User", foreign_keys=[doctor_id])
    treatments = relationship("TreatmentRecord", back_populates="consultation")
    appointments = relationship("FollowUpAppointment", back_populates="consultation")


class TreatmentRecord(Base):
    __tablename__ = "treatment_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # Patient ID
    prescribed_by_doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    consultation_id = Column(Integer, ForeignKey("dermatologist_consultations.id"), nullable=True)
    treatment_name = Column(String(255), nullable=False)
    prescribed_medication = Column(String(255), nullable=True)
    treatment_type = Column(String(100), nullable=False)  # Topical Cream, Oral Medication, Skin Care Regimen, Phototherapy, Procedure, Other
    dosage_or_instructions = Column(Text, nullable=False)
    treatment_status = Column(String(50), default="Treatment Prescribed", nullable=False) # Treatment Prescribed, Treatment Ongoing, Review Required, Completed, Discontinued by Treating Doctor
    start_date = Column(DateTime, nullable=False)
    review_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    notes = Column(Text, nullable=True)
    doctor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="treatments")
    prescribing_doctor = relationship("User", foreign_keys=[prescribed_by_doctor_id])
    consultation = relationship("DermatologistConsultation", back_populates="treatments")


class FollowUpAppointment(Base):
    __tablename__ = "follow_up_appointments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # Patient ID
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True) # Doctor ID
    consultation_id = Column(Integer, ForeignKey("dermatologist_consultations.id"), nullable=True)
    doctor_or_clinic = Column(String(255), nullable=False)
    appointment_date = Column(DateTime, nullable=False, index=True)
    appointment_time = Column(String(50), nullable=True)
    original_appointment_date = Column(DateTime, nullable=True)
    purpose_or_notes = Column(Text, nullable=True)
    reminder_advance_hours = Column(Integer, default=24)
    status = Column(String(50), default="PENDING", index=True)  # PENDING, CONFIRMED, REJECTED, RESCHEDULED, AWAITING_PATIENT_CONFIRMATION, COMPLETED, CANCELLED
    suggested_date = Column(String(50), nullable=True)
    suggested_time = Column(String(50), nullable=True)
    suggested_alternate_time = Column(String(255), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    doctor_response = Column(Text, nullable=True)
    doctor_response_notes = Column(Text, nullable=True)
    doctor_response_at = Column(DateTime, nullable=True)
    patient_response_at = Column(DateTime, nullable=True)
    is_reminder_sent = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="appointments")
    doctor = relationship("User", foreign_keys=[doctor_id])
    consultation = relationship("DermatologistConsultation", back_populates="appointments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # Recipient
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Sender (e.g. Doctor or Patient)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # AppointmentRequest, AppointmentAccepted, AppointmentRejected, AppointmentRescheduled, ConnectionRequest, ConnectionAccepted, ConsultationUpdate, TreatmentUpdate, WorseningAlert, System
    urgency = Column(String(20), default="Normal")  # Normal, Warning, Urgent
    is_read = Column(Boolean, default=False, index=True)
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender = relationship("User", foreign_keys=[sender_id])


class ImageComparisonRecord(Base):
    __tablename__ = "image_comparison_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    earlier_record_id = Column(Integer, ForeignKey("skin_health_records.id"), nullable=False)
    later_record_id = Column(Integer, ForeignKey("skin_health_records.id"), nullable=False)
    similarity_score = Column(Float, nullable=True)
    histogram_distance = Column(Float, nullable=True)
    color_shift_detected = Column(Boolean, default=False)
    observations_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
