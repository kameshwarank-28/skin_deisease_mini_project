import io
import json
import base64
import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status, Response, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.app.services.database import get_db
from backend.app.services.auth import (
    get_current_user,
    create_access_token,
    hash_password,
    verify_password,
    decode_token,
    security
)
from backend.app.services.storage import (
    save_image_bytes,
    get_image_path,
    UPLOAD_DIR
)
from backend.app.services.comparison import analyze_visual_comparison
from backend.app.services.safety_advisor import check_symptom_progression_and_alert
from backend.app.models.health import (
    User,
    PatientProfile,
    DoctorProfile,
    PatientDoctorConnection,
    SkinHealthRecord,
    SymptomRecord,
    DermatologistConsultation,
    TreatmentRecord,
    FollowUpAppointment,
    Notification,
    ImageComparisonRecord
)
from backend.app.models.history import PredictionRecord
from backend.app.schemas.health import (
    UserRegisterRequest,
    UserLoginRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserProfileResponse,
    PatientProfileCreate,
    PatientProfileUpdate,
    PatientProfileResponse,
    DoctorProfileCreate,
    DoctorProfileUpdate,
    DoctorProfileResponse,
    DoctorDirectoryItem,
    ConnectionRequestCreate,
    ConnectionActionRequest,
    PatientDoctorConnectionResponse,
    SkinRecordResponse,
    SkinRecordUpdate,
    SymptomCreate,
    SymptomUpdate,
    SymptomResponse,
    DoctorSymptomObservationCreate,
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationResponse,
    TreatmentCreate,
    TreatmentUpdate,
    TreatmentResponse,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentDoctorAction,
    AppointmentAcceptRequest,
    AppointmentRejectRequest,
    AppointmentRescheduleRequest,
    AppointmentPatientResponseRequest,
    NotificationResponse,
    ComparisonRequest,
    ComparisonResponse,
    TimelineEvent
)

router = APIRouter()

SEVERITY_MAPPING = {"mild": 1, "moderate": 2, "severe": 3}

# ==========================================
# 1. AUTHENTICATION & REGISTRATION
# ==========================================

@router.post("/auth/register", summary="Register New User (Patient or Doctor)")
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    clean_username = payload.username.strip().lower()
    clean_email = payload.email.strip().lower()
    role = (payload.role or "patient").strip().lower()

    if role not in ["patient", "doctor"]:
        raise HTTPException(status_code=400, detail="Invalid account role. Must be 'patient' or 'doctor'.")

    if db.query(User).filter(User.username == clean_username).first():
        raise HTTPException(status_code=400, detail="Username is already taken. Please choose another username.")

    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="Email address is already registered.")

    if role == "doctor":
        if not payload.medical_reg_no or not payload.qualification or not payload.specialization or not payload.hospital_name:
            raise HTTPException(
                status_code=400,
                detail="Doctor registration requires Medical Registration Number, Qualification, Specialization, and Hospital / Clinic Name."
            )

    hashed = hash_password(payload.password)
    user = User(
        username=clean_username,
        email=clean_email,
        hashed_password=hashed,
        full_name=payload.full_name.strip(),
        role=role,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        timezone=payload.timezone or "UTC"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if role == "doctor":
        doc_prof = DoctorProfile(
            user_id=user.id,
            medical_reg_no=payload.medical_reg_no.strip(),
            qualification=payload.qualification.strip(),
            specialization=payload.specialization.strip(),
            hospital_name=payload.hospital_name.strip(),
            years_experience=payload.years_experience,
            bio=payload.bio.strip() if payload.bio else None,
            verification_status="Pending Verification"
        )
        db.add(doc_prof)
        db.commit()

    return {
        "success": True,
        "message": "Account created successfully. Please log in with your credentials.",
        "username": user.username,
        "role": user.role
    }


@router.post("/auth/login", response_model=TokenResponse, summary="User Login with Role Validation")
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    login_id = payload.username.strip().lower()
    requested_role = (payload.role or "patient").strip().lower()

    user = db.query(User).filter(
        (User.username == login_id) | (User.email == login_id)
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # Strict role validation: reject if account role does not match chosen login type
    if user.role != requested_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The selected account type does not match your registered account role."
        )

    token = create_access_token(user.id, user.username, user.email, user.role)
    has_profile = bool(user.patient_profile)
    doc_status = user.doctor_profile.verification_status if user.doctor_profile else None

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "phone_number": user.phone_number,
            "timezone": user.timezone
        },
        "has_patient_profile": has_profile,
        "doctor_verification_status": doc_status
    }


@router.get("/auth/me", response_model=UserProfileResponse, summary="Get Current Profile")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/change-password", summary="Change Account Password")
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


# ==========================================
# 2. PATIENT PROFILE MANAGEMENT
# ==========================================

@router.get("/patient-profile", response_model=Optional[PatientProfileResponse], summary="Get Patient Profile")
def get_patient_profile(current_user: User = Depends(get_current_user)):
    return current_user.patient_profile

@router.post("/patient-profile", response_model=PatientProfileResponse, summary="Create Patient Profile")
def create_patient_profile(
    payload: PatientProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.patient_profile:
        raise HTTPException(status_code=400, detail="Patient profile already exists.")

    profile = PatientProfile(
        user_id=current_user.id,
        patient_name=payload.patient_name.strip(),
        age=payload.age,
        gender=payload.gender,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        email_address=payload.email_address.strip() if payload.email_address else None,
        additional_details=payload.additional_details.strip() if payload.additional_details else None
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

@router.put("/patient-profile", response_model=PatientProfileResponse, summary="Update Patient Profile")
def update_patient_profile(
    payload: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.patient_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found. Please create one.")

    if payload.patient_name is not None:
        profile.patient_name = payload.patient_name.strip()
    if payload.age is not None:
        profile.age = payload.age
    if payload.gender is not None:
        profile.gender = payload.gender
    if payload.phone_number is not None:
        profile.phone_number = payload.phone_number.strip() if payload.phone_number else None
    if payload.email_address is not None:
        profile.email_address = payload.email_address.strip() if payload.email_address else None
    if payload.additional_details is not None:
        profile.additional_details = payload.additional_details.strip() if payload.additional_details else None

    profile.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


# ==========================================
# 3. DOCTOR DIRECTORY & PATIENT-DOCTOR CONNECTIONS
# ==========================================

@router.get("/doctors/directory", response_model=List[DoctorDirectoryItem], summary="Browse Verified Dermatologists")
def get_doctors_directory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch verified doctors
    doctors = db.query(User).filter(User.role == "doctor").all()
    results = []

    for doc in doctors:
        if not doc.doctor_profile:
            continue
        
        # Check connection status if current user is patient
        conn_status = None
        if current_user.role == "patient":
            conn = db.query(PatientDoctorConnection).filter(
                PatientDoctorConnection.patient_id == current_user.id,
                PatientDoctorConnection.doctor_id == doc.id
            ).first()
            if conn:
                conn_status = conn.status

        results.append(DoctorDirectoryItem(
            id=doc.id,
            doctor_id=doc.id,
            doctor_profile_id=doc.doctor_profile.id,
            full_name=doc.full_name,
            email=doc.email,
            phone_number=doc.phone_number,
            qualification=doc.doctor_profile.qualification,
            specialization=doc.doctor_profile.specialization,
            hospital_name=doc.doctor_profile.hospital_name,
            years_experience=doc.doctor_profile.years_experience,
            bio=doc.doctor_profile.bio,
            verification_status=doc.doctor_profile.verification_status,
            connection_status=conn_status
        ))

    return results

@router.post("/patients/connection-requests", summary="Patient Requests Doctor Connection")
def request_doctor_connection(
    payload: ConnectionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patient accounts can request doctor connections.")

    doctor = db.query(User).filter(User.id == payload.doctor_id, User.role == "doctor").first()
    if not doctor or not doctor.doctor_profile:
        raise HTTPException(status_code=404, detail="Selected doctor was not found.")

    existing = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.patient_id == current_user.id,
        PatientDoctorConnection.doctor_id == doctor.id
    ).first()

    if existing:
        if existing.status in ["Requested", "Accepted"]:
            return {"status": existing.status, "message": f"Connection status is currently: {existing.status}"}
        else:
            existing.status = "Requested"
            existing.request_note = payload.request_note
            existing.updated_at = datetime.datetime.now(datetime.timezone.utc)
            db.commit()
    else:
        conn = PatientDoctorConnection(
            patient_id=current_user.id,
            doctor_id=doctor.id,
            status="Requested",
            request_note=payload.request_note
        )
        db.add(conn)
        db.commit()

    # Create notification for doctor
    p_name = current_user.patient_profile.patient_name if current_user.patient_profile else current_user.full_name
    db.add(Notification(
        user_id=doctor.id,
        sender_id=current_user.id,
        title="New Patient Connection Request",
        message=f"{p_name} has requested a doctor-patient connection with you.",
        notification_type="ConnectionRequest",
        urgency="Normal"
    ))
    db.commit()

    return {"status": "Requested", "message": "Connection request sent to doctor."}

@router.get("/patients/connections", summary="Patient Lists Their Doctor Connections")
def get_patient_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patient accounts can query patient connections.")

    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.patient_id == current_user.id
    ).order_by(PatientDoctorConnection.created_at.desc()).all()

    resp = []
    for c in conns:
        doc_user = db.query(User).filter(User.id == c.doctor_id).first()
        doc_prof = doc_user.doctor_profile if doc_user else None
        resp.append({
            "id": c.id,
            "patient_id": c.patient_id,
            "doctor_id": c.doctor_id,
            "status": c.status,
            "request_note": c.request_note,
            "response_note": c.response_note,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "doctor_name": doc_user.full_name if doc_user else "Dermatologist",
            "specialization": doc_prof.specialization if doc_prof else "Dermatology",
            "hospital_name": doc_prof.hospital_name if doc_prof else "Medical Center",
            "qualification": doc_prof.qualification if doc_prof else "MD",
            "years_experience": doc_prof.years_experience if doc_prof else 5,
            "bio": doc_prof.bio if doc_prof else ""
        })
    return resp

@router.get("/patients/my-dermatologist", summary="Get Current Connected Dermatologist for Patient")
def get_my_dermatologist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patient accounts can query their dermatologist.")

    conn = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.patient_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).order_by(PatientDoctorConnection.updated_at.desc()).first()

    if not conn:
        pending_conn = db.query(PatientDoctorConnection).filter(
            PatientDoctorConnection.patient_id == current_user.id,
            PatientDoctorConnection.status == "Requested"
        ).order_by(PatientDoctorConnection.created_at.desc()).first()

        if pending_conn:
            doc = db.query(User).filter(User.id == pending_conn.doctor_id).first()
            p = doc.doctor_profile if doc else None
            return {
                "has_doctor": False,
                "connection_status": "Requested",
                "connection_id": pending_conn.id,
                "doctor": {
                    "id": doc.id,
                    "doctor_name": doc.full_name,
                    "specialization": p.specialization if p else "Dermatology",
                    "hospital_name": p.hospital_name if p else "Medical Center",
                    "qualification": p.qualification if p else "MD"
                }
            }
        return {"has_doctor": False, "connection_status": "None", "doctor": None}

    doc = db.query(User).filter(User.id == conn.doctor_id).first()
    p = doc.doctor_profile if doc else None

    next_appt = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.user_id == current_user.id,
        FollowUpAppointment.doctor_id == doc.id,
        FollowUpAppointment.status.in_(["Confirmed", "CONFIRMED", "Scheduled", "Pending", "PENDING"])
    ).order_by(FollowUpAppointment.appointment_date.asc()).first()

    return {
        "has_doctor": True,
        "connection_status": "Accepted",
        "connection_id": conn.id,
        "doctor_id": doc.id,
        "doctor_name": doc.full_name,
        "specialization": p.specialization if p else "Dermatology",
        "hospital_name": p.hospital_name if p else "Medical Center",
        "qualification": p.qualification if p else "MD",
        "years_experience": p.years_experience if p else 8,
        "email": doc.email,
        "phone_number": p.user.phone_number if p and p.user else doc.phone_number,
        "bio": p.bio if p else "Specialist in dermatological skin health monitoring and clinical diagnostics.",
        "doctor": {
            "id": doc.id,
            "doctor_name": doc.full_name,
            "specialization": p.specialization if p else "Dermatology",
            "hospital_name": p.hospital_name if p else "Medical Center",
            "qualification": p.qualification if p else "MD",
            "years_experience": p.years_experience if p else 8,
            "email": doc.email,
            "phone_number": p.user.phone_number if p and p.user else doc.phone_number,
            "bio": p.bio if p else "Specialist in dermatological skin health monitoring and clinical diagnostics."
        },
        "next_appointment": {
            "id": next_appt.id,
            "date": next_appt.appointment_date.isoformat(),
            "time": next_appt.appointment_time,
            "status": next_appt.status,
            "purpose": next_appt.purpose_or_notes
        } if next_appt else None
    }

