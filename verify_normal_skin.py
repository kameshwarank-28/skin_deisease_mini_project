import urllib.request
import json
import base64

def test_img(path, desc):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    payload = json.dumps({'image_base64': b64}).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/predict/camera',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"=== {desc} ===")
        print(f"Image:           {path}")
        print(f"Prediction:      {res['prediction']}")
        print(f"Confidence:      {res['confidence_pct']}")
        print(f"Is Normal Skin:  {res.get('is_normal_skin')}")
        print(f"Is Uncertain:    {res.get('is_uncertain')}")
        print(f"Quality Valid:   {res.get('image_quality', {}).get('valid')}")
        print(f"Recommendation:  {res.get('recommendation')}")
        print("Top 3 Differential:")
        for t in res.get('top_5', [])[:3]:
            print(f"  - {t['clean_name']}: {t['percentage']}")
        print()
        return res

if __name__ == "__main__":
    test_img('Z:/IMG_CLASSES/Normal_Skin/normal_skin_00195a93db11.jpg', 'VALID NORMAL SKIN SAMPLE 1')
    test_img('Z:/IMG_CLASSES/Normal_Skin/normal_skin_004caf5dc0ac.jpg', 'VALID NORMAL SKIN SAMPLE 2')
    test_img('Z:/IMG_CLASSES/Normal_Skin/normal_skin_00dc004f9503.jpg', 'VALID NORMAL SKIN SAMPLE 3')
