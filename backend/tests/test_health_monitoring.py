import io
import datetime
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from backend.app.main import app

client = TestClient(app)

def create_synthetic_image_bytes(color=(180, 120, 100)):
    img = Image.new("RGB", (200, 200), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_auth_login_initial_account():
    # Login with initial account alan / alan10
    res = client.post("/api/auth/login", json={
        "username": "alan",
        "password": "alan10"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "alan"

def test_auth_login_invalid_credentials():
    # Attempt login with invalid password
    res = client.post("/api/auth/login", json={
        "username": "alan",
        "password": "wrong_password_999"
    })
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]

def test_registration_and_duplicate_prevention():
    # Attempt register user
    unique_user = f"user_{int(datetime.datetime.now().timestamp())}"
    res = client.post("/api/auth/register", json={
        "full_name": "Test Patient",
        "username": unique_user,
        "email": f"{unique_user}@test.local",
        "password": "SecretPassword123",
        "phone_number": "+123456789"
    })
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Duplicate username attempt
    res_dup = client.post("/api/auth/register", json={
        "full_name": "Test Patient 2",
        "username": unique_user,
        "email": f"other_{unique_user}@test.local",
        "password": "SecretPassword123"
    })
    assert res_dup.status_code == 400
    assert "Username is already taken" in res_dup.json()["detail"]

def test_patient_profile_lifecycle():
    # Login as alan
    login_res = client.post("/api/auth/login", json={
        "username": "alan",
        "password": "alan10"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch profile initially
    prof_res = client.get("/api/patient-profile", headers=headers)
    assert prof_res.status_code == 200
    # May be None initially if not yet created

    if prof_res.json() is None:
        # Create patient profile
        create_res = client.post("/api/patient-profile", headers=headers, json={
            "patient_name": "Alan Mathison",
            "age": 35,
            "gender": "Male",
            "phone_number": "+1 555-0101",
            "email_address": "alan@dermai.local",
            "additional_details": "No known allergies."
        })
        assert create_res.status_code == 200
        assert create_res.json()["patient_name"] == "Alan Mathison"

    # Update profile
    upd_res = client.put("/api/patient-profile", headers=headers, json={
        "patient_name": "Alan Turing",
        "age": 36
    })
    assert upd_res.status_code == 200
    assert upd_res.json()["patient_name"] == "Alan Turing"

def test_multi_user_data_isolation():
    # Create two distinct test users
    ts = int(datetime.datetime.now().timestamp())
    u1_name = f"patient_a_{ts}"
    u2_name = f"patient_b_{ts}"

    client.post("/api/auth/register", json={
        "full_name": "Patient Alpha",
        "username": u1_name,
        "email": f"{u1_name}@health.local",
        "password": "Password123!"
    })

    client.post("/api/auth/register", json={
        "full_name": "Patient Beta",
        "username": u2_name,
        "email": f"{u2_name}@health.local",
        "password": "Password123!"
    })

    # Login User A
    tok_a = client.post("/api/auth/login", json={"username": u1_name, "password": "Password123!"}).json()["access_token"]
    # Login User B
    tok_b = client.post("/api/auth/login", json={"username": u2_name, "password": "Password123!"}).json()["access_token"]

    hdr_a = {"Authorization": f"Bearer {tok_a}"}
    hdr_b = {"Authorization": f"Bearer {tok_b}"}

    # User B checks their records -> must be empty (0)
    res_b_empty = client.get("/api/skin-records", headers=hdr_b)
    assert res_b_empty.status_code == 200
    assert len(res_b_empty.json()) == 0

    # User A creates a skin record
    img_bytes = create_synthetic_image_bytes((150, 90, 80))
    rec_a_res = client.post(
        "/api/skin-records",
        headers=hdr_a,
        data={"body_location": "Left Shoulder", "user_notes": "Alpha confidential record"},
        files={"file": ("alpha_lesion.jpg", img_bytes, "image/jpeg")}
    )
    assert rec_a_res.status_code == 200
    rec_a_id = rec_a_res.json()["id"]
    rec_a_filename = rec_a_res.json()["image_filename"]

    # User B tries to access User A's record directly by ID -> MUST return 404 Not Found
    cross_access_res = client.get(f"/api/skin-records/{rec_a_id}", headers=hdr_b)
    assert cross_access_res.status_code == 404

    # User B tries to access User A's image -> MUST return 404/401/403
    cross_img_res = client.get(f"/api/images/{rec_a_filename}", headers=hdr_b)
    assert cross_img_res.status_code in [403, 404]

    # User A accesses their own image -> 200 OK
    own_img_res = client.get(f"/api/images/{rec_a_filename}", headers=hdr_a)
    assert own_img_res.status_code == 200

def test_symptom_tracking_and_alert():
    tok = client.post("/api/auth/login", json={"username": "alan", "password": "alan10"}).json()["access_token"]
    hdr = {"Authorization": f"Bearer {tok}"}

    # Post mild symptom
    s1 = client.post("/api/symptoms", headers=hdr, json={
        "symptom_name": "Itching",
        "severity": "Mild",
        "duration": "1 day",
        "notes": "Mild itch"
    })
    assert s1.status_code == 200

    # Post severe symptom triggering safety alert
    s2 = client.post("/api/symptoms", headers=hdr, json={
        "symptom_name": "Itching",
        "severity": "Severe",
        "duration": "2 days",
        "notes": "Intense itching"
    })
    assert s2.status_code == 200
    assert "advisory" in s2.json()

def test_image_comparison_between_two_records():
    tok = client.post("/api/auth/login", json={"username": "alan", "password": "alan10"}).json()["access_token"]
    hdr = {"Authorization": f"Bearer {tok}"}

    # Create baseline image
    r1 = client.post(
        "/api/skin-records",
        headers=hdr,
        data={"body_location": "Right Arm", "user_notes": "Baseline"},
        files={"file": ("base.jpg", create_synthetic_image_bytes((120, 80, 60)), "image/jpeg")}
    ).json()

    # Create follow-up image
    r2 = client.post(
        "/api/skin-records",
        headers=hdr,
        data={"body_location": "Right Arm", "user_notes": "Followup"},
        files={"file": ("follow.jpg", create_synthetic_image_bytes((180, 90, 70)), "image/jpeg")}
    ).json()

    comp_res = client.post("/api/skin-comparison", headers=hdr, json={
        "earlier_record_id": r1["id"],
        "later_record_id": r2["id"]
    })
    assert comp_res.status_code == 200
    data = comp_res.json()
    assert "similarity_score" in data
    assert "observed_changes" in data
    assert "disclaimer" in data
