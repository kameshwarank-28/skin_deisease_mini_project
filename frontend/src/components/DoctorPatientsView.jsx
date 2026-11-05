import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  User,
  Activity,
  FolderHeart,
  Stethoscope,
  Pill,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Plus,
  MapPin
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DoctorPatientsView({ setActiveTab, onSelectPatientForAction }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Detail view state for selected patient
  const [activeDossierTab, setActiveDossierTab] = useState('records'); // 'records' | 'symptoms' | 'consultations' | 'treatments'
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientSymptoms, setPatientSymptoms] = useState([]);
  const [patientConsultations, setPatientConsultations] = useState([]);
  const [patientTreatments, setPatientTreatments] = useState([]);
  const [dossierLoading, setDossierLoading] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/patients');
      const list = res.data || [];
      setPatients(list);
      if (list.length > 0 && !selectedPatient) {
        selectPatient(list[0]);
      }
    } catch (err) {
      console.error('Failed to load doctor patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = async (pat) => {
    setSelectedPatient(pat);
    setDossierLoading(true);
    try {
      const [recRes, sympRes, consultRes, treatRes] = await Promise.all([
        api.get(`/api/doctors/patients/${pat.patient_id}/records`),
        api.get(`/api/doctors/patients/${pat.patient_id}/symptoms`),
        api.get(`/api/doctors/patients/${pat.patient_id}/consultations`),
        api.get(`/api/doctors/patients/${pat.patient_id}/treatments`)
      ]);
      setPatientRecords(recRes.data || []);
      setPatientSymptoms(sympRes.data || []);
      setPatientConsultations(consultRes.data || []);
      setPatientTreatments(treatRes.data || []);
    } catch (err) {
      console.error('Error fetching patient clinical dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    const name = (p.patient_name || '').toLowerCase();
    const cond = (p.chronic_conditions || '').toLowerCase();
    return name.includes(q) || cond.includes(q);
  });

  const handlePrescribeTreatment = () => {
    if (selectedPatient && onSelectPatientForAction) {
      onSelectPatientForAction(selectedPatient.patient_id, 'treatment');
    } else {
      setActiveTab('doctor_treatments');
    }
  };

  const handleNewConsultation = () => {
    if (selectedPatient && onSelectPatientForAction) {
      onSelectPatientForAction(selectedPatient.patient_id, 'consultation');
    } else {
      setActiveTab('doctor_consultations');
    }
  };

  return (
    <div>
      {/* Header Info */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
            Connected Patient Dossiers
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Full clinical visibility into dermatological photos, AI inference scores, symptom timelines and treatment regimens for authorized patients.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleNewConsultation}
            className="btn-submit"
            style={{ fontSize: '0.825rem', padding: '8px 14px', gap: 6 }}
          >
            <Stethoscope size={15} />
            <span>New Consultation</span>
          </button>
          <button
            onClick={handlePrescribeTreatment}
            className="btn-outline"
            style={{ fontSize: '0.825rem', padding: '8px 14px', gap: 6 }}
          >
            <Pill size={15} />
            <span>Prescribe Treatment</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left Column: Patient List */}
        <div className="project-card" style={{ padding: '16px' }}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: '0.85rem',
                border: '1px solid #7CB0EA',
                borderRadius: 6,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, padding: '0 4px' }}>
            Connected Patients ({filteredPatients.length})
          </div>

          {loading ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Loading patient list...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No connected patients found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 600, overflowY: 'auto' }}>
              {filteredPatients.map((pat) => {
                const isSelected = selectedPatient?.patient_id === pat.patient_id;
                const initial = (pat.patient_name || 'P')[0].toUpperCase();

                return (
                  <div
                    key={pat.patient_id}
                    onClick={() => selectPatient(pat)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isSelected ? '#EAF3FC' : '#EAF3FC',
                      border: `1px solid ${isSelected ? '#7CB0EA' : '#EAF3FC'}`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#1177DE' : '#7CB0EA',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      flexShrink: 0
                    }}>
                      {initial}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? '#1177DE' : '#1177DE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pat.patient_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Age {pat.age || '--'} • {pat.gender || 'Not specified'}
                      </div>
                    </div>

                    <ChevronRight size={16} style={{ color: isSelected ? '#1177DE' : '#7CB0EA' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Patient Dossier */}
        {selectedPatient ? (
          <div>
            {/* Patient Header Card */}
            <div className="project-card" style={{ padding: '20px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: '#1177DE',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.3rem'
                  }}>
                    {(selectedPatient.patient_name || 'P')[0].toUpperCase()}
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 2px', fontSize: '1.25rem', fontWeight: 700, color: '#1177DE' }}>
                      {selectedPatient.patient_name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Age: <strong>{selectedPatient.age || 'N/A'}</strong></span>
                      <span>Gender: <strong>{selectedPatient.gender || 'N/A'}</strong></span>
                      <span>Skin Type: <strong>{selectedPatient.skin_type || 'Unspecified'}</strong></span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setActiveTab('doctor_timeline')}
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', gap: 6 }}
                  >
                    <span>Timeline View &rarr;</span>
                  </button>
                </div>
              </div>

              {/* Medical Badges / Alerts */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {selectedPatient.allergies && (
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} color="#b91c1c" />
                    <span>Allergies: {selectedPatient.allergies}</span>
                  </span>
                )}
                {selectedPatient.chronic_conditions && (
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', color: '#1e40af', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Stethoscope size={12} color="#1e40af" />
                    <span>Conditions: {selectedPatient.chronic_conditions}</span>
                  </span>
                )}
                <span className="badge-label badge-success-custom" style={{ fontSize: '0.75rem' }}>
                  <ShieldCheck size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Connected Patient
                </span>
              </div>
            </div>

            {/* Dossier Tabs */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #7CB0EA', marginBottom: 16 }}>
              <button
                onClick={() => setActiveDossierTab('records')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeDossierTab === 'records' ? '3px solid #1177DE' : '3px solid transparent',
                  color: activeDossierTab === 'records' ? '#1177DE' : '#64748b',
                  fontWeight: activeDossierTab === 'records' ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FolderHeart size={16} />
                <span>Lesion Photos ({patientRecords.length})</span>
              </button>

              <button
                onClick={() => setActiveDossierTab('symptoms')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeDossierTab === 'symptoms' ? '3px solid #1177DE' : '3px solid transparent',
                  color: activeDossierTab === 'symptoms' ? '#1177DE' : '#64748b',
                  fontWeight: activeDossierTab === 'symptoms' ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Activity size={16} />
                <span>Symptom Tracker ({patientSymptoms.length})</span>
              </button>

              <button
                onClick={() => setActiveDossierTab('consultations')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeDossierTab === 'consultations' ? '3px solid #1177DE' : '3px solid transparent',
                  color: activeDossierTab === 'consultations' ? '#1177DE' : '#64748b',
                  fontWeight: activeDossierTab === 'consultations' ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Stethoscope size={16} />
                <span>Consultations ({patientConsultations.length})</span>
              </button>

              <button
                onClick={() => setActiveDossierTab('treatments')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeDossierTab === 'treatments' ? '3px solid #1177DE' : '3px solid transparent',
                  color: activeDossierTab === 'treatments' ? '#1177DE' : '#64748b',
                  fontWeight: activeDossierTab === 'treatments' ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Pill size={16} />
                <span>Treatment Plans ({patientTreatments.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            {dossierLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                Loading dossier details...
              </div>
            ) : (
              <div>
                {/* 1. Lesion Photos */}
                {activeDossierTab === 'records' && (
                  patientRecords.length === 0 ? (
                    <div className="project-card" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <FolderHeart size={36} style={{ color: '#7CB0EA', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>No Lesion Photos Uploaded Yet</div>
                      <div style={{ fontSize: '0.825rem' }}>Patient has not yet documented any skin lesion records.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                      {patientRecords.map(rec => (
                        <div key={rec.id} className="project-card" style={{ overflow: 'hidden' }}>
                          <div style={{ height: 160, backgroundColor: '#10254C', position: 'relative', overflow: 'hidden' }}>
                            <img
                              src={getImageUrl(rec.image_filename)}
                              alt={rec.body_location}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {rec.predicted_disease && (
                              <div style={{
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                right: 8,
                                backgroundColor: 'rgba(11, 19, 41, 0.85)',
                                color: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                backdropFilter: 'blur(4px)'
                              }}>
                                <strong>AI:</strong> {rec.predicted_disease} ({intScore(rec.confidence_score)}%)
                              </div>
                            )}
                          </div>

                          <div style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1177DE', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={13} color="#1177DE" />
                              <span>{rec.body_location}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>
                              Captured on {new Date(rec.capture_date).toLocaleDateString()}
                            </div>
                            {rec.user_notes && (
                              <div style={{ fontSize: '0.8rem', color: '#334155', backgroundColor: '#EAF3FC', padding: '6px 8px', borderRadius: 4 }}>
                                "{rec.user_notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 2. Symptom Tracker */}
                {activeDossierTab === 'symptoms' && (
                  patientSymptoms.length === 0 ? (
                    <div className="project-card" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <Activity size={36} style={{ color: '#7CB0EA', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>No Reported Symptoms</div>
                      <div style={{ fontSize: '0.825rem' }}>No active or logged symptoms for this patient.</div>
                    </div>
                  ) : (
                    <div className="project-card" style={{ padding: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #7CB0EA', color: '#64748b', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Symptom</th>
                            <th style={{ padding: '8px' }}>Severity</th>
                            <th style={{ padding: '8px' }}>Duration</th>
                            <th style={{ padding: '8px' }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patientSymptoms.map(symp => (
                            <tr key={symp.id} style={{ borderBottom: '1px solid #EAF3FC' }}>
                              <td style={{ padding: '10px 8px', color: '#64748b' }}>
                                {new Date(symp.recorded_at).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '10px 8px', fontWeight: 600, color: '#1177DE' }}>
                                {symp.symptom_name}
                              </td>
                              <td style={{ padding: '10px 8px' }}>
                                <span className={
                                  symp.severity === 'Severe' ? 'badge-label badge-danger-custom' :
                                  symp.severity === 'Moderate' ? 'badge-label badge-warning-custom' :
                                  'badge-label badge-info-custom'
                                }>
                                  {symp.severity} ({symp.severity_score}/10)
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', color: '#64748b' }}>
                                {symp.duration || '--'}
                              </td>
                              <td style={{ padding: '10px 8px', color: '#334155' }}>
                                {symp.notes || '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* 3. Consultations */}
                {activeDossierTab === 'consultations' && (
                  patientConsultations.length === 0 ? (
                    <div className="project-card" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <Stethoscope size={36} style={{ color: '#7CB0EA', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>No Consultations Recorded</div>
                      <div style={{ fontSize: '0.825rem', marginBottom: 14 }}>Document your first clinical consultation for this patient.</div>
                      <button
                        onClick={handleNewConsultation}
                        className="btn-submit"
                        style={{ fontSize: '0.825rem', padding: '6px 14px' }}
                      >
                        + Document Consultation
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <button
                          onClick={handleNewConsultation}
                          className="btn-submit"
                          style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Stethoscope size={14} />
                          <span>+ New Consultation</span>
                        </button>
                      </div>
                      {patientConsultations.map(c => (
                        <div key={c.id} className="project-card" style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1177DE', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Stethoscope size={16} color="#1177DE" />
                              <span>Consultation: {c.consultation_type || 'Clinical Review'}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {new Date(c.consultation_date).toLocaleDateString()}
                            </div>
                          </div>
                          {c.diagnosis && (
                            <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                              <strong>Clinical Diagnosis:</strong> {c.diagnosis}
                            </div>
                          )}
                          {c.clinical_observations && (
                            <div style={{ fontSize: '0.825rem', color: '#334155', backgroundColor: '#EAF3FC', padding: '8px 10px', borderRadius: 6, marginBottom: 6 }}>
                              <strong>Observations:</strong> {c.clinical_observations}
                            </div>
                          )}
                          {c.recommendations && (
                            <div style={{ fontSize: '0.825rem', color: '#1177DE' }}>
                              <strong>Recommendations:</strong> {c.recommendations}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 4. Treatment Plans */}
                {activeDossierTab === 'treatments' && (
                  patientTreatments.length === 0 ? (
                    <div className="project-card" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <Pill size={36} style={{ color: '#7CB0EA', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>No Active Prescriptions</div>
                      <div style={{ fontSize: '0.825rem', marginBottom: 14 }}>Prescribe a targeted dermatological treatment regimen.</div>
                      <button
                        onClick={handlePrescribeTreatment}
                        className="btn-submit"
                        style={{ fontSize: '0.825rem', padding: '6px 14px' }}
                      >
                        + Prescribe Treatment
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <button
                          onClick={handlePrescribeTreatment}
                          className="btn-submit"
                          style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Pill size={14} />
                          <span>+ Prescribe Treatment</span>
                        </button>
                      </div>
                      {patientTreatments.map(t => (
                        <div key={t.id} className="project-card" style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1177DE', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Pill size={15} color="#1177DE" />
                              <span>{t.treatment_name}</span>
                            </div>
                            <span className={
                              t.treatment_status === 'Treatment Ongoing' ? 'badge-label badge-success-custom' :
                              t.treatment_status === 'Review Required' ? 'badge-label badge-warning-custom' :
                              t.treatment_status === 'Completed' ? 'badge-label' :
                              'badge-label badge-info-custom'
                            }>
                              {t.treatment_status || (t.is_active ? 'Active' : 'Completed')}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 4 }}>
                            <strong>Medication:</strong> {t.prescribed_medication || t.medication_name || t.treatment_name}
                          </div>
                          {t.dosage && (
                            <div style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: 4 }}>
                              <strong>Dosage & Frequency:</strong> {t.dosage} {t.frequency ? `(${t.frequency})` : ''}
                            </div>
                          )}
                          {t.doctor_notes && (
                            <div style={{ fontSize: '0.8rem', color: '#334155', backgroundColor: '#EAF3FC', padding: '6px 10px', borderRadius: 4, marginTop: 6 }}>
                              <strong>Clinician Notes:</strong> {t.doctor_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Select a patient from the list on the left to view their clinical dossier.
          </div>
        )}
      </div>
    </div>
  );
}

function intScore(val) {
  if (!val) return 0;
  return Math.round(val * 100);
}

