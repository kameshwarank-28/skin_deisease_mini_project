import React, { useState } from 'react';
import { CheckCircle2, FolderHeart, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const BODY_LOCATIONS = [
  'Face', 'Neck', 'Chest', 'Back', 'Abdomen',
  'Left Arm', 'Right Arm', 'Hands',
  'Left Leg', 'Right Leg', 'Feet', 'Scalp', 'Other'
];

export default function ResultsView({ result, originalImage, onSavedToRecords }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bodyLocation, setBodyLocation] = useState('Face');
  const [saveNotes, setSaveNotes] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  if (!result) return null;

  const {
    prediction_id,
    prediction,
    confidence,
    confidence_pct,
    uncertainty_entropy,
    is_uncertain,
    recommendation,
    top_5 = [],
    disease_info,
    heatmap_overlay,
    processing_time_ms
  } = result;

  const handleSaveToRecords = async () => {
    setSavingRecord(true);
    try {
      const formData = new FormData();
      formData.append('body_location', bodyLocation);
      formData.append('user_notes', saveNotes || `AI Scan result: ${prediction} (${confidence_pct})`);
      if (prediction_id) {
        formData.append('prediction_id', prediction_id);
      }

      await api.post('/api/skin-records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSaveSuccess(true);
      setShowSaveModal(false);
      if (onSavedToRecords) onSavedToRecords();
    } catch (err) {
      alert('Failed to save to records: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingRecord(false);
    }
  };

  return (
    <div className="project-card">
      <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Classification Output</span>
        <span style={{ fontSize: '0.8rem', color: '#6c757d', fontWeight: 'normal' }}>
          Time taken: {processing_time_ms} ms
        </span>
      </div>

      {/* Main Prediction Result Box */}
      <div style={{
        backgroundColor: '#e7f1ff',
        border: '1px solid #b6d4fe',
        borderRadius: 5,
        padding: '14px 18px',
        marginBottom: 18
      }}>
        <div style={{ fontSize: '0.85rem', color: '#084298', fontWeight: 600, textTransform: 'uppercase' }}>
          Predicted Disease:
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#052c65', margin: '4px 0 2px' }}>
          {prediction}
        </h3>
        {disease_info?.scientific_name && (
          <div style={{ fontSize: '0.85rem', color: '#0d6efd', fontStyle: 'italic' }}>
            Scientific Name: {disease_info.scientific_name}
          </div>
        )}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.9rem', color: '#212529' }}>
              Confidence: <strong style={{ color: '#0d6efd' }}>{confidence_pct}</strong>
            </span>
            <span className={`badge-label ${is_uncertain ? 'badge-warning-custom' : 'badge-success-custom'}`}>
              {is_uncertain ? 'Uncertain Prediction' : 'High Confidence'}
            </span>
          </div>

          <button
            onClick={() => setShowSaveModal(true)}
            className="btn-submit"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            {saveSuccess ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                <span>Saved to Health Records</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FolderHeart size={14} />
                <span>Save to Skin Records</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <h4 style={{ color: '#0d6efd', margin: '0 0 12px' }}>Save to Skin Health Records</h4>
            <div className="form-group">
              <label className="form-label">Affected Body Location *</label>
              <select
                value={bodyLocation}
                onChange={(e) => setBodyLocation(e.target.value)}
                className="form-select"
              >
                {BODY_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Personal Observations</label>
              <textarea
                rows={3}
                placeholder="Observed itching, initial onset, sun exposure..."
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                className="form-control"
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setShowSaveModal(false)} className="btn-outline">Cancel</button>
              <button
                onClick={handleSaveToRecords}
                disabled={savingRecord}
                className="btn-submit"
              >
                {savingRecord ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Explanation: Image Preview & Heatmap */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: '0.9rem', color: '#495057' }}>
            Model Visual Focus (XAI Heatmap)
          </strong>
          {heatmap_overlay && (
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="btn-outline"
              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
            >
              {showHeatmap ? 'Show Original Only' : 'Show Attention Heatmap'}
            </button>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          padding: 10,
          maxHeight: 260
        }}>
          <img
            src={showHeatmap && heatmap_overlay ? heatmap_overlay : originalImage}
            alt="Skin lesion focus"
            style={{ maxHeight: 240, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
          />
        </div>
      </div>

      {/* Uncertainty & Clinical Action Advice */}
      <div style={{
        backgroundColor: is_uncertain ? '#fff3cd' : '#d1e7dd',
        border: `1px solid ${is_uncertain ? '#ffecb5' : '#badbcc'}`,
        borderRadius: 5,
        padding: '10px 14px',
        marginBottom: 18,
        fontSize: '0.85rem'
      }}>
        <strong style={{ color: is_uncertain ? '#664d03' : '#0f5132', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {is_uncertain ? (
            <>
              <AlertTriangle size={15} color="#b45309" />
              <span>Uncertainty Advisory</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} color="#0f5132" />
              <span>Diagnostic Recommendation</span>
            </>
          )}
        </strong>
        <p style={{ margin: 0, color: '#212529' }}>
          {recommendation}
        </p>
      </div>

      {/* Top-5 Predictions Table */}
      <div style={{ marginBottom: 18 }}>
        <strong style={{ fontSize: '0.9rem', color: '#495057', display: 'block', marginBottom: 6 }}>
          Top Differential Classes
        </strong>
        <table className="table-custom">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Condition</th>
              <th style={{ width: '150px' }}>Probability</th>
            </tr>
          </thead>
          <tbody>
            {top_5.map((item, idx) => (
              <tr key={idx} style={{ backgroundColor: idx === 0 ? '#f0f7ff' : 'inherit' }}>
                <td>{idx + 1}</td>
                <td>
                  <strong>{item.clean_name}</strong>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, backgroundColor: '#e9ecef', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.max(item.probability * 100, 2)}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? '#0d6efd' : '#6c757d'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.percentage}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disease Information */}
      {disease_info && (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: 5,
          padding: 12,
          fontSize: '0.85rem'
        }}>
          <strong style={{ color: '#212529', display: 'block', marginBottom: 4 }}>
            Disease Information & Advice:
          </strong>
          <p style={{ color: '#495057', margin: 0 }}>
            {disease_info.description}
          </p>
          {disease_info.when_to_see_doctor && (
            <div style={{ marginTop: 6, color: '#842029', backgroundColor: '#f8d7da', padding: '6px 10px', borderRadius: 4 }}>
              <strong>Note:</strong> {disease_info.when_to_see_doctor}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
