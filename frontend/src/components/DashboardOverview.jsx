import React, { useState, useEffect } from 'react';
import {
  Camera,
  Activity,
  Pill,
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  Images,
  FolderPlus,
  TrendingUp,
  Building2
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DashboardOverview({ setActiveTab, onSelectRecordForCompare }) {
  const [stats, setStats] = useState({
    recordsCount: 0,
    symptomsCount: 0,
    treatmentsCount: 0,
    appointmentsCount: 0,
    notificationsCount: 0,
  });
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [recentRecords, setRecentRecords] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [recRes, sympRes, treatRes, apptRes, notifRes] = await Promise.all([
        api.get('/api/skin-records'),
        api.get('/api/symptoms'),
        api.get('/api/treatments?active_only=true'),
        api.get('/api/appointments'),
        api.get('/api/notifications?unread_only=true')
      ]);

      const records = recRes.data || [];
      const symptoms = sympRes.data || [];
      const treatments = treatRes.data || [];
      const appointments = apptRes.data || [];
      const notifications = notifRes.data || [];

      setStats({
        recordsCount: records.length,
        symptomsCount: symptoms.length,
        treatmentsCount: treatments.length,
        appointmentsCount: appointments.filter(a => a.status === 'Scheduled').length,
        notificationsCount: notifications.length
      });

      // Find urgent or warning notifications
      const safetyNotifs = notifications.filter(n => n.urgency === 'Urgent' || n.urgency === 'Warning');
      setUrgentAlerts(safetyNotifs);

      // Recent 3 records
      setRecentRecords(records.slice(0, 3));

      // Next scheduled appointment
      const scheduled = appointments
        .filter(a => a.status === 'Scheduled')
        .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
      if (scheduled.length > 0) {
        setNextAppointment(scheduled[0]);
      }
    } catch (err) {
      console.error('Failed loading dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Safety Warning Banner if Worsening Alerts exist */}
      {urgentAlerts.length > 0 && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffecb5',
          borderLeft: '5px solid #dc3545',
          borderRadius: 6,
          padding: '14px 18px',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={18} color="#dc3545" />
                <h4 style={{ color: '#842029', margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Clinical Safety Advisory Detected
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#664d03' }}>
                {urgentAlerts[0].message}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('notifications')}
              className="btn-outline"
              style={{ borderColor: '#842029', color: '#842029', fontSize: '0.8rem', padding: '5px 12px' }}
            >
              View All Alerts ({urgentAlerts.length})
            </button>
          </div>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="project-card" style={{
        background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
        color: '#ffffff',
        padding: '24px 28px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.85 }}>
              Patient Monitoring Portal
            </span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '4px 0 8px' }}>
              Skin Health Monitoring & Follow-up Dashboard
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: 650, opacity: 0.95 }}>
              Track skin lesions longitudinally, record clinical symptoms, document dermatologist consultation diagnoses, and receive scheduled appointment reminders.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('diagnose')}
            style={{
              backgroundColor: '#ffffff',
              color: '#0d6efd',
              border: 'none',
              padding: '10px 20px',
              fontWeight: 700,
              borderRadius: 5,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            + Run AI Scan
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('records')}>
          <div className="stat-icon" style={{ backgroundColor: '#e7f1ff', color: '#0d6efd' }}>
            <Camera size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#212529' }}>{stats.recordsCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Skin Records</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('symptoms')}>
          <div className="stat-icon" style={{ backgroundColor: '#fff3cd', color: '#d97706' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#212529' }}>{stats.symptomsCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Logged Symptoms</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('treatments')}>
          <div className="stat-icon" style={{ backgroundColor: '#d1e7dd', color: '#198754' }}>
            <Pill size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#212529' }}>{stats.treatmentsCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Active Treatments</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('appointments')}>
          <div className="stat-icon" style={{ backgroundColor: '#cfe2ff', color: '#084298' }}>
            <CalendarDays size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#212529' }}>{stats.appointmentsCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Scheduled Visits</div>
          </div>
        </div>
      </div>

      {/* Next Appointment & Quick Actions Grid */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Next Appointment Box */}
        <div className="project-card" style={{ margin: 0 }}>
          <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Next Follow-up Appointment</span>
            <button
              onClick={() => setActiveTab('appointments')}
              className="btn-outline"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              Manage
            </button>
          </div>
          {nextAppointment ? (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Building2 size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#212529' }}>
                    {nextAppointment.doctor_or_clinic}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#0d6efd', fontWeight: 600 }}>
                    {new Date(nextAppointment.appointment_date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
              {nextAppointment.purpose_or_notes && (
                <p style={{ fontSize: '0.85rem', color: '#6c757d', margin: 0, background: '#f8f9fa', padding: 8, borderRadius: 4 }}>
                  <strong>Notes:</strong> {nextAppointment.purpose_or_notes}
                </p>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 10px', color: '#6c757d' }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No upcoming follow-up appointments scheduled.</p>
              <button
                onClick={() => setActiveTab('appointments')}
                className="btn-submit"
                style={{ marginTop: 10, fontSize: '0.8rem', padding: '6px 14px' }}
              >
                + Schedule Appointment
              </button>
            </div>
          )}
        </div>

        {/* Quick Action Shortcuts */}
        <div className="project-card" style={{ margin: 0 }}>
          <div className="project-card-header">
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setActiveTab('records')}
              className="btn-outline"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.875rem', gap: 8 }}
            >
              <FolderPlus size={16} /> Record New Skin Lesion & Observation
            </button>
            <button
              onClick={() => setActiveTab('symptoms')}
              className="btn-outline"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.875rem', gap: 8 }}
            >
              <TrendingUp size={16} /> Log Symptom Severity (Itching, Pain, Redness)
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className="btn-outline"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.875rem', gap: 8 }}
            >
              <Images size={16} /> Compare Two Skin Photos Side-by-Side
            </button>
            <button
              onClick={() => setActiveTab('consultations')}
              className="btn-outline"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.875rem', gap: 8 }}
            >
              <Stethoscope size={16} /> Document Dermatologist Visit & Treatment Plan
            </button>
          </div>
        </div>
      </div>

      {/* Recent Skin Records Section */}
      <div className="project-card">
        <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Recent Skin Health Records</span>
          <button
            onClick={() => setActiveTab('records')}
            className="btn-outline"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
          >
            View All ({stats.recordsCount})
          </button>
        </div>

        {recentRecords.length > 0 ? (
          <div className="grid-3">
            {recentRecords.map(rec => (
              <div
                key={rec.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ height: 160, backgroundColor: '#f1f3f5', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={getImageUrl(rec.image_url) || rec.thumbnail_b64}
                    alt={rec.body_location}
                    onError={(e) => {
                      if (rec.thumbnail_b64 && e.target.src !== rec.thumbnail_b64) {
                        e.target.src = rec.thumbnail_b64;
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    backgroundColor: 'rgba(33, 37, 41, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.725rem',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {rec.body_location}
                  </span>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: 4 }}>
                    Captured: {new Date(rec.capture_date).toLocaleDateString()}
                  </div>
                  {rec.predicted_disease && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0d6efd', marginBottom: 6 }}>
                      AI: {rec.predicted_disease}
                    </div>
                  )}
                  {rec.user_notes && (
                    <p style={{ fontSize: '0.8rem', color: '#495057', margin: '4px 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.user_notes}
                    </p>
                  )}
                  <button
                    onClick={() => setActiveTab('records')}
                    className="btn-outline"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '4px 8px', justifyContent: 'center' }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#6c757d' }}>
            <p>No skin health records saved yet.</p>
            <button
              onClick={() => setActiveTab('records')}
              className="btn-submit"
              style={{ fontSize: '0.85rem', padding: '6px 16px' }}
            >
              + Create First Record
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

