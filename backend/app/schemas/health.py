import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# --- Patient Profile Schemas ---
class PatientProfileCreate(BaseModel):
    patient_name: str = Field(..., min_length=1, description="Full name of patient")
    age: int = Field(..., ge=0, le=130, description="Age in years")
    gender: Optional[str] = Field(None, description="Male, Female, Non-Binary, Prefer not to say, Other")
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    additional_details: Optional[str] = None

class PatientProfileUpdate(BaseModel):
    patient_name: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    additional_details: Optional[str] = None

class PatientProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    patient_name: str
    age: int
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    additional_details: Optional[str] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None


# --- Doctor Profile Schemas ---
class DoctorProfileCreate(BaseModel):
    medical_reg_no: str = Field(..., min_length=3)
    qualification: str = Field(..., min_length=2)
    specialization: str = Field(..., min_length=2)
    hospital_name: str = Field(..., min_length=2)
    years_experience: Optional[int] = Field(None, ge=0, le=70)
    bio: Optional[str] = None

class DoctorProfileUpdate(BaseModel):
    qualification: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None

class DoctorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    medical_reg_no: str
    qualification: str
    specialization: str
    hospital_name: str
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    verification_status: str # "Pending Verification", "Verified", "Rejected"
    verified_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

class DoctorDirectoryItem(BaseModel):
    id: int # doctor's user_id
    doctor_id: Optional[int] = None
    doctor_profile_id: int
    full_name: str
    email: str
    phone_number: Optional[str] = None
    qualification: str
    specialization: str
    hospital_name: str
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    verification_status: str
    connection_status: Optional[str] = None # None, "Requested", "Accepted", "Rejected"


# --- Connection Schemas ---
class ConnectionRequestCreate(BaseModel):
    doctor_id: int
    request_note: Optional[str] = None

class ConnectionActionRequest(BaseModel):
    action: str # "accept" | "reject" | "disconnect"
    response_note: Optional[str] = None

class PatientDoctorConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    doctor_id: int
    status: str # "Requested", "Accepted", "Rejected", "Disconnected"
    request_note: Optional[str] = None
    response_note: Optional[str] = None
    created_at: datetime.datetime
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None


