import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Sparkles,
  Activity,
  Stethoscope,
  Pill,
  Image as ImageIcon,
  User,
  AlertCircle
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DoctorTimelineView() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/patients');
      const list = res.data || [];
      setPatients(list);
      if (list.length > 0) {
        setSelectedPatientId(list[0].patient_id);
        fetchTimeline(list[0].patient_id);
      }
    } catch (err) {
      console.error('Failed to load patients for timeline:', err);
      setError('Failed to load connected patients.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async (patId) => {
    if (!patId) return;
    setTimelineLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/skin-timeline?patient_id=${patId}`);
      setTimelineEvents(res.data || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setError(err.response?.data?.detail || 'Failed to fetch patient timeline.');
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handlePatientChange = (patId) => {
    setSelectedPatientId(patId);
    fetchTimeline(patId);
  };

  const selectedPatient = patients.find(p => String(p.patient_id) === String(selectedPatientId));

  return (
    <div>
      {/* Header & Patient Picker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Patient Skin Progression Timeline
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Unified chronological progression of lesion photographs, deep learning predictions, reported symptoms, and treatment milestones.
          </p>
        </div>

        {/* Patient Selection Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
            Select Patient:
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => handlePatientChange(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              backgroundColor: '#ffffff',
              minWidth: 200
            }}
          >
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.patient_name} (ID: PAT-{p.patient_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Selected Patient Banner */}
      {selectedPatient && (
        <div className="project-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#0d6efd',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem'
            }}>
              {(selectedPatient.patient_name || 'P')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                {selectedPatient.patient_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Age {selectedPatient.age || 'N/A'} • {selectedPatient.gender || 'Unspecified'} • Skin Type: {selectedPatient.skin_type || 'Unspecified'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Total Events: <strong>{timelineEvents.length}</strong>
          </div>
        </div>
      )}

      {/* Timeline Stream */}
      {timelineLoading ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading chronological timeline...
        </div>
      ) : timelineEvents.length === 0 ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <History size={40} style={{ color: '#cbd5e1', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No Timeline Events Recorded</div>
          <div style={{ fontSize: '0.825rem' }}>This patient has not yet logged any photos, symptoms or treatments.</div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 30 }}>
          {/* Vertical Timeline Rule */}
          <div style={{
            position: 'absolute',
            left: 14,
            top: 10,
            bottom: 10,
            width: 2,
            backgroundColor: '#e2e8f0'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {timelineEvents.map((evt, idx) => {
              const isSkinRecord = evt.event_type === 'skin_record';
              const isSymptom = evt.event_type === 'symptom';
              const isConsult = evt.event_type === 'consultation';
              const isTreatment = evt.event_type === 'treatment';

              return (
                <div key={evt.event_id || idx} style={{ position: 'relative' }}>
                  {/* Timeline Node Icon Circle */}
                  <div style={{
                    position: 'absolute',
                    left: -29,
                    top: 16,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: isSkinRecord ? '#0d6efd' : isSymptom ? '#f59e0b' : isConsult ? '#8b5cf6' : '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    zIndex: 2
                  }}>
                    {isSkinRecord && <ImageIcon size={14} />}
                    {isSymptom && <Activity size={14} />}
                    {isConsult && <Stethoscope size={14} />}
                    {isTreatment && <Pill size={14} />}
                  </div>

                  {/* Event Card */}
                  <div className="project-card" style={{ padding: '16px 20px', marginLeft: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                          {evt.title}
                        </span>
                        <span className={
                          isSkinRecord ? 'badge-label badge-info-custom' :
                          isSymptom ? 'badge-label badge-warning-custom' :
                          isConsult ? 'badge-label badge-primary-custom' :
                          'badge-label badge-success-custom'
                        } style={{ fontSize: '0.7rem' }}>
                          {isSkinRecord ? 'Photo Record' : isSymptom ? 'Symptom' : isConsult ? 'Consultation' : 'Treatment'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} />
                        <span>{new Date(evt.date).toLocaleString()}</span>
                      </div>
                    </div>

                    {evt.subtitle && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        {evt.subtitle}
                      </div>
                    )}

                    {evt.description && (
                      <div style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: 8 }}>
                        {evt.description}
                      </div>
                    )}

                    {/* Image if available */}
                    {evt.image_url && (
                      <div style={{ marginTop: 10, maxWidth: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <img
                          src={getImageUrl(evt.image_url.replace('/api/images/', ''))}
                          alt="Lesion snapshot"
                          style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

