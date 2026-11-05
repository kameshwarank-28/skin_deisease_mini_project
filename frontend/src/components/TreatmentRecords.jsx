import React, { useState, useEffect } from 'react';
import {
  Pill,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building,
  AlertCircle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Activity,
  CalendarDays,
  ShieldAlert,
  Info,
  Lock,
  FileText
} from 'lucide-react';
import api from '../services/api';

export default function TreatmentRecords({ setActiveTab }) {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'discontinued'
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/treatments');
      setTreatments(res.data || []);
    } catch (err) {
      console.error('Failed to load patient treatments:', err);
      setError(err.response?.data?.detail || 'Unable to load your treatment records. Please refresh or try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return null;
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return String(dateVal);
    }
  };

  const getStatusBadge = (status, isActive) => {
    const s = (status || '').toUpperCase();

    if (s.includes('DISCONTINUED')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fecaca'
        }}>
          <XCircle size={12} /> Discontinued by Treating Doctor
        </span>
      );
    }

    if (s.includes('COMPLETED')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: '#EAF3FC',
          color: '#475569',
          border: '1px solid #7CB0EA'
        }}>
          <CheckCircle size={12} /> Completed
        </span>
      );
    }

    if (s.includes('REVIEW')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: '#fef3c7',
          color: '#b45309',
          border: '1px solid #fde68a'
        }}>
          <Clock size={12} /> Review Required
        </span>
      );
    }

    if (s.includes('ONGOING')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: '#DCEAF8',
          color: '#1177DE',
          border: '1px solid #7CB0EA'
        }}>
          <Activity size={12} /> Treatment Ongoing
        </span>
      );
    }

    // Default to Prescribed
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: '0.75rem',
        fontWeight: 700,
        backgroundColor: '#EAF3FC',
        color: '#1177DE',
        border: '1px solid #7CB0EA'
      }}>
        <FileText size={12} /> Treatment Prescribed
      </span>
    );
  };

  const filteredTreatments = treatments.filter(t => {
    if (filter === 'all') return true;
    const s = (t.treatment_status || '').toUpperCase();
    if (filter === 'active') {
      return t.is_active && !s.includes('COMPLETED') && !s.includes('DISCONTINUED');
    }
    if (filter === 'completed') {
      return s.includes('COMPLETED');
    }
    if (filter === 'discontinued') {
      return s.includes('DISCONTINUED');
    }
    return true;
  });

  const activeCount = treatments.filter(t => {
    const s = (t.treatment_status || '').toUpperCase();
    return t.is_active && !s.includes('COMPLETED') && !s.includes('DISCONTINUED');
  }).length;
  const completedCount = treatments.filter(t => (t.treatment_status || '').toUpperCase().includes('COMPLETED')).length;
  const discontinuedCount = treatments.filter(t => (t.treatment_status || '').toUpperCase().includes('DISCONTINUED')).length;

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: 0 }}>
              Dermatological Treatment & Regimen Monitoring
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              backgroundColor: '#EAF3FC',
              color: '#1177DE',
              borderRadius: 12,
              fontSize: '0.725rem',
              fontWeight: 600,
              border: '1px solid #7CB0EA'
            }}>
              <Lock size={12} />
              <span>Verified Doctor Prescriptions (Read-Only)</span>
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Review official dermatologist-prescribed regimens, active medication dosages, schedule instructions, and clinical progress.
          </p>
        </div>

        <button
          onClick={fetchTreatments}
          disabled={loading}
          style={{
            padding: '7px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #7CB0EA',
            borderRadius: 6,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title="Refresh treatment records"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All Treatments (${treatments.length})` },
          { key: 'active', label: `Active Regimens (${activeCount})` },
          { key: 'completed', label: `Completed (${completedCount})` },
          { key: 'discontinued', label: `Discontinued (${discontinuedCount})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: filter === tab.key ? '1px solid #1177DE' : '1px solid #7CB0EA',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: filter === tab.key ? '#EAF3FC' : '#ffffff',
              color: filter === tab.key ? '#1177DE' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
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

      {/* Treatments List */}
      {loading ? (
        <div className="project-card" style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <RefreshCw size={26} className="animate-spin" color="#1177DE" />
          </div>
          <div style={{ fontWeight: 600, color: '#334155' }}>Loading prescribed treatments...</div>
        </div>
      ) : filteredTreatments.length === 0 ? (
        /* Empty State */
        <div className="project-card" style={{ textAlign: 'center', padding: '50px 24px', color: '#64748b' }}>
          <Pill size={42} style={{ color: '#7CB0EA', marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1177DE', margin: '0 0 6px' }}>
            No treatment plan has been recorded by your dermatologist.
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.5 }}>
            When your treating dermatologist prescribes a clinical treatment regimen, medication schedule, or topical care plan, it will be synchronized here for your monitoring.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {setActiveTab && (
              <>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="btn-submit"
                  style={{ fontSize: '0.825rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CalendarDays size={14} />
                  <span>Request Doctor Consultation</span>
                </button>
                <button
                  onClick={() => setActiveTab('symptoms')}
                  className="btn-outline"
                  style={{ fontSize: '0.825rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Activity size={14} />
                  <span>Report Symptoms</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredTreatments.map(t => {
            return (
              <div
                key={t.id}
                className="project-card"
                style={{
                  padding: '22px 24px',
                  borderLeft: `4px solid ${
                    (t.treatment_status || '').toUpperCase().includes('DISCONTINUED') ? '#ef4444' :
                    (t.treatment_status || '').toUpperCase().includes('COMPLETED') ? '#64748b' :
                    (t.treatment_status || '').toUpperCase().includes('REVIEW') ? '#f59e0b' : '#1177DE'
                  }`
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1177DE', margin: 0 }}>
                        {t.treatment_name}
                      </h3>
                      {getStatusBadge(t.treatment_status, t.is_active)}
                    </div>

                    {/* Prescribing Doctor Information */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.825rem', color: '#475569' }}>
                      <Stethoscope size={14} style={{ color: '#1177DE' }} />
                      <span>
                        Prescribed by: <strong>{t.prescribing_doctor_name || 'Treating Dermatologist'}</strong>
                      </span>
                      {t.prescribing_doctor_qualification && (
                        <span style={{ color: '#64748b' }}>
                          ({t.prescribing_doctor_qualification}{t.prescribing_doctor_specialization ? ` • ${t.prescribing_doctor_specialization}` : ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Classification Type Tag */}
                  <span style={{
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #7CB0EA',
                    color: '#334155',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {t.treatment_type || 'Topical Regimen'}
                  </span>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  padding: '14px 16px',
                  backgroundColor: '#EAF3FC',
                  borderRadius: 8,
                  border: '1px solid #7CB0EA',
                  marginBottom: 14
                }}>
                  {/* Prescribed Medication */}
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                      Prescribed Medication
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1177DE' }}>
                      {t.prescribed_medication || t.treatment_name}
                    </div>
                  </div>

                  {/* Dosage & Application Instructions */}
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                      Prescribed Dosage & Instructions
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e40af' }}>
                      {t.dosage_or_instructions || 'As instructed by doctor'}
                    </div>
                  </div>

                  {/* Treatment Start & Review Dates */}
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                      Regimen Duration & Review
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#1177DE', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} style={{ color: '#1177DE' }} />
                      <span>Start: <strong>{formatDate(t.start_date)}</strong></span>
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: 2 }}>
                      Review: {formatDate(t.review_date || t.end_date) || 'Ongoing regular evaluation'}
                    </div>
                  </div>

                  {/* Follow-up Appointment */}
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                      Clinical Follow-up
                    </div>
                    {t.follow_up_appointment_date ? (
                      <div style={{ fontSize: '0.825rem', color: '#1177DE', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={13} />
                        <span>{formatDate(t.follow_up_appointment_date)} {t.follow_up_appointment_time ? `@ ${t.follow_up_appointment_time}` : ''}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                        No follow-up visit scheduled
                      </div>
                    )}
                  </div>
                </div>

                {/* Doctor's Clinical Instructions Box */}
                {(t.doctor_notes || t.notes) && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    fontSize: '0.825rem',
                    color: '#1e40af',
                    marginBottom: 14
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={14} color="#1177DE" />
                      <strong>Dermatologist Instructions & Notes:</strong>
                    </div>
                    <div style={{ marginTop: 2, color: '#1e3a8a', fontStyle: 'italic' }}>
                      "{t.doctor_notes || t.notes}"
                    </div>
                  </div>
                )}

                {/* Patient Monitoring Actions Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  paddingTop: 10,
                  borderTop: '1px solid #EAF3FC'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Prescribed on {formatDate(t.created_at || t.start_date)} • Official Medical Record
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {setActiveTab && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab('symptoms')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ffffff',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Report any side effects or symptom changes"
                        >
                          <Activity size={13} />
                          <span>Report Symptoms / Side Effects</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('appointments')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1177DE',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Request a follow-up consultation with doctor"
                        >
                          <CalendarDays size={13} />
                          <span>Request Consultation</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
