import React, { useState, useEffect } from 'react';
import {
  Pill,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  Check
} from 'lucide-react';
import api from '../services/api';

export default function DoctorTreatmentsView() {
  const [patients, setPatients] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [formData, setFormData] = useState({
    patientId: '',
    treatmentName: '',
    prescribedMedication: '',
    dosage: '',
    frequency: 'Twice daily',
    treatmentStatus: 'Treatment Prescribed',
    startDate: new Date().toISOString().split('T')[0],
    reviewDate: '',
    doctorNotes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const patRes = await api.get('/api/doctors/patients');
      const pats = patRes.data || [];
      setPatients(pats);

      if (pats.length > 0 && !formData.patientId) {
        setFormData(prev => ({ ...prev, patientId: pats[0].patient_id }));
      }

      // Collect treatments across all connected patients
      const treatPromises = pats.map(p =>
        api.get(`/api/doctors/patients/${p.patient_id}/treatments`)
          .then(res => (res.data || []).map(t => ({ ...t, patient_name: p.patient_name })))
          .catch(() => [])
      );
      const allResults = await Promise.all(treatPromises);
      const flattened = allResults.flat().sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date));
      setTreatments(flattened);
    } catch (err) {
      console.error('Failed to load doctor treatments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId) {
      setFeedback({ type: 'error', text: 'Please select a patient.' });
      return;
    }
    if (!formData.treatmentName.trim()) {
      setFeedback({ type: 'error', text: 'Treatment title is required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        treatment_name: formData.treatmentName.trim(),
        prescribed_medication: formData.prescribedMedication.trim() || formData.treatmentName.trim(),
        dosage: formData.dosage.trim() || null,
        frequency: formData.frequency.trim() || null,
        treatment_status: formData.treatmentStatus,
        start_date: formData.startDate,
        review_date: formData.reviewDate || null,
        doctor_notes: formData.doctorNotes.trim() || null
      };

      await api.post(`/api/doctors/patients/${formData.patientId}/treatments`, payload);

      setFeedback({ type: 'success', text: 'Treatment regimen prescribed successfully. Patient notified.' });
      setShowAddForm(false);
      setFormData(prev => ({
        ...prev,
        treatmentName: '',
        prescribedMedication: '',
        dosage: '',
        reviewDate: '',
        doctorNotes: ''
      }));
      loadData();
    } catch (err) {
      console.error('Failed to create treatment:', err);
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to prescribe treatment.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusUpdate = async (treatmentId, newStatus) => {
    try {
      await api.put(`/api/doctors/treatments/${treatmentId}`, {
        treatment_status: newStatus
      });
      setFeedback({ type: 'success', text: `Treatment status updated to "${newStatus}".` });
      loadData();
    } catch (err) {
      console.error('Failed to update treatment status:', err);
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update treatment status.'
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Prescription & Treatment Management
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Prescribe targeted dermatological treatments, monitor active patient regimens, and update clinical review milestones.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-submit"
          style={{ fontSize: '0.85rem', padding: '9px 16px', gap: 8 }}
        >
          <Plus size={16} />
          <span>{showAddForm ? 'Close Form' : 'Prescribe Treatment'}</span>
        </button>
      </div>

      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.text}</div>
        </div>
      )}

      {/* Add Treatment Form */}
      {showAddForm && (
        <div className="project-card" style={{ padding: '24px', marginBottom: 24, border: '1px solid #bfdbfe', backgroundColor: '#fcfdfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Pill size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Prescribe New Treatment Plan
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Structured clinical regimen will be synced to the patient's isolated profile.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
              {/* Patient Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Select Connected Patient <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                >
                  {patients.length === 0 ? (
                    <option value="">No connected patients found</option>
                  ) : (
                    patients.map(p => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_name} (ID: PAT-{p.patient_id})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Treatment Title / Regimen Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Treatment Regimen Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.treatmentName}
                  onChange={(e) => setFormData({ ...formData, treatmentName: e.target.value })}
                  placeholder="e.g. Topical Corticosteroid Regimen"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Prescribed Medication */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Prescribed Medication
                </label>
                <input
                  type="text"
                  value={formData.prescribedMedication}
                  onChange={(e) => setFormData({ ...formData, prescribedMedication: e.target.value })}
                  placeholder="e.g. Hydrocortisone 1% Cream, Cetirizine 10mg"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
              {/* Dosage */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Dosage / Application
                </label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  placeholder="e.g. Thin film to affected area"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Frequency */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Frequency
                </label>
                <input
                  type="text"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  placeholder="e.g. Twice daily after cleansing"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Initial Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Treatment Status
                </label>
                <select
                  value={formData.treatmentStatus}
                  onChange={(e) => setFormData({ ...formData, treatmentStatus: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="Treatment Prescribed">Treatment Prescribed</option>
                  <option value="Treatment Ongoing">Treatment Ongoing</option>
                  <option value="Review Required">Review Required</option>
                </select>
              </div>

              {/* Review Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Review Date
                </label>
                <input
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            </div>

            {/* Clinician Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Clinician Instructions & Safety Warnings
              </label>
              <textarea
                rows={3}
                value={formData.doctorNotes}
                onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                placeholder="Specific instructions for patient, contraindications, when to discontinue or seek urgent evaluation..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.875rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-outline"
                style={{ fontSize: '0.85rem', padding: '9px 16px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-submit"
                style={{ fontSize: '0.85rem', padding: '9px 20px' }}
              >
                {submitting ? 'Prescribing...' : 'Prescribe Regimen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Treatments List Table */}
      {loading ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading treatment regimens...
        </div>
      ) : treatments.length === 0 ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <Pill size={40} style={{ color: '#cbd5e1', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No Treatments Prescribed Yet</div>
          <div style={{ fontSize: '0.825rem' }}>Click "Prescribe Treatment" above to create a patient regimen.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {treatments.map(t => (
            <div key={t.id} className="project-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Pill size={16} color="#15803d" />
                      <span>{t.treatment_name}</span>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      for <strong>{t.patient_name || `Patient #${t.patient_id}`}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    <strong>Medication:</strong> {t.prescribed_medication || t.treatment_name}
                    {t.dosage ? ` • ${t.dosage}` : ''}
                    {t.frequency ? ` • ${t.frequency}` : ''}
                  </div>
                </div>

                {/* Status Dropdown / Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={t.treatment_status || (t.is_active ? 'Treatment Ongoing' : 'Completed')}
                    onChange={(e) => handleQuickStatusUpdate(t.id, e.target.value)}
                    style={{
                      padding: '5px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Treatment Prescribed">Treatment Prescribed</option>
                    <option value="Treatment Ongoing">Treatment Ongoing</option>
                    <option value="Review Required">Review Required</option>
                    <option value="Completed">Completed</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>
              </div>

              {t.doctor_notes && (
                <div style={{ fontSize: '0.825rem', color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginTop: 8 }}>
                  <strong>Clinician Instructions:</strong> {t.doctor_notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem', color: '#64748b' }}>
                <span>Prescribed on: {t.start_date}</span>
                {t.review_date && (
                  <span style={{ color: '#0d6efd', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} />
                    <span>Review milestone: {t.review_date}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

