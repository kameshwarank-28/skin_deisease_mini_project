import React, { useState, useEffect } from 'react';
import {
  FolderHeart,
  Pill,
  CalendarDays,
  Bell,
  AlertTriangle,
  Stethoscope,
  Images,
  Plus,
  ScanSearch,
  Activity,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  UserCheck,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RotateCcw
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DashboardOverview({ setActiveTab, onSelectRecordForCompare }) {
  const [data, setData] = useState({
    stats: {
      records_count: 0,
      symptoms_count: 0,
      active_treatments_count: 0,
      upcoming_appointments_count: 0,
      unread_doctor_messages_count: 0
    },
    next_appointment: null,
    active_treatments: [],
    recent_records: [],
    connected_doctor: null,
    recent_medical_updates: []
  });
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals for appointment actions
  const [selectedRecordModal, setSelectedRecordModal] = useState(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ preferred_date: '', preferred_time: '10:00 AM', notes: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [overviewRes, notifRes, treatRes] = await Promise.all([
        api.get('/api/patients/overview-stats'),
        api.get('/api/notifications?unread_only=true'),
        api.get('/api/treatments').catch(() => ({ data: [] }))
      ]);

      const ovData = overviewRes.data || {};
      const fallbackTreats = (treatRes.data || []).filter(t => t.is_active && !t.treatment_status?.toUpperCase().includes('DISCONTINUED') && !t.treatment_status?.toUpperCase().includes('COMPLETED'));
      const activeTreats = (ovData.active_treatments && ovData.active_treatments.length > 0)
        ? ovData.active_treatments
        : fallbackTreats;

      setData({
        ...ovData,
        active_treatments: activeTreats,
        stats: {
          ...(ovData.stats || {}),
          active_treatments_count: activeTreats.length
        }
      });

      const notifications = notifRes.data || [];
      const urgent = notifications.filter(n => n.urgency === 'Urgent' || n.urgency === 'Warning');
      setUrgentAlerts(urgent);
    } catch (err) {
      console.error('Failed loading patient dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReschedule = async (e) => {
    e.preventDefault();
    if (!data.next_appointment) return;
    setActionLoading(true);
    try {
      await api.post(`/api/appointments/${data.next_appointment.id}/reschedule`, {
        suggested_date: rescheduleData.preferred_date,
        suggested_time: rescheduleData.preferred_time,
        preferred_date: rescheduleData.preferred_date,
        preferred_time: rescheduleData.preferred_time,
        notes: rescheduleData.notes || 'Patient requested alternate appointment slot.',
        reason: rescheduleData.notes || 'Patient requested alternate appointment slot.'
      });
      setFeedback({ type: 'success', message: 'Reschedule request submitted to your doctor.' });
      setRescheduleModalOpen(false);
      loadDashboardData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to submit reschedule request.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAppointment = async (e) => {
    e.preventDefault();
    if (!data.next_appointment) return;
    setActionLoading(true);
    try {
      await api.post(`/api/appointments/${data.next_appointment.id}/cancel`, {
        cancellation_reason: cancelReason || 'Patient cancelled.'
      });
      setFeedback({ type: 'success', message: 'Appointment has been cancelled.' });
      setCancelModalOpen(false);
      loadDashboardData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to cancel appointment.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptProposedTime = async () => {
    if (!data.next_appointment) return;
    setActionLoading(true);
    try {
      await api.post(`/api/appointments/${data.next_appointment.id}/patient-response`, {
        response: 'accept',
        accept_proposal: true,
        patient_notes: 'Patient accepted proposed alternate time.'
      });
      setFeedback({ type: 'success', message: 'Proposed time accepted and appointment confirmed!' });
      loadDashboardData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to accept proposal.' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
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
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading patient health overview...</div>
      </div>
    );
  }

  const { stats, next_appointment, recent_records, connected_doctor, recent_medical_updates, active_treatments = [] } = data;

  return (
    <div>
      {/* Clinical Safety Alert Banner */}
      {urgentAlerts.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fee2e2',
          borderLeft: '4px solid #ef4444',
          borderRadius: 8,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} color="#ef4444" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#991b1b' }}>
                Clinical Safety Advisory
              </div>
              <div style={{ fontSize: '0.825rem', color: '#7f1d1d' }}>
                {urgentAlerts[0].message}
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('notifications')}
            style={{
              padding: '6px 14px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Review Alerts ({urgentAlerts.length})
          </button>
        </div>
      )}

      {/* Feedback Toast Banner */}
      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          backgroundColor: feedback.type === 'success' ? '#EAF3FC' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#7CB0EA' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#1177DE' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          <div>{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Welcome & Patient Header */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            backgroundColor: '#EAF3FC',
            border: '1px solid #7CB0EA',
            borderRadius: 20,
            fontSize: '0.75rem',
            color: '#1177DE',
            fontWeight: 600,
            marginBottom: 8
          }}>
            <ShieldCheck size={14} />
            <span>Skin Health Longitudinal Monitor</span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#1177DE' }}>
            Patient Health Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Monitor dermatological lesions, synchronize consultation notes with your dermatologist, and follow active treatment schedules.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setActiveTab('diagnose')}
            style={{
              padding: '10px 18px',
              backgroundColor: '#1177DE',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 6px rgba(13, 110, 253, 0.3)'
            }}
          >
            <ScanSearch size={16} />
            <span>New AI Skin Scan</span>
          </button>
          <button
            onClick={() => setActiveTab('records')}
            style={{
              padding: '10px 16px',
              backgroundColor: '#EAF3FC',
              color: '#1177DE',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <FolderHeart size={16} />
            <span>Skin Records</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION A: SUMMARY CARDS (4 COMPACT CARDS)               */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: Total Skin Records */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          transition: 'transform 0.15s ease',
          cursor: 'pointer'
        }}
        onClick={() => setActiveTab('records')}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#EAF3FC',
            color: '#1177DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderHeart size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Skin Records
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1177DE', lineHeight: 1.2 }}>
              {stats.records_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1177DE', fontWeight: 500, marginTop: 2 }}>
              Documented Lesions &rarr;
            </div>
          </div>
        </div>

        {/* Card 2: Active Treatments */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          cursor: 'pointer'
        }}
        onClick={() => setActiveTab('treatments')}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#EAF3FC',
            color: '#1177DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Pill size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Active Treatments
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1177DE', lineHeight: 1.2 }}>
              {stats.active_treatments_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1177DE', fontWeight: 500, marginTop: 2 }}>
              Ongoing Regimens &rarr;
            </div>
          </div>
        </div>

        {/* Card 3: Upcoming Appointments */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          cursor: 'pointer'
        }}
        onClick={() => setActiveTab('appointments')}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#EAF3FC',
            color: '#1177DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarDays size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Appointments
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1177DE', lineHeight: 1.2 }}>
              {stats.upcoming_appointments_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1177DE', fontWeight: 500, marginTop: 2 }}>
              Scheduled Visits &rarr;
            </div>
          </div>
        </div>

        {/* Card 4: Unread Doctor Messages */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          cursor: 'pointer'
        }}
        onClick={() => setActiveTab('notifications')}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: stats.unread_doctor_messages_count > 0 ? '#fef3c7' : '#EAF3FC',
            color: stats.unread_doctor_messages_count > 0 ? '#d97706' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bell size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Notifications
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1177DE', lineHeight: 1.2 }}>
              {stats.unread_doctor_messages_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: stats.unread_doctor_messages_count > 0 ? '#d97706' : '#94a3b8', fontWeight: 500, marginTop: 2 }}>
              {stats.unread_doctor_messages_count > 0 ? 'Unread alerts' : 'No new alerts'}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION B: NEXT APPOINTMENT SPOTLIGHT CARD               */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#EAF3FC',
              color: '#1177DE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
                Next Clinical Appointment
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Dermatology Consultation Schedule
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('appointments')}
            style={{
              background: 'none',
              border: 'none',
              color: '#1177DE',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>All Appointments</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {next_appointment ? (
          <div style={{
            backgroundColor: '#EAF3FC',
            border: '1px solid #7CB0EA',
            borderRadius: 10,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1177DE' }}>
                    {next_appointment.doctor_name || 'Dr. Specialist'}
                  </span>
                  <span style={{
                    fontSize: '0.725rem',
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontWeight: 600,
                    backgroundColor: next_appointment.status.toLowerCase().includes('confirm') ? '#DCEAF8' :
                      next_appointment.status.toLowerCase().includes('pending') ? '#fef3c7' : '#e0f2fe',
                    color: next_appointment.status.toLowerCase().includes('confirm') ? '#1177DE' :
                      next_appointment.status.toLowerCase().includes('pending') ? '#b45309' : '#0369a1'
                  }}>
                    {next_appointment.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 10 }}>
                  {next_appointment.specialization || 'Clinical Dermatology'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: '0.875rem', color: '#1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} color="#1177DE" />
                    <strong>{formatDate(next_appointment.appointment_date)}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#1177DE" />
                    <span>{next_appointment.appointment_time || 'Scheduled Slot'}</span>
                  </div>
                </div>

                {next_appointment.purpose && (
                  <div style={{ marginTop: 10, fontSize: '0.825rem', color: '#475569' }}>
                    <strong style={{ color: '#1177DE' }}>Purpose / Reason:</strong> {next_appointment.purpose}
                  </div>
                )}

                {/* If Doctor suggested an alternate time */}
                {next_appointment.suggested_alternate_time && (
                  <div style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #7CB0EA',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1177DE' }}>
                        Doctor Suggested Alternate Slot:
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                        {next_appointment.suggested_alternate_time}
                      </div>
                    </div>
                    <button
                      onClick={handleAcceptProposedTime}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#1177DE',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.775rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Accept This Time
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons for Next Appointment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                <button
                  onClick={() => {
                    setRescheduleData({ preferred_date: '', preferred_time: '10:00 AM', notes: '' });
                    setRescheduleModalOpen(true);
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    color: '#1177DE',
                    border: '1px solid #1177DE',
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
                  <RotateCcw size={14} />
                  <span>Request Reschedule</span>
                </button>

                <button
                  onClick={() => {
                    setCancelReason('');
                    setCancelModalOpen(true);
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    color: '#ef4444',
                    border: '1px solid #fca5a5',
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
                  <XCircle size={14} />
                  <span>Cancel Visit</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '30px 16px',
            backgroundColor: '#EAF3FC',
            border: '1px dashed #7CB0EA',
            borderRadius: 10
          }}>
            <CalendarDays size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
              No Upcoming Appointments Scheduled
            </div>
            <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: 450, margin: '6px auto 14px' }}>
              Book an appointment with your connected dermatologist for periodic skin evaluations, treatment monitoring, and biopsy follow-ups.
            </p>
            <button
              onClick={() => setActiveTab('appointments')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10254C',
                color: '#ffffff',
                border: '1px solid #1177DE',
                borderRadius: 6,
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1177DE'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1177DE'}
            >
              + Book New Appointment
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION B2: DOCTOR-PRESCRIBED ACTIVE TREATMENT REGIMEN    */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#EAF3FC',
              color: '#1177DE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Pill size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
                Active Treatment & Regimen Schedule
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Verified dermatologist prescriptions, topical instructions & medication schedules
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {active_treatments && active_treatments.length > 0 && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 12,
                backgroundColor: '#DCEAF8',
                color: '#1177DE',
                border: '1px solid #7CB0EA'
              }}>
                {active_treatments.length} Active Regimen{active_treatments.length === 1 ? '' : 's'}
              </span>
            )}
            <button
              onClick={() => setActiveTab('treatments')}
              style={{
                background: 'none',
                border: 'none',
                color: '#1177DE',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>View All Treatments</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {active_treatments && active_treatments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {active_treatments.map((t, idx) => (
              <div
                key={t.id || idx}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#EAF3FC',
                  border: '1px solid #7CB0EA',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1177DE' }}>
                        {t.treatment_name}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 10,
                        backgroundColor: (t.treatment_status || '').toUpperCase().includes('ONGOING') ? '#DCEAF8' : '#EAF3FC',
                        color: (t.treatment_status || '').toUpperCase().includes('ONGOING') ? '#1177DE' : '#1177DE',
                        border: `1px solid ${(t.treatment_status || '').toUpperCase().includes('ONGOING') ? '#7CB0EA' : '#7CB0EA'}`
                      }}>
                        {t.treatment_status || 'Treatment Prescribed'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {t.prescribing_doctor_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Stethoscope size={14} color="#1177DE" />
                          <strong>Doctor:</strong> {t.prescribing_doctor_name.startsWith('Dr.') ? t.prescribing_doctor_name : `Dr. ${t.prescribing_doctor_name}`}
                        </span>
                      )}
                      {t.start_date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={14} color="#64748b" />
                          <strong>Started:</strong> {formatDate(t.start_date)}
                        </span>
                      )}
                      {t.review_date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309' }}>
                          <Clock size={14} color="#d97706" />
                          <strong>Review Milestone:</strong> {formatDate(t.review_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('treatments')}
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', gap: 6 }}
                  >
                    <span>Regimen Details</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  backgroundColor: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid #EAF3FC'
                }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Medication
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1177DE' }}>
                      {t.prescribed_medication || t.treatment_name}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Dosage & Instructions
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1177DE' }}>
                      {t.dosage_or_instructions || 'As prescribed by physician'}
                    </div>
                  </div>
                  {t.treatment_type && (
                    <div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Form / Modality
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1177DE' }}>
                        {t.treatment_type}
                      </div>
                    </div>
                  )}
                </div>

                {t.doctor_notes && (
                  <div style={{
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #DCEAF8',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: '0.825rem',
                    color: '#0F1E36'
                  }}>
                    <strong>Dermatologist Clinical Instructions:</strong> {t.doctor_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            backgroundColor: '#EAF3FC',
            borderRadius: 8,
            border: '1px dashed #7CB0EA'
          }}>
            <Pill size={32} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              No Active Treatment Plan Recorded
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: 440, margin: '0 auto 14px' }}>
              When your dermatologist prescribes topical medication, skincare regimens, or clinical treatment plans, they will automatically synchronize here.
            </div>
            <button
              onClick={() => setActiveTab('appointments')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10254C',
                color: '#ffffff',
                border: '1px solid #1177DE',
                borderRadius: 6,
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1177DE'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1177DE'}
            >
              Request Dermatologist Consultation
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION C: QUICK ACTIONS BAR                             */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '18px 24px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
          Quick Health Actions
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12
        }}>
          <button
            onClick={() => setActiveTab('diagnose')}
            style={{
              padding: '12px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'background 0.15s ease'
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#EAF3FC', color: '#1177DE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ScanSearch size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1177DE' }}>New AI Scan</div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Classify lesion</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            style={{
              padding: '12px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#EAF3FC', color: '#1177DE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderHeart size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1177DE' }}>Upload Record</div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Add skin photo</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('symptoms')}
            style={{
              padding: '12px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1177DE' }}>Record Symptoms</div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Track changes</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            style={{
              padding: '12px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#faf5ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1177DE' }}>Book Visit</div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Schedule slot</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('treatments')}
            style={{
              padding: '12px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#EAF3FC', color: '#1177DE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pill size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1177DE' }}>Treatments</div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Active prescriptions</div>
            </div>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION D & E: RECENT SKIN RECORDS & MY DERMATOLOGIST    */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
        gap: 24,
        marginBottom: 24
      }}>
        {/* Left: Section D - Recent 3 Skin Records */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
                Recent Skin Lesion Records
              </h3>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Latest photographed skin monitoring entries
              </div>
            </div>
            <button
              onClick={() => setActiveTab('records')}
              style={{ background: 'none', border: 'none', color: '#1177DE', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>View All Records</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {recent_records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', backgroundColor: '#EAF3FC', borderRadius: 8, border: '1px dashed #7CB0EA' }}>
              <FolderHeart size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>No Skin Records Uploaded Yet</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 12px' }}>
                Upload your first lesion photo or run an AI classification scan to start your tracking timeline.
              </div>
              <button
                onClick={() => setActiveTab('records')}
                style={{ padding: '6px 14px', backgroundColor: '#1177DE', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                + Upload Lesion Photo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {recent_records.map(rec => (
                <div
                  key={rec.id}
                  style={{
                    border: '1px solid #7CB0EA',
                    borderRadius: 10,
                    overflow: 'hidden',
                    backgroundColor: '#EAF3FC',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ height: 110, backgroundColor: '#7CB0EA', overflow: 'hidden', position: 'relative' }}>
                    {rec.image_filename ? (
                      <img
                        src={getImageUrl(rec.image_filename)}
                        alt={rec.body_location}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <Images size={28} />
                      </div>
                    )}
                    <span style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      color: '#ffffff',
                      fontSize: '0.675rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {rec.body_location || 'Skin Lesion'}
                    </span>
                  </div>

                  <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', marginBottom: 2 }}>
                        {formatDate(rec.capture_date)}
                      </div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1177DE', lineHeight: 1.25, marginBottom: 4 }}>
                        {rec.predicted_disease || 'Lesion Entry'}
                      </div>
                      {rec.confidence_score && (
                        <div style={{ fontSize: '0.7rem', color: '#1177DE', fontWeight: 600 }}>
                          AI Confidence: {Math.round(rec.confidence_score * 100)}%
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button
                        onClick={() => setSelectedRecordModal(rec)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #7CB0EA',
                          borderRadius: 4,
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: '#334155'
                        }}
                      >
                        Details
                      </button>
                      {onSelectRecordForCompare && (
                        <button
                          onClick={() => onSelectRecordForCompare(rec)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#EAF3FC',
                            border: '1px solid #7CB0EA',
                            borderRadius: 4,
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#1177DE'
                          }}
                          title="Compare with another image"
                        >
                          Compare
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Section E - My Dermatologist Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #7CB0EA',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stethoscope size={18} color="#1177DE" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
                  My Dermatologist
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('my_dermatologist')}
                style={{ background: 'none', border: 'none', color: '#1177DE', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Directory
              </button>
            </div>

            {connected_doctor ? (
              <div style={{
                backgroundColor: '#EAF3FC',
                border: '1px solid #7CB0EA',
                borderRadius: 10,
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#EAF3FC',
                    color: '#1177DE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem'
                  }}>
                    {connected_doctor.doctor_name ? connected_doctor.doctor_name[0] : 'D'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1177DE' }}>
                      {connected_doctor.doctor_name}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      {connected_doctor.qualification || 'Board Certified Dermatologist'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Building2 size={14} color="#64748b" />
                    <span>{connected_doctor.hospital_name || 'DermAI Clinical Center'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#1177DE" />
                    <span style={{ color: '#1177DE', fontWeight: 600 }}>Connected & Clinical Access Granted</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setActiveTab('consultations')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #7CB0EA',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#1177DE'
                    }}
                  >
                    Consultations
                  </button>
                  <button
                    onClick={() => setActiveTab('appointments')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      backgroundColor: '#1177DE',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Book Slot
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px 14px',
                backgroundColor: '#EAF3FC',
                border: '1px dashed #7CB0EA',
                borderRadius: 10
              }}>
                <UserCheck size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                  No Dermatologist Connected
                </div>
                <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '4px 0 14px' }}>
                  Connect with a verified clinician to share skin photos and receive doctor-prescribed treatment regimens.
                </p>
                <button
                  onClick={() => setActiveTab('my_dermatologist')}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#1177DE',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Find Dermatologist
                </button>
              </div>
            )}
          </div>

          <div style={{
            marginTop: 14,
            padding: '10px 12px',
            backgroundColor: '#EAF3FC',
            borderRadius: 6,
            fontSize: '0.75rem',
            color: '#475569'
          }}>
            <strong>Secure Access:</strong> Only connected dermatologists can access your lesion photos and symptoms.
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION F: RECENT MEDICAL UPDATES                        */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '22px 26px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
              Recent Clinical Updates
            </h3>
            <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
              Prescriptions, doctor consultations and clinical follow-up notes
            </div>
          </div>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{ background: 'none', border: 'none', color: '#1177DE', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>Full Health Timeline</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {recent_medical_updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 14px', color: '#94a3b8', fontSize: '0.85rem' }}>
            No recent medical updates logged yet. Clinical reports and prescriptions from your dermatologist will appear here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent_medical_updates.map((upd, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#EAF3FC',
                  border: '1px solid #7CB0EA',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      backgroundColor: upd.type.includes('Prescription') ? '#EAF3FC' : '#EAF3FC',
                      color: upd.type.includes('Prescription') ? '#1177DE' : '#1177DE'
                    }}>
                      {upd.type}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1177DE' }}>
                      {upd.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {upd.description}
                  </div>
                  {upd.details && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                      Note: "{upd.details}"
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {formatDate(upd.date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Inspection Modal */}
      {selectedRecordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#1177DE' }}>
                Skin Record Details
              </h3>
              <button
                onClick={() => setSelectedRecordModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ height: 240, backgroundColor: '#10254C', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
              <img
                src={getImageUrl(selectedRecordModal.image_filename)}
                alt={selectedRecordModal.body_location}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Body Location</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1177DE' }}>{selectedRecordModal.body_location}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Capture Date</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1177DE' }}>{formatDate(selectedRecordModal.capture_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>AI Prediction</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1177DE' }}>{selectedRecordModal.predicted_disease || 'None'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Confidence Score</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1177DE' }}>
                  {selectedRecordModal.confidence_score ? `${Math.round(selectedRecordModal.confidence_score * 100)}%` : 'N/A'}
                </div>
              </div>
            </div>

            {selectedRecordModal.user_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', marginBottom: 2 }}>Patient Notes</div>
                <div style={{ fontSize: '0.85rem', color: '#334155', backgroundColor: '#EAF3FC', padding: '8px 10px', borderRadius: 6 }}>
                  {selectedRecordModal.user_notes}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedRecordModal(null)}
                style={{ padding: '8px 16px', backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', borderRadius: 6, fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  const rec = selectedRecordModal;
                  setSelectedRecordModal(null);
                  if (onSelectRecordForCompare) onSelectRecordForCompare(rec);
                }}
                style={{ padding: '8px 16px', backgroundColor: '#1177DE', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Compare in Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 10px', color: '#1177DE' }}>
              Request Appointment Rescheduling
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Select your preferred alternate consultation date and slot. Your doctor will review and confirm.
            </p>

            <form onSubmit={handleRequestReschedule}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Preferred Date *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleData.preferred_date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_date: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Preferred Time Slot
                </label>
                <select
                  value={rescheduleData.preferred_time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_time: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA' }}
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:30 AM">11:30 AM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="03:30 PM">03:30 PM</option>
                  <option value="04:30 PM">04:30 PM</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Reason / Clinical Notes
                </label>
                <textarea
                  rows={3}
                  value={rescheduleData.notes}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, notes: e.target.value })}
                  placeholder="Reason for requesting alternate schedule..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', backgroundColor: '#1177DE', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {actionLoading ? 'Submitting...' : 'Submit Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 10px', color: '#991b1b' }}>
              Cancel Appointment
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Are you sure you want to cancel this scheduled appointment? Your doctor will be notified.
            </p>

            <form onSubmit={handleCancelAppointment}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Cancellation Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, symptoms resolved, etc."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #7CB0EA' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
