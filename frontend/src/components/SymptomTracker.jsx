import React, { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Trash2 } from 'lucide-react';
import api from '../services/api';

const STANDARD_SYMPTOMS = [
  'Itching',
  'Redness',
  'Swelling',
  'Dryness',
  'Pain',
  'Burning Sensation',
  'Irritation',
  'Peeling',
  'Bleeding',
  'Other'
];

export default function SymptomTracker() {
  const [symptoms, setSymptoms] = useState([]);
  const [skinRecords, setSkinRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [symptomName, setSymptomName] = useState('Itching');
  const [customName, setCustomName] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = useState('2 days');
  const [notes, setNotes] = useState('');
  const [linkedRecordId, setLinkedRecordId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Advisory modal / banner for worsening condition
  const [activeAdvisory, setActiveAdvisory] = useState(null);

  // Edit / Delete states
  const [editingSymptom, setEditingSymptom] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchSymptoms();
    fetchSkinRecords();
  }, []);

  const fetchSymptoms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/symptoms');
      setSymptoms(res.data || []);
    } catch (err) {
      console.error('Failed fetching symptoms:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSkinRecords = async () => {
    try {
      const res = await api.get('/api/skin-records');
      setSkinRecords(res.data || []);
    } catch (err) {
      console.error('Failed fetching skin records:', err);
    }
  };

  const handleAddSymptom = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const finalName = symptomName === 'Other' && customName.trim() ? customName.trim() : symptomName;

    const payload = {
      symptom_name: finalName,
      severity: severity,
      recorded_at: new Date(recordedAt).toISOString(),
      duration: duration || null,
      notes: notes || null,
      skin_record_id: linkedRecordId ? parseInt(linkedRecordId) : null
    };

    try {
      const res = await api.post('/api/symptoms', payload);
      // Check if worsening alert triggered
      if (res.data.advisory && res.data.advisory.alert_triggered) {
        setActiveAdvisory(res.data.advisory);
      }
      setNotes('');
      setCustomName('');
      fetchSymptoms();
    } catch (err) {
      alert('Failed to log symptom: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSymptom = async (id) => {
    try {
      await api.delete(`/api/symptoms/${id}`);
      setDeleteConfirmId(null);
      fetchSymptoms();
    } catch (err) {
      alert('Failed to delete symptom: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getSeverityBadgeClass = (sev) => {
    switch (sev.toLowerCase()) {
      case 'severe': return 'badge-danger-custom';
      case 'moderate': return 'badge-warning-custom';
      default: return 'badge-success-custom';
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card">
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0d6efd', margin: '0 0 4px' }}>
          Symptom Monitoring & Severity Tracking
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
          Maintain an ongoing log of patient-reported sensations and visible reactions. Changes in severity are monitored to recommend clinical consultation when appropriate.
        </p>
      </div>

      {/* Safety Alert Modal / Banner */}
      {activeAdvisory && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520, borderTop: '6px solid #dc3545' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={28} color="#dc3545" />
              <h3 style={{ margin: 0, color: '#842029', fontSize: '1.15rem' }}>
                {activeAdvisory.title}
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#212529', lineHeight: 1.5, marginBottom: 16 }}>
              {activeAdvisory.message}
            </p>
            <div style={{ background: '#f8f9fa', padding: '10px 14px', borderRadius: 6, fontSize: '0.8rem', color: '#6c757d', marginBottom: 18 }}>
              {activeAdvisory.safety_guideline}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setActiveAdvisory(null)}
                className="btn-submit"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                I Understand / Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left = Add Symptom Form, Right = Symptom History & Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 20 }}>
        {/* Left: Log Symptom Form */}
        <div className="project-card">
          <div className="project-card-header">
            Log New Symptom
          </div>

          <form onSubmit={handleAddSymptom}>
            <div className="form-group">
              <label className="form-label">Symptom Type *</label>
              <select
                value={symptomName}
                onChange={(e) => setSymptomName(e.target.value)}
                className="form-select"
                required
              >
                {STANDARD_SYMPTOMS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {symptomName === 'Other' && (
              <div className="form-group">
                <label className="form-label">Specify Symptom Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Tingling, scaling, weeping"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="form-control"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Severity Level *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Mild', 'Moderate', 'Severe'].map(sev => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: 4,
                      border: severity === sev ? '2px solid #0d6efd' : '1px solid var(--border-color)',
                      backgroundColor: severity === sev ? (sev === 'Severe' ? '#f8d7da' : sev === 'Moderate' ? '#fff3cd' : '#d1e7dd') : '#ffffff',
                      color: '#212529',
                      fontWeight: severity === sev ? 700 : 500,
                      fontSize: '0.825rem',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: sev === 'Severe' ? '#dc2626' : sev === 'Moderate' ? '#d97706' : '#16a34a'
                      }} />
                      <span>{sev}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Approximate Duration</label>
              <input
                type="text"
                placeholder="e.g. 2 days, 1 week, since yesterday"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Associated Skin Photo (Optional)</label>
              <select
                value={linkedRecordId}
                onChange={(e) => setLinkedRecordId(e.target.value)}
                className="form-select"
              >
                <option value="">-- None / General Body Symptom --</option>
                {skinRecords.map(r => (
                  <option key={r.id} value={r.id}>
                    Record #{r.id} ({r.body_location} - {new Date(r.capture_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date & Time Logged</label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Patient Notes / Triggers</label>
              <textarea
                rows={3}
                placeholder="Observed triggers, aggravated by heat or water, relief measures..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-control"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-submit"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Logging...' : '+ Record Symptom'}
            </button>
          </form>
        </div>

        {/* Right: Symptom History Table & Severity Evolution */}
        <div className="project-card">
          <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Chronological Symptom Log ({symptoms.length})</span>
            <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>Sorted latest first</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#6c757d' }}>Loading symptoms...</div>
          ) : symptoms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Activity size={40} color="#94a3b8" />
              </div>
              <p>No symptoms logged yet. Use the form on the left to record skin sensations.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Symptom</th>
                    <th>Severity</th>
                    <th>Duration</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {symptoms.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#6c757d' }}>
                        {new Date(s.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 600, color: '#212529' }}>
                        {s.symptom_name}
                      </td>
                      <td>
                        <span className={`badge-label ${getSeverityBadgeClass(s.severity)}`}>
                          {s.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {s.duration || '—'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#495057', maxWidth: 220 }}>
                        {s.notes || <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>None</span>}
                      </td>
                      <td>
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center' }}
                          title="Delete symptom"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clinical Disclaimer */}
          <div style={{ marginTop: 20, padding: 12, backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 4, fontSize: '0.775rem', color: '#6c757d' }}>
            <strong>Medical Notice:</strong> Self-reported symptom logging is designed strictly to facilitate longitudinal review during your next doctor consultation. It is not an automated medical diagnostic evaluation. If you observe spreading infection, fever, or extreme pain, seek emergency medical care immediately.
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 380, textAlign: 'center' }}>
            <h4 style={{ color: '#dc3545', margin: '0 0 10px' }}>Delete Symptom Entry</h4>
            <p style={{ fontSize: '0.85rem', color: '#495057', marginBottom: 18 }}>
              Are you sure you want to delete this symptom record?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmId(null)} className="btn-outline">Cancel</button>
              <button
                onClick={() => handleDeleteSymptom(deleteConfirmId)}
                className="btn-submit"
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

