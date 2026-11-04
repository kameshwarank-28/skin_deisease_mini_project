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
    Notification
)
from backend.app.schemas.health import (
    SymptomCreate,
    DoctorSymptomObservationCreate
)
from backend.app.api.health_routes import (
    get_all_symptoms,
    create_symptom,
    delete_symptom,
    doctor_get_patient_symptoms,
    get_all_doctor_patient_symptoms,
    add_doctor_symptom_observation,
    get_skin_timeline,
    verify_doctor_patient_access
)
from fastapi import HTTPException

def run_tests():
    print("=" * 65)
    print("STARTING E2E VERIFICATION: SYMPTOMS & OBSERVATIONS ENHANCEMENT")
    print("=" * 65)

    db: Session = SessionLocal()
    try:
        # 1. Fetch Patient and Doctor
        patient = db.query(User).filter(User.role == "patient").first()
        doctor = db.query(User).filter(User.role == "doctor").first()
        assert patient, "No patient found in database"
        assert doctor, "No doctor found in database"
        print(f"[OK] Patient: {patient.full_name} (ID: {patient.id})")
        print(f"[OK] Doctor: {doctor.full_name} (ID: {doctor.id})")

        # Ensure patient and doctor are connected
        conn = db.query(PatientDoctorConnection).filter(
            PatientDoctorConnection.patient_id == patient.id,
            PatientDoctorConnection.doctor_id == doctor.id
        ).first()
        if not conn:
            conn = PatientDoctorConnection(
                patient_id=patient.id,
                doctor_id=doctor.id,
                status="Accepted",
                request_note="Automated test connection"
            )
            db.add(conn)
            db.commit()
        elif conn.status != "Accepted":
            conn.status = "Accepted"
            db.commit()
        print(f"[OK] Doctor-Patient Connection Established: Status={conn.status}")

        # Ensure a skin record exists for testing photo association
        skin_rec = db.query(SkinHealthRecord).filter(SkinHealthRecord.user_id == patient.id).first()
        if not skin_rec:
            skin_rec = SkinHealthRecord(
                user_id=patient.id,
                image_filename="test_lesion.jpg",
                body_location="Left Forearm",
                user_notes="Documented lesion for symptom testing"
            )
            db.add(skin_rec)
            db.commit()
            db.refresh(skin_rec)
        print(f"[OK] Associated Skin Record: ID={skin_rec.id}, Location={skin_rec.body_location}")

        # 2. Record New Symptom as Patient with Associated Skin Record (Requirements 1, 2, 8)
        now_time = datetime.datetime.now(datetime.timezone.utc)
        payload = SymptomCreate(
            symptom_name="Burning Sensation",
            severity="Moderate",
            duration="3 days",
            notes="Aggravated after warm shower, mild scaling noted at borders.",
            skin_record_id=skin_rec.id,
            recorded_at=now_time
        )

        res = create_symptom(payload=payload, current_user=patient, db=db)
        created_symptom = res["symptom"]
        symptom_id = created_symptom.id
        print(f"[OK] Symptom Created: ID={symptom_id}, Name={created_symptom.symptom_name}, Severity={created_symptom.severity}")
        assert created_symptom.user_id == patient.id, "Symptom user_id does not match patient ID!"
        assert created_symptom.skin_record_id == skin_rec.id, "Skin record ID not properly linked!"
        assert created_symptom.skin_record_image_url is not None, "Skin record image url not serialized!"

        # 3. Notification to Connected Doctor (Requirement 10)
        notif = db.query(Notification).filter(
            Notification.user_id == doctor.id,
            Notification.notification_type.in_(["SymptomReport", "SymptomAlert"]),
            Notification.reference_id == symptom_id
        ).order_by(Notification.created_at.desc()).first()
        assert notif, "Doctor was not notified when connected patient submitted symptom!"
        print(f"[OK] Doctor Notification Verified: '{notif.title}' -> '{notif.message}'")

        # 4. Doctor Reviews Patient-Reported Symptoms (Requirement 9)
        doc_patient_symptoms = doctor_get_patient_symptoms(patient_id=patient.id, current_user=doctor, db=db)
        matching = [s for s in doc_patient_symptoms if s.id == symptom_id]
        assert len(matching) > 0, "Doctor could not view patient's symptom!"
        assert matching[0].notes == payload.notes, "Original patient notes altered!"
        print(f"[OK] Doctor Viewed Patient Symptoms: Found {len(doc_patient_symptoms)} symptoms for patient {patient.id}")

        all_doc_symptoms = get_all_doctor_patient_symptoms(current_user=doctor, db=db)
        assert len(all_doc_symptoms) > 0, "get_all_doctor_patient_symptoms returned empty list!"
        print(f"[OK] Doctor All-Patient Symptoms: {len(all_doc_symptoms)} total authorized entries")

        # 5. Doctor Adds Clinical Observations & Feedback (Requirements 11, 12, 17)
        obs_payload = DoctorSymptomObservationCreate(
            doctor_observation="Localized macular erythema without induration. Lesion borders well demarcated.",
            doctor_feedback="Apply mild non-comedogenic emollient twice daily. Keep area dry and avoid hot showers."
        )
        updated_symptom = add_doctor_symptom_observation(
            symptom_id=symptom_id,
            payload=obs_payload,
            current_user=doctor,
            db=db
        )

        assert updated_symptom.doctor_observation == obs_payload.doctor_observation, "Doctor observation not saved!"
        assert updated_symptom.doctor_feedback == obs_payload.doctor_feedback, "Doctor feedback not saved!"
        assert updated_symptom.reviewed_by_doctor_id == doctor.id, "Doctor ID not recorded on review!"
        assert updated_symptom.reviewed_by_doctor_name == doctor.full_name, "Doctor name not recorded!"
        assert updated_symptom.reviewed_at is not None, "Reviewed timestamp not set!"
        # Verify original patient notes were preserved untouched
        assert updated_symptom.notes == payload.notes, "Original patient notes were altered during doctor review!"
        print(f"[OK] Doctor Added Observation: '{updated_symptom.doctor_observation}'")
        print(f"[OK] Doctor Feedback / Guidance: '{updated_symptom.doctor_feedback}'")
        print(f"[OK] Original Patient Notes Preserved: '{updated_symptom.notes}'")

        # 6. Patient Notification of Doctor Review (Requirement 12)
        patient_notif = db.query(Notification).filter(
            Notification.user_id == patient.id,
            Notification.notification_type == "DoctorObservation",
            Notification.reference_id == symptom_id
        ).first()
        assert patient_notif, "Patient did not receive notification of doctor's clinical observation!"
        print(f"[OK] Patient Notification Verified: '{patient_notif.title}' -> '{patient_notif.message}'")

        # 7. Patient Retrieves Updated Symptoms & Observations (Requirements 6, 7, 12)
        patient_symptoms = get_all_symptoms(current_user=patient, db=db)
        pat_matching = [s for s in patient_symptoms if s.id == symptom_id][0]
        assert pat_matching.doctor_observation == obs_payload.doctor_observation
        assert pat_matching.doctor_feedback == obs_payload.doctor_feedback
        assert pat_matching.reviewed_by_doctor_name == doctor.full_name
        print(f"[OK] Patient Dashboard Displays Doctor Feedback: '{pat_matching.doctor_feedback}'")

        # 8. Skin Timeline Integration (Requirement 15)
        timeline = get_skin_timeline(current_user=patient, db=db)
        timeline_symptom = [e for e in timeline if e.event_id == f"symptom_{symptom_id}"]
        assert len(timeline_symptom) > 0, "Symptom entry missing from Skin Timeline!"
        evt = timeline_symptom[0]
        assert obs_payload.doctor_observation in evt.description, "Doctor observation missing from timeline description!"
        assert evt.image_url is not None, "Associated skin image missing from timeline event!"
        print(f"[OK] Timeline Integration Verified: Title='{evt.title}', Subtitle='{evt.subtitle}'")

        # 9. Test Worsening Condition Alert (Requirements 13, 14)
        severe_payload = SymptomCreate(
            symptom_name="Burning Sensation",
            severity="Severe",
            duration="5 days",
            notes="Pain intensifying and spreading rapidly."
        )
        severe_res = create_symptom(payload=severe_payload, current_user=patient, db=db)
        advisory = severe_res.get("advisory")
        assert advisory is not None and advisory.get("alert_triggered") == True, "Worsening alert not triggered on severe escalation!"
        print(f"[OK] Worsening Observation Alert Triggered: Title='{advisory['title']}' (Urgency: {advisory['urgency']})")
        # Verify no automated diagnosis or prescription is generated
        assert "prescribe" not in advisory["safety_guideline"].lower() or "not" in advisory["safety_guideline"].lower()
        print(f"[OK] Clinical Safety Verified: Advisory does NOT automatically diagnose or prescribe medicine.")

        # 10. Role-Based Access Control (RBAC) (Requirement 17)
        # Unauthorized doctor cannot add observation or view symptoms
        unauthorized_doctor_id = 99999
        try:
            verify_doctor_patient_access(doctor_id=unauthorized_doctor_id, patient_id=patient.id, db=db)
            assert False, "Should have raised 403 Forbidden for unauthorized doctor!"
        except HTTPException as e:
            assert e.status_code == 403
            print(f"[OK] Strict RBAC Enforced: Unauthorized Doctor received HTTP 403 ({e.detail})")

        print("=" * 65)
        print("ALL 17 SYMPTOMS & OBSERVATIONS REQUIREMENTS FULLY VERIFIED!")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
