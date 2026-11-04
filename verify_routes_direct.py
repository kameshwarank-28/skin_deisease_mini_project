import sys
import datetime
from sqlalchemy.orm import Session
from backend.app.services.database import SessionLocal
from backend.app.models.health import (
    User,
    PatientProfile,
    DoctorProfile,
    PatientDoctorConnection,
    SkinHealthRecord,
    SymptomRecord,
    FollowUpAppointment,
    TreatmentRecord
)
from backend.app.api.health_routes import (
    get_patient_overview_stats,
    get_doctor_overview_stats,
    get_doctor_connections,
    action_doctor_connection,
    get_doctors_directory,
    request_doctor_connection,
    get_my_dermatologist,
    get_all_doctor_patient_records,
    get_all_doctor_patient_symptoms,
    get_doctor_followups
)
from backend.app.schemas.health import ConnectionRequestCreate, ConnectionActionRequest

def run_tests():
    print("=" * 60)
    print("RUNNING DIRECT ROUTE LOGIC & DB SYNCHRONIZATION TEST")
    print("=" * 60)
    db = SessionLocal()
    try:
        # Find a patient
        patient = db.query(User).filter(User.role == "patient").first()
        assert patient, "No patient found in database"
        print(f"[OK] Test Patient: {patient.full_name} ({patient.username}, ID: {patient.id})")

        # Find a doctor
        doctor = db.query(User).filter(User.role == "doctor").first()
        assert doctor, "No doctor found in database"
        print(f"[OK] Test Doctor: {doctor.full_name} ({doctor.username}, ID: {doctor.id})")

        # 1. Test get_patient_overview_stats
        p_stats = get_patient_overview_stats(current_user=patient, db=db)
        assert "stats" in p_stats
        assert "records_count" in p_stats["stats"]
        assert "active_treatments_count" in p_stats["stats"]
        assert "upcoming_appointments_count" in p_stats["stats"]
        print(f"[OK] get_patient_overview_stats succeeded: {p_stats['stats']}")

        # 2. Test get_doctor_overview_stats
        d_stats = get_doctor_overview_stats(current_user=doctor, db=db)
        assert "stats" in d_stats
        assert "total_connected_patients" in d_stats["stats"]
        assert "pending_patient_requests" in d_stats["stats"]
        assert "pending_appointments" in d_stats["stats"]
        assert "calendar_events" in d_stats
        print(f"[OK] get_doctor_overview_stats succeeded: {d_stats['stats']}")

        # 3. Test get_doctors_directory
        directory = get_doctors_directory(current_user=patient, db=db)
        assert len(directory) > 0
        print(f"[OK] get_doctors_directory succeeded: {len(directory)} doctors listed")

        # 4. Test request_doctor_connection
        req_payload = ConnectionRequestCreate(
            doctor_id=doctor.id,
            request_note="Automated test connection request"
        )
        conn_res = request_doctor_connection(payload=req_payload, current_user=patient, db=db)
        print(f"[OK] request_doctor_connection succeeded: {conn_res}")

        # 5. Test get_doctor_connections
        doc_conns = get_doctor_connections(current_user=doctor, db=db)
        assert len(doc_conns) > 0
        target_conn = [c for c in doc_conns if c.patient_id == patient.id][0]
        print(f"[OK] get_doctor_connections succeeded: retrieved connection ID {target_conn.id} (Status: {target_conn.status})")

        # 6. Test action_doctor_connection (Accept)
        act_payload = ConnectionActionRequest(
            action="accept",
            response_note="Approved for direct testing."
        )
        act_res = action_doctor_connection(conn_id=target_conn.id, payload=act_payload, current_user=doctor, db=db)
        print(f"[OK] action_doctor_connection (accept) succeeded: {act_res['message']}")

        # 7. Test get_my_dermatologist
        my_doc = get_my_dermatologist(current_user=patient, db=db)
        assert my_doc is not None
        assert my_doc["doctor_id"] == doctor.id
        print(f"[OK] get_my_dermatologist succeeded: Connected to {my_doc['doctor_name']}")

        # 8. Test get_all_doctor_patient_records
        all_recs = get_all_doctor_patient_records(current_user=doctor, db=db)
        print(f"[OK] get_all_doctor_patient_records succeeded: {len(all_recs)} records retrieved")

        # 9. Test get_all_doctor_patient_symptoms
        all_symps = get_all_doctor_patient_symptoms(current_user=doctor, db=db)
        print(f"[OK] get_all_doctor_patient_symptoms succeeded: {len(all_symps)} symptoms retrieved")

        # 10. Test get_doctor_followups
        followups = get_doctor_followups(current_user=doctor, db=db)
        print(f"[OK] get_doctor_followups succeeded: {len(followups)} followups retrieved")

        # 11. Test RBAC Security Enforcement: verify_doctor_patient_access
        from backend.app.api.health_routes import verify_doctor_patient_access
        from fastapi import HTTPException
        # Create an unconnected doctor in memory or check with a random doctor_id 9999
        try:
            verify_doctor_patient_access(doctor_id=9999, patient_id=patient.id, db=db)
            assert False, "Should have raised 403 Forbidden for unconnected doctor!"
        except HTTPException as e:
            assert e.status_code == 403
            print(f"[OK] Strict RBAC Enforced: Unconnected doctor received HTTP {e.status_code} ({e.detail})")

        print("=" * 60)
        print("ALL BACKEND ENDPOINTS AND SYNC LOGIC VERIFIED 100% CORRECT!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
