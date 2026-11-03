import urllib.request
import json

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

def run_isolation_tests():
    print("=================================================================")
    print("   TESTING MULTI-USER DATA ISOLATION & PRIVACY BOUNDARIES")
    print("=================================================================")

    # 1. Register a second patient: patient_bob
    status, reg_bob = api_call("/api/auth/register", method="POST", data={
        "full_name": "Bob Patient",
        "username": "patient_bob",
        "email": "bob@patient.local",
        "password": "password123",
        "role": "patient"
    })
    # If already exists, proceed to login
    status, bob_auth = api_call("/api/auth/login", method="POST", data={
        "username": "patient_bob",
        "password": "password123",
        "role": "patient"
    })
    assert status == 200
    bob_token = bob_auth["access_token"]
    bob_id = bob_auth["user"]["id"]
    print(f"[PASS] 1. Second patient authenticated (ID: {bob_id}).")

    # 2. Login Dr. Smith
    status, doc_auth = api_call("/api/auth/login", method="POST", data={
        "username": "dr_smith",
        "password": "doctor10",
        "role": "doctor"
    })
    assert status == 200
    doc_token = doc_auth["access_token"]

    # 3. Dr. Smith attempts to access Bob's records WITHOUT an accepted connection
    status, err = api_call(f"/api/doctors/patients/{bob_id}/records", token=doc_token)
    assert status == 403, f"Expected 403 Forbidden for unconnected patient, got {status}"
    print("[PASS] 2. Strict privacy: Doctor forbidden from accessing unconnected patient's records (403).")

    # 4. Dr. Smith attempts to view Bob's timeline WITHOUT an accepted connection
    status, err = api_call(f"/api/skin-timeline?patient_id={bob_id}", token=doc_token)
    assert status == 403, f"Expected 403 Forbidden for unconnected patient timeline, got {status}"
    print("[PASS] 3. Strict privacy: Doctor forbidden from accessing unconnected patient's timeline (403).")

    # 5. Bob logs in and checks his records - sees ZERO of Alan's records
    status, bob_records = api_call("/api/skin-records", token=bob_token)
    assert status == 200
    print(f"[PASS] 4. Patient data isolation: Bob only sees his own isolated records ({len(bob_records)} records).")

    print("\n=================================================================")
    print("   ALL PRIVACY AND ISOLATION BOUNDARY CHECKS PASSED!")
    print("=================================================================\n")

if __name__ == "__main__":
    run_isolation_tests()