# --- Auth Schemas ---
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, description="User full name")
    username: str = Field(..., min_length=3, max_length=50, description="Unique account username")
    email: str = Field(..., min_length=5, description="Valid email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    role: str = Field("patient", description="Account role: patient or doctor")
    phone_number: Optional[str] = None
    timezone: Optional[str] = "UTC"

    # Doctor specific registration fields
    medical_reg_no: Optional[str] = None
    qualification: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None

class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username or Email")
    password: str = Field(..., min_length=1)
    role: str = Field("patient", description="Requested role: patient or doctor")

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    role: str = "patient"
    has_patient_profile: bool = False
    doctor_verification_status: Optional[str] = None

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str
    role: str
    phone_number: Optional[str] = None
    timezone: str
    profile_picture: Optional[str] = None
    created_at: datetime.datetime
    patient_profile: Optional[PatientProfileResponse] = None
    doctor_profile: Optional[DoctorProfileResponse] = None


# --- Symptom Schemas ---
class SymptomCreate(BaseModel):
    skin_record_id: Optional[int] = None
    symptom_name: str = Field(..., description="e.g. Itching, Redness, Swelling, Dryness, Pain, Burning Sensation, Irritation, Peeling, Other")
    severity: str = Field(..., description="Mild, Moderate, Severe")
    recorded_at: Optional[datetime.datetime] = None
    duration: Optional[str] = None
    notes: Optional[str] = None

class SymptomUpdate(BaseModel):
    symptom_name: Optional[str] = None
    severity: Optional[str] = None
    duration: Optional[str] = None
    notes: Optional[str] = None

class SymptomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    skin_record_id: Optional[int] = None
    symptom_name: str
    severity: str
    severity_score: int
    recorded_at: datetime.datetime
    duration: Optional[str] = None
    notes: Optional[str] = None
    doctor_observation: Optional[str] = None
    doctor_feedback: Optional[str] = None
    reviewed_by_doctor_id: Optional[int] = None
    reviewed_by_doctor_name: Optional[str] = None
    reviewed_at: Optional[datetime.datetime] = None
    skin_record_image_url: Optional[str] = None
    skin_record_body_location: Optional[str] = None

class DoctorSymptomObservationCreate(BaseModel):
    doctor_observation: str = Field(..., description="Doctor's clinical observation / notes")
    doctor_feedback: Optional[str] = Field(None, description="Doctor's recommendations / follow-up advice to patient")


# --- Skin Record Schemas ---
class SkinRecordCreate(BaseModel):
    body_location: str
    capture_date: Optional[datetime.datetime] = None
    user_notes: Optional[str] = None
    prediction_id: Optional[int] = None
    symptoms: Optional[List[SymptomCreate]] = None

class SkinRecordUpdate(BaseModel):
    body_location: Optional[str] = None
    capture_date: Optional[datetime.datetime] = None
    user_notes: Optional[str] = None

class SkinRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    image_filename: str
    image_url: str
    thumbnail_b64: Optional[str] = None
    capture_date: datetime.datetime
    created_at: datetime.datetime
    body_location: str
    user_notes: Optional[str] = None
    prediction_id: Optional[int] = None
    predicted_disease: Optional[str] = None
    confidence_score: Optional[float] = None
    symptoms: List[SymptomResponse] = []


# --- Consultation Schemas ---
class ConsultationCreate(BaseModel):
    patient_id: Optional[int] = None # When created by doctor
    doctor_name: Optional[str] = None
    clinic_name: Optional[str] = None
    consultation_date: datetime.datetime
    doctor_diagnosis: Optional[str] = None
    diagnosis: Optional[str] = None
    consultation_type: Optional[str] = "Clinical Review"
    clinical_observations: Optional[str] = None
    recommendations: Optional[str] = None
    consultation_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[datetime.datetime] = None
    expected_review_date: Optional[datetime.datetime] = None

class ConsultationUpdate(BaseModel):
    doctor_name: Optional[str] = None
    clinic_name: Optional[str] = None
    consultation_date: Optional[datetime.datetime] = None
    doctor_diagnosis: Optional[str] = None
    diagnosis: Optional[str] = None
    clinical_observations: Optional[str] = None
    recommendations: Optional[str] = None
    consultation_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[datetime.datetime] = None
    expected_review_date: Optional[datetime.datetime] = None

class ConsultationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int # Patient
    doctor_id: Optional[int] = None
    doctor_name: str
    clinic_name: str
    consultation_date: datetime.datetime
    doctor_diagnosis: str
    clinical_observations: Optional[str] = None
    recommendations: Optional[str] = None
    consultation_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[datetime.datetime] = None
    expected_review_date: Optional[datetime.datetime] = None
    created_at: datetime.datetime


# --- Treatment Schemas ---
class TreatmentCreate(BaseModel):
    patient_id: Optional[int] = None # When created by doctor
    consultation_id: Optional[int] = None
    treatment_name: str
    prescribed_medication: Optional[str] = None
    treatment_type: str = "Topical Cream"
    dosage_or_instructions: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    treatment_status: str = "Treatment Prescribed"
    start_date: datetime.datetime
    review_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    is_active: bool = True
    notes: Optional[str] = None
    doctor_notes: Optional[str] = None

class TreatmentUpdate(BaseModel):
    treatment_name: Optional[str] = None
    prescribed_medication: Optional[str] = None
    treatment_type: Optional[str] = None
    dosage_or_instructions: Optional[str] = None
    treatment_status: Optional[str] = None
    start_date: Optional[datetime.datetime] = None
    review_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    doctor_notes: Optional[str] = None

class TreatmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int # Patient
    prescribed_by_doctor_id: Optional[int] = None
    prescribing_doctor_name: Optional[str] = None
    prescribing_doctor_qualification: Optional[str] = None
    prescribing_doctor_specialization: Optional[str] = None
    prescribing_doctor_hospital: Optional[str] = None
    consultation_id: Optional[int] = None
    treatment_name: str
    prescribed_medication: Optional[str] = None
    treatment_type: str
    dosage_or_instructions: str
    treatment_status: str
    start_date: datetime.datetime
    review_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    follow_up_appointment_date: Optional[datetime.datetime] = None
    follow_up_appointment_time: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    doctor_notes: Optional[str] = None
    created_at: datetime.datetime


# --- Follow-Up Appointment Schemas ---
class AppointmentCreate(BaseModel):
    doctor_id: Optional[int] = None
    doctor_or_clinic: str
    appointment_date: datetime.datetime
    appointment_time: Optional[str] = None
    purpose_or_notes: Optional[str] = None
    reminder_advance_hours: int = 24

class AppointmentUpdate(BaseModel):
    doctor_id: Optional[int] = None
    doctor_or_clinic: Optional[str] = None
    appointment_date: Optional[datetime.datetime] = None
    appointment_time: Optional[str] = None
    purpose_or_notes: Optional[str] = None
    reason_for_visit: Optional[str] = None
    reminder_advance_hours: Optional[int] = None
    status: Optional[str] = None
    consultation_id: Optional[int] = None

class AppointmentAcceptRequest(BaseModel):
    doctor_notes: Optional[str] = None
    notes: Optional[str] = None

class AppointmentRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=2, description="Mandatory reason for declining the appointment")
    doctor_notes: Optional[str] = None

