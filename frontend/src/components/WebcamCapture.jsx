import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, XCircle, CheckCircle } from 'lucide-react';

export default function WebcamCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsReady(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access webcam. Please verify camera permissions in your browser.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    onCapture(base64Image);
  };

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      textAlign: 'center'
    }}>
      {cameraError ? (
        <div style={{ padding: 24, color: '#f87171' }}>
          <p style={{ marginBottom: 12 }}>{cameraError}</p>
          <button className="btn-secondary" onClick={startCamera}>
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      ) : (
        <div>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 400,
            margin: '0 auto',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: '#000'
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {/* Crosshair Guide */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140,
              height: 140,
              border: '2px dashed rgba(6, 182, 212, 0.6)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn-primary" onClick={takeSnapshot} disabled={!isReady}>
              <Camera size={18} /> Capture Lesion
            </button>
            <button className="btn-secondary" onClick={() => { stopCamera(); onCancel(); }}>
              <XCircle size={18} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
