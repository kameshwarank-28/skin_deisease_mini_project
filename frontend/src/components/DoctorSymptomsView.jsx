import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  AlertTriangle,
  Stethoscope,
  Pill,
  User,
  Clock,
  ShieldCheck,
  Loader2,
  Calendar
} from 'lucide-react';
import api from '../services/api';

export default function DoctorSymptomsView({ setActiveTab }) {
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSymptoms();
  }, []);

  const loadSymptoms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/all-patient-symptoms');
      setSymptoms(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor patient symptoms:', err);
    } finally {
      setLoading(false);
    }
  };

  const uniquePatients = Array.from(new Set(symptoms.map(s => s.patient_name || `Patient #${s.user_id}`)));

  const filteredSymptoms = symptoms.filter(s => {
    const pName = s.patient_name || `Patient #${s.user_id}`;
    const matchesPatient = patientFilter === 'all' || pName === patientFilter;
    const matchesSeverity = severityFilter === 'all' || s.severity?.toLowerCase() === severityFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const sName = (s.symptom_name || '').toLowerCase();
    const notes = (s.notes || '').toLowerCase();
    return matchesPatient && matchesSeverity && (pName.toLowerCase().includes(q) || sName.includes(q) || notes.includes(q));
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Loader2 size={30} className="animate-spin" color="#0284c7" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading patient symptom logs...</div>
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
          backgroundColor: '#fef2f2',
          border: '1px solid #fee2e2',
          borderRadius: 20,
          fontSize: '0.75rem',
          color: '#dc2626',
          fontWeight: 600,
          marginBottom: 8
        }}>
          <Activity size={14} />
          <span>Patient-Reported Symptom Progression</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          Authorized Patient Symptom History ({symptoms.length})
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Evaluate patient-reported symptoms, severity progressions, and worsening alerts to inform clinical diagnostic decisions.
        </p>
      </div>

      {/* Filter and Search Controls */}
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Patient Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#64748b' }}>Patient:</span>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="all">All Patients ({uniquePatients.length})</option>
              {uniquePatients.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Severity Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#64748b' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="all">All Severities</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Search symptoms or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
          />
        </div>
      </div>

      {/* Symptoms List */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {filteredSymptoms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No symptom entries found for the selected filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSymptoms.map(s => {
              const sev = (s.severity || '').toLowerCase();
              const isSevere = sev === 'severe';
              const isModerate = sev === 'moderate';

              return (
                <div
                  key={s.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    backgroundColor: isSevere ? '#fffbfb' : '#f8fafc',
                    borderLeft: isSevere ? '4px solid #ef4444' : isModerate ? '4px solid #f59e0b' : '4px solid #10b981',
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
                        {s.symptom_name}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontWeight: 700,
                        backgroundColor: isSevere ? '#fee2e2' : isModerate ? '#fef3c7' : '#dcfce7',
                        color: isSevere ? '#b91c1c' : isModerate ? '#b45309' : '#15803d'
                      }}>
                        {s.severity || 'Mild'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#0d6efd', fontWeight: 600 }}>
                        {s.patient_name || `Patient #${s.user_id}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.775rem', color: '#64748b', marginBottom: 6 }}>
                      {s.duration && <span>Duration: <strong>{s.duration}</strong></span>}
                      <span>Logged: {formatDate(s.recorded_at)}</span>
                    </div>

                    {s.notes && (
                      <div style={{ fontSize: '0.825rem', color: '#334155' }}>
                        "{s.notes}"
                      </div>
                    )}
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
                      <span>Prescribe</span>
                    </button>
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
