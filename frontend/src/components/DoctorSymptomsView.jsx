import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  AlertTriangle,
  Stethoscope,
  Pill,
  User,
  Clock,
  ShieldCheck,
  Loader2,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Images,
  ExternalLink
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DoctorSymptomsView({ setActiveTab }) {
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Observation Modal State
  const [observationModalSymptom, setObservationModalSymptom] = useState(null);
  const [observationData, setObservationData] = useState({ doctor_observation: '', doctor_feedback: '' });
  const [submittingObs, setSubmittingObs] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadSymptoms();
  }, []);

  const loadSymptoms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/all-patient-symptoms');
      setSymptoms(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor patient symptoms:', err);
    } finally {
      setLoading(false);
    }
  };

  const openObservationModal = (symptom) => {
    setObservationModalSymptom(symptom);
    setObservationData({
      doctor_observation: symptom.doctor_observation || '',
      doctor_feedback: symptom.doctor_feedback || ''
    });
  };

  const handleSubmitObservation = async (e) => {
    e.preventDefault();
    if (!observationModalSymptom) return;
    setSubmittingObs(true);

    try {
      await api.post(`/api/doctors/symptoms/${observationModalSymptom.id}/observation`, {
        doctor_observation: observationData.doctor_observation.trim(),
        doctor_feedback: observationData.doctor_feedback.trim() || null
      });

      setFeedback({
        type: 'success',
        message: `Clinical observation recorded for ${observationModalSymptom.patient_name}'s ${observationModalSymptom.symptom_name}. Patient notified.`
      });
      setObservationModalSymptom(null);
      loadSymptoms();
    } catch (err) {
      console.error('Failed to save observation:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to save clinical observation.'
      });
    } finally {
      setSubmittingObs(false);
    }
  };

  const uniquePatients = Array.from(new Set(symptoms.map(s => s.patient_name || `Patient #${s.user_id}`)));

  const filteredSymptoms = symptoms.filter(s => {
    const pName = s.patient_name || `Patient #${s.user_id}`;
    const matchesPatient = patientFilter === 'all' || pName === patientFilter;
    const matchesSeverity = severityFilter === 'all' || s.severity?.toLowerCase() === severityFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const sName = (s.symptom_name || '').toLowerCase();
    const notes = (s.notes || '').toLowerCase();
    const docObs = (s.doctor_observation || '').toLowerCase();
    return matchesPatient && matchesSeverity && (pName.toLowerCase().includes(q) || sName.includes(q) || notes.includes(q) || docObs.includes(q));
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#1177DE" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading patient symptom logs...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast Feedback */}
      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          backgroundColor: feedback.type === 'success' ? '#EAF3FC' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#7CB0EA' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#1177DE' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fee2e2',
          borderRadius: 20,
          fontSize: '0.75rem',
          color: '#dc2626',
          fontWeight: 600,
          marginBottom: 8
        }}>
          <Activity size={14} />
          <span>Patient-Reported Symptom Progression</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#1177DE' }}>
          Authorized Patient Symptom History ({symptoms.length})
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Evaluate patient-reported symptoms, severity progressions, and provide clinical observations and recommendations without modifying patient entries.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Patient Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#64748b' }}>Patient:</span>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.8rem' }}
            >
              <option value="all">All Patients ({uniquePatients.length})</option>
              {uniquePatients.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Severity Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#64748b' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.8rem' }}
            >
              <option value="all">All Severities</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Search symptoms or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.825rem' }}
          />
        </div>
      </div>

      {/* Symptoms List */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {filteredSymptoms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No symptom entries found for the selected filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredSymptoms.map(s => {
              const sev = (s.severity || '').toLowerCase();
              const isSevere = sev === 'severe';
              const isModerate = sev === 'moderate';

              return (
                <div
                  key={s.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    border: '1px solid #7CB0EA',
                    backgroundColor: isSevere ? '#fffbfb' : '#EAF3FC',
                    borderLeft: isSevere ? '4px solid #ef4444' : isModerate ? '4px solid #f59e0b' : '4px solid #10b981',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1177DE' }}>
                          {s.symptom_name}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontWeight: 700,
                          backgroundColor: isSevere ? '#fee2e2' : isModerate ? '#fef3c7' : '#DCEAF8',
                          color: isSevere ? '#b91c1c' : isModerate ? '#b45309' : '#1177DE'
                        }}>
                          {s.severity || 'Mild'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#1177DE', fontWeight: 700 }}>
                          {s.patient_name || `Patient #${s.user_id}`}
                        </span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, backgroundColor: '#7CB0EA', color: '#475569' }}>
                          {s.patient_code}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.775rem', color: '#64748b' }}>
                        {s.duration && <span>Duration: <strong>{s.duration}</strong></span>}
                        <span>Logged: {formatDate(s.recorded_at)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openObservationModal(s)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: s.doctor_observation ? '#EAF3FC' : '#1177DE',
                          color: s.doctor_observation ? '#1177DE' : '#ffffff',
                          border: s.doctor_observation ? '1px solid #7CB0EA' : 'none',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>{s.doctor_observation ? 'Edit Observation' : '+ Add Clinical Observation'}</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('doctor_consultations')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #7CB0EA',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: '#1177DE',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Stethoscope size={13} />
                        <span>Consultation</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('doctor_treatments')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#1177DE',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Pill size={13} />
                        <span>Prescribe</span>
                      </button>
                    </div>
                  </div>

                  {/* Patient Notes & Associated Photo */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {s.skin_record_image_url && (
                      <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 6,
                        backgroundColor: '#10254C',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative'
                      }}>
                        <img
                          src={getImageUrl(s.skin_record_image_url)}
                          alt="Lesion"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {s.skin_record_body_location && (
                          <span style={{
                            position: 'absolute',
                            bottom: 2,
                            left: 2,
                            backgroundColor: 'rgba(15,23,42,0.85)',
                            color: '#448EE2',
                            fontSize: '0.55rem',
                            padding: '1px 3px',
                            borderRadius: 2
                          }}>
                            {s.skin_record_body_location}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ flex: 1, fontSize: '0.825rem', color: '#334155' }}>
                      <strong>Patient Note:</strong> {s.notes ? `"${s.notes}"` : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None provided</span>}
                    </div>
                  </div>

                  {/* Doctor Clinical Observation Section if exists */}
                  {(s.doctor_observation || s.doctor_feedback) && (
                    <div style={{
                      padding: '10px 14px',
                      backgroundColor: '#EAF3FC',
                      border: '1px solid #7CB0EA',
                      borderRadius: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Stethoscope size={14} color="#1177DE" />
                        <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#1e40af' }}>
                          Doctor Clinical Observation ({s.reviewed_by_doctor_name ? `Dr. ${s.reviewed_by_doctor_name}` : 'Clinician'})
                        </span>
                        {s.reviewed_at && (
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            • {formatDate(s.reviewed_at)}
                          </span>
                        )}
                      </div>

                      {s.doctor_observation && (
                        <div style={{ fontSize: '0.8rem', color: '#1e3a8a', marginBottom: s.doctor_feedback ? 3 : 0 }}>
                          <strong>Observation:</strong> {s.doctor_observation}
                        </div>
                      )}

                      {s.doctor_feedback && (
                        <div style={{ fontSize: '0.8rem', color: '#1e3a8a' }}>
                          <strong>Recommendations for Patient:</strong> {s.doctor_feedback}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observation Modal */}
      {observationModalSymptom && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px', color: '#1177DE' }}>
              Add Clinical Observation
            </h3>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: 16 }}>
              Patient: <strong>{observationModalSymptom.patient_name}</strong> • Symptom: <strong>{observationModalSymptom.symptom_name}</strong> ({observationModalSymptom.severity})
            </p>

            <form onSubmit={handleSubmitObservation}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Clinical Observation / Physical Findings *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Mild localized erythema observed. No signs of secondary infection or cellulitis."
                  value={observationData.doctor_observation}
                  onChange={(e) => setObservationData({ ...observationData, doctor_observation: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Patient Recommendations & Guidance (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Apply prescribed topical barrier cream twice daily. Avoid hot showers."
                  value={observationData.doctor_feedback}
                  onChange={(e) => setObservationData({ ...observationData, doctor_feedback: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setObservationModalSymptom(null)}
                  style={{ padding: '8px 14px', backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingObs}
                  style={{ padding: '8px 16px', backgroundColor: '#1177DE', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {submittingObs ? 'Saving...' : 'Save Clinical Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
