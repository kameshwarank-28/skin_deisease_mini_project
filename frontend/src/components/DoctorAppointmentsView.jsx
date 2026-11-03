import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Check,
  FileText
} from 'lucide-react';
import api from '../services/api';

export default function DoctorAppointmentsView() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'rescheduled' | 'completed' | 'rejected' | 'cancelled'
  const [actionModal, setActionModal] = useState(null); // { type: 'accept'|'reject'|'reschedule'|'complete'|'cancel', appt }
  const [formData, setFormData] = useState({
    doctorNotes: '',
    rejectionReason: '',
    suggestedDate: '',
    suggestedTime: '10:00 AM',
    error: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/appointments');
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusKey = (s) => {
    if (!s) return 'pending';
    const val = s.toString().trim().toUpperCase();
    if (['PENDING', 'PENDING DOCTOR REVIEW', 'AWAITING_DOCTOR_REVIEW', 'SCHEDULED'].includes(val)) return 'pending';
    if (['CONFIRMED', 'ACCEPTED'].includes(val)) return 'confirmed';
    if (['RESCHEDULED', 'RESCHEDULED BY DOCTOR', 'AWAITING_PATIENT_CONFIRMATION'].includes(val)) return 'rescheduled';
    if (['COMPLETED'].includes(val)) return 'completed';
    if (['REJECTED', 'DECLINED'].includes(val)) return 'rejected';
    if (['CANCELLED'].includes(val)) return 'cancelled';
    return 'other';
  };

  const isPending = (s) => getStatusKey(s) === 'pending';
  const isConfirmed = (s) => getStatusKey(s) === 'confirmed';
  const isAwaiting = (s) => getStatusKey(s) === 'rescheduled';
  const isCompleted = (s) => getStatusKey(s) === 'completed';
  const isRejected = (s) => getStatusKey(s) === 'rejected';
  const isCancelled = (s) => getStatusKey(s) === 'cancelled';

  const formatAppointmentDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return String(dateVal);
    }
  };

  const formatAppointmentTime = (timeVal, dateVal) => {
    if (timeVal) return timeVal;
    if (!dateVal) return 'General Slot';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'General Slot';
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'General Slot';
    }
  };

  const openActionModal = (type, appt) => {
    let defaultDate = '';
    if (appt.appointment_date) {
      try {
        const d = new Date(appt.appointment_date);
        defaultDate = d.toISOString().slice(0, 10);
      } catch (e) {
        defaultDate = '';
      }
    }
    setActionModal({ type, appt });
    setFormData({
      doctorNotes: type === 'accept'
        ? 'Appointment confirmed. Please arrive 10 minutes prior with any previous lesion photos.'
        : '',
      rejectionReason: '',
      suggestedDate: defaultDate,
      suggestedTime: appt.appointment_time || '10:00 AM',
      error: null
    });
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal) return;

    const { type, appt } = actionModal;
    setSubmitting(true);
    setFormData(prev => ({ ...prev, error: null }));
    setFeedback(null);

    try {
      if (type === 'accept') {
        await api.post(`/api/appointments/${appt.id}/accept`, {
          doctor_notes: formData.doctorNotes.trim() || null
        });
        setFeedback({
          type: 'success',
          text: `Appointment for ${appt.patient_name || 'patient'} has been successfully confirmed.`
        });
      } else if (type === 'reject') {
        const reason = formData.rejectionReason.trim();
        if (!reason) {
          setFormData(prev => ({ ...prev, error: 'Rejection reason is required. Please explain to the patient why this request was declined.' }));
          setSubmitting(false);
          return;
        }
        await api.post(`/api/appointments/${appt.id}/reject`, {
          rejection_reason: reason,
          doctor_notes: reason
        });
        setFeedback({
          type: 'success',
          text: `Appointment request has been declined. The patient has been notified with your reason.`
        });
      } else if (type === 'reschedule') {
        const sDate = formData.suggestedDate.trim();
        const sTime = formData.suggestedTime.trim();
        if (!sDate || !sTime) {
          setFormData(prev => ({ ...prev, error: 'Both suggested date and suggested time are required.' }));
          setSubmitting(false);
          return;
        }
        await api.post(`/api/appointments/${appt.id}/reschedule`, {
          suggested_date: sDate,
          suggested_time: sTime,
          message: formData.doctorNotes.trim() || null
        });
        setFeedback({
          type: 'success',
          text: `Alternate appointment proposal (${sDate} @ ${sTime}) sent to patient for confirmation.`
        });
      } else if (type === 'complete' || type === 'cancel') {
        await api.post(`/api/doctors/appointments/${appt.id}/action`, {
          action: type,
          doctor_notes: formData.doctorNotes.trim() || null
        });
        setFeedback({
          type: 'success',
          text: `Appointment status updated to ${type === 'complete' ? 'Completed' : 'Cancelled'}.`
        });
      }

      setActionModal(null);
      loadAppointments();
    } catch (err) {
      console.error('Appointment action error:', err);
      const errMsg = err.response?.data?.detail || 'Failed to update appointment.';
      setFormData(prev => ({ ...prev, error: errMsg }));
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAppointments = appointments.filter(a => {
    if (filter === 'all') return true;
    return getStatusKey(a.status) === filter;
  });

  const pendingCount = appointments.filter(a => isPending(a.status)).length;
  const confirmedCount = appointments.filter(a => isConfirmed(a.status)).length;
  const rescheduledCount = appointments.filter(a => isAwaiting(a.status)).length;
  const completedCount = appointments.filter(a => isCompleted(a.status)).length;
  const rejectedCount = appointments.filter(a => isRejected(a.status)).length;
  const cancelledCount = appointments.filter(a => isCancelled(a.status)).length;

  const renderStatusBadge = (status) => {
    const k = getStatusKey(status);
    switch (k) {
      case 'pending':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a'
          }}>
            <Clock size={12} /> Pending
          </span>
        );
      case 'confirmed':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0'
          }}>
            <CheckCircle2 size={12} /> Confirmed
          </span>
        );
      case 'rescheduled':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#ede9fe',
            color: '#6d28d9',
            border: '1px solid #ddd6fe'
          }}>
            <RotateCcw size={12} /> Rescheduled
          </span>
        );
      case 'rejected':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fecaca'
          }}>
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'completed':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0'
          }}>
            <CheckCircle size={12} /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 9px',
            borderRadius: 12,
            fontSize: '0.725rem',
            fontWeight: 600,
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
            border: '1px solid #e5e7eb'
          }}>
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="badge-label badge-info-custom" style={{ fontSize: '0.725rem' }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Clinical Appointments & Schedule
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Manage consultation bookings, accept or reject pending requests, propose alternate times, and complete scheduled visits.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All (${appointments.length})` },
            { key: 'pending', label: `Pending Review (${pendingCount})` },
            { key: 'confirmed', label: `Confirmed (${confirmedCount})` },
            { key: 'rescheduled', label: `Rescheduled (${rescheduledCount})` },
            { key: 'completed', label: `Completed (${completedCount})` },
            { key: 'rejected', label: `Rejected (${rejectedCount})` },
            { key: 'cancelled', label: `Cancelled (${cancelledCount})` }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filter === f.key ? '#ffffff' : 'transparent',
                color: filter === f.key ? '#0d6efd' : '#64748b',
                boxShadow: filter === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
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

      {/* Appointment Table */}
      {loading ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading appointment schedule...
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="project-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <CalendarDays size={40} style={{ color: '#cbd5e1', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No Appointments Found</div>
          <div style={{ fontSize: '0.825rem' }}>There are no consultation bookings matching this filter.</div>
        </div>
      ) : (
        <div className="project-card" style={{ padding: '8px 16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Patient</th>
                <th style={{ padding: '12px 8px' }}>Appointment Slot</th>
                <th style={{ padding: '12px 8px' }}>Reason / Concern</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map(appt => {
                const patientIdDisplay = appt.patient_id || appt.user_id || '---';
                return (
                  <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 8px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {appt.patient_name || `Patient #${patientIdDisplay}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ID: PAT-{patientIdDisplay}
                      </div>
                    </td>

                    <td style={{ padding: '14px 8px' }}>
                      <div style={{ fontWeight: 600, color: '#0d6efd', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={14} />
                        <span>{formatAppointmentDate(appt.appointment_date)}</span>
                      </div>
                      <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} />
                        <span>{formatAppointmentTime(appt.appointment_time, appt.appointment_date)}</span>
                      </div>

                      {/* Display Suggested Alternate Time if Rescheduled */}
                      {(appt.suggested_date || appt.suggested_alternate_time) && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6d28d9',
                          marginTop: 4,
                          padding: '3px 6px',
                          backgroundColor: '#f5f3ff',
                          borderRadius: 4,
                          display: 'inline-block'
                        }}>
                          Proposed: {appt.suggested_date || ''} {appt.suggested_time ? `@ ${appt.suggested_time}` : (appt.suggested_alternate_time ? `(${appt.suggested_alternate_time})` : '')}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 8px', maxWidth: 280 }}>
                      <div style={{ color: '#1e293b', fontWeight: 500 }}>
                        {appt.reason_for_visit || appt.purpose_or_notes || 'General Skin Consultation'}
                      </div>
                      {appt.rejection_reason && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#b91c1c',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fee2e2',
                          padding: '4px 6px',
                          borderRadius: 4,
                          marginTop: 4
                        }}>
                          <strong>Decline Reason:</strong> "{appt.rejection_reason}"
                        </div>
                      )}
                      {appt.doctor_response_notes && !appt.rejection_reason && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          backgroundColor: '#f8fafc',
                          padding: '4px 6px',
                          borderRadius: 4,
                          marginTop: 4
                        }}>
                          Notes: "{appt.doctor_response_notes}"
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 8px' }}>
                      {renderStatusBadge(appt.status)}
                    </td>

                    <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* PENDING ACTIONS */}
                        {isPending(appt.status) && (
                          <>
                            {/* 1. Accept Button (Green) */}
                            <button
                              onClick={() => openActionModal('accept', appt)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'background-color 0.15s ease'
                              }}
                              title="Accept Appointment"
                            >
                              <Check size={14} />
                              <span>Accept</span>
                            </button>

                            {/* 2. Reject Button (Red) */}
                            <button
                              onClick={() => openActionModal('reject', appt)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'background-color 0.15s ease'
                              }}
                              title="Reject Appointment"
                            >
                              <XCircle size={14} />
                              <span>Reject</span>
                            </button>

                            {/* 3. Suggest New Time Button (Blue Outlined) */}
                            <button
                              onClick={() => openActionModal('reschedule', appt)}
                              style={{
                                padding: '5px 12px',
                                backgroundColor: '#ffffff',
                                color: '#0d6efd',
                                border: '1px solid #0d6efd',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease'
                              }}
                              title="Suggest New Time"
                            >
                              <Clock size={14} />
                              <span>Suggest New Time</span>
                            </button>
                          </>
                        )}

                        {/* CONFIRMED ACTIONS */}
                        {isConfirmed(appt.status) && (
                          <>
                            <button
                              onClick={() => openActionModal('complete', appt)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#0d6efd',
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
                              title="Mark as Completed"
                            >
                              <CheckCircle2 size={14} />
                              <span>Complete</span>
                            </button>

                            <button
                              onClick={() => openActionModal('cancel', appt)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Cancel Confirmed Appointment"
                            >
                              <XCircle size={14} />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}

                        {/* AWAITING PATIENT CONFIRMATION */}
                        {isAwaiting(appt.status) && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', color: '#6d28d9', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={13} /> Awaiting patient confirmation
                            </span>
                            <button
                              onClick={() => openActionModal('reschedule', appt)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                fontSize: '0.725rem',
                                cursor: 'pointer'
                              }}
                            >
                              Edit Slot
                            </button>
                          </div>
                        )}

                        {/* REJECTED / CANCELLED / COMPLETED */}
                        {(isRejected(appt.status) || isCompleted(appt.status) || isCancelled(appt.status)) && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: 16
        }}>
          <div className="modal-content" style={{
            maxWidth: 480,
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              {actionModal.type === 'accept' && 'Accept & Confirm Patient Appointment'}
              {actionModal.type === 'reject' && 'Decline Appointment Request'}
              {actionModal.type === 'reschedule' && 'Propose New Appointment Time'}
              {actionModal.type === 'complete' && 'Mark Consultation as Completed'}
              {actionModal.type === 'cancel' && 'Cancel Confirmed Appointment'}
            </h3>

            <div style={{
              margin: '0 0 16px',
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: '0.825rem',
              color: '#334155'
            }}>
              <div>
                <strong>Patient:</strong> {actionModal.appt.patient_name || `Patient #${actionModal.appt.patient_id}`}
                <span style={{ color: '#64748b', marginLeft: 6 }}>
                  (ID: PAT-{actionModal.appt.patient_id || actionModal.appt.user_id})
                </span>
              </div>
              <div style={{ marginTop: 3 }}>
                <strong>Requested Slot:</strong> {formatAppointmentDate(actionModal.appt.appointment_date)} at {formatAppointmentTime(actionModal.appt.appointment_time, actionModal.appt.appointment_date)}
              </div>
              {actionModal.appt.reason_for_visit && (
                <div style={{ marginTop: 3, color: '#64748b' }}>
                  <strong>Concern:</strong> {actionModal.appt.reason_for_visit}
                </div>
              )}
            </div>

            {formData.error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 14,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.825rem'
              }}>
                <AlertCircle size={16} />
                <div>{formData.error}</div>
              </div>
            )}

            <form onSubmit={handleActionSubmit}>
              {/* ACCEPT APPOINTMENT FORM */}
              {actionModal.type === 'accept' && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 10px' }}>
                    Are you sure you want to confirm this appointment? The patient will receive an instant notification with appointment details.
                  </p>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Optional Clinical Instructions / Preparation Note
                  </label>
                  <textarea
                    rows={3}
                    value={formData.doctorNotes}
                    onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                    placeholder="e.g. Please bring recent lesion photos or clean skin before arrival."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* REJECT APPOINTMENT FORM */}
              {actionModal.type === 'reject' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                    Reason for Declining <span style={{ color: '#ef4444' }}>* (Required)</span>
                  </label>
                  <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0 0 8px' }}>
                    This reason will be provided to the patient in their notification so they understand why their request could not be accommodated.
                  </p>
                  <textarea
                    rows={3}
                    value={formData.rejectionReason}
                    onChange={(e) => setFormData({ ...formData, rejectionReason: e.target.value, error: null })}
                    placeholder="e.g. Schedule fully booked on requested day; please select another time or clinic is closed for maintenance."
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      border: formData.error ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* SUGGEST NEW TIME (RESCHEDULE) FORM */}
              {actionModal.type === 'reschedule' && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: '0.825rem', color: '#475569', margin: '0 0 12px' }}>
                    Propose an alternative slot for the patient. The patient will be able to review and accept or decline your suggested time.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                        Suggested Date <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.suggestedDate}
                        onChange={(e) => setFormData({ ...formData, suggestedDate: e.target.value, error: null })}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                        Suggested Time <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.suggestedTime}
                        onChange={(e) => setFormData({ ...formData, suggestedTime: e.target.value, error: null })}
                        placeholder="e.g. 10:30 AM"
                        required
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Optional Message / Reason for Alternative Slot
                    </label>
                    <textarea
                      rows={2}
                      value={formData.doctorNotes}
                      onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                      placeholder="e.g. The morning clinic has better availability for comprehensive dermoscopy evaluation."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.85rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* COMPLETE APPOINTMENT FORM */}
              {actionModal.type === 'complete' && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 10px' }}>
                    Mark this appointment as completed. You can record clinical notes and next follow-up recommendations.
                  </p>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Consultation Summary & Outcome
                  </label>
                  <textarea
                    rows={3}
                    value={formData.doctorNotes}
                    onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                    placeholder="e.g. Completed skin examination. Lesion shows improvement. Continue topical treatment."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* CANCEL APPOINTMENT FORM */}
              {actionModal.type === 'cancel' && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: '0 0 10px' }}>
                    Are you sure you want to cancel this confirmed appointment?
                  </p>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Cancellation Reason (shared with patient)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.doctorNotes}
                    onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                    placeholder="e.g. Emergency surgery scheduled during this slot."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    backgroundColor:
                      actionModal.type === 'accept' ? '#16a34a' :
                      actionModal.type === 'reject' ? '#ef4444' :
                      actionModal.type === 'cancel' ? '#ef4444' : '#0d6efd',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? 'Processing...' : (
                    actionModal.type === 'accept' ? 'Confirm Acceptance' :
                    actionModal.type === 'reject' ? 'Decline Request' :
                    actionModal.type === 'reschedule' ? 'Send Proposal' :
                    actionModal.type === 'complete' ? 'Mark Completed' : 'Confirm Cancellation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
