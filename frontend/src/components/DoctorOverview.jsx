import React, { useState, useEffect } from 'react';
import {
  Users,
  CalendarDays,
  Calendar,
  Clock,
  Pill,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Stethoscope,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Loader2
} from 'lucide-react';
import api from '../services/api';

export default function DoctorOverview({ setActiveTab, onSelectPatient }) {
  const [stats, setStats] = useState({
    total_patients: 0,
    pending_requests: 0,
    upcoming_appointments: 0,
    today_appointments: 0,
    pending_appointments: 0,
    total_treatments: 0
  });
  const [connections, setConnections] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [statsRes, connRes, apptRes] = await Promise.all([
        api.get('/api/doctors/overview-stats'),
        api.get('/api/doctors/connections'),
        api.get('/api/doctors/appointments')
      ]);

      setStats(statsRes.data || {
        total_patients: 0,
        pending_requests: 0,
        upcoming_appointments: 0,
        today_appointments: 0,
        pending_appointments: 0,
        total_treatments: 0
      });

      setConnections(connRes.data || []);
      setAppointments(apptRes.data || []);
    } catch (err) {
      console.error('Failed to load doctor overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionAction = async (connId, action) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      await api.post(`/api/doctors/connections/${connId}/action`, {
        action: action,
        response_note: action === 'accept'
          ? 'Connection accepted. You can now book appointments and share skin health records.'
          : 'Connection request declined at this time.'
      });
      setActionMessage({
        type: 'success',
        text: `Patient connection ${action === 'accept' ? 'accepted' : 'declined'} successfully.`
      });
      loadOverviewData();
    } catch (err) {
      console.error('Connection action error:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update connection request.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickAcceptAppointment = async (apptId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/doctors/appointments/${apptId}/action`, {
        action: 'accept',
        doctor_notes: 'Appointment confirmed. Please arrive 10 minutes prior.'
      });
      setActionMessage({
        type: 'success',
        text: 'Appointment confirmed successfully.'
      });
      loadOverviewData();
    } catch (err) {
      console.error('Accept appointment error:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to accept appointment.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isPendingStatus = (s) => {
    if (!s) return false;
    const val = s.toString().trim().toUpperCase();
    return ['PENDING', 'PENDING DOCTOR REVIEW', 'AWAITING_DOCTOR_REVIEW', 'SCHEDULED'].includes(val);
  };

  const pendingRequests = connections.filter(c => c.status === 'Requested');
  const pendingAppointmentsList = appointments.filter(a => isPendingStatus(a.status));

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={28} className="animate-spin" color="#0d6efd" />
        </div>
        <div>Loading clinical practice dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0b1329 0%, #172554 100%)',
        borderRadius: 12,
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 4px 14px rgba(11, 19, 41, 0.2)'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 20,
            fontSize: '0.75rem',
            color: '#38bdf8',
            fontWeight: 600,
            marginBottom: 8
          }}>
            <UserCheck size={14} />
            <span>Verified Dermatologist Dashboard</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: '#ffffff' }}>
            Clinical Decision & Patient Management Center
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', maxWidth: 650 }}>
            Review connected patient lesion records, manage consultation schedules, confirm appointments, and prescribe structured dermatological treatment regimens.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setActiveTab('doctor_patients')}
            style={{
              padding: '10px 18px',
              backgroundColor: '#0d6efd',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 6px rgba(13, 110, 253, 0.4)'
            }}
          >
            <Users size={16} />
            <span>Manage Patients</span>
          </button>
          <button
            onClick={() => setActiveTab('doctor_appointments')}
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <CalendarDays size={16} />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          backgroundColor: actionMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${actionMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: actionMessage.type === 'success' ? '#15803d' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{actionMessage.text}</div>
        </div>
      )}

      {/* 4 Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Connected Patients */}
        <div className="project-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#e0f2fe',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Connected Patients
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {stats.total_patients}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 2, cursor: 'pointer' }} onClick={() => setActiveTab('doctor_patients')}>
              View Directory &rarr;
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="project-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: stats.pending_requests > 0 ? '#fef3c7' : '#f1f5f9',
            color: stats.pending_requests > 0 ? '#d97706' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Patient Requests
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {stats.pending_requests}
            </div>
            <div style={{ fontSize: '0.75rem', color: stats.pending_requests > 0 ? '#d97706' : '#94a3b8', marginTop: 2 }}>
              {stats.pending_requests > 0 ? 'Requires your review' : 'No pending requests'}
            </div>
          </div>
        </div>

        {/* Pending Appointments */}
        <div className="project-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: stats.pending_appointments > 0 ? '#ede9fe' : '#f1f5f9',
            color: stats.pending_appointments > 0 ? '#7c3aed' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarDays size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Pending Appointments
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {stats.pending_appointments}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: 2, cursor: 'pointer' }} onClick={() => setActiveTab('doctor_appointments')}>
              Review requests &rarr;
            </div>
          </div>
        </div>

        {/* Active Treatments */}
        <div className="project-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#dcfce7',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Pill size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Prescribed Treatments
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {stats.total_treatments}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 2, cursor: 'pointer' }} onClick={() => setActiveTab('doctor_treatments')}>
              Manage Regimens &rarr;
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Pending Connection Requests & Upcoming Appointments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Pending Patient Connection Requests */}
        <div className="project-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Patient Connection Requests ({pendingRequests.length})
            </h3>
            <button
              onClick={() => setActiveTab('doctor_patients')}
              style={{ background: 'none', border: 'none', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              View All
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
              <CheckCircle2 size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>All caught up!</div>
              <div style={{ fontSize: '0.8rem' }}>No pending patient connection requests awaiting approval.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                      {req.patient_name || `Patient #${req.patient_id}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                      {req.request_note ? `Note: "${req.request_note}"` : 'Requested connection for skin consultation'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      Requested on: {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleConnectionAction(req.id, 'accept')}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#16a34a',
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
                      <CheckCircle2 size={13} />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleConnectionAction(req.id, 'reject')}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#ef4444',
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
                      <XCircle size={13} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Upcoming & Pending Appointments */}
        <div className="project-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Pending Appointments ({pendingAppointmentsList.length})
            </h3>
            <button
              onClick={() => setActiveTab('doctor_appointments')}
              style={{ background: 'none', border: 'none', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Full Schedule
            </button>
          </div>

          {pendingAppointmentsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
              <CalendarDays size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>No Pending Appointments</div>
              <div style={{ fontSize: '0.8rem' }}>Patients will appear here when they book a consultation slot.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingAppointmentsList.slice(0, 4).map(appt => (
                <div key={appt.id} style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                      {appt.patient_name || `Patient #${appt.patient_id}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#0d6efd', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      <span>{appt.appointment_date} {appt.appointment_time ? `@ ${appt.appointment_time}` : ''}</span>
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: 2 }}>
                      Reason: {appt.reason_for_visit}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className={
                      appt.status === 'Confirmed' ? 'badge-label badge-success-custom' :
                      appt.status === 'Pending Doctor Review' ? 'badge-label badge-warning-custom' :
                      'badge-label'
                    } style={{ fontSize: '0.7rem' }}>
                      {appt.status}
                    </span>

                    {appt.status === 'Pending Doctor Review' && (
                      <button
                        onClick={() => handleQuickAcceptAppointment(appt.id)}
                        disabled={actionLoading}
                        style={{
                          marginTop: 4,
                          padding: '4px 10px',
                          backgroundColor: '#0d6efd',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 5,
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

