import urllib.request
import uuid
import json

boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
with open('test_rec_30.jpg', 'rb') as f:
    img_bytes = f.read()

parts = [
    ('--' + boundary).encode('utf-8'),
    b'Content-Disposition: form-data; name="file"; filename="test_rec_30.jpg"',
    b'Content-Type: image/jpeg',
    b'',
    img_bytes,
    ('--' + boundary + '--').encode('utf-8'),
    b''
]
body = b'\r\n'.join(parts)

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/predict',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print('File Upload Endpoint Response Status:', resp.status)
    print('Prediction:', data.get('prediction'))
    print('Confidence:', data.get('confidence_pct'))
    print('Prediction ID:', data.get('prediction_id'))
    print('Top 3:', [{'name': x['clean_name'], 'prob': x['percentage']} for x in data.get('top_5', [])[:3]])
