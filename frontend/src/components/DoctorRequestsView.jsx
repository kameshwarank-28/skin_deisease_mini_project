import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Loader2,
  ChevronRight,
  User,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export default function DoctorRequestsView({ setActiveTab }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'Requested' | 'Accepted' | 'Rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/connections');
      setConnections(res.data || []);
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (connId, action) => {
    setActionLoading(true);
    try {
      await api.post(`/api/doctors/connections/${connId}/action`, {
        action: action,
        response_note: action === 'accept'
          ? 'Connection accepted. You may now share skin health records and schedule consultations.'
          : 'Connection request declined.'
      });
      setFeedback({
        type: 'success',
        message: `Patient connection request ${action === 'accept' ? 'accepted' : 'declined'} successfully.`
      });
      loadConnections();
    } catch (err) {
      console.error('Action error:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update connection request.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredConnections = connections.filter(c => {
    const matchesFilter = filter === 'all' ? true : c.status === filter;
    const q = searchQuery.toLowerCase();
    const name = (c.patient_name || '').toLowerCase();
    const note = (c.request_note || '').toLowerCase();
    return matchesFilter && (name.includes(q) || note.includes(q));
  });

  const pendingCount = connections.filter(c => c.status === 'Requested').length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#1177DE" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading patient requests...</div>
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
          backgroundColor: feedback.type === 'success' ? '#EAF3FC' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#7CB0EA' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#1177DE' : '#b91c1c',
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
        border: '1px solid #7CB0EA',
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
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
          <UserCheck size={14} />
          <span>Patient Intake & Connection Authorizations</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#1177DE' }}>
          Patient Connection Requests ({connections.length})
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Review and approve connection requests from patients. Accepting a connection grants you authorized clinical access to their longitudinal skin lesion records and symptom timelines.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All (${connections.length})` },
            { key: 'Requested', label: `Pending Review (${pendingCount})` },
            { key: 'Accepted', label: 'Accepted' },
            { key: 'Rejected', label: 'Declined' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filter === f.key ? '#1177DE' : '#EAF3FC',
                color: filter === f.key ? '#ffffff' : '#475569'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Search by patient name or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #7CB0EA', fontSize: '0.825rem' }}
          />
        </div>
      </div>

      {/* Requests List */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #7CB0EA',
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {filteredConnections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No patient connection requests found for this filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredConnections.map(c => {
              const isPending = c.status === 'Requested';
              const isAccepted = c.status === 'Accepted';
              const isRejected = c.status === 'Rejected';

              return (
                <div
                  key={c.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    border: '1px solid #7CB0EA',
                    backgroundColor: '#EAF3FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
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
                      {c.patient_name ? c.patient_name[0] : 'P'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1177DE' }}>
                          {c.patient_name || `Patient #${c.patient_id}`}
                        </span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, backgroundColor: '#7CB0EA', color: '#475569', fontWeight: 600 }}>
                          PAT-{String(c.patient_id).padStart(4, '0')}
                        </span>
                        <span style={{
                          fontSize: '0.725rem',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontWeight: 600,
                          backgroundColor: isAccepted ? '#DCEAF8' : isPending ? '#fef3c7' : '#fee2e2',
                          color: isAccepted ? '#1177DE' : isPending ? '#b45309' : '#b91c1c'
                        }}>
                          {c.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.825rem', color: '#334155', marginBottom: 4 }}>
                        <strong>Patient Note:</strong> "{c.request_note || 'Requesting skin monitoring and clinical review.'}"
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Requested: {new Date(c.created_at).toLocaleString()}
                      </div>

                      {c.response_note && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
                          Doctor Response: "{c.response_note}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleAction(c.id, 'accept')}
                          disabled={actionLoading}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#1177DE',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Accept Connection</span>
                        </button>

                        <button
                          onClick={() => handleAction(c.id, 'reject')}
                          disabled={actionLoading}
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
                            gap: 6
                          }}
                        >
                          <XCircle size={15} />
                          <span>Decline</span>
                        </button>
                      </>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('doctor_patients');
                        }}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#ffffff',
                          color: '#1177DE',
                          border: '1px solid #7CB0EA',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <ShieldCheck size={15} />
                        <span>View Clinical Dossier</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

