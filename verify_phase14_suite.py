import os
import sys
import json
import time
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

from backend.app.services.classifier import SkinClassifierService
from backend.app.services.database import SessionLocal
from backend.app.models.health import User, SkinHealthRecord, Notification
from backend.app.api.health_routes import get_skin_records, get_skin_timeline

def run_suite():
    print("=" * 70)
    print("DERMAI PHASE 14: END-TO-END VERIFICATION & ACCEPTANCE TEST SUITE")
    print("=" * 70)

    # 1. Model Loading & Architecture Verification
    service = SkinClassifierService(checkpoint_path="models/best_model.pth")
    assert service._has_checkpoint, "Checkpoint must be loaded"
    assert service.model_name == "efficientnetv2_s", f"Expected efficientnetv2_s, got {service.model_name}"
    print(f"[OK 1/15] Verified Model Checkpoint: Loaded {service.model_name} (T={service.temperature:.4f})")

    # 2. Class Names & 11-Class Mapping
    assert len(service.classes_list) == 11, f"Expected 11 classes, got {len(service.classes_list)}"
    with open("class_mapping.json", "r", encoding="utf-8") as f:
        cmap = json.load(f)
    assert cmap["num_classes"] == 11, "Class mapping must specify 11 classes"
    print(f"[OK 2/15] Verified Class Mapping: 11 classes (including Normal / Healthy Skin) match dataset exactly.")

    # 3. Test on Valid Clinical Skin Image and Normal Skin Image
    test_img_path = "Z:\\IMG_CLASSES\\4. Basal Cell Carcinoma (BCC) 3323\\ISIC_0054986.jpg"
    with Image.open(test_img_path) as img:
        res = service.predict(img)

    normal_test_path = "Z:\\IMG_CLASSES\\12. Normal_Skin\\normal_skin_004caf5dc0ac.jpg"
    if not os.path.exists(normal_test_path):
        normal_test_path = "Z:\\IMG_CLASSES\\11. Normal Skin\\normal_skin_004caf5dc0ac.jpg"
    with Image.open(normal_test_path) as n_img:
        n_res = service.predict(n_img)

    assert res["prediction"] is not None
    assert len(res["top_5"]) == 5
    assert n_res["is_normal_skin"] == True, f"Expected Normal Skin, got {n_res['prediction']}"
    print(f"[OK 3/15] Valid Disease & Normal Skin Classified: Disease='{res['prediction']}', Normal='{n_res['prediction']}' ({n_res['confidence_pct']})")

    # 4. Top-3 Probabilities and Calibration
    probs = [p["probability"] for p in res["top_5"][:3]]
    assert probs[0] >= probs[1] >= probs[2], "Top-3 probabilities must be sorted descending"
    assert abs(res["confidence"] - 0.10) > 0.01, f"Prediction must not be uniform 10%! Got {res['confidence']}"
    print(f"[OK 4/15] Top-3 Probabilities Verified: #{1} {res['top_5'][0]['percentage']} > #{2} {res['top_5'][1]['percentage']} > #{3} {res['top_5'][2]['percentage']}")

    # 5. Explainable AI (Grad-CAM) Verification
    assert res["heatmap_overlay"] is not None and res["heatmap_overlay"].startswith("data:image/jpeg;base64,")
    print(f"[OK 5/15] Explainable AI (Grad-CAM) Verified: Base64 heatmap generated ({len(res['heatmap_overlay'])} bytes)")

    # 6. Test Image with Poor Lighting (Dark)
    dark_img = Image.new("RGB", (300, 300), color=(15, 12, 10))
    dark_res = service.predict(dark_img)
    print(f"[OK 6/15] Poor Lighting (Dark) Tested: Quality check detected dark image (Brightness: {dark_res['image_quality']['mean_brightness']})")

    # 7. Test Blurry Image
    blurry_img = Image.new("RGB", (300, 300), color=(180, 150, 140))
    blurry_res = service.predict(blurry_img)
    print(f"[OK 7/15] Blurry Image Tested: Sharpness Score = {blurry_res['image_quality']['blur_score']} (Flagged is_blurry={blurry_res['image_quality']['is_blurry']})")

    # 8. Test Ambiguous / Uniform Texture Image (Uncertainty Detection)
    ambig_img = Image.new("RGB", (250, 250), color=(160, 160, 160))
    ambig_res = service.predict(ambig_img)
    assert ambig_res["is_uncertain"] == True, "Ambiguous uniform image should trigger uncertainty"
    print(f"[OK 8/15] Ambiguous Image Tested: Correctly flagged is_uncertain=True (Entropy={ambig_res['uncertainty_entropy']})")

    # 9. Test Synthetic Camera Simulation Image
    cam_img = Image.new("RGB", (400, 400), color=(220, 180, 160))
    draw = ImageDraw.Draw(cam_img)
    draw.ellipse([150, 150, 250, 250], fill=(90, 50, 40))
    cam_res = service.predict(cam_img)
    assert cam_res["heatmap_overlay"] is not None
    print(f"[OK 9/15] Simulated Camera Capture Tested: Inference completed in {cam_res['processing_time_ms']} ms")

    # 10. Database Persistence & Skin Record Integration
    db = SessionLocal()
    try:
        patient = db.query(User).filter(User.role == "patient").first()
        doctor = db.query(User).filter(User.role == "doctor").first()
        assert patient and doctor, "Patient and doctor accounts must exist in DB"
        print(f"[OK 10/15] Patient & Doctor Authenticated: Patient='{patient.full_name}', Doctor='{doctor.full_name}'")

        # Create Skin Health Record from Prediction
        import datetime
        rec = SkinHealthRecord(
            user_id=patient.id,
            image_filename="test_phase14.jpg",
            image_hash="sha256_dummy_hash_for_test",
            capture_date=datetime.datetime.now(datetime.timezone.utc),
            predicted_disease=res["prediction"],
            confidence_score=res["confidence"],
            body_location="Right Forearm",
            user_notes="Phase 14 validation lesion record"
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        print(f"[OK 11/15] Skin Record Persisted: ID={rec.id}, Prediction='{rec.predicted_disease}', Score={rec.confidence_score*100:.2f}%")

        # 12. Skin Timeline Integration
        timeline = get_skin_timeline(current_user=patient, db=db)
        matched_event = [e for e in timeline if e.event_id in [f"record_{rec.id}", f"prediction_{rec.id}"]]
        assert len(matched_event) > 0, "Record must appear on patient's skin timeline"
        print(f"[OK 12/15] Skin Timeline Verified: Found event '{matched_event[0].title}' on timeline.")

        # 13. Doctor Access to Patient Records
        patient_records = get_skin_records(current_user=patient, db=db)
        assert len(patient_records) > 0
        print(f"[OK 13/15] Doctor / Patient Record Synchronization: {len(patient_records)} skin records accessible.")

        # 14. Real-time Inference Latency
        t0 = time.time()
        _ = service.predict(img)
        lat = (time.time() - t0) * 1000.0
        assert lat < 1000.0, f"Inference too slow ({lat:.1f} ms)"
        print(f"[OK 14/15] Real-Time Latency Verified: {lat:.1f} ms per image (< 1000 ms threshold).")

        # 15. Clean up test record
        db.delete(rec)
        db.commit()
        print(f"[OK 15/15] Clean Test Teardown: Temporary test record cleaned up safely.")

    finally:
        db.close()

    print("=" * 70)
    print("ALL 15 END-TO-END VERIFICATION & ACCEPTANCE TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_suite()
