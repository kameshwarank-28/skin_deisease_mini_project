import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  CalendarDays,
  Search,
  CheckCircle2,
  Stethoscope,
  Pill,
  User,
  ShieldCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export default function DoctorFollowupsView({ setActiveTab }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFollowups();
  }, []);

  const loadFollowups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/followups');
      setFollowups(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFollowups = followups.filter(f => {
    const q = searchQuery.toLowerCase();
    const pName = (f.patient_name || '').toLowerCase();
    const reason = (f.reason || '').toLowerCase();
    const fType = (f.followup_type || '').toLowerCase();
    return pName.includes(q) || reason.includes(q) || fType.includes(q);
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#0284c7" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading clinical follow-ups...</div>
      </div>
    );
  }

  return (
    <div>
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
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 20,
          fontSize: '0.75rem',
          color: '#2563eb',
          fontWeight: 600,
          marginBottom: 8
        }}>
          <Clock size={14} />
          <span>Longitudinal Clinical Care Continuity</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          Clinical Follow-ups & Treatment Reviews ({followups.length})
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Track upcoming patient evaluations, ongoing topical and systemic therapy checkpoints, and scheduled clinical visits.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
          Showing {filteredFollowups.length} Follow-up Items
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Search by patient or concern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
          />
        </div>
      </div>

      {/* Follow-up List */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {filteredFollowups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No upcoming clinical follow-ups scheduled at this time.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredFollowups.map(f => (
              <div
                key={f.id}
                style={{
                  padding: '14px 18px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
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
                      {f.patient_name}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 600,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb'
                    }}>
                      {f.followup_type}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 600,
                      backgroundColor: f.status.toLowerCase().includes('confirm') ? '#dcfce7' : '#fef3c7',
                      color: f.status.toLowerCase().includes('confirm') ? '#15803d' : '#b45309'
                    }}>
                      {f.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8rem', color: '#334155', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={14} color="#0d6efd" />
                      <span><strong>Date:</strong> {f.scheduled_date}</span>
                    </div>
                    {f.time_slot && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={14} color="#0d6efd" />
                        <span><strong>Time:</strong> {f.time_slot}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>Clinical Reason:</strong> {f.reason}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setActiveTab('doctor_consultations')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Stethoscope size={13} />
                    <span>Consultation</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('doctor_treatments')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0d6efd',
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
                    <Pill size={13} />
                    <span>Review Treatment</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
