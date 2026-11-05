import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, XCircle, CheckCircle, Video } from 'lucide-react';

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
      setIsReady(false);
      let mediaStream = null;

      // Strategy 1: Try environment/rear camera (smartphones/tablets)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
        });
      } catch (e1) {
        // Strategy 2: Try front user-facing camera (laptops / desktop webcams)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
          });
        } catch (e2) {
          // Strategy 3: Standard any-device video fallback
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn('Autoplay error:', e));
          setIsReady(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access webcam. Please verify camera permissions in your browser or connect a webcam device.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    onCapture(base64Image);
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.03)',
      border: '1px solid #7CB0EA',
      borderRadius: 10,
      padding: 18,
      textAlign: 'center'
    }}>
      {cameraError ? (
        <div style={{ padding: '24px 16px', color: '#dc2626' }}>
          <p style={{ marginBottom: 14, fontSize: '0.875rem' }}>{cameraError}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-outline" onClick={startCamera} style={{ fontSize: '0.825rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} /> Try Again
            </button>
            <button className="btn-outline" onClick={onCancel} style={{ fontSize: '0.825rem', padding: '6px 14px' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#1177DE',
            border: '2px solid #1177DE',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'auto', display: 'block', minHeight: 280, objectFit: 'cover' }}
            />

            {/* Live Indicator Pill */}
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: isReady ? 'rgba(22, 163, 74, 0.85)' : 'rgba(234, 88, 12, 0.85)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                display: 'inline-block'
              }} />
              <span>{isReady ? 'LIVE WEBCAM' : 'INITIALIZING...'}</span>
            </div>

            {/* Center Aiming Reticle */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 160,
              height: 160,
              border: '2px dashed rgba(56, 189, 248, 0.8)',
              borderRadius: '50%',
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.7rem',
                textAlign: 'center',
                width: 120
              }}>
                Align Skin or Lesion Here
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '10px 0 0' }}>
            Hold the skin area or lesion steady inside the center circle and click <strong>Capture & Analyze Skin</strong>.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}>
            <button
              type="button"
              className="btn-submit"
              onClick={takeSnapshot}
              disabled={!isReady}
              style={{
                fontSize: '0.85rem',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: isReady ? 1 : 0.6,
                cursor: isReady ? 'pointer' : 'not-allowed'
              }}
            >
              <Camera size={16} />
              <span>Capture & Analyze Skin</span>
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => { stopCamera(); onCancel(); }}
              style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <XCircle size={16} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
