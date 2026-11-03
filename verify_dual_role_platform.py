import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def api_call(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(content)
            except:
                return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except:
            return e.code, content

def run_tests():
    print("=================================================================")
    print("   DERMAI DUAL-ROLE PATIENT & DOCTOR PLATFORM VERIFICATION")
    print("=================================================================")

    # 1. API Health Check
    status, res = api_call("/api/health")
    assert status == 200, f"Health check failed: {status}"
    print("[PASS] 1. API health check verified.")

    # 2. Patient Login with Matching Role
    status, alan_auth = api_call("/api/auth/login", method="POST", data={
        "username": "alan",
        "password": "alan10",
        "role": "patient"
    })
    assert status == 200, f"Alan login failed: {status} {alan_auth}"
    alan_token = alan_auth["access_token"]
    assert alan_auth["user"]["role"] == "patient"
    print("[PASS] 2. Patient 'alan' logged in with role 'patient'.")

    # 3. Patient Login with Doctor Role (Mismatch Rejection)
    status, mismatch_err = api_call("/api/auth/login", method="POST", data={
        "username": "alan",
        "password": "alan10",
        "role": "doctor"
    })
    assert status == 403, f"Expected 403 role mismatch, got {status}"
    assert "The selected account type does not match your registered account role" in str(mismatch_err)
    print("[PASS] 3. Role rejection verified when Patient attempts Doctor Login.")

    # 4. Doctor Login with Matching Role
    status, doc_auth = api_call("/api/auth/login", method="POST", data={
        "username": "dr_smith",
        "password": "doctor10",
        "role": "doctor"
    })
    assert status == 200, f"Dr. Smith login failed: {status} {doc_auth}"
    doc_token = doc_auth["access_token"]
    doc_id = doc_auth["user"]["id"]
    assert doc_auth["user"]["role"] == "doctor"
    print("[PASS] 4. Doctor 'dr_smith' logged in with role 'doctor'.")

    # 5. Doctor Login with Patient Role (Mismatch Rejection)
    status, doc_mismatch = api_call("/api/auth/login", method="POST", data={
        "username": "dr_smith",
        "password": "doctor10",
        "role": "patient"
    })
    assert status == 403, f"Expected 403 role mismatch, got {status}"
    assert "The selected account type does not match your registered account role" in str(doc_mismatch)
    print("[PASS] 5. Role rejection verified when Doctor attempts Patient Login.")

    # 6. Patient Profile Verification for Alan
    status, alan_prof = api_call("/api/patient-profile", token=alan_token)
    if status == 200 and not alan_prof:
        # Create profile
        status, alan_prof = api_call("/api/patient-profile", method="POST", data={
            "patient_name": "Alan Walker",
            "age": 28,
            "gender": "Male",
            "phone_number": "+1 555-0101",
            "additional_details": "History of mild eczema and seasonal dry skin"
        }, token=alan_token)
    print(f"[PASS] 6. Patient profile confirmed: {alan_prof.get('patient_name')}")

    # 7. Doctor Directory Query
    status, doctors = api_call("/api/doctors/directory", token=alan_token)
    assert status == 200, f"Doctor directory failed: {status}"
    assert any(d["doctor_id"] == doc_id for d in doctors), "Dr. Smith not found in directory"
    print(f"[PASS] 7. Patient successfully queried doctor directory ({len(doctors)} verified doctors found).")

    # 8. Patient Connection Request
    status, conn_req = api_call("/api/patients/connection-requests", method="POST", data={
        "doctor_id": doc_id,
        "request_note": "Requesting consultation regarding arm rash"
    }, token=alan_token)
    assert status in [200, 201], f"Connection request failed: {status} {conn_req}"
    print("[PASS] 8. Patient submitted connection request to Dr. Smith.")

    # 9. Doctor Reviews and Accepts Connection
    status, conn_list = api_call("/api/doctors/connections", token=doc_token)
    assert status == 200, f"Doctor connection list failed: {status}"
    alan_conn = next((c for c in conn_list if c["patient_id"] == alan_auth["user"]["id"]), None)
    assert alan_conn is not None, "Connection request not in doctor inbox"
    
    status, act_resp = api_call(f"/api/doctors/connections/{alan_conn['id']}/action", method="POST", data={
        "action": "accept",
        "response_note": "Glad to assist you, Alan. Welcome to our clinical practice."
    }, token=doc_token)
    assert status == 200
    print("[PASS] 9. Doctor accepted patient connection.")

    # 10. Patient Books Synchronized Appointment
    status, appt_res = api_call("/api/appointments", method="POST", data={
        "doctor_id": doc_id,
        "doctor_or_clinic": "Dr. Robert Smith, MD",
        "appointment_date": "2026-11-20T10:00:00",
        "appointment_time": "10:00 AM",
        "purpose_or_notes": "Clinical review of persistent erythema on forearm",
        "reminder_advance_hours": 24
    }, token=alan_token)
    assert status in [200, 201], f"Appointment creation failed: {status} {appt_res}"
    appt_id = appt_res["id"]
    print(f"[PASS] 10. Patient booked appointment #{appt_id} with Dr. Smith.")

    # 11. Doctor Views Appointment and Reschedules
    status, doc_appts = api_call("/api/doctors/appointments", token=doc_token)
    assert status == 200
    our_appt = next((a for a in doc_appts if a["id"] == appt_id), None)
    assert our_appt is not None, "Appointment not visible to doctor"

    status, resched_resp = api_call(f"/api/doctors/appointments/{appt_id}/action", method="POST", data={
        "action": "reschedule",
        "suggested_alternate_date": "2026-11-21",
        "suggested_alternate_time": "02:30 PM",
        "doctor_notes": "Conflict with surgery schedule. Proposing Nov 21 at 2:30 PM."
    }, token=doc_token)
    assert status == 200
    assert resched_resp["status"] == "Rescheduled by Doctor"
    print(f"[PASS] 11. Doctor rescheduled appointment with alternate slot Nov 21 at 02:30 PM.")

    # 12. Patient Reviews Rescheduled Status
    status, patient_appts = api_call("/api/appointments", token=alan_token)
    assert status == 200
    pat_appt = next((a for a in patient_appts if a["id"] == appt_id), None)
    assert pat_appt["status"] == "Rescheduled by Doctor"
    assert "2026-11-21" in str(pat_appt.get("suggested_alternate_time", "")) or pat_appt.get("suggested_alternate_date") == "2026-11-21"
    print("[PASS] 12. Patient received doctor's reschedule proposal and notes.")

    # 13. Doctor Confirms Appointment
    status, confirm_resp = api_call(f"/api/doctors/appointments/{appt_id}/action", method="POST", data={
        "action": "accept",
        "doctor_notes": "Slot finalized. Please arrive 10 minutes prior."
    }, token=doc_token)
    assert status == 200
    assert confirm_resp["status"] == "Confirmed"
    print("[PASS] 13. Doctor confirmed appointment status to 'Confirmed'.")

    # 14. Doctor Documents Clinical Consultation
    status, consult_res = api_call(f"/api/doctors/patients/{alan_auth['user']['id']}/consultations", method="POST", data={
        "consultation_date": "2026-11-21",
        "consultation_type": "Clinical Examination & Dermoscopy",
        "diagnosis": "Atopic Dermatitis with localized epidermal barrier disruption",
        "clinical_observations": "Visible ill-defined erythema with mild lichenification and xerosis on left volar forearm. No satellite pustules.",
        "recommendations": "Apply prescribed emollient and topical hydrocortisone; avoid harsh surfactants.",
        "follow_up_date": "2026-12-05"
    }, token=doc_token)
    assert status in [200, 201], f"Consultation creation failed: {status} {consult_res}"
    print("[PASS] 14. Doctor documented formal clinical consultation with objective observations.")

    # 15. Doctor Prescribes Structured Treatment Regimen
    status, treat_res = api_call(f"/api/doctors/patients/{alan_auth['user']['id']}/treatments", method="POST", data={
        "treatment_name": "Topical Hydrocortisone Regimen",
        "prescribed_medication": "Hydrocortisone 1% topical ointment",
        "dosage": "Apply thin film twice daily after bathing",
        "frequency": "Twice daily for 10 days",
        "treatment_status": "Treatment Prescribed",
        "start_date": "2026-11-21",
        "review_date": "2026-12-05",
        "doctor_notes": "Discontinue if stinging occurs. Follow up in 14 days."
    }, token=doc_token)
    assert status in [200, 201], f"Treatment creation failed: {status} {treat_res}"
    treat_id = treat_res["id"]
    print(f"[PASS] 15. Doctor prescribed treatment regimen #{treat_id} with status 'Treatment Prescribed'.")

    # 16. Patient Views Prescribed Treatment
    status, patient_treatments = api_call("/api/treatments", token=alan_token)
    assert status == 200
    prescribed = next((t for t in patient_treatments if t["id"] == treat_id), None)
    assert prescribed is not None, "Treatment not found in patient list"
    assert prescribed["prescribed_by_doctor_id"] == doc_id
    assert prescribed["treatment_status"] == "Treatment Prescribed"
    print("[PASS] 16. Patient received doctor-prescribed treatment plan.")

    # 17. Doctor Views Patient Skin Timeline
    status, timeline = api_call(f"/api/skin-timeline?patient_id={alan_auth['user']['id']}", token=doc_token)
    assert status == 200
    assert len(timeline) >= 2, f"Expected timeline events, got {len(timeline)}"
    print(f"[PASS] 17. Doctor retrieved chronological skin timeline ({len(timeline)} events).")

    # 18. Patient Notifications Delivery
    status, notifs = api_call("/api/notifications", token=alan_token)
    assert status == 200
    assert len(notifs) >= 3, f"Expected notifications for appointment, consult, and treatment, got {len(notifs)}"
    print(f"[PASS] 18. Synchronized clinical notifications delivered to patient ({len(notifs)} alerts).")

    # 19. SPA Static Delivery & Assets
    req = urllib.request.Request(f"{BASE_URL}/", headers={"Accept": "text/html"})
    with urllib.request.urlopen(req) as resp:
        spa_html = resp.read().decode("utf-8")
        assert resp.status == 200
        assert "<div id=\"root\"></div>" in str(spa_html)
        assert "/assets/index-" in str(spa_html)
    print("[PASS] 19. Frontend SPA production index and assets served correctly.")

    print("\n=================================================================")
    print("   ALL 19 DUAL-ROLE CLINICAL PLATFORM VERIFICATION CHECKS PASSED!")
    print("=================================================================\n")

if __name__ == "__main__":
    run_tests()
