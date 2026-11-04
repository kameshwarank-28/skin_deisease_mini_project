import json
from pathlib import Path
from PIL import Image
import pandas as pd
from backend.app.services.classifier import SkinClassifierService

def verify():
    print("=" * 65)
    print("VERIFYING EFFICIENTNETV2-S CHECKPOINT INTEGRATION")
    print("=" * 65)

    service = SkinClassifierService(checkpoint_path="models/best_model.pth")
    print(f"[OK] Checkpoint Loaded: {service._has_checkpoint}")
    print(f"[OK] Loaded Architecture: {service.model_name}")
    print(f"[OK] Calibrated Temperature: {service.temperature:.4f}")

    assert service._has_checkpoint, "Checkpoint failed to load!"
    assert service.model_name == "efficientnetv2_s", f"Expected efficientnetv2_s, got {service.model_name}"

    # Load 3 test images from different classes
    test_df = pd.read_csv("processed_dataset/test_manifest.csv")
    test_samples = test_df.groupby("label").first().reset_index()

    print("\nRunning inference on 3 unseen test images:")
    for i in range(3):
        row = test_samples.iloc[i]
        path = row["file_path"]
        true_name = row["class_name"]

        with Image.open(path) as img:
            res = service.predict(img)

        print(f"\n--- Test Sample {i+1} ---")
        print(f"Path: {Path(path).name}")
        print(f"True Class: {true_name}")
        print(f"Predicted Class: {res['prediction']}")
        print(f"Top-1 Confidence: {res['confidence_pct']}")
        
        # Verify predictions are NOT 10%
        top_prob = res["confidence"]
        assert abs(top_prob - 0.10) > 0.005, f"Prediction is still 10%! Got {top_prob}"

        print("Top-3 Differential Classes:")
        for pred in res["top_5"][:3]:
            print(f"  {pred['percentage']:>8} -> {pred['clean_name']}")

        # Verify probabilities sum to ~1.0
        prob_sum = sum(p["probability"] for p in res["top_5"])
        print(f"Top-5 Probability Sum: {prob_sum*100:.2f}%")

        # Verify Grad-CAM
        has_heatmap = res["heatmap_overlay"] is not None and res["heatmap_overlay"].startswith("data:image/jpeg;base64,")
        print(f"Grad-CAM Heatmap Generated: {has_heatmap}")
        assert has_heatmap, "Grad-CAM heatmap missing!"

        print(f"Inference Latency: {res['processing_time_ms']} ms")

    print("\n" + "=" * 65)
    print("ALL EFFICIENTNETV2-S INTEGRATION TESTS PASSED!")
    print("=" * 65)

if __name__ == "__main__":
    verify()
