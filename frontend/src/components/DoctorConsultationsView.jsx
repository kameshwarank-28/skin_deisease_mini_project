import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';

export default function DoctorConsultationsView() {
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [formData, setFormData] = useState({
    patientId: '',
    consultationDate: new Date().toISOString().split('T')[0],
    consultationType: 'Dermatological Clinical Review',
    diagnosis: '',
    clinicalObservations: '',
    recommendations: '',
    followUpDate: ''
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

      // Collect consultations across all connected patients
      const consultPromises = pats.map(p =>
        api.get(`/api/doctors/patients/${p.patient_id}/consultations`)
          .then(res => (res.data || []).map(c => ({ ...c, patient_name: p.patient_name })))
          .catch(() => [])
      );
      const allResults = await Promise.all(consultPromises);
      const flattened = allResults.flat().sort((a, b) => new Date(b.consultation_date) - new Date(a.consultation_date));
      setConsultations(flattened);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId) {
      setFeedback({ type: 'error', text: 'Please select a patient.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        consultation_date: formData.consultationDate,
        consultation_type: formData.consultationType,
        diagnosis: formData.diagnosis.trim() || null,
        clinical_observations: formData.clinicalObservations.trim() || null,
        recommendations: formData.recommendations.trim() || null,
        follow_up_date: formData.followUpDate || null
      };

      await api.post(`/api/doctors/patients/${formData.patientId}/consultations`, payload);

      setFeedback({ type: 'success', text: 'Clinical consultation documented and patient notified successfully.' });
      setShowAddForm(false);
      setFormData(prev => ({
        ...prev,
        diagnosis: '',
        clinicalObservations: '',
        recommendations: '',
        followUpDate: ''
      }));
      loadData();
    } catch (err) {
      console.error('Failed to save consultation:', err);
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to document consultation.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Clinical Consultations
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Document formal clinical impressions, objective lesion observations, and medical advisories for connected patients.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-submit"
          style={{ fontSize: '0.85rem', padding: '9px 16px', gap: 8 }}
        >
          <Plus size={16} />
          <span>{showAddForm ? 'Close Form' : 'Document Consultation'}</span>
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

      {/* Add Consultation Form Card */}
      {showAddForm && (
        <div className="project-card" style={{ padding: '24px', marginBottom: 24, border: '1px solid #bfdbfe', backgroundColor: '#fcfdfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Stethoscope size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                New Clinical Consultation Record
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Observations will be saved to patient medical history and trigger a patient notification.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
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

              {/* Consultation Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Consultation Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.consultationDate}
                  onChange={(e) => setFormData({ ...formData, consultationDate: e.target.value })}
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

              {/* Consultation Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Consultation Modality / Type
                </label>
                <input
                  type="text"
                  value={formData.consultationType}
                  onChange={(e) => setFormData({ ...formData, consultationType: e.target.value })}
                  placeholder="e.g. Clinical Review, Biopsy Follow-up"
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

            {/* Diagnosis */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Clinical Diagnosis / Assessment
              </label>
              <input
                type="text"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder="e.g. Benign Melanocytic Nevus; Active Atopic Dermatitis with erythema"
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

            {/* Clinical Observations */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Clinical Observations (Neutral Observational Language)
              </label>
              <textarea
                rows={3}
                value={formData.clinicalObservations}
                onChange={(e) => setFormData({ ...formData, clinicalObservations: e.target.value })}
                placeholder="Describe visible morphology, lesion boundaries, scaling, pigmentation changes, or evolution compared with prior photographs..."
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

            {/* Recommendations & Follow-up */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Recommendations & Patient Care Instructions
                </label>
                <input
                  type="text"
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  placeholder="e.g. Apply prescribed topical hydrocortisone; avoid sun exposure; re-photograph lesion in 14 days"
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Recommended Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
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
                {submitting ? 'Saving...' : 'Save Consultation Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Consultations List */}
      {loading ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading consultations...
        </div>
      ) : consultations.length === 0 ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <Stethoscope size={40} style={{ color: '#cbd5e1', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No Consultations Recorded Yet</div>
          <div style={{ fontSize: '0.825rem', marginBottom: 16 }}>Click "Document Consultation" above to add your first entry.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {consultations.map(c => (
            <div key={c.id} className="project-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: '#e7f1ff',
                    color: '#0d6efd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {(c.patient_name || 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.975rem', color: '#0f172a' }}>
                      {c.patient_name || `Patient #${c.patient_id}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Modality: {c.consultation_type || 'Clinical Review'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} />
                  <span>{c.consultation_date}</span>
                </div>
              </div>

              {c.diagnosis && (
                <div style={{ fontSize: '0.875rem', color: '#1e293b', marginBottom: 8, padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: 6 }}>
                  <strong>Diagnosis / Clinical Assessment:</strong> {c.diagnosis}
                </div>
              )}

              {c.clinical_observations && (
                <div style={{ fontSize: '0.825rem', color: '#334155', marginBottom: 8, lineHeight: 1.4 }}>
                  <strong>Clinical Observations:</strong> {c.clinical_observations}
                </div>
              )}

              {c.recommendations && (
                <div style={{ fontSize: '0.825rem', color: '#0d6efd', marginBottom: 6 }}>
                  <strong>Recommendations:</strong> {c.recommendations}
                </div>
              )}

              {c.follow_up_date && (
                <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} />
                  <span>Follow-up scheduled for: <strong>{c.follow_up_date}</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

