import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Filter,
  Search,
  Trash2,
  Eye,
  CheckCircle2,
  Stethoscope,
  Images,
  FolderHeart,
  CalendarDays,
  Plus,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

const STANDARD_SYMPTOMS = [
  'Itching',
  'Redness',
  'Swelling',
  'Dryness',
  'Pain',
  'Burning Sensation',
  'Irritation',
  'Peeling',
  'Bleeding',
  'Scaling',
  'Blistering',
  'Other'
];

export default function SymptomTracker() {
  const [symptoms, setSymptoms] = useState([]);
  const [skinRecords, setSkinRecords] = useState([]);
  const [connectedDoc, setConnectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [symptomName, setSymptomName] = useState('Itching');
  const [customName, setCustomName] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = useState('2 days');
  const [notes, setNotes] = useState('');
  const [linkedRecordId, setLinkedRecordId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all'); // 'all' | '7days' | '30days'

  // Modal States
  const [activeAdvisory, setActiveAdvisory] = useState(null);
  const [selectedSymptomModal, setSelectedSymptomModal] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [sympRes, recRes, docRes] = await Promise.all([
        api.get('/api/symptoms'),
        api.get('/api/skin-records'),
        api.get('/api/patients/my-dermatologist')
      ]);

      setSymptoms(sympRes.data || []);
      setSkinRecords(recRes.data || []);
      setConnectedDoc(docRes.data || null);
    } catch (err) {
      console.error('Failed fetching symptoms & observations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSymptom = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const finalName = symptomName === 'Other' && customName.trim() ? customName.trim() : symptomName;

    const payload = {
      symptom_name: finalName,
      severity: severity,
      recorded_at: new Date(recordedAt).toISOString(),
      duration: duration || null,
      notes: notes || null,
      skin_record_id: linkedRecordId ? parseInt(linkedRecordId) : null
    };

    try {
      const res = await api.post('/api/symptoms', payload);
      setFeedback({ type: 'success', message: `Symptom "${finalName}" recorded successfully.` });

      // Check if worsening alert triggered
      if (res.data.advisory && res.data.advisory.alert_triggered) {
        setActiveAdvisory(res.data.advisory);
      }

      // Reset form
      setNotes('');
      setCustomName('');
      setDuration('2 days');
      setLinkedRecordId('');

      // Reload symptoms
      const updated = await api.get('/api/symptoms');
      setSymptoms(updated.data || []);
    } catch (err) {
      console.error('Failed to log symptom:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to record symptom.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSymptom = async (id) => {
    try {
      await api.delete(`/api/symptoms/${id}`);
      setDeleteConfirmId(null);
      setFeedback({ type: 'success', message: 'Symptom entry deleted.' });
      const updated = await api.get('/api/symptoms');
      setSymptoms(updated.data || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to delete symptom.' });
    }
  };

  // Filter Logic
  const filteredSymptoms = symptoms.filter(s => {
    // 1. Severity filter
    if (selectedSeverity !== 'all' && s.severity?.toLowerCase() !== selectedSeverity.toLowerCase()) {
      return false;
    }

    // 2. Symptom Type filter
    if (selectedType !== 'all' && s.symptom_name?.toLowerCase() !== selectedType.toLowerCase()) {
      return false;
    }

    // 3. Date range filter
    if (selectedDateRange !== 'all') {
      const recDate = new Date(s.recorded_at);
      const now = new Date();
      const diffDays = (now - recDate) / (1000 * 60 * 60 * 24);
      if (selectedDateRange === '7days' && diffDays > 7) return false;
      if (selectedDateRange === '30days' && diffDays > 30) return false;
    }

    // 4. Search query
    const q = searchQuery.toLowerCase();
    const sName = (s.symptom_name || '').toLowerCase();
    const sNotes = (s.notes || '').toLowerCase();
    const docObs = (s.doctor_observation || '').toLowerCase();
    return sName.includes(q) || sNotes.includes(q) || docObs.includes(q);
  });

  // Check for worsening patterns across symptoms
  const hasSevereSymptoms = symptoms.some(s => s.severity?.toLowerCase() === 'severe');
  const recentWorsening = symptoms.slice(0, 3).find(s => s.severity?.toLowerCase() === 'severe');

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
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
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
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
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        marginBottom: 20,
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
          <span>Longitudinal Symptom Tracking & Clinical Observations</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          Symptoms & Observations
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Log skin sensations and visible changes, track severity patterns over time, and receive clinical observations and follow-up guidance from your dermatologist.
        </p>
      </div>

      {/* Worsening Observation Banner if Severe Symptom Detected */}
      {recentWorsening && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fef3c7',
          borderLeft: '4px solid #f59e0b',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>
                Observation: Severe {recentWorsening.symptom_name} Recorded
              </div>
              <div style={{ fontSize: '0.825rem', color: '#78350f' }}>
                Recent entries show elevated severity. We recommend reaching out to your treating dermatologist or booking a follow-up review.
              </div>
            </div>
          </div>

          <a
            href="#appointments"
            style={{
              padding: '7px 14px',
              backgroundColor: '#d97706',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <CalendarDays size={14} />
            <span>Book Clinical Review</span>
          </a>
        </div>
      )}

      {/* Main Grid: Left = Log Form, Right = History Cards & Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 390px) 1fr',
        gap: 24,
        alignItems: 'start'
      }}>
        {/* Left Card: Log New Symptom Form */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Plus size={18} color="#0d6efd" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Log New Symptom
            </h2>
          </div>

          <form onSubmit={handleAddSymptom}>
            {/* Symptom Type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Symptom Type *
              </label>
              <select
                value={symptomName}
                onChange={(e) => setSymptomName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                required
              >
                {STANDARD_SYMPTOMS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Custom Symptom Name if "Other" */}
            {symptomName === 'Other' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Specify Symptom Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tingling, weeping, tightness"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
            )}

            {/* Severity Level Buttons */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Severity Level *
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { key: 'Mild', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
                  { key: 'Moderate', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
                  { key: 'Severe', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' }
                ].map(sev => {
                  const isSelected = severity === sev.key;
                  return (
                    <button
                      key={sev.key}
                      type="button"
                      onClick={() => setSeverity(sev.key)}
                      style={{
                        flex: 1,
                        padding: '8px 6px',
                        borderRadius: 6,
                        border: isSelected ? `2px solid ${sev.color}` : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? sev.bg : '#ffffff',
                        color: isSelected ? sev.color : '#475569',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: sev.color }} />
                      <span>{sev.key}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Approximate Duration
              </label>
              <input
                type="text"
                placeholder="e.g. 2 days, since yesterday, 1 week"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            {/* Associated Skin Photo Dropdown */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Associated Skin Photograph (Optional)
              </label>
              <select
                value={linkedRecordId}
                onChange={(e) => setLinkedRecordId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              >
                <option value="">-- None / General Body Symptom --</option>
                {skinRecords.map(r => (
                  <option key={r.id} value={r.id}>
                    Record #{r.id} ({r.body_location} - {new Date(r.capture_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time Logged */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Date & Time Logged
              </label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            {/* Patient Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Patient Notes & Observations
              </label>
              <textarea
                rows={3}
                placeholder="Describe triggers, flare-ups with heat or water, relief measures, sensations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: '#0d6efd',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(13, 110, 253, 0.3)'
              }}
            >
              <Activity size={16} />
              <span>{submitting ? 'Recording...' : '+ Record Symptom Entry'}</span>
            </button>
          </form>

          {/* Clinical Notice Box */}
          <div style={{
            marginTop: 16,
            padding: '10px 12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: '0.725rem',
            color: '#64748b',
            lineHeight: 1.4
          }}>
            <strong>Clinical Safety Notice:</strong> Symptom observations and severity tracking assist your dermatologist during evaluations. The platform does not diagnose diseases or prescribe medicines based on symptom entries.
          </div>
        </div>

        {/* Right Section: Filter Bar & Chronological Compact Cards */}
        <div>
          {/* Filter & Search Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            marginBottom: 16,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                Chronological Symptom Log ({filteredSymptoms.length} of {symptoms.length})
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
                <input
                  type="text"
                  placeholder="Search symptom or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Filter Dropdowns & Pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Severity Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Severity:</span>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.775rem' }}
                >
                  <option value="all">All Severities</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              {/* Symptom Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.775rem' }}
                >
                  <option value="all">All Symptom Types</option>
                  {STANDARD_SYMPTOMS.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Date Range:</span>
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.775rem' }}
                >
                  <option value="all">All Time</option>
                  <option value="7days">Past 7 Days</option>
                  <option value="30days">Past 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chronological Symptom Cards */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
              <Loader2 size={26} className="animate-spin" color="#0d6efd" style={{ marginBottom: 8 }} />
              <div>Loading symptoms & observations...</div>
            </div>
          ) : filteredSymptoms.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              border: '1px dashed #cbd5e1',
              padding: '48px 20px',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              <Activity size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>No Symptom Entries Found</div>
              <p style={{ fontSize: '0.825rem', maxWidth: 400, margin: '6px auto 0' }}>
                No records matched your filters. Use the form on the left to document new skin sensations and symptoms.
              </p>
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
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      borderLeft: isSevere ? '4px solid #ef4444' : isModerate ? '4px solid #f59e0b' : '4px solid #10b981',
                      padding: '16px 20px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                  >
                    {/* Top Row: Symptom, Badge, Duration, Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                          {s.symptom_name}
                        </span>
                        <span style={{
                          fontSize: '0.725rem',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontWeight: 700,
                          backgroundColor: isSevere ? '#fee2e2' : isModerate ? '#fef3c7' : '#dcfce7',
                          color: isSevere ? '#b91c1c' : isModerate ? '#b45309' : '#15803d'
                        }}>
                          {s.severity || 'Mild'}
                        </span>
                        {s.duration && (
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#475569' }}>
                            Duration: {s.duration}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {formatDate(s.recorded_at)}
                        </span>
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                          title="Delete symptom entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Notes & Linked Skin Photo */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      {/* Linked Skin Photo Preview if available */}
                      {s.skin_record_image_url && (
                        <div style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          backgroundColor: '#0f172a',
                          overflow: 'hidden',
                          flexShrink: 0,
                          position: 'relative'
                        }}>
                          <img
                            src={getImageUrl(s.skin_record_image_url)}
                            alt="Associated lesion"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {s.skin_record_body_location && (
                            <span style={{
                              position: 'absolute',
                              bottom: 2,
                              left: 2,
                              backgroundColor: 'rgba(15,23,42,0.8)',
                              color: '#ffffff',
                              fontSize: '0.55rem',
                              padding: '1px 3px',
                              borderRadius: 2
                            }}>
                              {s.skin_record_body_location}
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        {s.notes ? (
                          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.4 }}>
                            <strong>Patient Observation:</strong> {s.notes}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            No specific patient notes documented.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Doctor Clinical Observation & Recommendations Section (Requirement 11 & 12) */}
                    {(s.doctor_observation || s.doctor_feedback) && (
                      <div style={{
                        marginTop: 4,
                        padding: '10px 14px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Stethoscope size={15} color="#2563eb" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
                            Dermatologist Clinical Review ({s.reviewed_by_doctor_name ? `Dr. ${s.reviewed_by_doctor_name}` : 'Attending Dermatologist'})
                          </span>
                          {s.reviewed_at && (
                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                              • {formatDate(s.reviewed_at)}
                            </span>
                          )}
                        </div>

                        {s.doctor_observation && (
                          <div style={{ fontSize: '0.825rem', color: '#1e3a8a', marginBottom: s.doctor_feedback ? 4 : 0 }}>
                            <strong>Clinical Observation:</strong> {s.doctor_observation}
                          </div>
                        )}

                        {s.doctor_feedback && (
                          <div style={{ fontSize: '0.825rem', color: '#1e3a8a' }}>
                            <strong>Recommendations:</strong> {s.doctor_feedback}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                      <button
                        onClick={() => setSelectedSymptomModal(s)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0d6efd',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <span>View Full Entry Details</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Safety Alert Modal */}
      {activeAdvisory && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500, borderTop: '5px solid #dc2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={26} color="#dc2626" />
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.15rem', fontWeight: 700 }}>
                {activeAdvisory.title}
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5, marginBottom: 16 }}>
              {activeAdvisory.message}
            </p>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: 6, fontSize: '0.775rem', color: '#64748b', marginBottom: 18, border: '1px solid #e2e8f0' }}>
              {activeAdvisory.safety_guideline}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setActiveAdvisory(null)}
                style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
              >
                I Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedSymptomModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Symptom & Observation Dossier
              </h3>
              <button
                onClick={() => setSelectedSymptomModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            {selectedSymptomModal.skin_record_image_url && (
              <div style={{ height: 200, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                <img
                  src={getImageUrl(selectedSymptomModal.skin_record_image_url)}
                  alt="Associated lesion"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, backgroundColor: '#f8fafc', padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Symptom Name</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedSymptomModal.symptom_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Severity Level</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: selectedSymptomModal.severity?.toLowerCase() === 'severe' ? '#dc2626' : selectedSymptomModal.severity?.toLowerCase() === 'moderate' ? '#d97706' : '#16a34a' }}>
                  {selectedSymptomModal.severity} (Score: {selectedSymptomModal.severity_score}/3)
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Duration</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{selectedSymptomModal.duration || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Recorded At</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{formatDate(selectedSymptomModal.recorded_at)}</div>
              </div>
            </div>

            {selectedSymptomModal.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Patient Description & Triggers</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  "{selectedSymptomModal.notes}"
                </div>
              </div>
            )}

            {/* Doctor Clinical Review */}
            {(selectedSymptomModal.doctor_observation || selectedSymptomModal.doctor_feedback) && (
              <div style={{ marginBottom: 16, padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>
                  Dermatologist Clinical Observation ({selectedSymptomModal.reviewed_by_doctor_name ? `Dr. ${selectedSymptomModal.reviewed_by_doctor_name}` : 'Doctor'})
                </div>
                {selectedSymptomModal.doctor_observation && (
                  <div style={{ fontSize: '0.825rem', color: '#1e3a8a', marginBottom: 4 }}>
                    <strong>Observation:</strong> {selectedSymptomModal.doctor_observation}
                  </div>
                )}
                {selectedSymptomModal.doctor_feedback && (
                  <div style={{ fontSize: '0.825rem', color: '#1e3a8a' }}>
                    <strong>Recommendations:</strong> {selectedSymptomModal.doctor_feedback}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setSelectedSymptomModal(null)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 380, textAlign: 'center' }}>
            <h4 style={{ color: '#dc2626', margin: '0 0 10px', fontSize: '1.1rem', fontWeight: 700 }}>
              Delete Symptom Entry?
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 18 }}>
              Are you sure you want to remove this symptom record from your history?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSymptom(deleteConfirmId)}
                style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
