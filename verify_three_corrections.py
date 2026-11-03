import urllib.request
import urllib.parse
import json
import datetime
import sys
import io
import base64

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

    def upload_file(self, path: str, filename: str, file_bytes: bytes, mime_type: str = "image/jpeg"):
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        body = bytearray()
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        req = urllib.request.Request(f"{BASE_URL}{path}", data=bytes(body), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
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
    print("DERMAI HEALTH MONITOR - THREE CORRECTIONS VERIFICATION")
    print("=======================================================\n")

    client_alan = ApiClient()
    client_doc = ApiClient()

    # 1. Login Alan (Patient)
    code, res = client_alan.request("POST", "/api/auth/login", {
        "username": "alan",
        "password": "alan10",
        "role": "patient"
    })
    assert code == 200, f"Alan login failed: {res}"
    client_alan.token = res["access_token"]
    alan_id = res["user"]["id"]
    log(f"Patient Alan authenticated (user_id: {alan_id})")

    # 2. Login Dr. Smith (Doctor)
    code, res = client_doc.request("POST", "/api/auth/login", {
        "username": "dr_smith",
        "password": "doctor10",
        "role": "doctor"
    })
    assert code == 200, f"Doctor login failed: {res}"
    client_doc.token = res["access_token"]
    doc_id = res["user"]["id"]
    doc_name = res["user"]["full_name"]
    log(f"Doctor Dr. Smith authenticated (doctor_id: {doc_id}, name: {doc_name})")

    # ----------------------------------------------------
    # ISSUE 1: Image Upload & Prediction Pipeline Test
    # ----------------------------------------------------
    print("\n--- ISSUE 1: AI Skin Disease Prediction Pipeline ---")
    # Generate a valid test JPEG image using PIL
    from PIL import Image
    test_img = Image.new("RGB", (100, 100), color=(180, 120, 100))
    img_buf = io.BytesIO()
    test_img.save(img_buf, format="JPEG")
    dummy_b64 = "data:image/jpeg;base64," + base64.b64encode(img_buf.getvalue()).decode("utf-8")
    
    code, pred_res = client_alan.request("POST", "/api/predict/camera", {"image_base64": dummy_b64})
    assert code == 200, f"AI prediction failed: {pred_res}"
    assert "prediction" in pred_res, "prediction field missing from AI response"
    log(f"AI Model prediction (camera/base64) successful: '{pred_res.get('prediction')}' (Confidence: {pred_res['confidence']})")

    # Test file upload multipart endpoint (/api/predict)
    code_upload, upload_res = client_alan.upload_file("/api/predict", "skin_sample.jpg", img_buf.getvalue(), "image/jpeg")
    assert code_upload == 200, f"Multipart file upload prediction failed: {upload_res}"
    assert "prediction" in upload_res, "prediction missing from multipart upload response"
    log(f"AI Model prediction (file upload) successful: '{upload_res.get('prediction')}' (Confidence: {upload_res['confidence']})")

    # ----------------------------------------------------
    # ISSUE 2: Skin Timeline in Patient Dashboard
    # ----------------------------------------------------
    print("\n--- ISSUE 2: Skin Timeline for Patient Dashboard ---")
    # Patient fetches timeline
    code, timeline_events = client_alan.request("GET", "/api/skin-timeline")
    assert code == 200, f"Patient timeline fetch failed: {code} - {timeline_events}"
    assert isinstance(timeline_events, list), "Timeline response should be a list"
    log(f"Patient Alan timeline fetched successfully: {len(timeline_events)} chronological events returned.")

    if len(timeline_events) > 0:
        evt0 = timeline_events[0]
        log(f"Latest timeline event: [{evt0['event_type']}] '{evt0['title']}' on {evt0['date']}")
        assert "event_id" in evt0 and "event_type" in evt0 and "date" in evt0, "Missing required event fields"

    # Alias /api/timeline
    code, timeline_alias = client_alan.request("GET", "/api/timeline")
    assert code == 200, "Alias /api/timeline failed"
    log("Alias /api/timeline endpoint verified.")

    # Doctor views patient timeline
    code, doc_view_tl = client_doc.request("GET", f"/api/skin-timeline?patient_id={alan_id}")
    assert code == 200, f"Doctor viewing patient timeline failed: {code}"
    log(f"Doctor access to authorized patient timeline verified ({len(doc_view_tl)} events).")

    # Doctor trying to view non-authorized patient timeline
    code, err_tl = client_doc.request("GET", "/api/skin-timeline?patient_id=999999")
    assert code in (403, 404), f"Expected 403/404 for unauthorized timeline, got {code}"
    log("Security verified: Doctor cannot access unauthorized patient timeline.")

    # ----------------------------------------------------
    # ISSUE 3: Read-Only Patient Treatment & Doctor Prescription
    # ----------------------------------------------------
    print("\n--- ISSUE 3: Read-Only Treatment Section & Doctor Prescription ---")
    # 1. Patient tries to prescribe treatment -> MUST FAIL with 403
    patient_attempt = {
        "treatment_name": "Patient Self-Prescription",
        "treatment_type": "Oral Medication",
        "dosage_or_instructions": "Take 5 pills daily",
        "start_date": datetime.datetime.now().isoformat()
    }
    code, res_tamper = client_alan.request("POST", "/api/treatments", patient_attempt)
    assert code == 403, f"Expected 403 Forbidden for patient creating treatment, got {code}"
    log("Security verified: Patient CANNOT create treatment plans (HTTP 403).")

    # 2. Doctor prescribes treatment for Alan
    start_dt = datetime.datetime.now().isoformat()
    review_dt = (datetime.datetime.now() + datetime.timedelta(days=30)).isoformat()
    doc_prescription = {
        "treatment_name": "Hydrocortisone 1% Topical Therapy",
        "prescribed_medication": "Hydrocortisone Cream 1%",
        "treatment_type": "Topical Cream",
        "dosage_or_instructions": "Apply thin layer to affected area twice daily for 14 days.",
        "treatment_status": "Treatment Prescribed",
        "start_date": start_dt,
        "review_date": review_dt,
        "is_active": True,
        "doctor_notes": "Cleanse area with mild soap before application. Monitor for redness or irritation."
    }
    code, created_treatment = client_doc.request("POST", f"/api/doctors/patients/{alan_id}/treatments", doc_prescription)
    assert code == 200, f"Doctor prescribing treatment failed: {created_treatment}"
    treatment_id = created_treatment["id"]
    log(f"Doctor prescribed treatment #{treatment_id}: '{created_treatment['treatment_name']}'")

    # 3. Verify Patient receives notification
    code, notifs = client_alan.request("GET", "/api/notifications")
    t_notif = next((n for n in notifs if "updated your treatment plan" in n["message"].lower() or "treatment" in n["message"].lower()), None)
    assert t_notif is not None, "Patient did not receive treatment notification!"
    log(f"Patient notification verified: \"{t_notif['message']}\"")

    # 4. Patient reads treatment in dashboard
    code, patient_treatments = client_alan.request("GET", "/api/treatments")
    assert code == 200, f"Patient treatments fetch failed: {code}"
    found_t = next((t for t in patient_treatments if t["id"] == treatment_id), None)
    assert found_t is not None, "Prescribed treatment not found in patient treatment list!"
    assert found_t["treatment_name"] == "Hydrocortisone 1% Topical Therapy"
    assert found_t["prescribing_doctor_name"] is not None
    log(f"Patient reads treatment #{treatment_id}: Status='{found_t['treatment_status']}', Doctor='{found_t['prescribing_doctor_name']}'")

    # 5. Patient tries to delete or edit doctor's treatment -> MUST FAIL with 403
    code, _ = client_alan.request("PUT", f"/api/treatments/{treatment_id}", {"treatment_name": "Altered"})
    assert code == 403, f"Expected 403 Forbidden for patient editing treatment, got {code}"
    log("Security verified: Patient CANNOT edit doctor's treatment plan (HTTP 403).")

    code, _ = client_alan.request("DELETE", f"/api/treatments/{treatment_id}")
    assert code == 403, f"Expected 403 Forbidden for patient deleting treatment, got {code}"
    log("Security verified: Patient CANNOT delete doctor's treatment record (HTTP 403).")

    # 6. Doctor updates treatment status to 'Treatment Ongoing'
    code, updated_t = client_doc.request("PUT", f"/api/doctors/treatments/{treatment_id}", {
        "treatment_status": "Treatment Ongoing",
        "doctor_notes": "Patient reports tolerance with minimal side effects. Continue regimen."
    })
    assert code == 200, f"Doctor updating treatment failed: {updated_t}"
    assert updated_t["treatment_status"] == "Treatment Ongoing"
    log(f"Doctor updated treatment status to '{updated_t['treatment_status']}'")

    # 7. Patient reads updated status
    code, patient_treatments_after = client_alan.request("GET", "/api/treatments")
    found_updated = next((t for t in patient_treatments_after if t["id"] == treatment_id), None)
    assert found_updated["treatment_status"] == "Treatment Ongoing"
    log("Patient dashboard reflects updated status 'Treatment Ongoing' in real time.")

    print("\n=======================================================")
    print("ALL THREE FUNCTIONAL CORRECTIONS VERIFIED SUCCESSFULLY!")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