class AppointmentRescheduleRequest(BaseModel):
    suggested_date: Optional[str] = None
    suggested_time: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    new_date: Optional[str] = None
    new_time: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    message: Optional[str] = None
    doctor_notes: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentCancelRequest(BaseModel):
    cancellation_reason: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentPatientResponseRequest(BaseModel):
    response: Optional[str] = Field(None, description="'accept' to confirm the suggested time, 'decline' to decline")
    accept_proposal: Optional[bool] = None
    patient_notes: Optional[str] = None

class AppointmentDoctorAction(BaseModel):
    action: str # "accept", "reject", "reschedule", "complete", "cancel"
    alternate_time: Optional[str] = None
    suggested_alternate_date: Optional[str] = None
    suggested_alternate_time: Optional[str] = None
    notes: Optional[str] = None
    doctor_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int # Patient
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    consultation_id: Optional[int] = None
    doctor_or_clinic: str
    appointment_date: datetime.datetime
    appointment_time: Optional[str] = None
    original_appointment_date: Optional[datetime.datetime] = None
    purpose_or_notes: Optional[str] = None
    reason_for_visit: Optional[str] = None
    reminder_advance_hours: int
    status: str # PENDING, CONFIRMED, REJECTED, RESCHEDULED, AWAITING_PATIENT_CONFIRMATION, COMPLETED, CANCELLED
    suggested_date: Optional[str] = None
    suggested_time: Optional[str] = None
    suggested_alternate_time: Optional[str] = None
    rejection_reason: Optional[str] = None
    doctor_response: Optional[str] = None
    doctor_response_notes: Optional[str] = None
    doctor_response_at: Optional[datetime.datetime] = None
    patient_response_at: Optional[datetime.datetime] = None
    is_reminder_sent: bool
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None


# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    sender_id: Optional[int] = None
    title: str
    message: str
    notification_type: str
    urgency: str
    is_read: bool
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    created_at: datetime.datetime


# --- Image Comparison Schemas ---
class ComparisonRequest(BaseModel):
    earlier_record_id: int
    later_record_id: int

class VisualObservationDetail(BaseModel):
    observation_type: str
    summary: str
    neutral_metric: str

class ComparisonResponse(BaseModel):
    earlier_record: SkinRecordResponse
    later_record: SkinRecordResponse
    similarity_score: float
    histogram_distance: float
    color_shift_detected: bool
    observed_changes: List[VisualObservationDetail]
    disclaimer: str


# --- Timeline Schemas ---
class TimelineEvent(BaseModel):
    event_id: str
    event_type: str  # 'skin_record', 'ai_classification', 'symptom', 'consultation', 'treatment_start', 'appointment', 'image_comparison'
    date: datetime.datetime
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    severity: Optional[str] = None
    body_location: Optional[str] = None
    link_tab: Optional[str] = None
    metadata: Dict[str, Any] = {}