@router.get("/patients/overview-stats", summary="Patient Dashboard Overview Data")
def get_patient_overview_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patient accounts can view patient overview.")

    records = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.user_id == current_user.id
    ).order_by(SkinHealthRecord.capture_date.desc()).all()

    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == current_user.id
    ).all()

    treatments = db.query(TreatmentRecord).filter(
        TreatmentRecord.user_id == current_user.id,
        TreatmentRecord.is_active == True
    ).all()

    appointments = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.user_id == current_user.id
    ).order_by(FollowUpAppointment.appointment_date.asc()).all()

    unread_messages = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).all()

    upcoming = [
        a for a in appointments
        if a.status.upper() in ["CONFIRMED", "SCHEDULED", "ACCEPTED", "PENDING", "RESCHEDULE PROPOSED"]
    ]
    next_appt = upcoming[0] if upcoming else None

    conn = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.patient_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).first()
    connected_doc = None
    if conn:
        doc = db.query(User).filter(User.id == conn.doctor_id).first()
        if doc:
            p = doc.doctor_profile
            connected_doc = {
                "doctor_id": doc.id,
                "doctor_name": doc.full_name,
                "specialization": p.specialization if p else "Dermatology",
                "hospital_name": p.hospital_name if p else "Medical Center",
                "qualification": p.qualification if p else "MD",
                "status": "Accepted",
                "connection_id": conn.id
            }

    recent_updates = []
    consults = db.query(DermatologistConsultation).filter(
        DermatologistConsultation.user_id == current_user.id
    ).order_by(DermatologistConsultation.consultation_date.desc()).limit(3).all()
    for c in consults:
        recent_updates.append({
            "type": "Consultation Report",
            "title": f"Consultation with Dr. {c.doctor_name}",
            "description": f"Diagnosis: {c.doctor_diagnosis}",
            "date": c.consultation_date.isoformat(),
            "details": c.recommendations or c.clinical_observations
        })
    for t in treatments[:3]:
        recent_updates.append({
            "type": "Treatment Prescription",
            "title": t.treatment_name,
            "description": f"Medication: {t.prescribed_medication or 'Topical'}. Instructions: {t.dosage_or_instructions}",
            "date": t.created_at.isoformat() if t.created_at else t.start_date.isoformat(),
            "details": t.doctor_notes
        })
    recent_updates = sorted(recent_updates, key=lambda x: x["date"], reverse=True)[:5]

    return {
        "stats": {
            "records_count": len(records),
            "symptoms_count": len(symptoms),
            "active_treatments_count": len(treatments),
            "upcoming_appointments_count": len(upcoming),
            "unread_doctor_messages_count": len(unread_messages)
        },
        "next_appointment": {
            "id": next_appt.id,
            "doctor_name": next_appt.doctor_or_clinic,
            "specialization": next_appt.doctor.doctor_profile.specialization if (next_appt.doctor and next_appt.doctor.doctor_profile) else "Dermatologist",
            "appointment_date": next_appt.appointment_date.isoformat(),
            "appointment_time": next_appt.appointment_time or "09:00 AM",
            "status": next_appt.status,
            "purpose": next_appt.purpose_or_notes,
            "suggested_alternate_time": next_appt.suggested_alternate_time,
            "rejection_reason": next_appt.rejection_reason
        } if next_appt else None,
        "recent_records": [serialize_skin_record(r) for r in records[:3]],
        "connected_doctor": connected_doc,
        "recent_medical_updates": recent_updates
    }

@router.get("/doctors/connections", response_model=List[PatientDoctorConnectionResponse], summary="Doctor Lists Connection Requests")
def get_doctor_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view connection management.")

    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id
    ).order_by(PatientDoctorConnection.created_at.desc()).all()

    resp = []
    for c in conns:
        patient_user = db.query(User).filter(User.id == c.patient_id).first()
        p_name = patient_user.patient_profile.patient_name if (patient_user and patient_user.patient_profile) else (patient_user.full_name if patient_user else "Patient")
        resp.append(PatientDoctorConnectionResponse(
            id=c.id,
            patient_id=c.patient_id,
            doctor_id=c.doctor_id,
            status=c.status,
            request_note=c.request_note,
            response_note=c.response_note,
            created_at=c.created_at,
            patient_name=p_name,
            doctor_name=current_user.full_name,
            hospital_name=current_user.doctor_profile.hospital_name if current_user.doctor_profile else None
        ))
    return resp

@router.post("/doctors/connections/{conn_id}/action", summary="Doctor Accepts/Rejects Patient Connection")
def action_doctor_connection(
    conn_id: int,
    payload: ConnectionActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can manage connection actions.")

    conn = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.id == conn_id,
        PatientDoctorConnection.doctor_id == current_user.id
    ).first()

    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found.")

    action = payload.action.lower()
    if action == "accept":
        conn.status = "Accepted"
        notif_msg = f"{current_user.full_name} accepted your connection request. They can now review your skin health updates."
    elif action == "reject":
        conn.status = "Rejected"
        notif_msg = f"{current_user.full_name} was unable to accept your connection request."
    elif action == "disconnect":
        conn.status = "Disconnected"
        notif_msg = f"Your connection with {current_user.full_name} has been disconnected."
    else:
        raise HTTPException(status_code=400, detail="Invalid action.")

    conn.response_note = payload.response_note
    conn.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    # Send notification to patient
    db.add(Notification(
        user_id=conn.patient_id,
        sender_id=current_user.id,
        title="Doctor Connection Update",
        message=notif_msg,
        notification_type="ConnectionAccepted" if action == "accept" else "ConnectionUpdate",
        urgency="Normal"
    ))
    db.commit()

    return {"status": conn.status, "message": f"Connection updated to {conn.status}."}

