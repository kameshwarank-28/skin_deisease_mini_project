import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  User,
  Stethoscope,
  Building,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Plus,
  Send,
  Calendar,
  ExternalLink,
  Trash2,
  Award,
  FileText,
  RotateCcw,
  X
} from 'lucide-react';
import api from '../services/api';

export default function AppointmentReminders({ setActiveTab }) {
  const [appointments, setAppointments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [doctorsDirectory, setDoctorsDirectory] = useState([]);
  const [viewTab, setViewTab] = useState('appointments'); // 'appointments' | 'doctors'
  const [loading, setLoading] = useState(true);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorOrClinic, setDoctorOrClinic] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [purposeOrNotes, setPurposeOrNotes] = useState('');
  const [reminderAdvanceHours, setReminderAdvanceHours] = useState(24);
  const [status, setStatus] = useState('Scheduled');
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Reschedule Modal State
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00 AM');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Delete Confirm
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchAppointments();
    fetchConsultations();
    fetchDoctorsDirectory();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/appointments');
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Failed fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultations = async () => {
    try {
      const res = await api.get('/api/consultations');
      setConsultations(res.data || []);
    } catch (err) {
      console.error('Failed fetching consultations:', err);
    }
  };

  const fetchDoctorsDirectory = async () => {
    try {
      const res = await api.get('/api/doctors/directory');
      setDoctorsDirectory(res.data || []);
    } catch (err) {
      console.error('Failed fetching doctors directory:', err);
    }
  };

  const handleConnectWithDoctor = async (doctorId, doctorName) => {
    try {
      await api.post('/api/patients/connection-requests', {
        doctor_id: doctorId,
        request_note: 'Requesting connection to share lesion photos and schedule consultation.'
      });
      setFeedback({ type: 'success', text: `Connection request sent to ${doctorName}.` });
      fetchDoctorsDirectory();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to send connection request.' });
    }
  };

  const handlePatientResponse = async (apptId, responseType) => {
    try {
      await api.post(`/api/appointments/${apptId}/patient-response`, {
        response: responseType
      });
      setFeedback({
        type: 'success',
        text: responseType === 'accept'
          ? 'Rescheduled appointment confirmed!'
          : 'Proposed appointment time declined. Status reset to Pending.'
      });
      fetchAppointments();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update appointment response.'
      });
    }
  };

  const handleOpenReschedule = (appt) => {
    setRescheduleModal(appt);
    let defDate = '';
    if (appt.appointment_date) {
      try {
        defDate = new Date(appt.appointment_date).toISOString().slice(0, 10);
      } catch (e) {
        defDate = '';
      }
    }
    if (!defDate) {
      defDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    setRescheduleDate(defDate);
    setRescheduleTime(appt.appointment_time || '10:00 AM');
    setRescheduleReason('');
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleModal || !rescheduleDate) return;
    setRescheduling(true);
    try {
      const payload = {
        appointment_date: rescheduleDate,
        appointment_time: rescheduleTime,
        new_date: rescheduleDate,
        new_time: rescheduleTime,
        suggested_date: rescheduleDate,
        suggested_time: rescheduleTime,
        reason: rescheduleReason.trim() || 'Patient requested reschedule',
        notes: rescheduleReason.trim() || 'Patient requested reschedule',
        message: rescheduleReason.trim() || 'Patient requested reschedule'
      };
      await api.post(`/api/appointments/${rescheduleModal.id}/reschedule`, payload);
      setRescheduleModal(null);
      setFeedback({
        type: 'success',
        text: 'Appointment rescheduled successfully! Your doctor has received notification of your new requested slot.'
      });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reschedule appointment.');
    } finally {
      setRescheduling(false);
    }
  };

  const handleOpenCreateWithDoctor = (doc) => {
    setEditingId(null);
    setSelectedDoctorId(String(doc.doctor_id));
    setDoctorOrClinic(doc.full_name);
    setAppointmentDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setPurposeOrNotes(`Consultation with ${doc.full_name} (${doc.specialization})`);
    setReminderAdvanceHours(24);
    setStatus('Pending Doctor Review');
    setSelectedConsultationId('');
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setSelectedDoctorId('');
    setDoctorOrClinic('');
    setAppointmentDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setPurposeOrNotes('');
    setReminderAdvanceHours(24);
    setStatus('Scheduled');
    setSelectedConsultationId('');
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (a) => {
    setEditingId(a.id);
    setSelectedDoctorId(a.doctor_id ? String(a.doctor_id) : '');
    setDoctorOrClinic(a.doctor_name || a.doctor_or_clinic);
    setAppointmentDate(new Date(a.appointment_date).toISOString().slice(0, 16));
    setPurposeOrNotes(a.purpose_or_notes || a.reason_for_visit || '');
    setReminderAdvanceHours(a.reminder_advance_hours || 24);
    setStatus(a.status);
    setSelectedConsultationId(a.consultation_id ? String(a.consultation_id) : '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!doctorOrClinic.trim() || !appointmentDate) {
      setFormError('Doctor / Clinic name and date/time are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      doctor_or_clinic: doctorOrClinic.trim(),
      doctor_id: selectedDoctorId ? parseInt(selectedDoctorId, 10) : null,
      appointment_date: new Date(appointmentDate).toISOString(),
      appointment_time: new Date(appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      purpose_or_notes: purposeOrNotes.trim() || null,
      reason_for_visit: purposeOrNotes.trim() || null,
      reminder_advance_hours: parseInt(reminderAdvanceHours, 10),
      status: selectedDoctorId ? 'Pending Doctor Review' : status,
      consultation_id: selectedConsultationId ? parseInt(selectedConsultationId, 10) : null
    };

    try {
      if (editingId) {
        await api.put(`/api/appointments/${editingId}`, payload);
      } else {
        await api.post('/api/appointments', payload);
      }
      setShowModal(false);
      setFeedback({ type: 'success', text: selectedDoctorId ? 'Appointment request submitted to doctor!' : 'Appointment scheduled successfully!' });
      fetchAppointments();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/appointments/${id}`);
      setDeleteId(null);
      fetchAppointments();
    } catch (err) {
      alert('Failed to delete appointment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getStatusBadge = (appt) => {
    const s = (appt.status || '').toUpperCase();
    if (s === 'CONFIRMED' || s === 'ACCEPTED') {
      return (
        <span className="badge-label badge-success-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} /> Confirmed
        </span>
      );
    }
    if (s === 'PENDING' || s === 'PENDING DOCTOR REVIEW' || s === 'SCHEDULED' || s === 'AWAITING_DOCTOR_REVIEW') {
      return (
        <span className="badge-label badge-warning-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> Pending Review
        </span>
      );
    }
    if (s === 'AWAITING_PATIENT_CONFIRMATION' || s === 'RESCHEDULED' || s === 'RESCHEDULED BY DOCTOR') {
      return (
        <span className="badge-label badge-info-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <RotateCcw size={12} /> Rescheduled
        </span>
      );
    }
    if (s === 'COMPLETED') {
      return (
        <span className="badge-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle size={12} /> Completed
        </span>
      );
    }
    if (s === 'REJECTED' || s === 'DECLINED') {
      return (
        <span className="badge-label badge-danger-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <XCircle size={12} /> Declined
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="badge-label badge-danger-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <XCircle size={12} /> Cancelled
        </span>
      );
    }
    return <span className="badge-label badge-info-custom">{appt.status}</span>;
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
            Follow-up Appointments & Dermatologist Directory
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
            Connect with verified dermatologists, book synchronized appointments, and track clinical review milestones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setViewTab(viewTab === 'appointments' ? 'doctors' : 'appointments')}
            className="btn-outline"
            style={{ fontSize: '0.825rem', padding: '8px 14px' }}
          >
            {viewTab === 'appointments' ? 'Browse Verified Doctors' : 'View My Appointments'}
          </button>
          <button onClick={handleOpenCreate} className="btn-submit" style={{ fontSize: '0.825rem', padding: '8px 14px' }}>
            + Book Appointment
          </button>
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
          backgroundColor: feedback.type === 'success' ? '#EAF3FC' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#7CB0EA' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#1177DE' : '#b91c1c',
          fontSize: '0.875rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.text}</div>
        </div>
      )}

      {/* VIEW 1: MY APPOINTMENTS */}
      {viewTab === 'appointments' && (
        loading ? (
          <div className="project-card" style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
            Loading appointments...
          </div>
        ) : appointments.length === 0 ? (
          <div className="project-card" style={{ textAlign: 'center', padding: 50, color: '#6c757d' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CalendarDays size={44} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: '#495057' }}>No Appointments Scheduled</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: 450, margin: '0 auto 16px' }}>
              Connect with our verified dermatologists or schedule a clinical review to maintain your lesion health records.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setViewTab('doctors')} className="btn-outline">
                Browse Doctors
              </button>
              <button onClick={handleOpenCreate} className="btn-submit">
                + Book Visit
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {appointments.map(a => (
              <div key={a.id} className="project-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      backgroundColor: '#EAF3FC',
                      color: '#1177DE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      flexShrink: 0
                    }}>
                      <Stethoscope size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1177DE', margin: 0 }}>
                          {a.doctor_name || a.doctor_or_clinic}
                        </h3>
                        {getStatusBadge(a)}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#1177DE', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={14} />
                        <span>{new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>•</span>
                        <Clock size={13} />
                        <span>{a.appointment_time || new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {(a.purpose_or_notes || a.reason_for_visit) && (
                        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                          Concern / Notes: {a.purpose_or_notes || a.reason_for_visit}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleOpenReschedule(a)}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#1177DE', borderColor: '#bae6fd', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="Reschedule this appointment with your doctor"
                    >
                      <RotateCcw size={12} />
                      <span>Reschedule</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(a)}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc3545', borderColor: '#fecaca' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 1. If Rescheduled by Patient (Awaiting Doctor Review) */}
                {a.status === 'RESCHEDULED' && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #7CB0EA',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    color: '#0F1E36'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} color="#1177DE" />
                      <strong style={{ color: '#14532d' }}>Reschedule Request Sent to Doctor:</strong>
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#1177DE', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} color="#1177DE" />
                      <span>
                        {new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {a.appointment_time && ` at ${a.appointment_time}`}
                      </span>
                    </div>
                    {a.purpose_or_notes && (
                      <div style={{ marginTop: 4, fontStyle: 'italic', color: '#0F1E36', fontSize: '0.8rem' }}>
                        Note: "{a.purpose_or_notes}"
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: '0.775rem', color: '#1177DE' }}>
                      Awaiting confirmation from your doctor. They will review this new appointment slot.
                    </div>
                  </div>
                )}

                {/* 2. If Doctor Proposed Alternate Time (Awaiting Patient Confirmation) */}
                {a.status !== 'RESCHEDULED' && ((a.status && ['AWAITING_PATIENT_CONFIRMATION', 'Rescheduled by Doctor'].includes(a.status)) || (a.suggested_date && a.status !== 'CONFIRMED' && a.status !== 'Confirmed')) && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    backgroundColor: '#EAF3FC',
                    border: '1px solid #7CB0EA',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    color: '#1e40af'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <RotateCcw size={14} />
                          <strong style={{ color: '#1e3a8a' }}>Doctor Proposed New Appointment Time:</strong>
                        </div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#1177DE', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} color="#1177DE" />
                          <span>
                            {a.suggested_date || a.suggested_alternate_date || 'Alternative Date'}
                            {(a.suggested_time || a.suggested_alternate_time) && ` at ${a.suggested_time || a.suggested_alternate_time}`}
                          </span>
                        </div>
                        {(a.doctor_response_notes || a.doctor_response) && (
                          <div style={{ marginTop: 4, fontStyle: 'italic', color: '#1e40af', fontSize: '0.8rem' }}>
                            Doctor Note: "{a.doctor_response_notes || a.doctor_response}"
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handlePatientResponse(a.id, 'accept')}
                          style={{
                            padding: '6px 14px',
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
                        >
                          <CheckCircle2 size={14} />
                          <span>Accept Proposed Time</span>
                        </button>
                        <button
                          onClick={() => handlePatientResponse(a.id, 'decline')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ffffff',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <XCircle size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Declined / Rejected by Doctor */}
                {((a.status && ['REJECTED', 'DECLINED', 'Cancelled'].includes(a.status)) || a.rejection_reason) && a.status !== 'CONFIRMED' && a.status !== 'Confirmed' && (
                  <div style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    fontSize: '0.825rem',
                    color: '#991b1b'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <XCircle size={14} color="#dc2626" />
                      <strong>Appointment Request Declined:</strong>
                    </div>
                    <div style={{ marginTop: 3 }}>
                      {a.rejection_reason ? `Reason: "${a.rejection_reason}"` : 'The doctor was unable to confirm this appointment slot.'}
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.775rem', color: '#b91c1c' }}>
                      Please request another appointment slot or browse other verified doctors.
                    </div>
                  </div>
                )}

                {/* Doctor Response Notes */}
                {a.doctor_response_notes && !a.rejection_reason && a.status !== 'AWAITING_PATIENT_CONFIRMATION' && a.status !== 'Rescheduled by Doctor' && (
                  <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    backgroundColor: '#EAF3FC',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    color: '#334155'
                  }}>
                    <strong>Doctor Instructions:</strong> {a.doctor_response_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* VIEW 2: DOCTOR DIRECTORY */}
      {viewTab === 'doctors' && (
        <div>
          <div style={{ marginBottom: 14, fontSize: '0.9rem', color: '#475569' }}>
            Showing verified dermatologists licensed for clinical tele-dermatology consultations.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {doctorsDirectory.map(doc => (
              <div key={doc.doctor_id} className="project-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: '#10254C',
                    color: '#448EE2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    border: '2px solid rgba(56, 189, 248, 0.4)'
                  }}>
                    <Stethoscope size={22} color="#448EE2" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1177DE' }}>
                      {doc.full_name}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#1177DE', fontWeight: 600 }}>
                      {doc.qualification} • {doc.specialization}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building size={14} color="#1177DE" />
                    <span><strong>Hospital / Clinic:</strong> {doc.hospital_name}</span>
                  </div>
                  {doc.years_experience && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Award size={14} color="#d97706" />
                      <span><strong>Experience:</strong> {doc.years_experience} years in clinical dermatology</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color="#64748b" />
                    <span><strong>License:</strong> {doc.medical_reg_no}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #EAF3FC', paddingTop: 12 }}>
                  {doc.connection_status === 'Accepted' ? (
                    <button
                      onClick={() => handleOpenCreateWithDoctor(doc)}
                      className="btn-submit"
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', justifyContent: 'center' }}
                    >
                      Book Appointment
                    </button>
                  ) : doc.connection_status === 'Requested' ? (
                    <button
                      disabled
                      className="btn-outline"
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', justifyContent: 'center', color: '#64748b' }}
                    >
                      Connection Requested
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectWithDoctor(doc.doctor_id, doc.full_name)}
                      className="btn-outline"
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', justifyContent: 'center' }}
                    >
                      Connect with Doctor
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenCreateWithDoctor(doc)}
                    className="btn-submit"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    title="Direct Booking"
                  >
                    Book Slot
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 380, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1177DE' }}>Delete Appointment?</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 18 }}>
              This will remove the appointment and cancel reminder notifications.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} className="btn-outline" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="btn-submit" style={{ flex: 1, backgroundColor: '#dc3545', borderColor: '#dc3545' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT APPOINTMENT */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1177DE', fontSize: '1.2rem', fontWeight: 700 }}>
                {editingId ? 'Edit Follow-up Appointment' : 'Book Clinical Appointment'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 4, display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                color: '#b91c1c',
                fontSize: '0.825rem',
                marginBottom: 14
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Doctor Directory Selector */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Select Verified Doctor (or type custom clinic)
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    const docId = e.target.value;
                    setSelectedDoctorId(docId);
                    if (docId) {
                      const d = doctorsDirectory.find(doc => String(doc.doctor_id) === docId);
                      if (d) setDoctorOrClinic(d.full_name);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    marginBottom: 6,
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">-- Choose Verified Dermatologist --</option>
                  {doctorsDirectory.map(d => (
                    <option key={d.doctor_id} value={d.doctor_id}>
                      {d.full_name} ({d.specialization} - {d.hospital_name})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Or enter clinic name manually..."
                  value={doctorOrClinic}
                  onChange={(e) => {
                    setDoctorOrClinic(e.target.value);
                    if (selectedDoctorId) setSelectedDoctorId('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Date & Time */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Appointment Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Purpose / Concern */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Reason for Visit / Skin Concern
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your current symptoms, lesion locations, or purpose of follow-up..."
                  value={purposeOrNotes}
                  onChange={(e) => setPurposeOrNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-submit"
                >
                  {submitting ? 'Saving...' : (selectedDoctorId ? 'Send Appointment Request' : 'Schedule Visit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE APPOINTMENT */}
      {rescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={20} color="#1177DE" />
                <h3 style={{ margin: 0, color: '#1177DE', fontSize: '1.15rem', fontWeight: 700 }}>
                  Reschedule Appointment
                </h3>
              </div>
              <button
                onClick={() => setRescheduleModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px' }}>
              Choose a new date and time for your consultation with <strong>{rescheduleModal.doctor_name || rescheduleModal.doctor_or_clinic}</strong>. Your doctor will be notified automatically.
            </p>

            <form onSubmit={handleConfirmReschedule}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  New Appointment Date *
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Preferred Time Slot *
                </label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                  required
                >
                  <option value="09:00 AM">09:00 AM - Morning Slot</option>
                  <option value="10:00 AM">10:00 AM - Morning Slot</option>
                  <option value="11:30 AM">11:30 AM - Morning Slot</option>
                  <option value="02:00 PM">02:00 PM - Afternoon Slot</option>
                  <option value="03:30 PM">03:30 PM - Afternoon Slot</option>
                  <option value="04:30 PM">04:30 PM - Evening Slot</option>
                  <option value="05:30 PM">05:30 PM - Evening Slot</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Reason for Reschedule (Optional note for doctor)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Prior conflict, prefer morning slot, symptom follow-up change..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.85rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRescheduleModal(null)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling}
                  className="btn-submit"
                  style={{ backgroundColor: '#10254C', borderColor: '#1177DE' }}
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
