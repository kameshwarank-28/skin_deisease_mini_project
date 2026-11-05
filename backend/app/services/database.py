import os
import sqlite3
import datetime
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.models.history import Base
# Import all health models so Base.metadata knows about them
import backend.app.models.health

DB_PATH = Path("backend/app/data/app.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.resolve()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_initial_accounts(db):
    """
    Creates the required prototype test accounts:
    1. Patient account: username='alan', password='alan10', role='patient'
    2. Verified Doctor account: username='dr_smith', password='doctor10', role='doctor'
    """
    from backend.app.models.health import User, DoctorProfile
    import bcrypt

    # 1. Patient: alan
    alan = db.query(User).filter(User.username == "alan").first()
    if not alan:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(b"alan10", salt).decode("utf-8")
        alan = User(
            username="alan",
            email="alan@dermai.local",
            hashed_password=hashed,
            full_name="Alan",
            role="patient",
            phone_number=None,
            timezone="UTC"
        )
        db.add(alan)
        db.commit()
        db.refresh(alan)
        print("[DB] Created initial patient account: username='alan'")
    else:
        alan.role = "patient"
        # Ensure password is set to alan10
        try:
            if not bcrypt.checkpw(b"alan10", alan.hashed_password.encode("utf-8")):
                salt = bcrypt.gensalt()
                alan.hashed_password = bcrypt.hashpw(b"alan10", salt).decode("utf-8")
        except:
            salt = bcrypt.gensalt()
            alan.hashed_password = bcrypt.hashpw(b"alan10", salt).decode("utf-8")
        db.commit()

    # 2. Doctor: dr_smith (Verified Dermatologist)
    dr_smith = db.query(User).filter(User.username == "dr_smith").first()
    if not dr_smith:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(b"doctor10", salt).decode("utf-8")
        dr_smith = User(
            username="dr_smith",
            email="dr_smith@dermai.local",
            hashed_password=hashed,
            full_name="Dr. Robert Smith, MD",
            role="doctor",
            phone_number="+1 555-0199",
            timezone="UTC"
        )
        db.add(dr_smith)
        db.commit()
        db.refresh(dr_smith)

        # Create verified doctor profile
        doc_prof = DoctorProfile(
            user_id=dr_smith.id,
            medical_reg_no="DMR-84920",
            qualification="MD, Board Certified Dermatologist",
            specialization="Clinical & Diagnostic Dermatology",
            hospital_name="City Dermatology Center",
            years_experience=12,
            bio="Senior Consultant Dermatologist specializing in pigmented lesions, dermoscopy, and eczema management.",
            verification_status="Verified",
            verified_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(doc_prof)
        db.commit()
        print("[DB] Created initial verified doctor account: username='dr_smith'")
    elif not dr_smith.doctor_profile:
        doc_prof = DoctorProfile(
            user_id=dr_smith.id,
            medical_reg_no="DMR-84920",
            qualification="MD, Board Certified Dermatologist",
            specialization="Clinical & Diagnostic Dermatology",
            hospital_name="City Dermatology Center",
            years_experience=12,
            bio="Senior Consultant Dermatologist specializing in pigmented lesions, dermoscopy, and eczema management.",
            verification_status="Verified",
            verified_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(doc_prof)
        db.commit()

def run_migrations():
    """
    Safely applies table creations and non-destructive column additions.
    Preserves all existing prediction history and user data.
    """
    Base.metadata.create_all(bind=engine)
    
    with engine.connect() as conn:
        def add_col_if_missing(table_name, col_name, col_type):
            res = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
            cols = [r[1] for r in res]
            if col_name not in cols:
                try:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type};"))
                    conn.commit()
                    print(f"[DB Migration] Added {col_name} column to {table_name}.")
                except Exception as e:
                    print(f"[DB Migration] Notice on {col_name} in {table_name}: {e}")

        # prediction_records
        add_col_if_missing("prediction_records", "user_id", "INTEGER")

        # users
        add_col_if_missing("users", "username", "VARCHAR(100)")
        add_col_if_missing("users", "phone_number", "VARCHAR(50)")
        add_col_if_missing("users", "role", "VARCHAR(20) DEFAULT 'patient'")
        add_col_if_missing("users", "profile_picture", "TEXT")

        # follow_up_appointments
        add_col_if_missing("follow_up_appointments", "doctor_id", "INTEGER")
        add_col_if_missing("follow_up_appointments", "appointment_time", "VARCHAR(50)")
        add_col_if_missing("follow_up_appointments", "original_appointment_date", "DATETIME")
        add_col_if_missing("follow_up_appointments", "suggested_date", "VARCHAR(50)")
        add_col_if_missing("follow_up_appointments", "suggested_time", "VARCHAR(50)")
        add_col_if_missing("follow_up_appointments", "suggested_alternate_time", "VARCHAR(255)")
        add_col_if_missing("follow_up_appointments", "rejection_reason", "TEXT")
        add_col_if_missing("follow_up_appointments", "doctor_response", "TEXT")
        add_col_if_missing("follow_up_appointments", "doctor_response_notes", "TEXT")
        add_col_if_missing("follow_up_appointments", "doctor_response_at", "DATETIME")
        add_col_if_missing("follow_up_appointments", "patient_response_at", "DATETIME")
        add_col_if_missing("follow_up_appointments", "updated_at", "DATETIME")

        # dermatologist_consultations
        add_col_if_missing("dermatologist_consultations", "doctor_id", "INTEGER")
        add_col_if_missing("dermatologist_consultations", "clinical_observations", "TEXT")
        add_col_if_missing("dermatologist_consultations", "recommendations", "TEXT")
        add_col_if_missing("dermatologist_consultations", "follow_up_date", "DATETIME")

        # treatment_records
        add_col_if_missing("treatment_records", "prescribed_by_doctor_id", "INTEGER")
        add_col_if_missing("treatment_records", "prescribed_medication", "VARCHAR(255)")
        add_col_if_missing("treatment_records", "review_date", "DATETIME")
        add_col_if_missing("treatment_records", "treatment_status", "VARCHAR(50) DEFAULT 'Treatment Prescribed'")
        add_col_if_missing("treatment_records", "doctor_notes", "TEXT")

        # notifications
        add_col_if_missing("notifications", "sender_id", "INTEGER")

def init_db():
    run_migrations()
    db = SessionLocal()
    try:
        init_initial_accounts(db)
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
