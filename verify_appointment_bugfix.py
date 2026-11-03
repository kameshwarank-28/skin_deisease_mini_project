import urllib.request
import urllib.parse
import json
import datetime
import sys

BASE_URL = "http://127.0.0.1:8000"

class ApiClient:
    def __init__(self):
        self.token = None

    def request(self, method, endpoint, data=None):
        url = f"{BASE_URL}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                status_code = resp.getcode()
                resp_text = resp.read().decode("utf-8")
                try:
                    return status_code, json.loads(resp_text)
                except Exception:
                    return status_code, resp_text
        except urllib.error.HTTPError as e:
            err_text = e.read().decode("utf-8")
            try:
                return e.code, json.loads(err_text)
            except Exception:
                return e.code, err_text

def log(msg, success=True):
    icon = "[OK]" if success else "[FAIL]"
    print(f"{icon} {msg}")

def main():
    print("\n=======================================================")
    print("DERMAI HEALTH MONITOR - APPOINTMENT BUG FIX VERIFICATION")
    print("=======================================================\n")

    client_alan = ApiClient()
    client_doc = ApiClient()

    # 1. Login Alan (Patient)
    code, res = client_alan.request("POST", "/api/auth/login", {
        "username": "alan",
        "password": "alan10",
        "role": "patient"
    })
    if code != 200:
        log(f"Alan login failed: {code} - {res}", False)
        sys.exit(1)
    client_alan.token = res["access_token"]
    alan_user_id = res["user"]["id"]
    log(f"Alan logged in as Patient (user_id: {alan_user_id})")

    # 2. Login Dr. Smith (Doctor)
    code, res = client_doc.request("POST", "/api/auth/login", {
        "username": "dr_smith",
        "password": "doctor10",
        "role": "doctor"
    })
    if code != 200:
        log(f"Dr. Smith login failed: {code} - {res}", False)
        sys.exit(1)
    client_doc.token = res["access_token"]
    doc_id = res["user"]["id"]
    doc_name = res["user"]["full_name"]
    log(f"Dr. Smith logged in as Doctor (doctor_id: {doc_id}, name: {doc_name})")

    # 3. Check existing doctor appointments
    code, doc_appts = client_doc.request("GET", "/api/doctors/appointments")
    assert code == 200, f"Doctor appointments fetch failed: {code}"
    log(f"Dr. Smith currently has {len(doc_appts)} appointments in schedule inbox.")

    # ----------------------------------------------------
    # TEST CASE 1: Book Appointment & Doctor Accepts
    # ----------------------------------------------------
    print("\n--- TEST CASE 1: Book Appointment & Doctor Accepts ---")
    appt_date = (datetime.datetime.now() + datetime.timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0)
    create_payload = {
        "doctor_id": doc_id,
        "doctor_or_clinic": doc_name,
        "appointment_date": appt_date.isoformat(),
        "appointment_time": "09:00 AM",
        "purpose_or_notes": "Lesion spot follow-up check",
        "reminder_advance_hours": 24
    }
    code, appt1 = client_alan.request("POST", "/api/appointments", create_payload)
    assert code == 200, f"Appointment booking failed: {appt1}"
    appt1_id = appt1["id"]
    log(f"Alan booked appointment #{appt1_id}. Initial status: '{appt1['status']}'")
    assert appt1["status"].upper() == "PENDING", f"Expected PENDING, got {appt1['status']}"

    # Doctor views appointment in inbox
    code, doc_inbox = client_doc.request("GET", "/api/doctors/appointments")
    found_appt1 = next((a for a in doc_inbox if a["id"] == appt1_id), None)
    assert found_appt1 is not None, "Doctor inbox did not contain newly created appointment!"
    log(f"Doctor inbox contains appointment #{appt1_id} with patient name '{found_appt1['patient_name']}' and status '{found_appt1['status']}'")

    # Doctor accepts appointment
    accept_payload = {
        "doctor_notes": "Confirmed. Please bring lesion photos from last week."
    }
    code, accepted_appt = client_doc.request("POST", f"/api/appointments/{appt1_id}/accept", accept_payload)
    assert code == 200, f"Doctor accept failed: {accepted_appt}"
    log(f"Doctor accepted appointment #{appt1_id}. Updated status: '{accepted_appt['status']}'")
    assert accepted_appt["status"] == "CONFIRMED", f"Expected CONFIRMED, got {accepted_appt['status']}"
    assert accepted_appt["doctor_response_at"] is not None, "doctor_response_at timestamp missing"

    # Verify Alan sees Confirmed status
    code, alan_appts = client_alan.request("GET", "/api/appointments")
    alan_appt1 = next((a for a in alan_appts if a["id"] == appt1_id), None)
    assert alan_appt1["status"] == "CONFIRMED", f"Alan views status as {alan_appt1['status']}"
    log(f"Patient Alan dashboard confirms appointment #{appt1_id} status is 'CONFIRMED'")

    # Verify Patient notification received
    code, notifs = client_alan.request("GET", "/api/notifications")
    conf_notif = next((n for n in notifs if n.get("reference_id") == appt1_id and "confirmed" in n["message"].lower()), None)
    assert conf_notif is not None, "Patient did not receive confirmation notification!"
    log(f"Patient notification verified: \"{conf_notif['message']}\"")

    # ----------------------------------------------------
    # TEST CASE 2: Book Appointment & Doctor Rejects
    # ----------------------------------------------------
    print("\n--- TEST CASE 2: Book Appointment & Doctor Rejects (Mandatory Reason) ---")
    appt2_date = (datetime.datetime.now() + datetime.timedelta(days=10)).replace(hour=14, minute=30, second=0, microsecond=0)
    create_payload2 = {
        "doctor_id": doc_id,
        "doctor_or_clinic": doc_name,
        "appointment_date": appt2_date.isoformat(),
        "appointment_time": "02:30 PM",
        "purpose_or_notes": "Eczema consultation",
        "reminder_advance_hours": 24
    }
    code, appt2 = client_alan.request("POST", "/api/appointments", create_payload2)
    assert code == 200
    appt2_id = appt2["id"]
    log(f"Alan booked appointment #{appt2_id} for {appt2_date.date()}")

    # Try rejecting without reason -> must fail with 422 or 400
    code, err_resp = client_doc.request("POST", f"/api/appointments/{appt2_id}/reject", {"rejection_reason": ""})
    assert code in (400, 422), f"Expected validation failure for empty rejection reason, got: {code}"
    log(f"Validation confirmed: Empty rejection reason blocked (HTTP {code}).")

    # Reject with mandatory reason
    rejection_msg = "Doctor will be in surgical theater during requested afternoon slot."
    code, rejected_appt = client_doc.request("POST", f"/api/appointments/{appt2_id}/reject", {"rejection_reason": rejection_msg})
    assert code == 200, f"Doctor reject failed: {rejected_appt}"
    assert rejected_appt["status"] == "REJECTED", f"Expected REJECTED, got {rejected_appt['status']}"
    assert rejected_appt["rejection_reason"] == rejection_msg
    log(f"Doctor rejected appointment #{appt2_id}. Status: '{rejected_appt['status']}', Reason: '{rejected_appt['rejection_reason']}'")

    # Verify record is NOT deleted and kept in history
    code, doc_inbox_after_rej = client_doc.request("GET", "/api/doctors/appointments")
    found_rej = next((a for a in doc_inbox_after_rej if a["id"] == appt2_id), None)
    assert found_rej is not None, "Rejected appointment was deleted from history!"
    log(f"Audit Trail confirmed: Appointment #{appt2_id} remains in history with REJECTED status.")

    # Verify patient notification with reason
    code, notifs_after_rej = client_alan.request("GET", "/api/notifications")
    rej_notif = next((n for n in notifs_after_rej if n.get("reference_id") == appt2_id and "declined" in n["message"].lower()), None)
    assert rej_notif is not None, "Patient did not receive rejection notification!"
    assert rejection_msg in rej_notif["message"], "Rejection reason missing from notification message!"
    log(f"Patient rejection notification verified: \"{rej_notif['message']}\"")

    # ----------------------------------------------------
    # TEST CASE 3: Doctor Suggests New Time & Patient Accepts
    # ----------------------------------------------------
    print("\n--- TEST CASE 3: Doctor Suggests New Time & Patient Accepts ---")
    appt3_date = (datetime.datetime.now() + datetime.timedelta(days=14)).replace(hour=11, minute=0, second=0, microsecond=0)
    code, appt3 = client_alan.request("POST", "/api/appointments", {
        "doctor_id": doc_id,
        "doctor_or_clinic": doc_name,
        "appointment_date": appt3_date.isoformat(),
        "appointment_time": "11:00 AM",
        "purpose_or_notes": "Mole screening examination"
    })
    assert code == 200
    appt3_id = appt3["id"]
    log(f"Alan booked appointment #{appt3_id} for {appt3_date.date()} at 11:00 AM")

    # Doctor proposes new time
    s_date = (datetime.datetime.now() + datetime.timedelta(days=16)).strftime("%Y-%m-%d")
    s_time = "03:30 PM"
    code, resched_appt = client_doc.request("POST", f"/api/appointments/{appt3_id}/reschedule", {
        "suggested_date": s_date,
        "suggested_time": s_time,
        "message": "Afternoon dermoscopy clinic is recommended for complete mole evaluation."
    })
    assert code == 200, f"Reschedule proposal failed: {resched_appt}"
    assert resched_appt["status"] == "AWAITING_PATIENT_CONFIRMATION"
    assert resched_appt["suggested_date"] == s_date
    assert resched_appt["suggested_time"] == s_time
    log(f"Doctor proposed alternative slot: {s_date} @ {s_time}. Status: '{resched_appt['status']}'")

    # Patient accepts proposed time
    code, confirmed_proposal = client_alan.request("POST", f"/api/appointments/{appt3_id}/patient-response", {
        "response": "accept"
    })
    assert code == 200, f"Patient response failed: {confirmed_proposal}"
    assert confirmed_proposal["status"] == "CONFIRMED"
    assert confirmed_proposal["appointment_time"] == s_time
    log(f"Patient Alan accepted proposed time. Status updated to 'CONFIRMED' with time '{confirmed_proposal['appointment_time']}'")

    # ----------------------------------------------------
    # TEST CASE 4: Doctor Suggests New Time & Patient Declines
    # ----------------------------------------------------
    print("\n--- TEST CASE 4: Doctor Suggests New Time & Patient Declines ---")
    appt4_date = (datetime.datetime.now() + datetime.timedelta(days=20)).replace(hour=10, minute=0, second=0, microsecond=0)
    code, appt4 = client_alan.request("POST", "/api/appointments", {
        "doctor_id": doc_id,
        "doctor_or_clinic": doc_name,
        "appointment_date": appt4_date.isoformat(),
        "appointment_time": "10:00 AM",
        "purpose_or_notes": "Allergy rash review"
    })
    assert code == 200
    appt4_id = appt4["id"]

    code, res = client_doc.request("POST", f"/api/appointments/{appt4_id}/reschedule", {
        "suggested_date": "2026-11-25",
        "suggested_time": "08:00 AM",
        "message": "Early morning slot available."
    })
    assert code == 200

    # Patient declines proposed slot
    code, declined_resp = client_alan.request("POST", f"/api/appointments/{appt4_id}/patient-response", {
        "response": "decline",
        "patient_notes": "Unable to travel that early."
    })
    assert code == 200
    assert declined_resp["status"] == "PENDING"
    log(f"Patient Alan declined proposed time. Appointment returned to '{declined_resp['status']}' status for re-evaluation.")

    # ----------------------------------------------------
    # TEST CASE 5: Security & Role Authorization
    # ----------------------------------------------------
    print("\n--- TEST CASE 5: Security & Role Authorization ---")
    # Patient tries to call doctor accept endpoint -> must be 403
    code, err_resp = client_alan.request("POST", f"/api/appointments/{appt4_id}/accept", {"doctor_notes": "Hacked"})
    assert code == 403, f"Expected 403 Forbidden for patient accessing doctor endpoint, got {code}"
    log("Security check passed: Patient cannot accept appointments (HTTP 403).")

    # Patient tries to call doctor reject endpoint -> must be 403
    code, err_resp = client_alan.request("POST", f"/api/appointments/{appt4_id}/reject", {"rejection_reason": "Hacked"})
    assert code == 403, f"Expected 403 Forbidden for patient accessing doctor reject, got {code}"
    log("Security check passed: Patient cannot reject appointments (HTTP 403).")

    print("\n=======================================================")
    print("ALL APPOINTMENT ACCEPT / REJECT / RESCHEDULE TESTS PASSED!")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