@router.post("/doctors/dev-verify", summary="Development / Admin Verification Toggle for Doctors")
def dev_verify_doctor(
    doctor_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = doctor_id if doctor_id else current_user.id
    doc_user = db.query(User).filter(User.id == target_id, User.role == "doctor").first()
    if not doc_user or not doc_user.doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    doc_user.doctor_profile.verification_status = "Verified"
    doc_user.doctor_profile.verified_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    return {"status": "Verified", "message": f"Doctor {doc_user.full_name} is now Verified."}


# ==========================================
# 4. DOCTOR OVERVIEW & PATIENT CLINICAL DATA
# ==========================================

@router.get("/doctors/overview-stats", summary="Doctor Overview Statistics")
def get_doctor_overview_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view doctor dashboard.")

    # 1. Total connected patients
    accepted_conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()
    total_patients = len(accepted_conns)
    connected_patient_ids = [c.patient_id for c in accepted_conns]

    # 2. Pending patient connection requests
    pending_conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Requested"
    ).order_by(PatientDoctorConnection.created_at.desc()).all()
    pending_requests_count = len(pending_conns)

    # 3. Pending appointment requests
    pending_appts = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.doctor_id == current_user.id,
        FollowUpAppointment.status.in_(["Pending", "PENDING", "Pending Doctor Review", "AWAITING_DOCTOR_REVIEW", "Requested"])
    ).order_by(FollowUpAppointment.appointment_date.asc()).all()

    # 4. Active treatments
    active_treatments_count = db.query(TreatmentRecord).filter(
        TreatmentRecord.prescribed_by_doctor_id == current_user.id,
        TreatmentRecord.is_active == True
    ).count()

    # All appointments for this doctor
    all_appts = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.doctor_id == current_user.id
    ).order_by(FollowUpAppointment.appointment_date.asc()).all()

    # Today's date in UTC
    now_date = datetime.datetime.now(datetime.timezone.utc).date()
    today_appts = []
    for a in all_appts:
        if a.appointment_date.date() == now_date:
            p_user = db.query(User).filter(User.id == a.user_id).first()
            p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
            today_appts.append({
                "id": a.id,
                "patient_id": a.user_id,
                "patient_name": p_name,
                "time": a.appointment_time or "09:00 AM",
                "consultation_type": "Dermatology Follow-up",
                "purpose": a.purpose_or_notes or "Skin Lesion Examination",
                "status": a.status
            })

    # Pending appointments formatted for Section D
    pending_appts_list = []
    for a in pending_appts:
        p_user = db.query(User).filter(User.id == a.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        pending_appts_list.append({
            "id": a.id,
            "patient_id": a.user_id,
            "patient_code": f"PAT-{a.user_id:04d}",
            "patient_name": p_name,
            "requested_date": a.appointment_date.strftime("%Y-%m-%d"),
            "requested_time": a.appointment_time or "09:00 AM",
            "reason": a.purpose_or_notes or "Dermatological Review",
            "request_created_at": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else a.appointment_date.strftime("%Y-%m-%d"),
            "status": a.status
        })

    # Pending connection requests formatted for Section E
    pending_conns_list = []
    for c in pending_conns:
        p_user = db.query(User).filter(User.id == c.patient_id).first()
        p_prof = p_user.patient_profile if p_user else None
        pending_conns_list.append({
            "id": c.id,
            "patient_id": c.patient_id,
            "patient_code": f"PAT-{c.patient_id:04d}",
            "patient_name": p_prof.patient_name if p_prof else (p_user.full_name if p_user else "Patient"),
            "age": p_prof.age if p_prof else "N/A",
            "gender": p_prof.gender if p_prof else "N/A",
            "request_note": c.request_note or "Requesting consultation and skin monitoring guidance.",
            "request_date": c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "Recently",
            "status": c.status
        })

    # Recent patient activity from authorized patients (Section G)
    recent_activity = []
    if connected_patient_ids:
        # Recent skin records
        recent_recs = db.query(SkinHealthRecord).filter(
            SkinHealthRecord.user_id.in_(connected_patient_ids)
        ).order_by(SkinHealthRecord.created_at.desc()).limit(5).all()
        for r in recent_recs:
            p_user = db.query(User).filter(User.id == r.user_id).first()
            p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
            recent_activity.append({
                "type": "New Skin Image",
                "patient_id": r.user_id,
                "patient_name": p_name,
                "description": f"Uploaded photograph for {r.body_location}" + (f" (AI: {r.predicted_disease})" if r.predicted_disease else ""),
                "timestamp": r.created_at.isoformat() if r.created_at else r.capture_date.isoformat(),
                "time_display": r.created_at.strftime("%b %d, %H:%M") if r.created_at else r.capture_date.strftime("%b %d")
            })

        # Recent symptoms
        recent_symps = db.query(SymptomRecord).filter(
            SymptomRecord.user_id.in_(connected_patient_ids)
        ).order_by(SymptomRecord.recorded_at.desc()).limit(5).all()
        for s in recent_symps:
            p_user = db.query(User).filter(User.id == s.user_id).first()
            p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
            recent_activity.append({
                "type": "Symptom Report",
                "patient_id": s.user_id,
                "patient_name": p_name,
                "description": f"Reported {s.symptom_name} (Severity: {s.severity})",
                "timestamp": s.recorded_at.isoformat(),
                "time_display": s.recorded_at.strftime("%b %d, %H:%M")
            })

    # Sort recent activity
    recent_activity = sorted(recent_activity, key=lambda x: x["timestamp"], reverse=True)[:8]

    # Calendar events formatted for Section B
    calendar_events = []
    for a in all_appts:
        p_user = db.query(User).filter(User.id == a.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        calendar_events.append({
            "id": a.id,
            "patient_id": a.user_id,
            "patient_name": p_name,
            "date": a.appointment_date.strftime("%Y-%m-%d"),
            "time": a.appointment_time or "09:00 AM",
            "status": a.status,
            "purpose": a.purpose_or_notes or "Follow-up Examination"
        })

    prof = current_user.doctor_profile
    return {
        "doctor_name": current_user.full_name,
        "doctor_id": current_user.id,
        "qualification": prof.qualification if prof else "MD, Board Certified Dermatologist",
        "specialization": prof.specialization if prof else "Clinical Dermatology",
        "hospital_name": prof.hospital_name if prof else "DermAI Clinical Center",
        "verification_status": prof.verification_status if prof else "Verified",
        "stats": {
            "total_connected_patients": total_patients,
            "pending_patient_requests": pending_requests_count,
            "pending_appointments": len(pending_appts),
            "active_treatment_plans": active_treatments_count,
            "total_patients": total_patients,
            "pending_requests": pending_requests_count,
            "total_treatments": active_treatments_count
        },
        "today_appointments": today_appts,
        "pending_appointments_list": pending_appts_list,
        "pending_connections_list": pending_conns_list,
        "recent_activity": recent_activity,
        "calendar_events": calendar_events
    }

@router.get("/doctors/all-patient-records", summary="Doctor Browses All Connected Patient Skin Records")
def get_all_doctor_patient_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient records.")

    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()
    patient_ids = [c.patient_id for c in conns]

    records = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.user_id.in_(patient_ids)
    ).order_by(SkinHealthRecord.capture_date.desc()).all()

    result = []
    for r in records:
        p_user = db.query(User).filter(User.id == r.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        serialized = serialize_skin_record(r)
        d = serialized.model_dump() if hasattr(serialized, "model_dump") else serialized.dict()
        d["patient_name"] = p_name
        d["patient_code"] = f"PAT-{r.user_id:04d}"
        result.append(d)
    return result

@router.get("/doctors/all-patient-symptoms", summary="Doctor Browses All Connected Patient Symptoms")
def get_all_doctor_patient_symptoms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient symptoms.")

    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()
    patient_ids = [c.patient_id for c in conns]

    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.user_id.in_(patient_ids)
    ).order_by(SymptomRecord.recorded_at.desc()).all()

    result = []
    for s in symptoms:
        p_user = db.query(User).filter(User.id == s.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        img_url = f"/api/images/{s.skin_record.image_filename}" if (s.skin_record and s.skin_record.image_filename) else None
        body_loc = s.skin_record.body_location if s.skin_record else None
        result.append({
            "id": s.id,
            "user_id": s.user_id,
            "patient_name": p_name,
            "patient_code": f"PAT-{s.user_id:04d}",
            "symptom_name": s.symptom_name,
            "severity": s.severity,
            "severity_score": s.severity_score,
            "duration": s.duration,
            "notes": s.notes,
            "recorded_at": s.recorded_at.isoformat(),
            "doctor_observation": s.doctor_observation,
            "doctor_feedback": s.doctor_feedback,
            "reviewed_by_doctor_id": s.reviewed_by_doctor_id,
            "reviewed_by_doctor_name": s.reviewed_by_doctor_name,
            "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
            "skin_record_id": s.skin_record_id,
            "skin_record_image_url": img_url,
            "skin_record_body_location": body_loc
        })
    return result

@router.get("/doctors/followups", summary="Doctor Lists Upcoming Patient Follow-ups and Reviews")
def get_doctor_followups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view follow-ups.")

    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()
    patient_ids = [c.patient_id for c in conns]

    # Treatments with review dates
    treatments = db.query(TreatmentRecord).filter(
        TreatmentRecord.prescribed_by_doctor_id == current_user.id,
        TreatmentRecord.is_active == True,
        TreatmentRecord.review_date != None
    ).order_by(TreatmentRecord.review_date.asc()).all()

    # Appointments
    appts = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.doctor_id == current_user.id
    ).order_by(FollowUpAppointment.appointment_date.asc()).all()

    items = []
    for t in treatments:
        p_user = db.query(User).filter(User.id == t.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        items.append({
            "type": "Treatment Review",
            "followup_type": "Treatment Review",
            "id": t.id,
            "patient_id": t.user_id,
            "patient_name": p_name,
            "patient_code": f"PAT-{t.user_id:04d}",
            "title": f"Review: {t.treatment_name}",
            "reason": f"Review active regimen: {t.treatment_name}",
            "scheduled_date": t.review_date.strftime("%Y-%m-%d"),
            "status": t.treatment_status,
            "instructions": t.dosage_or_instructions
        })

    for a in appts:
        p_user = db.query(User).filter(User.id == a.user_id).first()
        p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")
        items.append({
            "type": "Clinical Appointment",
            "followup_type": "Clinical Appointment",
            "id": a.id,
            "patient_id": a.user_id,
            "patient_name": p_name,
            "patient_code": f"PAT-{a.user_id:04d}",
            "title": f"Appointment: {a.purpose_or_notes or 'Follow-up'}",
            "reason": a.purpose_or_notes or "Dermatological Follow-up Visit",
            "scheduled_date": a.appointment_date.strftime("%Y-%m-%d"),
            "time_slot": a.appointment_time,
            "time": a.appointment_time,
            "status": a.status,
            "instructions": a.doctor_response_notes
        })

    items = sorted(items, key=lambda x: x["scheduled_date"])
    return items

@router.get("/doctors/patients", summary="List Authorized Patients for Doctor")
def get_doctor_patients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access patient management.")

    # Only fetch accepted connections
    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()

    patient_items = []
    for c in conns:
        p_user = db.query(User).filter(User.id == c.patient_id).first()
        if not p_user:
            continue

        p_prof = p_user.patient_profile
        latest_rec = db.query(SkinHealthRecord).filter(
            SkinHealthRecord.user_id == p_user.id
        ).order_by(SkinHealthRecord.capture_date.desc()).first()

        latest_cons = db.query(DermatologistConsultation).filter(
            DermatologistConsultation.user_id == p_user.id
        ).order_by(DermatologistConsultation.consultation_date.desc()).first()

        next_appt = db.query(FollowUpAppointment).filter(
            FollowUpAppointment.user_id == p_user.id,
            FollowUpAppointment.doctor_id == current_user.id,
            or_(FollowUpAppointment.status == "Accepted", FollowUpAppointment.status == "Scheduled")
        ).order_by(FollowUpAppointment.appointment_date.asc()).first()

        patient_items.append({
            "patient_id": p_user.id,
            "patient_name": p_prof.patient_name if p_prof else p_user.full_name,
            "email": p_user.email,
            "phone": p_prof.phone_number if p_prof else p_user.phone_number,
            "age": p_prof.age if p_prof else None,
            "gender": p_prof.gender if p_prof else None,
            "additional_details": p_prof.additional_details if p_prof else None,
            "latest_skin_record_date": latest_rec.capture_date.isoformat() if latest_rec else None,
            "latest_consultation_date": latest_cons.consultation_date.isoformat() if latest_cons else None,
            "next_appointment_date": next_appt.appointment_date.isoformat() if next_appt else None,
            "connection_date": c.created_at.isoformat()
        })

    return patient_items

def verify_doctor_patient_access(doctor_id: int, patient_id: int, db: Session):
    conn = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.doctor_id == doctor_id,
        PatientDoctorConnection.patient_id == patient_id,
        PatientDoctorConnection.status == "Accepted"
    ).first()
    if not conn:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You do not have an accepted doctor-patient relationship with this patient."
        )

