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
  AlertTriangle,
  ArrowRight,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  FolderHeart,
  Activity,
  Plus,
  Loader2,
  FileCheck,
  Eye,
  MessageSquare,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';

export default function DoctorOverview({ setActiveTab, onSelectPatient }) {
  const [data, setData] = useState({
    doctor_name: 'Dr. Dermatologist',
    doctor_id: 0,
    qualification: '',
    specialization: '',
    hospital_name: '',
    verification_status: 'Verified',
    stats: {
      total_connected_patients: 0,
      pending_patient_requests: 0,
      pending_appointments: 0,
      active_treatment_plans: 0,
      today_appointments: 0
    },
    today_appointments: [],
    pending_appointments_list: [],
    pending_connections_list: [],
    recent_activity: [],
    calendar_events: []
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Calendar State
  const [calendarView, setCalendarView] = useState('month'); // 'month' | 'week' | 'day'
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedAppointmentModal, setSelectedAppointmentModal] = useState(null);

  // Appointment Action Modals
  const [actionModal, setActionModal] = useState(null); // { type: 'accept'|'reject'|'reschedule', appt }
  const [actionFormData, setActionFormData] = useState({
    doctorNotes: '',
    rejectionReason: '',
    suggestedDate: '',
    suggestedTime: '10:00 AM'
  });

  // Connection Request Details Modal
  const [selectedConnectionModal, setSelectedConnectionModal] = useState(null);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/overview-stats');
      setData(res.data || {
        doctor_name: 'Dr. Dermatologist',
        doctor_id: 0,
        qualification: '',
        specialization: '',
        hospital_name: '',
        verification_status: 'Verified',
        stats: {
          total_connected_patients: 0,
          pending_patient_requests: 0,
          pending_appointments: 0,
          active_treatment_plans: 0,
          today_appointments: 0
        },
        today_appointments: [],
        pending_appointments_list: [],
        pending_connections_list: [],
        recent_activity: [],
        calendar_events: []
      });
    } catch (err) {
      console.error('Failed to load doctor overview stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // APPOINTMENT ACTIONS (Accept / Reject / Reschedule)
  // ==========================================
  const openAppointmentAction = (type, appt) => {
    let defDate = '';
    if (appt.requested_date) {
      defDate = appt.requested_date;
    } else if (appt.appointment_date) {
      try {
        defDate = new Date(appt.appointment_date).toISOString().slice(0, 10);
      } catch (e) {
        defDate = '';
      }
    }
    setActionModal({ type, appt });
    setActionFormData({
      doctorNotes: type === 'accept' ? 'Appointment confirmed. Please arrive 10 minutes prior.' : '',
      rejectionReason: '',
      suggestedDate: defDate,
      suggestedTime: appt.requested_time || appt.appointment_time || '10:00 AM'
    });
  };

  const handleAppointmentActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    const { type, appt } = actionModal;
    setActionLoading(true);

    try {
      if (type === 'accept') {
        await api.post(`/api/doctors/appointments/${appt.id}/action`, {
          action: 'accept',
          doctor_notes: actionFormData.doctorNotes || 'Appointment confirmed.'
        });
        setFeedback({ type: 'success', message: `Appointment with ${appt.patient_name} accepted and confirmed.` });
      } else if (type === 'reject') {
        if (!actionFormData.rejectionReason.trim()) {
          alert('Please specify a rejection reason.');
          setActionLoading(false);
          return;
        }
        await api.post(`/api/doctors/appointments/${appt.id}/action`, {
          action: 'reject',
          rejection_reason: actionFormData.rejectionReason.trim()
        });
        setFeedback({ type: 'success', message: `Appointment request declined. Patient notified.` });
      } else if (type === 'reschedule') {
        if (!actionFormData.suggestedDate) {
          alert('Please select a suggested alternate date.');
          setActionLoading(false);
          return;
        }
        await api.post(`/api/doctors/appointments/${appt.id}/action`, {
          action: 'reschedule',
          suggested_date: actionFormData.suggestedDate,
          suggested_time: actionFormData.suggestedTime,
          doctor_notes: actionFormData.doctorNotes || 'Doctor proposed an alternate appointment slot.'
        });
        setFeedback({ type: 'success', message: `Proposed alternate time sent to patient for approval.` });
      }

      setActionModal(null);
      setSelectedAppointmentModal(null);
      loadOverviewData();
    } catch (err) {
      console.error('Appointment action failed:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to complete appointment action.' });
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // CONNECTION ACTIONS (Accept / Reject)
  // ==========================================
  const handleConnectionAction = async (connId, action) => {
    setActionLoading(true);
    try {
      await api.post(`/api/doctors/connections/${connId}/action`, {
        action: action,
        response_note: action === 'accept'
          ? 'Connection accepted. Clinical records and appointments enabled.'
          : 'Connection request declined.'
      });
      setFeedback({
        type: 'success',
        message: `Patient connection request ${action === 'accept' ? 'accepted' : 'declined'} successfully.`
      });
      setSelectedConnectionModal(null);
      loadOverviewData();
    } catch (err) {
      console.error('Connection action error:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to update connection request.' });
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // CALENDAR COMPUTATION HELPERS
  // ==========================================
  const changeMonth = (offset) => {
    setCurrentCalendarDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + offset);
      return d;
    });
  };

  const getDaysInMonth = (year, month) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Group calendar events by date string (YYYY-MM-DD)
  const eventsByDate = {};
  (data.calendar_events || []).forEach(evt => {
    const dStr = evt.date;
    if (!eventsByDate[dStr]) eventsByDate[dStr] = [];
    eventsByDate[dStr].push(evt);
  });

  // Check double-booking collisions
  const hasDoubleBooking = (evts) => {
    if (!evts || evts.length < 2) return false;
    const timeSlots = evts.map(e => e.time);
    return new Set(timeSlots).size !== timeSlots.length;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#0284c7" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading clinical practice overview...</div>
      </div>
    );
  }

  const { stats, today_appointments, pending_appointments_list, pending_connections_list, recent_activity } = data;

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

      {/* Doctor Clinical Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
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
            backgroundColor: '#f0fdfa',
            border: '1px solid #ccfbf1',
            borderRadius: 20,
            fontSize: '0.75rem',
            color: '#0d9488',
            fontWeight: 600,
            marginBottom: 8
          }}>
            <ShieldCheck size={14} />
            <span>Clinical Practice & Decision Support</span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
            {data.doctor_name}
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            {data.specialization || 'Clinical Dermatology'} • {data.hospital_name || 'DermAI Medical Center'} ({data.qualification || 'MD'})
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
              boxShadow: '0 2px 6px rgba(13, 110, 253, 0.3)'
            }}
          >
            <Users size={16} />
            <span>My Patients</span>
          </button>
          <button
            onClick={() => setActiveTab('doctor_appointments')}
            style={{
              padding: '10px 16px',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
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
            <span>Appointments</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION A: SUBTLE PASTEL GRADIENT STATISTIC CARDS        */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: Connected Patients (Pastel Sky/Blue) */}
        <div
          onClick={() => setActiveTab('doctor_patients')}
          style={{
            background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            borderRadius: 12,
            border: '1px solid #7dd3fc',
            padding: '20px 22px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 120
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Connected Patients
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.7)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1 }}>
              {stats.total_connected_patients}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, marginTop: 4 }}>
              Active Authorized Patients &rarr;
            </div>
          </div>
        </div>

        {/* Card 2: Pending Patient Requests (Pastel Amber) */}
        <div
          onClick={() => setActiveTab('doctor_requests')}
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: 12,
            border: '1px solid #fcd34d',
            padding: '20px 22px',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 120
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Patient Requests
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.7)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#78350f', lineHeight: 1.1 }}>
              {stats.pending_patient_requests}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, marginTop: 4 }}>
              {stats.pending_patient_requests > 0 ? 'Requires Your Review &rarr;' : 'Up to Date'}
            </div>
          </div>
        </div>

        {/* Card 3: Pending Appointments (Pastel Lavender) */}
        <div
          onClick={() => setActiveTab('doctor_appointments')}
          style={{
            background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
            borderRadius: 12,
            border: '1px solid #c4b5fd',
            padding: '20px 22px',
            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 120
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Pending Appointments
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.7)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#4c1d95', lineHeight: 1.1 }}>
              {stats.pending_appointments}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5b21b6', fontWeight: 600, marginTop: 4 }}>
              {stats.pending_appointments > 0 ? 'Action Required &rarr;' : 'All Slots Confirmed'}
            </div>
          </div>
        </div>

        {/* Card 4: Active Treatment Plans (Pastel Mint) */}
        <div
          onClick={() => setActiveTab('doctor_treatments')}
          style={{
            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            borderRadius: 12,
            border: '1px solid #6ee7b7',
            padding: '20px 22px',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 120
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Active Treatments
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.7)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pill size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#064e3b', lineHeight: 1.1 }}>
              {stats.active_treatment_plans}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600, marginTop: 4 }}>
              Prescribed Regimens &rarr;
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION B: INTERACTIVE APPOINTMENT CALENDAR              */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {/* Calendar Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {monthNames[month]} {year}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Clinical Appointment & Follow-up Schedule
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 }}>
              {['month', 'week', 'day'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v)}
                  style={{
                    padding: '5px 12px',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: calendarView === v ? '#ffffff' : 'transparent',
                    color: calendarView === v ? '#0f172a' : '#64748b',
                    boxShadow: calendarView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Prev / Next / Today */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => changeMonth(-1)}
                style={{ padding: '6px 10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentCalendarDate(new Date())}
                style={{ padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Today
              </button>
              <button
                onClick={() => changeMonth(1)}
                style={{ padding: '6px 10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid (Month View) */}
        {calendarView === 'month' && (
          <div>
            {/* Weekday Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6, textAlign: 'center' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', padding: '6px 0' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {/* Padding empty slots for first day of week */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} style={{ minHeight: 90, backgroundColor: '#f8fafc', borderRadius: 8, opacity: 0.4 }} />
              ))}

              {daysInMonth.map(dayDate => {
                const dayNum = dayDate.getDate();
                const dStr = dayDate.toISOString().slice(0, 10);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                const evts = eventsByDate[dStr] || [];
                const doubleBooked = hasDoubleBooking(evts);

                return (
                  <div
                    key={dStr}
                    style={{
                      minHeight: 90,
                      backgroundColor: isToday ? '#f0f9ff' : '#ffffff',
                      border: isToday ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? '#0284c7' : '#0f172a',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? '#e0f2fe' : 'transparent'
                      }}>
                        {dayNum}
                      </span>
                      {doubleBooked && (
                        <span title="Double-booking alert! Two appointments at the same slot." style={{ color: '#dc2626' }}>
                          <AlertTriangle size={13} />
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 60 }}>
                      {evts.map(evt => {
                        const isConf = evt.status?.toLowerCase().includes('confirm');
                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedAppointmentModal(evt)}
                            style={{
                              padding: '2px 5px',
                              borderRadius: 4,
                              fontSize: '0.675rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              backgroundColor: isConf ? '#dcfce7' : '#fef3c7',
                              color: isConf ? '#15803d' : '#b45309',
                              border: `1px solid ${isConf ? '#bbf7d0' : '#fde68a'}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={`${evt.patient_name} (${evt.time}) - Click for details`}
                          >
                            {evt.time}: {evt.patient_name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week / Day View Placeholder representation */}
        {calendarView !== 'month' && (
          <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
              Showing {calendarView.toUpperCase()} Agenda View
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
              {(data.calendar_events || []).length} scheduled appointments in clinical system.
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500, margin: '14px auto 0' }}>
              {(data.calendar_events || []).slice(0, 5).map(evt => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedAppointmentModal(evt)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{evt.patient_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{evt.purpose}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0d6efd' }}>{evt.date} @ {evt.time}</div>
                    <span style={{ fontSize: '0.675rem', padding: '1px 6px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#16a34a' }}>
                      {evt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION C & SECTION F: TODAY'S SCHEDULE & QUICK ACTIONS  */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
        gap: 24,
        marginBottom: 24
      }}>
        {/* Section C: Today's Schedule */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="#0d6efd" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Today's Schedule ({today_appointments.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('doctor_appointments')}
              style={{ background: 'none', border: 'none', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Full Schedule
            </button>
          </div>

          {today_appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <CalendarDays size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>No Appointments Scheduled for Today</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                Consultations and follow-ups booked for today will appear here chronologically.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {today_appointments.map(appt => (
                <div
                  key={appt.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {appt.patient_name}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, backgroundColor: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                        {appt.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#0d6efd', fontWeight: 600, marginTop: 2 }}>
                      Slot: {appt.time} • {appt.consultation_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                      Concern: {appt.purpose}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectPatient) onSelectPatient(appt.patient_id);
                      setActiveTab('doctor_patients');
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#0f172a'
                    }}
                  >
                    View Patient
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section F: Quick Clinical Actions */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
              Clinical Management Shortcuts
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setActiveTab('doctor_patients')}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Manage Patients</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>View dossiers & medical history</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('doctor_records')}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderHeart size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Patient Skin Records</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Review lesion photos & Grad-CAM</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('doctor_consultations')}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#fdf4ff', color: '#c026d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stethoscope size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Document Consultation</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Clinical notes & official diagnosis</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('doctor_treatments')}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pill size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Prescribe Regimen</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Structured treatments & dosage</div>
                </div>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: '10px 12px', backgroundColor: '#f1f5f9', borderRadius: 6, fontSize: '0.75rem', color: '#475569' }}>
            <strong>Protected Records:</strong> Clinician entries are cryptographically stamped with your Doctor ID.
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION D: PENDING APPOINTMENT REQUESTS                  */}
      {/* ======================================================== */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 26px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Pending Appointment Requests ({pending_appointments_list.length})
            </h3>
            <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
              Awaiting your clinical review and scheduling response
            </div>
          </div>
          <button
            onClick={() => setActiveTab('doctor_appointments')}
            style={{ background: 'none', border: 'none', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Manage All Appointments
          </button>
        </div>

        {pending_appointments_list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
            No pending appointment requests. All incoming consultation requests have been processed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending_appointments_list.map(appt => (
              <div
                key={appt.id}
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                      {appt.patient_name}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
                      {appt.patient_code}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                      {appt.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8rem', color: '#334155', marginBottom: 4 }}>
                    <span><strong>Requested:</strong> {appt.requested_date} @ {appt.requested_time}</span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span>Received: {appt.request_created_at}</span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>Concern:</strong> {appt.reason}
                  </div>
                </div>

                {/* Direct Action Buttons for Appointment */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openAppointmentAction('accept', appt)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Accept</span>
                  </button>

                  <button
                    onClick={() => openAppointmentAction('reject', appt)}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => openAppointmentAction('reschedule', appt)}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: '#ffffff',
                      color: '#0d6efd',
                      border: '1px solid #0d6efd',
                      borderRadius: 6,
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Suggest New Time</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION E & SECTION G: CONNECTION REQUESTS & ACTIVITY   */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: 24,
        marginBottom: 24
      }}>
        {/* Section E: Patient Connection Requests */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Patient Connection Requests ({pending_connections_list.length})
              </h3>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Accepting grants clinical access to patient lesion scans
              </div>
            </div>
            <button
              onClick={() => setActiveTab('doctor_requests')}
              style={{ background: 'none', border: 'none', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              All Requests
            </button>
          </div>

          {pending_connections_list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
              No pending patient connection requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending_connections_list.map(conn => (
                <div
                  key={conn.id}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      {conn.patient_name} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>({conn.gender}, {conn.age} yrs)</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                      Note: "{conn.request_note}"
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      Requested: {conn.request_date}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleConnectionAction(conn.id, 'accept')}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Accept Connection
                    </button>
                    <button
                      onClick={() => handleConnectionAction(conn.id, 'reject')}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#ffffff',
                        color: '#ef4444',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section G: Live Patient Activity Stream */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Recent Patient Activity
              </h3>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Real-time updates from authorized patients
              </div>
            </div>
          </div>

          {recent_activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
              No recent patient activity logged. Once connected patients upload photos or log symptoms, they will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent_activity.map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: act.type.includes('Skin') ? '#f0fdfa' : '#fef2f2',
                      color: act.type.includes('Skin') ? '#0d9488' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {act.type.includes('Skin') ? <FolderHeart size={16} /> : <Activity size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.825rem', color: '#0f172a' }}>
                        {act.patient_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {act.description}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {act.time_display}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: APPOINTMENT DETAILS & DIRECT ACTIONS              */}
      {/* ======================================================== */}
      {selectedAppointmentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Appointment Details
              </h3>
              <button
                onClick={() => setSelectedAppointmentModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                {selectedAppointmentModal.patient_name}
              </div>
              <div style={{ fontSize: '0.825rem', color: '#0d6efd', fontWeight: 600, marginBottom: 8 }}>
                {selectedAppointmentModal.date} @ {selectedAppointmentModal.time}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>
                <strong>Reason:</strong> {selectedAppointmentModal.purpose}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                <strong>Status:</strong> {selectedAppointmentModal.status}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSelectedAppointmentModal(null);
                  openAppointmentAction('accept', selectedAppointmentModal);
                }}
                style={{ padding: '8px 14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setSelectedAppointmentModal(null);
                  openAppointmentAction('reschedule', selectedAppointmentModal);
                }}
                style={{ padding: '8px 14px', backgroundColor: '#0d6efd', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Suggest New Time
              </button>
              <button
                onClick={() => {
                  setSelectedAppointmentModal(null);
                  openAppointmentAction('reject', selectedAppointmentModal);
                }}
                style={{ padding: '8px 14px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedAppointmentModal(null)}
                style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ACCEPT / REJECT / RESCHEDULE FORM                 */}
      {/* ======================================================== */}
      {actionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>
              {actionModal.type === 'accept' && 'Confirm Appointment Acceptance'}
              {actionModal.type === 'reject' && 'Decline Appointment'}
              {actionModal.type === 'reschedule' && 'Propose Alternate Appointment Slot'}
            </h3>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Patient: <strong>{actionModal.appt.patient_name}</strong>
            </p>

            <form onSubmit={handleAppointmentActionSubmit}>
              {actionModal.type === 'accept' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Confirmation Message / Instructions for Patient
                  </label>
                  <textarea
                    rows={3}
                    value={actionFormData.doctorNotes}
                    onChange={(e) => setActionFormData({ ...actionFormData, doctorNotes: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {actionModal.type === 'reject' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Reason for Declining *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Schedule fully booked, requires urgent in-person ER evaluation, etc."
                    value={actionFormData.rejectionReason}
                    onChange={(e) => setActionFormData({ ...actionFormData, rejectionReason: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {actionModal.type === 'reschedule' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Proposed Alternate Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={actionFormData.suggestedDate}
                      onChange={(e) => setActionFormData({ ...actionFormData, suggestedDate: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Proposed Slot *
                    </label>
                    <select
                      value={actionFormData.suggestedTime}
                      onChange={(e) => setActionFormData({ ...actionFormData, suggestedTime: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
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
                      Note to Patient
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Doctor note regarding reason for suggested time..."
                      value={actionFormData.doctorNotes}
                      onChange={(e) => setActionFormData({ ...actionFormData, doctorNotes: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: actionModal.type === 'reject' ? '#ef4444' : actionModal.type === 'accept' ? '#16a34a' : '#0d6efd',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
