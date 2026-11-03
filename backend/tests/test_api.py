import io
from fastapi.testclient import TestClient
from PIL import Image
from backend.app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "DermAI" in response.json()["message"]

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_get_diseases():
    response = client.get("/api/diseases")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert len(data) >= 10

def test_predict_endpoint_with_synthetic_image():
    img = Image.new("RGB", (224, 224), color=(200, 150, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    response = client.post(
        "/api/predict",
        files={"file": ("test_skin.jpg", buf, "image/jpeg")}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert "prediction" in res_data
    assert "confidence" in res_data
    assert "top_5" in res_data
    assert len(res_data["top_5"]) > 0
    assert "heatmap_overlay" in res_data
