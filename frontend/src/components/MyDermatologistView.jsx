import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Building2,
  ShieldCheck,
  CalendarDays,
  FileCheck,
  Pill,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  UserPlus,
  Loader2,
  Send,
  Sparkles
} from 'lucide-react';
import api from '../services/api';

export default function MyDermatologistView({ setActiveTab }) {
  const [connectedDoc, setConnectedDoc] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Request Connection Modal State
  const [selectedDoctorForRequest, setSelectedDoctorForRequest] = useState(null);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDermatologistData();
  }, []);

  const loadDermatologistData = async () => {
    setLoading(true);
    try {
      const [myDocRes, dirRes, connsRes] = await Promise.all([
        api.get('/api/patients/my-dermatologist'),
        api.get('/api/doctors/directory'),
        api.get('/api/patients/connections')
      ]);

      const docData = myDocRes.data;
      if (docData && (docData.has_doctor || docData.doctor_name)) {
        const doc = docData.doctor || docData;
        setConnectedDoc({
          ...doc,
          next_appointment: docData.next_appointment,
          connection_status: docData.connection_status || 'Accepted'
        });
      } else {
        setConnectedDoc(null);
      }
      setDirectory(dirRes.data || []);
      setConnections(connsRes.data || []);
    } catch (err) {
      console.error('Failed to load dermatologist data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRequestModal = (doc) => {
    setSelectedDoctorForRequest(doc);
    setRequestNote('Hello Doctor, I would like to connect to share my skin health photos and receive clinical guidance.');
  };

  const handleSubmitConnectionRequest = async (e) => {
    e.preventDefault();
    if (!selectedDoctorForRequest) return;
    setSubmitting(true);

    try {
      await api.post('/api/patients/connection-requests', {
        doctor_id: selectedDoctorForRequest.doctor_id,
        request_note: requestNote.trim()
      });
      setFeedback({
        type: 'success',
        message: `Connection request sent to ${selectedDoctorForRequest.doctor_name}. The doctor will review your request.`
      });
      setSelectedDoctorForRequest(null);
      loadDermatologistData();
    } catch (err) {
      console.error('Connection request error:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to submit connection request.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getDoctorConnectionStatus = (doctorId) => {
    const conn = connections.find(c => c.doctor_id === doctorId);
    return conn ? conn.status : null;
  };

  const filteredDirectory = directory.filter(doc => {
    const q = searchQuery.toLowerCase();
    const name = (doc.doctor_name || '').toLowerCase();
    const hosp = (doc.hospital_name || '').toLowerCase();
    const spec = (doc.specialization || '').toLowerCase();
    return name.includes(q) || hosp.includes(q) || spec.includes(q);
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#0284c7" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading verified dermatologist profiles...</div>
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
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
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
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          backgroundColor: '#f0fdfa',
          border: '1px solid #ccfbf1',
          borderRadius: 20,
          fontSize: '0.75rem',
          color: '#0d9488',
          fontWeight: 600,
          marginBottom: 8
        }}>
          <ShieldCheck size={14} />
          <span>Patient-Doctor Medical Care Connectivity</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          My Dermatologist & Clinical Care Team
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Connect with licensed dermatologists, share your skin lesions and symptom records securely, and book verified clinical appointments.
        </p>
      </div>

      {/* Primary Connected Doctor Section */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Stethoscope size={20} color="#0d6efd" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Primary Connected Dermatologist
          </h2>
        </div>

        {connectedDoc ? (
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '20px 22px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.25rem'
                }}>
                  {connectedDoc.doctor_name ? connectedDoc.doctor_name[0] : 'D'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      {connectedDoc.doctor_name}
                    </h3>
                    <span style={{
                      fontSize: '0.725rem',
                      padding: '3px 8px',
                      borderRadius: 12,
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <CheckCircle2 size={12} />
                      <span>Connected & Verified</span>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
                    <strong>{connectedDoc.qualification || 'MD, Board Certified'}</strong> • {connectedDoc.specialization || 'Clinical Dermatology'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: '0.825rem', color: '#475569', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={15} color="#64748b" />
                      <span>{connectedDoc.hospital_name || 'Medical Center'}</span>
                    </div>
                    {connectedDoc.years_experience && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={15} color="#64748b" />
                        <span>{connectedDoc.years_experience} Years Experience</span>
                      </div>
                    )}
                  </div>

                  {connectedDoc.bio && (
                    <div style={{ fontSize: '0.825rem', color: '#334155', maxWidth: 650, backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      "{connectedDoc.bio}"
                    </div>
                  )}

                  {/* Next appointment indicator if exists */}
                  {connectedDoc.next_appointment && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      backgroundColor: '#eff6ff',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <CalendarDays size={18} color="#2563eb" />
                      <div style={{ fontSize: '0.825rem', color: '#1e40af' }}>
                        <strong>Next Consultation:</strong> {connectedDoc.next_appointment.date} @ {connectedDoc.next_appointment.time} ({connectedDoc.next_appointment.status})
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                <button
                  onClick={() => setActiveTab('appointments')}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#0d6efd',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <CalendarDays size={14} />
                  <span>Book Appointment</span>
                </button>

                <button
                  onClick={() => setActiveTab('consultations')}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <FileCheck size={14} />
                  <span>Consultation Records</span>
                </button>

                <button
                  onClick={() => setActiveTab('treatments')}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Pill size={14} />
                  <span>Active Regimens</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '36px 16px',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 10
          }}>
            <Stethoscope size={36} color="#94a3b8" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
              No Dermatologist Currently Connected
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 500, margin: '6px auto 16px' }}>
              You haven't established an active doctor-patient connection yet. Browse the verified clinical directory below to send a connection request.
            </p>
          </div>
        )}
      </div>

      {/* Directory of Verified Dermatologists */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Verified Dermatologists Directory ({directory.length})
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Select a certified specialist to share your longitudinal skin records
            </div>
          </div>

          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              placeholder="Search by name, hospital, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
            />
          </div>
        </div>

        {filteredDirectory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
            No dermatologists matched your search criteria.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16
          }}>
            {filteredDirectory.map(doc => {
              const status = getDoctorConnectionStatus(doc.doctor_id);
              const isAccepted = status === 'Accepted';
              const isRequested = status === 'Requested';
              const isRejected = status === 'Rejected';

              return (
                <div
                  key={doc.doctor_id}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                          {doc.doctor_name}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                          {doc.qualification} • {doc.specialization}
                        </div>
                      </div>

                      {isAccepted && (
                        <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 10, backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                          Connected
                        </span>
                      )}
                      {isRequested && (
                        <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 10, backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                          Request Pending
                        </span>
                      )}
                      {isRejected && (
                        <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 10, backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                          Declined
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Building2 size={13} color="#64748b" />
                        <span>{doc.hospital_name}</span>
                      </div>
                      {doc.years_experience && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} color="#64748b" />
                          <span>{doc.years_experience} Years Clinical Experience</span>
                        </div>
                      )}
                    </div>

                    {doc.bio && (
                      <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '6px 0 12px', fontStyle: 'italic', lineHeight: 1.35 }}>
                        "{doc.bio}"
                      </p>
                    )}
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    {isAccepted ? (
                      <button
                        onClick={() => setActiveTab('appointments')}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#0d6efd',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Book Appointment
                      </button>
                    ) : isRequested ? (
                      <button
                        disabled
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#e2e8f0',
                          color: '#64748b',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'not-allowed'
                        }}
                      >
                        Awaiting Doctor Review
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenRequestModal(doc)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#0d6efd',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <UserPlus size={14} />
                        <span>Connect with Doctor</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connection Requests History */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 26px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
          Connection Requests History
        </h2>

        {connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 14px', color: '#94a3b8', fontSize: '0.85rem' }}>
            No connection requests submitted yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {connections.map(c => (
              <div
                key={c.id}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                      {c.doctor_name || `Doctor #${c.doctor_id}`}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 600,
                      backgroundColor: c.status === 'Accepted' ? '#dcfce7' : c.status === 'Requested' ? '#fef3c7' : '#fee2e2',
                      color: c.status === 'Accepted' ? '#15803d' : c.status === 'Requested' ? '#b45309' : '#b91c1c'
                    }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Note: "{c.request_note}"
                  </div>
                  {c.response_note && (
                    <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: 2, fontStyle: 'italic' }}>
                      Doctor Response: "{c.response_note}"
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Send Connection Request */}
      {selectedDoctorForRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Request Doctor-Patient Connection
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Send an introduction note to <strong>{selectedDoctorForRequest.doctor_name}</strong> at {selectedDoctorForRequest.hospital_name}.
            </p>

            <form onSubmit={handleSubmitConnectionRequest}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Introduction & Primary Skin Concerns *
                </label>
                <textarea
                  rows={4}
                  required
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Describe your symptoms or reasons for connecting..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedDoctorForRequest(null)}
                  style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Sending...' : 'Send Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
