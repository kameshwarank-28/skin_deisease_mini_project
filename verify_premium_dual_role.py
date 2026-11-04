import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def api_call(path, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{path}"
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    if encoded_data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"detail": err_body}
        return e.code, parsed

def run_tests():
    print("=" * 60)
    print("STARTING E2E VERIFICATION: PREMIUM DUAL-ROLE HEALTHCARE SYSTEM")
    print("=" * 60)

    # 1. Login Patient (Alan)
    status, patient_login = api_call("/api/auth/login", method="POST", data={
        "username": "alan_walker",
        "password": "Password123!"
    })
    if status != 200:
        status, patient_login = api_call("/api/auth/login", method="POST", data={
            "username": "john_doe",
            "password": "Password123!"
        })
    assert status == 200, f"Patient login failed: {patient_login}"
    patient_token = patient_login["access_token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    patient_user = patient_login["user"]
    print(f"[OK] Patient Logged In: {patient_user['username']} (ID: {patient_user['id']})")

    # 2. Login Doctor (Dr. Jennifer Adams)
    status, doctor_login = api_call("/api/auth/login", method="POST", data={
        "username": "dr_adams",
        "password": "Password123!"
    })
    if status != 200:
        status, doctor_login = api_call("/api/auth/login", method="POST", data={
            "username": "dr_smith",
            "password": "Password123!"
        })
    assert status == 200, f"Doctor login failed: {doctor_login}"
    doctor_token = doctor_login["access_token"]
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}
    doctor_user = doctor_login["user"]
    print(f"[OK] Doctor Logged In: {doctor_user['username']} (ID: {doctor_user['id']})")

    # 3. Patient Overview Stats (Part 2 - Patient Dashboard Reference 1)
    status, p_data = api_call("/api/patients/overview-stats", headers=patient_headers)
    assert status == 200, f"Patient overview stats failed: {p_data}"
    assert "stats" in p_data, "Missing stats in patient overview"
    assert "records_count" in p_data["stats"], "Missing records_count"
    assert "active_treatments_count" in p_data["stats"], "Missing active_treatments_count"
    assert "upcoming_appointments_count" in p_data["stats"], "Missing upcoming_appointments_count"
    print(f"[OK] Patient Overview Stats Verified: {p_data['stats']}")

    # 4. Doctor Overview Stats (Part 3 - Doctor Dashboard Reference 2)
    status, d_data = api_call("/api/doctors/overview-stats", headers=doctor_headers)
    assert status == 200, f"Doctor overview stats failed: {d_data}"
    assert "stats" in d_data, "Missing stats in doctor overview"
    assert "total_connected_patients" in d_data["stats"], "Missing total_connected_patients"
    assert "pending_patient_requests" in d_data["stats"], "Missing pending_patient_requests"
    assert "pending_appointments" in d_data["stats"], "Missing pending_appointments"
    assert "calendar_events" in d_data, "Missing calendar_events"
    print(f"[OK] Doctor Overview Stats Verified: {d_data['stats']}")

    # 5. Doctor Directory & Connection Workflow
    status, doctors = api_call("/api/doctors/directory", headers=patient_headers)
    assert status == 200, f"Doctor directory failed: {doctors}"
    assert len(doctors) > 0, "No doctors in directory"
    print(f"[OK] Doctor Directory Verified: {len(doctors)} doctors available")

    # Connect Patient with Doctor
    status, conn_req = api_call("/api/patients/connection-requests", method="POST", headers=patient_headers, data={
        "doctor_id": doctor_user["id"],
        "request_note": "Requesting consultation for persistent skin lesion."
    })
    assert status == 200, f"Connection request failed: {conn_req}"
    print(f"[OK] Patient requested connection with Doctor {doctor_user['id']}: {conn_req}")

    # Doctor views connections
    status, conns = api_call("/api/doctors/connections", headers=doctor_headers)
    assert status == 200, f"Doctor connections failed: {conns}"
    matching = [c for c in conns if c["patient_id"] == patient_user["id"]]
    assert len(matching) > 0, "Patient connection not found in doctor's incoming requests"
    conn_id = matching[0]["id"]
    print(f"[OK] Doctor retrieved connection ID {conn_id} (Status: {matching[0]['status']})")

    # Doctor accepts connection if not already accepted
    if matching[0]["status"] != "Accepted":
        status, action_res = api_call(f"/api/doctors/connections/{conn_id}/action", method="POST", headers=doctor_headers, data={
            "action": "accept",
            "response_note": "Welcome! Connection accepted."
        })
        assert status == 200, f"Accept connection failed: {action_res}"
        print(f"[OK] Doctor Accepted Connection ID {conn_id}")

    # Patient verifies My Dermatologist
    status, my_doc = api_call("/api/patients/my-dermatologist", headers=patient_headers)
    assert status == 200, f"My dermatologist failed: {my_doc}"
    assert my_doc is not None, "Connected doctor should not be None after acceptance"
    print(f"[OK] Patient My Dermatologist Verified: {my_doc.get('doctor_name')}")

    # 6. Doctor Browses All Authorized Patient Records & Symptoms
    status, recs = api_call("/api/doctors/all-patient-records", headers=doctor_headers)
    assert status == 200, f"Doctor records browse failed: {recs}"
    print(f"[OK] Doctor All Patient Records: {len(recs)} records retrieved")

    status, symps = api_call("/api/doctors/all-patient-symptoms", headers=doctor_headers)
    assert status == 200, f"Doctor symptoms browse failed: {symps}"
    print(f"[OK] Doctor All Patient Symptoms: {len(symps)} symptoms retrieved")

    status, followups = api_call("/api/doctors/followups", headers=doctor_headers)
    assert status == 200, f"Doctor follow-ups browse failed: {followups}"
    print(f"[OK] Doctor Follow-ups: {len(followups)} items retrieved")

    # 7. Appointment Booking & Doctor Accept Workflow
    status, new_appt = api_call("/api/appointments", method="POST", headers=patient_headers, data={
        "doctor_or_clinic": doctor_user.get("full_name", "Dr. Jennifer Adams"),
        "doctor_id": doctor_user["id"],
        "appointment_date": "2026-11-20T10:00:00",
        "appointment_time": "10:00 AM",
        "purpose_or_notes": "Clinical Lesion Evaluation and Treatment Review",
        "reminder_days_before": 1
    })
    assert status == 200, f"Book appointment failed: {new_appt}"
    appt_id = new_appt["id"]
    print(f"[OK] Appointment booked with ID {appt_id} (Status: {new_appt['status']})")

    # Doctor accepts the appointment
    status, accept_res = api_call(f"/api/doctors/appointments/{appt_id}/action", method="POST", headers=doctor_headers, data={
        "action": "accept",
        "doctor_notes": "Appointment accepted and confirmed. Please bring previous records."
    })
    assert status == 200, f"Doctor accept appointment failed: {accept_res}"
    print(f"[OK] Doctor Accepted Appointment ID {appt_id}")

    # Patient verifies updated appointment
    status, p_appt_check = api_call("/api/patients/overview-stats", headers=patient_headers)
    next_appt = p_appt_check.get("next_appointment")
    assert next_appt is not None, "Next appointment should be present"
    assert next_appt["status"].upper() in ["CONFIRMED", "ACCEPTED"], f"Unexpected status: {next_appt['status']}"
    print(f"[OK] Patient Next Appointment Confirmed: {next_appt['doctor_name']} @ {next_appt['appointment_date']} (Status: {next_appt['status']})")

    # 8. RBAC Security Check: Unconnected Doctor cannot access patient records
    # Register/Login an unconnected doctor
    api_call("/api/auth/register", method="POST", data={
        "username": "dr_unconnected_test",
        "email": "unconnected@test.com",
        "password": "Password123!",
        "full_name": "Dr. Unconnected",
        "role": "doctor",
        "medical_reg_no": "REG-99999",
        "qualification": "MBBS",
        "specialization": "General Medicine",
        "hospital_name": "Test Hospital"
    })
    # Login as this unconnected doctor
    status, unauth_login = api_call("/api/auth/login", method="POST", data={
        "username": "dr_unconnected_test",
        "password": "Password123!"
    })
    assert status == 200, f"Unconnected doctor login failed: {unauth_login}"
    unauth_token = unauth_login["access_token"]
    unauth_headers = {"Authorization": f"Bearer {unauth_token}"}

    # Try accessing patient's private records without connection approval
    status, forbidden_res = api_call(f"/api/doctors/patients/{patient_user['id']}/records", headers=unauth_headers)
    assert status == 403, f"Expected 403 Forbidden for unauthorized doctor, got {status}"
    print(f"[OK] Strict RBAC Enforced: Unauthorized Doctor received HTTP 403 Forbidden accessing patient {patient_user['id']}")

    print("=" * 60)
    print("ALL E2E DUAL-ROLE & SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