@router.get("/doctors/patients/{patient_id}/records", response_model=List[SkinRecordResponse], summary="Doctor Views Patient Skin Records")
def doctor_get_patient_records(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient records.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    records = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.user_id == patient_id
    ).order_by(SkinHealthRecord.capture_date.desc()).all()
    return [serialize_skin_record(r) for r in records]

@router.get("/doctors/patients/{patient_id}/symptoms", response_model=List[SymptomResponse], summary="Doctor Views Patient Symptoms")
def doctor_get_patient_symptoms(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient symptoms.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == patient_id
    ).order_by(SymptomRecord.recorded_at.desc()).all()
    return [serialize_symptom(s) for s in symptoms]

@router.get("/doctors/patients/{patient_id}/consultations", response_model=List[ConsultationResponse], summary="Doctor Views Patient Consultations")
def doctor_get_patient_consultations(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient consultations.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    return db.query(DermatologistConsultation).filter(
        DermatologistConsultation.user_id == patient_id
    ).order_by(DermatologistConsultation.consultation_date.desc()).all()

@router.post("/doctors/patients/{patient_id}/consultations", response_model=ConsultationResponse, summary="Doctor Documents Patient Consultation")
def doctor_create_patient_consultation(
    patient_id: int,
    payload: ConsultationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can document clinical consultations.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    # Verified check
    if not current_user.doctor_profile or current_user.doctor_profile.verification_status != "Verified":
        raise HTTPException(status_code=403, detail="Only verified doctors can document clinical evaluations.")

    diag = (payload.doctor_diagnosis or payload.diagnosis or "Clinical Evaluation").strip()
    cons = DermatologistConsultation(
        user_id=patient_id,
        doctor_id=current_user.id,
        doctor_name=current_user.full_name,
        clinic_name=current_user.doctor_profile.hospital_name,
        consultation_date=payload.consultation_date,
        doctor_diagnosis=diag,
        clinical_observations=payload.clinical_observations,
        recommendations=payload.recommendations,
        consultation_notes=payload.consultation_notes,
        follow_up_instructions=payload.follow_up_instructions,
        follow_up_date=payload.follow_up_date,
        expected_review_date=payload.expected_review_date
    )
    db.add(cons)
    db.commit()
    db.refresh(cons)

    # Notify patient
    db.add(Notification(
        user_id=patient_id,
        sender_id=current_user.id,
        title="New Dermatologist Consultation Recorded",
        message=f"{current_user.full_name} recorded a consultation report: {diag}.",
        notification_type="ConsultationUpdate",
        urgency="Normal",
        reference_id=cons.id,
        reference_type="consultation"
    ))
    db.commit()

    return cons

@router.get("/doctors/patients/{patient_id}/treatments", response_model=List[TreatmentResponse], summary="Doctor Views Patient Treatments")
def doctor_get_patient_treatments(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient treatments.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    return db.query(TreatmentRecord).filter(
        TreatmentRecord.user_id == patient_id
    ).order_by(TreatmentRecord.start_date.desc()).all()

@router.post("/doctors/patients/{patient_id}/treatments", response_model=TreatmentResponse, summary="Doctor Prescribes Treatment Plan")
def doctor_create_patient_treatment(
    patient_id: int,
    payload: TreatmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can prescribe clinical treatments.")
    verify_doctor_patient_access(current_user.id, patient_id, db)

    if not current_user.doctor_profile or current_user.doctor_profile.verification_status != "Verified":
        raise HTTPException(status_code=403, detail="Only verified doctors can prescribe clinical treatment plans.")

    treatment = TreatmentRecord(
        user_id=patient_id,
        prescribed_by_doctor_id=current_user.id,
        consultation_id=payload.consultation_id,
        treatment_name=payload.treatment_name.strip(),
        prescribed_medication=payload.prescribed_medication.strip() if payload.prescribed_medication else None,
        treatment_type=payload.treatment_type.strip(),
        dosage_or_instructions=(payload.dosage_or_instructions or f"{payload.dosage or ''} {payload.frequency or ''}").strip() or "As directed by physician",
        treatment_status=payload.treatment_status or "Treatment Prescribed",
        start_date=payload.start_date,
        review_date=payload.review_date,
        end_date=payload.end_date,
        is_active=payload.is_active,
        notes=payload.notes,
        doctor_notes=payload.doctor_notes
    )
    db.add(treatment)
    db.commit()
    db.refresh(treatment)

    # Notify patient
    db.add(Notification(
        user_id=patient_id,
        sender_id=current_user.id,
        title="Treatment Plan Prescribed",
        message="Your dermatologist has updated your treatment plan. Open the Treatments section to view the latest instructions.",
        notification_type="TreatmentUpdate",
        urgency="Normal",
        reference_id=treatment.id,
        reference_type="treatment"
    ))
    db.commit()

    return treatment

@router.put("/doctors/treatments/{treatment_id}", response_model=TreatmentResponse, summary="Doctor Updates Treatment Plan")
def doctor_update_treatment(
    treatment_id: int,
    payload: TreatmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update prescribed treatment plans.")

    treatment = db.query(TreatmentRecord).filter(TreatmentRecord.id == treatment_id).first()
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment record not found.")

    verify_doctor_patient_access(current_user.id, treatment.user_id, db)

    if payload.treatment_name is not None:
        treatment.treatment_name = payload.treatment_name.strip()
    if payload.prescribed_medication is not None:
        treatment.prescribed_medication = payload.prescribed_medication.strip()
    if payload.treatment_type is not None:
        treatment.treatment_type = payload.treatment_type.strip()
    if payload.dosage_or_instructions is not None:
        treatment.dosage_or_instructions = payload.dosage_or_instructions.strip()
    if payload.treatment_status is not None:
        treatment.treatment_status = payload.treatment_status
    if payload.start_date is not None:
        treatment.start_date = payload.start_date
    if payload.review_date is not None:
        treatment.review_date = payload.review_date
    if payload.end_date is not None:
        treatment.end_date = payload.end_date
    if payload.is_active is not None:
        treatment.is_active = payload.is_active
    if payload.notes is not None:
        treatment.notes = payload.notes
    if payload.doctor_notes is not None:
        treatment.doctor_notes = payload.doctor_notes

    db.commit()
    db.refresh(treatment)

    # Notify patient
    db.add(Notification(
        user_id=treatment.user_id,
        sender_id=current_user.id,
        title="Treatment Plan Updated",
        message="Your dermatologist has updated your treatment plan. Open the Treatments section to view the latest instructions.",
        notification_type="TreatmentUpdate",
        urgency="Normal",
        reference_id=treatment.id,
        reference_type="treatment"
    ))
    db.commit()

    return treatment


# ==========================================
# 5. APPOINTMENT SYNCHRONIZATION & WORKFLOW
# ==========================================

def build_appointment_response(a: FollowUpAppointment, db: Session) -> AppointmentResponse:
    p_user = db.query(User).filter(User.id == a.user_id).first()
    p_name = p_user.patient_profile.patient_name if (p_user and p_user.patient_profile) else (p_user.full_name if p_user else "Patient")

    doc_user = db.query(User).filter(User.id == a.doctor_id).first() if a.doctor_id else None
    doc_name = doc_user.full_name if doc_user else a.doctor_or_clinic

    return AppointmentResponse(
        id=a.id,
        user_id=a.user_id,
        patient_id=a.user_id,
        doctor_id=a.doctor_id,
        patient_name=p_name,
        doctor_name=doc_name,
        consultation_id=a.consultation_id,
        doctor_or_clinic=a.doctor_or_clinic,
        appointment_date=a.appointment_date,
        appointment_time=a.appointment_time,
        original_appointment_date=a.original_appointment_date,
        purpose_or_notes=a.purpose_or_notes,
        reason_for_visit=a.purpose_or_notes,
        reminder_advance_hours=a.reminder_advance_hours if a.reminder_advance_hours is not None else 24,
        status=a.status,
        suggested_date=a.suggested_date,
        suggested_time=a.suggested_time,
        suggested_alternate_time=a.suggested_alternate_time,
        rejection_reason=a.rejection_reason,
        doctor_response=a.doctor_response,
        doctor_response_notes=a.doctor_response_notes,
        doctor_response_at=a.doctor_response_at,
        patient_response_at=a.patient_response_at,
        is_reminder_sent=bool(a.is_reminder_sent),
        created_at=a.created_at,
        updated_at=a.updated_at
    )


@router.get("/doctors/appointments", response_model=List[AppointmentResponse], summary="Doctor Lists Appointment Requests")
@router.get("/doctor/appointments", response_model=List[AppointmentResponse], summary="Doctor Lists Appointment Requests (Alias)")
def get_doctor_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view doctor appointment inbox.")

    appts = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.doctor_id == current_user.id
    ).order_by(FollowUpAppointment.appointment_date.desc(), FollowUpAppointment.id.desc()).all()

    return [build_appointment_response(a, db) for a in appts]


@router.post("/appointments/{appointment_id}/accept", response_model=AppointmentResponse, summary="Doctor Accepts Appointment")
@router.post("/doctors/appointments/{appointment_id}/accept", response_model=AppointmentResponse, summary="Doctor Accepts Appointment (Alias)")
def accept_appointment(
    appointment_id: int,
    payload: Optional[AppointmentAcceptRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can accept appointment requests.")

    appt = db.query(FollowUpAppointment).filter(FollowUpAppointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appt.doctor_id and appt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to accept this appointment.")

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    appt.doctor_id = current_user.id
    appt.status = "CONFIRMED"
    appt.doctor_response_at = now_utc
    notes = (payload.doctor_notes or payload.notes) if payload else None
    if notes:
        appt.doctor_response = notes
        appt.doctor_response_notes = notes

    db.commit()
    db.refresh(appt)

    # Format appointment date & time for message
    doc_display = current_user.full_name if current_user.full_name.startswith("Dr.") else f"Dr. {current_user.full_name}"
    date_str = appt.appointment_date.strftime('%b %d, %Y')
    time_str = f" at {appt.appointment_time}" if appt.appointment_time else ""
    notif_msg = f"Your appointment has been confirmed by {doc_display} for {date_str}{time_str}."

    db.add(Notification(
        user_id=appt.user_id,
        sender_id=current_user.id,
        title="Appointment Confirmed",
        message=notif_msg,
        notification_type="AppointmentAccept",
        urgency="Normal",
        reference_id=appt.id,
        reference_type="appointment"
    ))
    db.commit()

    return build_appointment_response(appt, db)


@router.post("/appointments/{appointment_id}/reject", response_model=AppointmentResponse, summary="Doctor Rejects Appointment")
@router.post("/doctors/appointments/{appointment_id}/reject", response_model=AppointmentResponse, summary="Doctor Rejects Appointment (Alias)")
def reject_appointment(
    appointment_id: int,
    payload: AppointmentRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can reject appointment requests.")

    appt = db.query(FollowUpAppointment).filter(FollowUpAppointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appt.doctor_id and appt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to reject this appointment.")

    if not payload.rejection_reason or not payload.rejection_reason.strip():
        raise HTTPException(status_code=400, detail="Rejection reason is mandatory.")

    reason_text = payload.rejection_reason.strip()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    appt.doctor_id = current_user.id
    appt.status = "REJECTED"
    appt.rejection_reason = reason_text
    appt.doctor_response = reason_text
    appt.doctor_response_notes = payload.doctor_notes or reason_text
    appt.doctor_response_at = now_utc

    db.commit()
    db.refresh(appt)

    doc_display = current_user.full_name if current_user.full_name.startswith("Dr.") else f"Dr. {current_user.full_name}"
    date_str = appt.appointment_date.strftime('%b %d, %Y')
    notif_msg = f"Your appointment request for {date_str} was declined by {doc_display}. Reason: {reason_text}. Please request another appointment if required."

    db.add(Notification(
        user_id=appt.user_id,
        sender_id=current_user.id,
        title="Appointment Request Declined",
        message=notif_msg,
        notification_type="AppointmentReject",
        urgency="Normal",
        reference_id=appt.id,
        reference_type="appointment"
    ))
    db.commit()

    return build_appointment_response(appt, db)


@router.post("/appointments/{appointment_id}/reschedule", response_model=AppointmentResponse, summary="Doctor Proposes New Time")
@router.post("/doctors/appointments/{appointment_id}/reschedule", response_model=AppointmentResponse, summary="Doctor Proposes New Time (Alias)")
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can propose appointment reschedules.")

    appt = db.query(FollowUpAppointment).filter(FollowUpAppointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appt.doctor_id and appt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to reschedule this appointment.")

    if not payload.suggested_date or not payload.suggested_date.strip():
        raise HTTPException(status_code=400, detail="Suggested date is required.")
    if not payload.suggested_time or not payload.suggested_time.strip():
        raise HTTPException(status_code=400, detail="Suggested time is required.")

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    if not appt.original_appointment_date:
        appt.original_appointment_date = appt.appointment_date

    s_date = payload.suggested_date.strip()
    s_time = payload.suggested_time.strip()
    appt.doctor_id = current_user.id
    appt.status = "AWAITING_PATIENT_CONFIRMATION"
    appt.suggested_date = s_date
    appt.suggested_time = s_time
    appt.suggested_alternate_time = f"{s_date} @ {s_time}"
    msg_text = payload.message or payload.doctor_notes
    appt.doctor_response = msg_text
    appt.doctor_response_notes = msg_text
    appt.doctor_response_at = now_utc

    db.commit()
    db.refresh(appt)

    doc_display = current_user.full_name if current_user.full_name.startswith("Dr.") else f"Dr. {current_user.full_name}"
    notif_msg = f"{doc_display} has proposed a new appointment time on {s_date} at {s_time}."
    if msg_text:
        notif_msg += f" Note: {msg_text}"

    db.add(Notification(
        user_id=appt.user_id,
        sender_id=current_user.id,
        title="New Appointment Time Proposed",
        message=notif_msg,
        notification_type="AppointmentReschedule",
        urgency="Normal",
        reference_id=appt.id,
        reference_type="appointment"
    ))
    db.commit()

    return build_appointment_response(appt, db)


@router.post("/appointments/{appointment_id}/patient-response", response_model=AppointmentResponse, summary="Patient Responds to Reschedule Proposal")
def patient_response_appointment(
    appointment_id: int,
    payload: AppointmentPatientResponseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(FollowUpAppointment).filter(FollowUpAppointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the patient who booked this appointment can respond.")

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    p_name = current_user.patient_profile.patient_name if current_user.patient_profile else current_user.full_name
    resp_type = payload.response.strip().lower()

    if resp_type == "accept":
        if appt.suggested_date:
            try:
                # Try parsing YYYY-MM-DD
                appt.appointment_date = datetime.datetime.fromisoformat(appt.suggested_date)
            except Exception:
                pass
        if appt.suggested_time:
            appt.appointment_time = appt.suggested_time
        appt.status = "CONFIRMED"
        appt.patient_response_at = now_utc

        if appt.doctor_id:
            db.add(Notification(
                user_id=appt.doctor_id,
                sender_id=current_user.id,
                title="Rescheduled Appointment Confirmed",
                message=f"Patient {p_name} accepted the proposed appointment time for {appt.suggested_date or 'the new date'} at {appt.suggested_time or 'the new time'}.",
                notification_type="AppointmentConfirmed",
                urgency="Normal",
                reference_id=appt.id,
                reference_type="appointment"
            ))
    elif resp_type in ("decline", "reject"):
        appt.status = "PENDING"
        appt.patient_response_at = now_utc

        if appt.doctor_id:
            decline_note = f" (Note: {payload.patient_notes})" if payload.patient_notes else ""
            db.add(Notification(
                user_id=appt.doctor_id,
                sender_id=current_user.id,
                title="Rescheduled Time Declined",
                message=f"Patient {p_name} declined the proposed time ({appt.suggested_date} @ {appt.suggested_time}){decline_note}. Appointment returned to Pending status.",
                notification_type="AppointmentDeclined",
                urgency="Normal",
                reference_id=appt.id,
                reference_type="appointment"
            ))
    else:
        raise HTTPException(status_code=400, detail="Invalid response: must be 'accept' or 'decline'.")

    db.commit()
    db.refresh(appt)
    return build_appointment_response(appt, db)


@router.post("/doctors/appointments/{appointment_id}/action", response_model=AppointmentResponse, summary="Doctor Accepts/Rejects/Reschedules Appointment (Unified Action)")
@router.post("/appointments/{appointment_id}/action", response_model=AppointmentResponse, summary="Doctor Accepts/Rejects/Reschedules Appointment (Unified Action)")
def action_doctor_appointment(
    appointment_id: int,
    payload: AppointmentDoctorAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can perform appointment actions.")

    appt = db.query(FollowUpAppointment).filter(FollowUpAppointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appt.doctor_id and appt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to manage this appointment.")

    act = payload.action.lower()
    alt_time = payload.suggested_alternate_time or payload.alternate_time
    if payload.suggested_alternate_date:
        alt_time = f"{payload.suggested_alternate_date} @ {alt_time}" if alt_time else payload.suggested_alternate_date
    notes = payload.doctor_notes or payload.notes
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    appt.doctor_id = current_user.id
    doc_display = current_user.full_name if current_user.full_name.startswith("Dr.") else f"Dr. {current_user.full_name}"

    if act == "accept":
        appt.status = "CONFIRMED"
        appt.doctor_response_at = now_utc
        notif_msg = f"Your appointment has been confirmed by {doc_display} for {appt.appointment_date.strftime('%b %d, %Y')}."
        notif_type = "AppointmentAccept"
    elif act == "reject":
        appt.status = "REJECTED"
        appt.rejection_reason = payload.rejection_reason or notes or "Declined by doctor."
        appt.doctor_response = appt.rejection_reason
        appt.doctor_response_at = now_utc
        notif_msg = f"Your appointment request for {appt.appointment_date.strftime('%b %d, %Y')} was declined by {doc_display}. Reason: {appt.rejection_reason}."
        notif_type = "AppointmentReject"
    elif act == "reschedule":
        appt.status = "AWAITING_PATIENT_CONFIRMATION"
        if not appt.original_appointment_date:
            appt.original_appointment_date = appt.appointment_date
        if payload.suggested_alternate_date:
            appt.suggested_date = payload.suggested_alternate_date
        if alt_time:
            appt.suggested_alternate_time = alt_time
            if not appt.suggested_time:
                appt.suggested_time = alt_time
        appt.doctor_response = notes
        appt.doctor_response_at = now_utc
        notif_msg = f"{doc_display} suggested an alternate appointment: {alt_time or appt.suggested_date}."
        notif_type = "AppointmentReschedule"
    elif act == "complete":
        appt.status = "COMPLETED"
        appt.doctor_response_at = now_utc
        notif_msg = f"Your consultation on {appt.appointment_date.strftime('%b %d, %Y')} with {doc_display} is marked as Completed."
        notif_type = "AppointmentComplete"
    elif act == "cancel":
        appt.status = "CANCELLED"
        appt.doctor_response_at = now_utc
        notif_msg = f"Your appointment on {appt.appointment_date.strftime('%b %d, %Y')} was cancelled by {doc_display}."
        notif_type = "AppointmentCancel"
    else:
        raise HTTPException(status_code=400, detail="Invalid action specified.")

    appt.doctor_response_notes = notes
    db.commit()
    db.refresh(appt)

    # Send notification to patient
    db.add(Notification(
        user_id=appt.user_id,
        sender_id=current_user.id,
        title="Appointment Status Update",
        message=notif_msg,
        notification_type=notif_type,
        urgency="Normal",
        reference_id=appt.id,
        reference_type="appointment"
    ))
    db.commit()

    return build_appointment_response(appt, db)


# ==========================================
# 6. PATIENT APPOINTMENTS
# ==========================================

@router.get("/appointments", response_model=List[AppointmentResponse], summary="List Patient Appointments")
@router.get("/patient/appointments", response_model=List[AppointmentResponse], summary="List Patient Appointments (Alias)")
def get_patient_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appts = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.user_id == current_user.id
    ).order_by(FollowUpAppointment.appointment_date.desc(), FollowUpAppointment.id.desc()).all()

    return [build_appointment_response(a, db) for a in appts]


@router.post("/appointments", response_model=AppointmentResponse, summary="Patient Books Appointment")
def create_patient_appointment(
    payload: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_name = payload.doctor_or_clinic.strip()
    if payload.doctor_id:
        doc_user = db.query(User).filter(User.id == payload.doctor_id, User.role == "doctor").first()
        if doc_user:
            doc_name = doc_user.full_name

    appt = FollowUpAppointment(
        user_id=current_user.id,
        doctor_id=payload.doctor_id,
        doctor_or_clinic=doc_name,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        purpose_or_notes=payload.purpose_or_notes,
        reminder_advance_hours=payload.reminder_advance_hours,
        status="PENDING",
        is_reminder_sent=False
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    # Notify doctor if linked
    if payload.doctor_id:
        p_name = current_user.patient_profile.patient_name if current_user.patient_profile else current_user.full_name
        db.add(Notification(
            user_id=payload.doctor_id,
            sender_id=current_user.id,
            title="New Patient Appointment Request",
            message=f"{p_name} requested an appointment for {payload.appointment_date.strftime('%b %d, %Y')}: {payload.purpose_or_notes or 'General consultation'}.",
            notification_type="AppointmentRequest",
            urgency="Normal",
            reference_id=appt.id,
            reference_type="appointment"
        ))
        db.commit()

    return build_appointment_response(appt, db)

@router.delete("/appointments/{appointment_id}", summary="Delete Appointment")
def delete_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(FollowUpAppointment).filter(
        FollowUpAppointment.id == appointment_id,
        or_(FollowUpAppointment.user_id == current_user.id, FollowUpAppointment.doctor_id == current_user.id)
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    db.delete(appt)
    db.commit()
    return {"status": "deleted", "id": appointment_id}


# ==========================================
# 7. IMAGE SERVING (AUTHENTICATED & ACCESSIBLE TO CONNECTED DOCTOR)
# ==========================================

@router.get("/images/{filename}", summary="Get Stored Skin Record Image")
def get_user_image(
    filename: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    raw_token = credentials.credentials if (credentials and credentials.credentials) else token
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required to view skin image.")

    payload = decode_token(raw_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    try:
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token.")

    requester = db.query(User).filter(User.id == user_id).first()
    if not requester:
        raise HTTPException(status_code=401, detail="User account not found.")

    # 1. Direct owner check
    user_dir = UPLOAD_DIR / str(user_id)
    safe_name = Path(filename).name
    path = (user_dir / safe_name).resolve()

    if path.exists() and str(path).startswith(str(UPLOAD_DIR)):
        ext = path.suffix.lower()
        media_type = "image/png" if ext == ".png" else "image/jpeg"
        return FileResponse(path, media_type=media_type)

    # 2. If requester is a doctor, check if this image belongs to an authorized patient
    if requester.role == "doctor":
        rec = db.query(SkinHealthRecord).filter(SkinHealthRecord.image_filename == safe_name).first()
        if rec:
            # Verify patient is connected to this doctor
            conn = db.query(PatientDoctorConnection).filter(
                PatientDoctorConnection.doctor_id == requester.id,
                PatientDoctorConnection.patient_id == rec.user_id,
                PatientDoctorConnection.status == "Accepted"
            ).first()
            if conn:
                pat_path = (UPLOAD_DIR / str(rec.user_id) / safe_name).resolve()
                if pat_path.exists() and str(pat_path).startswith(str(UPLOAD_DIR)):
                    ext = pat_path.suffix.lower()
                    media_type = "image/png" if ext == ".png" else "image/jpeg"
                    return FileResponse(pat_path, media_type=media_type)

    raise HTTPException(status_code=404, detail="Image file not found or access denied.")


# ==========================================
# 8. SKIN HEALTH RECORDS (PATIENT PERSPECTIVE)
# ==========================================

def serialize_skin_record(r: SkinHealthRecord) -> SkinRecordResponse:
    return SkinRecordResponse(
        id=r.id,
        user_id=r.user_id,
        image_filename=r.image_filename,
        image_url=f"/api/images/{r.image_filename}",
        thumbnail_b64=r.thumbnail_b64,
        capture_date=r.capture_date,
        created_at=r.created_at,
        body_location=r.body_location,
        user_notes=r.user_notes,
        prediction_id=r.prediction_id,
        predicted_disease=r.predicted_disease,
        confidence_score=r.confidence_score,
        symptoms=[
            SymptomResponse(
                id=s.id,
                user_id=s.user_id,
                skin_record_id=s.skin_record_id,
                symptom_name=s.symptom_name,
                severity=s.severity,
                severity_score=s.severity_score,
                recorded_at=s.recorded_at,
                duration=s.duration,
                notes=s.notes
            )
            for s in r.symptoms
        ]
    )

def serialize_symptom(s: SymptomRecord) -> SymptomResponse:
    img_url = f"/api/images/{s.skin_record.image_filename}" if (s.skin_record and s.skin_record.image_filename) else None
    body_loc = s.skin_record.body_location if s.skin_record else None
    return SymptomResponse(
        id=s.id,
        user_id=s.user_id,
        skin_record_id=s.skin_record_id,
        symptom_name=s.symptom_name,
        severity=s.severity,
        severity_score=s.severity_score,
        recorded_at=s.recorded_at,
        duration=s.duration,
        notes=s.notes,
        doctor_observation=s.doctor_observation,
        doctor_feedback=s.doctor_feedback,
        reviewed_by_doctor_id=s.reviewed_by_doctor_id,
        reviewed_by_doctor_name=s.reviewed_by_doctor_name,
        reviewed_at=s.reviewed_at,
        skin_record_image_url=img_url,
        skin_record_body_location=body_loc
    )

@router.get("/skin-records", response_model=List[SkinRecordResponse], summary="List User Skin Health Records")
def get_skin_records(
    body_location: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SkinHealthRecord).filter(SkinHealthRecord.user_id == current_user.id)
    if body_location:
        query = query.filter(SkinHealthRecord.body_location.ilike(f"%{body_location}%"))
    records = query.order_by(SkinHealthRecord.capture_date.desc()).all()
    return [serialize_skin_record(r) for r in records]

@router.post("/skin-records", response_model=SkinRecordResponse, summary="Create New Skin Health Record")
async def create_skin_record(
    body_location: str = Form(...),
    capture_date: Optional[str] = Form(None),
    user_notes: Optional[str] = Form(None),
    prediction_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    reuse_image_hash: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    image_bytes = None
    orig_filename = "skin_lesion.jpg"

    if file:
        image_bytes = await file.read()
        orig_filename = file.filename or "skin_lesion.jpg"
    elif prediction_id:
        pred = db.query(PredictionRecord).filter(PredictionRecord.id == prediction_id).first()
        if pred and pred.image_preview_b64:
            b64_data = pred.image_preview_b64
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            image_bytes = base64.b64decode(b64_data)
            orig_filename = f"prediction_{prediction_id}.jpg"

    if not image_bytes:
        raise HTTPException(status_code=400, detail="An image file or valid prediction reference is required.")

    stored_filename, img_hash, thumb_b64 = save_image_bytes(image_bytes, current_user.id, orig_filename)

    parsed_date = datetime.datetime.now(datetime.timezone.utc)
    if capture_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(capture_date.replace("Z", "+00:00"))
        except Exception:
            pass

    pred_disease = None
    pred_conf = None
    if prediction_id:
        pred_rec = db.query(PredictionRecord).filter(PredictionRecord.id == prediction_id).first()
        if pred_rec:
            pred_disease = pred_rec.predicted_class
            pred_conf = pred_rec.confidence

    record = SkinHealthRecord(
        user_id=current_user.id,
        image_filename=stored_filename,
        image_hash=img_hash,
        thumbnail_b64=thumb_b64,
        capture_date=parsed_date,
        body_location=body_location.strip(),
        user_notes=user_notes,
        prediction_id=prediction_id,
        predicted_disease=pred_disease,
        confidence_score=pred_conf
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return serialize_skin_record(record)

@router.get("/skin-records/{record_id}", response_model=SkinRecordResponse, summary="Get Single Skin Record")
def get_skin_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.id == record_id,
        SkinHealthRecord.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Skin record not found.")
    return serialize_skin_record(record)

@router.put("/skin-records/{record_id}", response_model=SkinRecordResponse, summary="Update Skin Record")
def update_skin_record(
    record_id: int,
    payload: SkinRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.id == record_id,
        SkinHealthRecord.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Skin record not found.")

    if payload.body_location is not None:
        record.body_location = payload.body_location.strip()
    if payload.capture_date is not None:
        record.capture_date = payload.capture_date
    if payload.user_notes is not None:
        record.user_notes = payload.user_notes

    db.commit()
    db.refresh(record)
    return serialize_skin_record(record)

@router.delete("/skin-records/{record_id}", summary="Delete Skin Record")
def delete_skin_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(SkinHealthRecord).filter(
        SkinHealthRecord.id == record_id,
        SkinHealthRecord.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Skin record not found.")
    db.delete(record)
    db.commit()
    return {"status": "deleted", "id": record_id}


# ==========================================
# 9. SYMPTOM TRACKING
# ==========================================

@router.get("/symptoms", response_model=List[SymptomResponse], summary="List All Symptoms")
def get_all_symptoms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == current_user.id
    ).order_by(SymptomRecord.recorded_at.desc()).all()
    return [serialize_symptom(s) for s in symptoms]

@router.post("/symptoms", response_model=Dict[str, Any], summary="Record New Symptom")
def create_symptom(
    payload: SymptomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_severity = payload.severity.capitalize()
    score = SEVERITY_MAPPING.get(payload.severity.lower(), 1)
    rec_time = payload.recorded_at or datetime.datetime.now(datetime.timezone.utc)

    symptom = SymptomRecord(
        user_id=current_user.id,
        skin_record_id=payload.skin_record_id,
        symptom_name=payload.symptom_name.strip(),
        severity=clean_severity,
        severity_score=score,
        recorded_at=rec_time,
        duration=payload.duration,
        notes=payload.notes
    )
    db.add(symptom)
    db.commit()
    db.refresh(symptom)

    advisory = check_symptom_progression_and_alert(
        db=db,
        user_id=current_user.id,
        new_symptom=symptom
    )

    # Notify connected doctor(s)
    conns = db.query(PatientDoctorConnection).filter(
        PatientDoctorConnection.patient_id == current_user.id,
        PatientDoctorConnection.status == "Accepted"
    ).all()
    p_name = current_user.patient_profile.patient_name if current_user.patient_profile else current_user.full_name
    for c in conns:
        urgency = "Urgent" if clean_severity == "Severe" or (advisory and advisory.get("alert_triggered")) else "Normal"
        db.add(Notification(
            user_id=c.doctor_id,
            sender_id=current_user.id,
            title="New Patient Symptom Report",
            message=f"{p_name} reported new symptom: {symptom.symptom_name} (Severity: {clean_severity})." + (f" Advisory: {advisory.get('title')}" if advisory and advisory.get("alert_triggered") else ""),
            notification_type="SymptomAlert" if urgency == "Urgent" else "SymptomReport",
            urgency=urgency,
            reference_id=symptom.id,
            reference_type="symptom"
        ))
    db.commit()

    return {
        "symptom": serialize_symptom(symptom),
        "advisory": advisory
    }

@router.delete("/symptoms/{symptom_id}", summary="Delete Symptom")
def delete_symptom(
    symptom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    symptom = db.query(SymptomRecord).filter(
        SymptomRecord.id == symptom_id,
        SymptomRecord.user_id == current_user.id
    ).first()
    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom record not found.")
    db.delete(symptom)
    db.commit()
    return {"status": "deleted", "id": symptom_id}

@router.post("/doctors/symptoms/{symptom_id}/observation", response_model=SymptomResponse, summary="Doctor Adds Clinical Observation to Symptom")
def add_doctor_symptom_observation(
    symptom_id: int,
    payload: DoctorSymptomObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can add clinical observations.")

    symptom = db.query(SymptomRecord).filter(SymptomRecord.id == symptom_id).first()
    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom record not found.")

    verify_doctor_patient_access(current_user.id, symptom.user_id, db)

    # Set doctor clinical observations without modifying the original patient-reported entry
    symptom.doctor_observation = payload.doctor_observation.strip()
    symptom.doctor_feedback = payload.doctor_feedback.strip() if payload.doctor_feedback else None
    symptom.reviewed_by_doctor_id = current_user.id
    symptom.reviewed_by_doctor_name = current_user.full_name
    symptom.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(symptom)

    # Generate patient notification
    doc_display_name = current_user.full_name if current_user.full_name.startswith("Dr.") else f"Dr. {current_user.full_name}"
    db.add(Notification(
        user_id=symptom.user_id,
        sender_id=current_user.id,
        title="Dermatologist Clinical Observation Added",
        message=f"{doc_display_name} reviewed your symptom report for '{symptom.symptom_name}' and added clinical observations and follow-up guidance.",
        notification_type="DoctorObservation",
        urgency="Normal",
        reference_id=symptom.id,
        reference_type="symptom"
    ))
    db.commit()

    return serialize_symptom(symptom)


# ==========================================
# 10. CONSULTATIONS (PATIENT VIEW)
# ==========================================

@router.get("/consultations", response_model=List[ConsultationResponse], summary="List Patient Consultations")
def get_consultations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(DermatologistConsultation).filter(
        DermatologistConsultation.user_id == current_user.id
    ).order_by(DermatologistConsultation.consultation_date.desc()).all()

@router.post("/consultations", response_model=ConsultationResponse, summary="Create Patient Self-Entered Consultation")
def create_consultation(
    payload: ConsultationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cons = DermatologistConsultation(
        user_id=current_user.id,
        doctor_name=payload.doctor_name.strip() if payload.doctor_name else "Dermatologist",
        clinic_name=payload.clinic_name.strip() if payload.clinic_name else "Clinical Practice",
        consultation_date=payload.consultation_date,
        doctor_diagnosis=payload.doctor_diagnosis.strip(),
        clinical_observations=payload.clinical_observations,
        recommendations=payload.recommendations,
        consultation_notes=payload.consultation_notes,
        follow_up_instructions=payload.follow_up_instructions,
        follow_up_date=payload.follow_up_date,
        expected_review_date=payload.expected_review_date
    )
    db.add(cons)
    db.commit()
    db.refresh(cons)
    return cons


# ==========================================
# 11. TREATMENT MANAGEMENT (PATIENT VIEW)
# ==========================================

@router.get("/treatments", response_model=List[TreatmentResponse], summary="List Patient Treatments")
def get_treatments(
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(TreatmentRecord).filter(TreatmentRecord.user_id == current_user.id)
    if active_only:
        q = q.filter(TreatmentRecord.is_active == True)
    treatments = q.order_by(TreatmentRecord.start_date.desc(), TreatmentRecord.id.desc()).all()

    resp = []
    for t in treatments:
        doc = db.query(User).filter(User.id == t.prescribed_by_doctor_id).first() if t.prescribed_by_doctor_id else None
        doc_prof = doc.doctor_profile if (doc and doc.doctor_profile) else None

        # Look up any follow-up appointment
        follow_up = None
        if t.consultation_id:
            follow_up = db.query(FollowUpAppointment).filter(FollowUpAppointment.consultation_id == t.consultation_id).first()
        if not follow_up and t.prescribed_by_doctor_id:
            follow_up = db.query(FollowUpAppointment).filter(
                FollowUpAppointment.user_id == current_user.id,
                FollowUpAppointment.doctor_id == t.prescribed_by_doctor_id,
                FollowUpAppointment.appointment_date >= t.start_date
            ).order_by(FollowUpAppointment.appointment_date.asc()).first()

        resp.append(TreatmentResponse(
            id=t.id,
            user_id=t.user_id,
            prescribed_by_doctor_id=t.prescribed_by_doctor_id,
            prescribing_doctor_name=doc.full_name if doc else None,
            prescribing_doctor_qualification=doc_prof.qualification if doc_prof else None,
            prescribing_doctor_specialization=doc_prof.specialization if doc_prof else None,
            prescribing_doctor_hospital=doc_prof.hospital_name if doc_prof else None,
            consultation_id=t.consultation_id,
            treatment_name=t.treatment_name,
            prescribed_medication=t.prescribed_medication,
            treatment_type=t.treatment_type,
            dosage_or_instructions=t.dosage_or_instructions,
            treatment_status=t.treatment_status or "Treatment Prescribed",
            start_date=t.start_date,
            review_date=t.review_date,
            end_date=t.end_date,
            follow_up_appointment_date=follow_up.appointment_date if follow_up else None,
            follow_up_appointment_time=follow_up.appointment_time if follow_up else None,
            is_active=t.is_active,
            notes=t.notes,
            doctor_notes=t.doctor_notes,
            created_at=t.created_at
        ))
    return resp

@router.post("/treatments", response_model=TreatmentResponse, summary="Create Treatment (Doctor Only)")
def create_treatment(
    payload: TreatmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        raise HTTPException(
            status_code=403,
            detail="Patients cannot prescribe clinical treatment plans. Only your treating dermatologist can prescribe or modify medical treatments."
        )

    target_patient_id = payload.patient_id or current_user.id
    verify_doctor_patient_access(current_user.id, target_patient_id, db)

    treatment = TreatmentRecord(
        user_id=target_patient_id,
        prescribed_by_doctor_id=current_user.id,
        consultation_id=payload.consultation_id,
        treatment_name=payload.treatment_name.strip(),
        prescribed_medication=payload.prescribed_medication.strip() if payload.prescribed_medication else None,
        treatment_type=payload.treatment_type.strip(),
        dosage_or_instructions=(payload.dosage_or_instructions or f"{payload.dosage or ''} {payload.frequency or ''}").strip() or "As directed by physician",
        treatment_status=payload.treatment_status or "Treatment Prescribed",
        start_date=payload.start_date,
        review_date=payload.review_date,
        end_date=payload.end_date,
        is_active=payload.is_active,
        notes=payload.notes,
        doctor_notes=payload.doctor_notes
    )
    db.add(treatment)
    db.commit()
    db.refresh(treatment)

    # Notify patient
    db.add(Notification(
        user_id=target_patient_id,
        sender_id=current_user.id,
        title="Treatment Plan Prescribed",
        message="Your dermatologist has updated your treatment plan. Open the Treatments section to view the latest instructions.",
        notification_type="TreatmentUpdate",
        urgency="Normal",
        reference_id=treatment.id,
        reference_type="treatment"
    ))
    db.commit()

    doc_prof = current_user.doctor_profile if hasattr(current_user, 'doctor_profile') else None
    return TreatmentResponse(
        id=treatment.id,
        user_id=treatment.user_id,
        prescribed_by_doctor_id=treatment.prescribed_by_doctor_id,
        prescribing_doctor_name=current_user.full_name,
        prescribing_doctor_qualification=doc_prof.qualification if doc_prof else None,
        prescribing_doctor_specialization=doc_prof.specialization if doc_prof else None,
        prescribing_doctor_hospital=doc_prof.hospital_name if doc_prof else None,
        consultation_id=treatment.consultation_id,
        treatment_name=treatment.treatment_name,
        prescribed_medication=treatment.prescribed_medication,
        treatment_type=treatment.treatment_type,
        dosage_or_instructions=treatment.dosage_or_instructions,
        treatment_status=treatment.treatment_status,
        start_date=treatment.start_date,
        review_date=treatment.review_date,
        end_date=treatment.end_date,
        is_active=treatment.is_active,
        notes=treatment.notes,
        doctor_notes=treatment.doctor_notes,
        created_at=treatment.created_at
    )

@router.put("/treatments/{treatment_id}", response_model=TreatmentResponse, summary="Update Treatment (Doctor Only)")
def update_treatment(
    treatment_id: int,
    payload: TreatmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        raise HTTPException(
            status_code=403,
            detail="Patients cannot modify clinical treatment plans. Only your treating dermatologist can update or modify prescribed treatment plans."
        )
    return doctor_update_treatment(treatment_id, payload, current_user, db)

@router.delete("/treatments/{treatment_id}", summary="Delete Treatment (Doctor Only)")
def delete_treatment(
    treatment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        raise HTTPException(
            status_code=403,
            detail="Patients cannot delete doctor-prescribed treatment records."
        )
    treatment = db.query(TreatmentRecord).filter(TreatmentRecord.id == treatment_id).first()
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment record not found.")
    verify_doctor_patient_access(current_user.id, treatment.user_id, db)
    db.delete(treatment)
    db.commit()
    return {"status": "deleted", "id": treatment_id}


# ==========================================
# 12. NOTIFICATIONS
# ==========================================

@router.get("/notifications", response_model=List[NotificationResponse], summary="List Notifications")
def get_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.order_by(Notification.created_at.desc()).all()

@router.put("/notifications/{notification_id}/read", response_model=NotificationResponse, summary="Mark Notification Read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


# ==========================================
# 13. IMAGE COMPARISON
# ==========================================

@router.post("/skin-comparison", response_model=ComparisonResponse, summary="Compare Two Skin Images")
def compare_skin_images(
    payload: ComparisonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    earlier = db.query(SkinHealthRecord).filter(SkinHealthRecord.id == payload.earlier_record_id).first()
    later = db.query(SkinHealthRecord).filter(SkinHealthRecord.id == payload.later_record_id).first()

    if not earlier or not later:
        raise HTTPException(status_code=404, detail="One or both skin records could not be found.")

    # Check access: either patient owns both records, or authorized doctor
    if current_user.role == "patient":
        if earlier.user_id != current_user.id or later.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    elif current_user.role == "doctor":
        verify_doctor_patient_access(current_user.id, earlier.user_id, db)

    path1 = get_image_path(earlier.user_id, earlier.image_filename)
    path2 = get_image_path(later.user_id, later.image_filename)

    cv_results = analyze_visual_comparison(path1, path2)

    comp_rec = ImageComparisonRecord(
        user_id=current_user.id,
        earlier_record_id=earlier.id,
        later_record_id=later.id,
        similarity_score=cv_results["similarity_score"],
        histogram_distance=cv_results["histogram_distance"],
        color_shift_detected=cv_results["color_shift_detected"],
        observations_json=json.dumps(cv_results["observed_changes"])
    )
    db.add(comp_rec)
    db.commit()

    return ComparisonResponse(
        earlier_record=serialize_skin_record(earlier),
        later_record=serialize_skin_record(later),
        similarity_score=cv_results["similarity_score"],
        histogram_distance=cv_results["histogram_distance"],
        color_shift_detected=cv_results["color_shift_detected"],
        observed_changes=cv_results["observed_changes"],
        disclaimer=cv_results["disclaimer"]
    )


# ==========================================
# 14. CHRONOLOGICAL SKIN PROGRESS TIMELINE
# ==========================================

@router.get("/skin-timeline", response_model=List[TimelineEvent], summary="Chronological Skin Health Timeline")
@router.get("/timeline", response_model=List[TimelineEvent], summary="Chronological Skin Health Timeline (Alias)")
def get_skin_timeline(
    patient_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine target user id
    target_user_id = current_user.id
    if current_user.role == "doctor":
        if not patient_id:
            raise HTTPException(status_code=400, detail="Doctor must select an authorized patient to view their timeline.")
        verify_doctor_patient_access(current_user.id, patient_id, db)
        target_user_id = patient_id

    events: List[TimelineEvent] = []

    # 1. Skin records & linked AI predictions
    records = db.query(SkinHealthRecord).filter(SkinHealthRecord.user_id == target_user_id).all()
    for r in records:
        events.append(TimelineEvent(
            event_id=f"record_{r.id}",
            event_type="skin_record",
            date=r.capture_date,
            title=f"Skin Photo: {r.body_location}",
            subtitle=f"AI Prediction: {r.predicted_disease} ({int((r.confidence_score or 0)*100)}%)" if r.predicted_disease else "Lesion Photo Entry",
            description=r.user_notes,
            image_url=f"/api/images/{r.image_filename}" if r.image_filename else None,
            body_location=r.body_location,
            link_tab="records",
            metadata={"record_id": r.id, "location": r.body_location}
        ))
        if r.predicted_disease:
            events.append(TimelineEvent(
                event_id=f"prediction_{r.id}",
                event_type="ai_classification",
                date=r.created_at or r.capture_date,
                title=f"AI Diagnostic: {r.predicted_disease}",
                subtitle=f"Confidence: {int((r.confidence_score or 0) * 100)}% • Body Area: {r.body_location}",
                description=f"Automated AI screening scan recorded for {r.body_location}." + (f" Patient Notes: {r.user_notes}" if r.user_notes else ""),
                image_url=f"/api/images/{r.image_filename}" if r.image_filename else None,
                body_location=r.body_location,
                link_tab="diagnose",
                metadata={"record_id": r.id, "confidence": r.confidence_score}
            ))

    # 2. AI Classifications (PredictionRecord) if user_id is supported
    if hasattr(PredictionRecord, "user_id"):
        pred_records = db.query(PredictionRecord).filter(getattr(PredictionRecord, "user_id") == target_user_id).all()
        for p in pred_records:
            events.append(TimelineEvent(
                event_id=f"pred_history_{p.id}",
                event_type="ai_classification",
                date=p.created_at,
                title=f"AI Diagnostic Screening: {p.predicted_class}",
                subtitle=f"Confidence: {int(p.confidence * 100)}% • Entropy: {p.uncertainty_entropy:.2f}",
                description="Specialist clinical review recommended due to elevated uncertainty." if p.is_uncertain else "Standard routine skin health monitoring.",
                image_url=p.image_preview_b64 if p.image_preview_b64 else None,
                link_tab="diagnose",
                metadata={"prediction_id": p.id, "is_uncertain": p.is_uncertain, "confidence": p.confidence}
            ))

    # 3. Symptoms
    symptoms = db.query(SymptomRecord).filter(SymptomRecord.user_id == target_user_id).all()
    for s in symptoms:
        doc_note = f" • Clinician Review: {s.doctor_observation}" if s.doctor_observation else ""
        img_url = f"/api/images/{s.skin_record.image_filename}" if (s.skin_record and s.skin_record.image_filename) else None
        body_loc = s.skin_record.body_location if s.skin_record else None
        desc_parts = []
        if s.notes:
            desc_parts.append(f"Patient Notes: {s.notes}")
        if s.doctor_observation:
            desc_parts.append(f"Doctor Observation ({s.reviewed_by_doctor_name or 'Clinician'}): {s.doctor_observation}")
        if s.doctor_feedback:
            desc_parts.append(f"Doctor Recommendations: {s.doctor_feedback}")
        events.append(TimelineEvent(
            event_id=f"symptom_{s.id}",
            event_type="symptom",
            date=s.recorded_at,
            title=f"Symptom Logged: {s.symptom_name}",
            subtitle=f"Severity: {s.severity} (Duration: {s.duration or 'unspecified'}){doc_note}",
            description=" • ".join(desc_parts) if desc_parts else "Self-reported skin symptom entry.",
            severity=s.severity,
            image_url=img_url,
            body_location=body_loc,
            link_tab="symptoms",
            metadata={
                "symptom_id": s.id,
                "score": s.severity_score,
                "doctor_observation": s.doctor_observation,
                "doctor_feedback": s.doctor_feedback,
                "reviewed_by_doctor_name": s.reviewed_by_doctor_name
            }
        ))

    # 4. Consultations
    consultations = db.query(DermatologistConsultation).filter(DermatologistConsultation.user_id == target_user_id).all()
    for c in consultations:
        events.append(TimelineEvent(
            event_id=f"consultation_{c.id}",
            event_type="consultation",
            date=c.consultation_date,
            title=f"Dermatologist Visit: Dr. {c.doctor_name}",
            subtitle=f"Clinic: {c.clinic_name} • Diagnosis: {c.doctor_diagnosis}",
            description=f"Observations: {c.clinical_observations or 'None'}. Follow-up instructions: {c.follow_up_instructions or 'None'}.",
            link_tab="consultations",
            metadata={"consultation_id": c.id, "clinic": c.clinic_name}
        ))

    # 5. Treatments
    treatments = db.query(TreatmentRecord).filter(TreatmentRecord.user_id == target_user_id).all()
    for t in treatments:
        doc_user = db.query(User).filter(User.id == t.prescribed_by_doctor_id).first() if t.prescribed_by_doctor_id else None
        doc_label = f" by {doc_user.full_name}" if doc_user else ""
        events.append(TimelineEvent(
            event_id=f"treatment_{t.id}",
            event_type="treatment_start",
            date=t.start_date,
            title=f"Treatment Plan: {t.treatment_name}",
            subtitle=f"Status: {t.treatment_status} • Instructions: {t.dosage_or_instructions}{doc_label}",
            description=t.doctor_notes or t.notes,
            link_tab="treatments",
            metadata={"treatment_id": t.id, "active": t.is_active, "status": t.treatment_status}
        ))

    # 6. Appointments
    appointments = db.query(FollowUpAppointment).filter(FollowUpAppointment.user_id == target_user_id).all()
    for a in appointments:
        events.append(TimelineEvent(
            event_id=f"appointment_{a.id}",
            event_type="appointment",
            date=a.appointment_date,
            title=f"Appointment: {a.doctor_or_clinic}",
            subtitle=f"Status: {a.status} (Slot: {a.appointment_time or 'Scheduled'})",
            description=a.doctor_response_notes or a.purpose_or_notes,
            link_tab="appointments",
            metadata={"appointment_id": a.id, "status": a.status}
        ))

    # 7. Image Comparisons
    comparisons = db.query(ImageComparisonRecord).filter(ImageComparisonRecord.user_id == target_user_id).all()
    for comp in comparisons:
        events.append(TimelineEvent(
            event_id=f"comparison_{comp.id}",
            event_type="image_comparison",
            date=comp.created_at,
            title="Lesion Progression Comparison",
            subtitle=f"Similarity Score: {int((comp.similarity_score or 0) * 100)}% • Color Shift: {'Yes' if comp.color_shift_detected else 'No'}",
            description="Comparative visual evaluation between earlier and later lesion photographs.",
            link_tab="comparison",
            metadata={"comparison_id": comp.id, "similarity": comp.similarity_score}
        ))

    def ensure_utc(dt):
        if dt is None:
            return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.timezone.utc)
        return dt

    events.sort(key=lambda x: ensure_utc(x.date), reverse=True)
    return events
