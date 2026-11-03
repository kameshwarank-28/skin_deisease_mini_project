import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Clock,
  Camera,
  Activity,
  Stethoscope,
  Pill,
  CalendarDays,
  Sparkles,
  GitCompare,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  MapPin,
  Plus
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function SkinTimelineView({ setActiveTab }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('All');

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint handles patient timeline
      const res = await api.get('/api/skin-timeline');
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed fetching skin timeline:', err);
      setError(err.response?.data?.detail || 'Unable to load your skin health timeline. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateVal);
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'skin_record':
        return { label: 'Skin Photo', color: '#0d6efd', bg: '#e7f1ff', icon: Camera };
      case 'ai_classification':
        return { label: 'AI Diagnostic', color: '#2563eb', bg: '#dbeafe', icon: Sparkles };
      case 'symptom':
        return { label: 'Symptom Log', color: '#b45309', bg: '#fef3c7', icon: Activity };
      case 'consultation':
        return { label: 'Doctor Visit', color: '#6d28d9', bg: '#ede9fe', icon: Stethoscope };
      case 'treatment_start':
        return { label: 'Treatment', color: '#15803d', bg: '#dcfce7', icon: Pill };
      case 'appointment':
        return { label: 'Appointment', color: '#0284c7', bg: '#e0f2fe', icon: CalendarDays };
      case 'image_comparison':
        return { label: 'Lesion Comparison', color: '#4338ca', bg: '#e0e7ff', icon: GitCompare };
      default:
        return { label: 'Event', color: '#475569', bg: '#f1f5f9', icon: History };
    }
  };

  const filteredEvents = filterType === 'All'
    ? events
    : events.filter(e => {
        if (filterType === 'photos') return e.event_type === 'skin_record';
        if (filterType === 'ai') return e.event_type === 'ai_classification';
        if (filterType === 'symptoms') return e.event_type === 'symptom';
        if (filterType === 'consultations') return e.event_type === 'consultation';
        if (filterType === 'treatments') return e.event_type === 'treatment_start';
        if (filterType === 'appointments') return e.event_type === 'appointment';
        return true;
      });

  const photoCount = events.filter(e => e.event_type === 'skin_record').length;
  const aiCount = events.filter(e => e.event_type === 'ai_classification').length;
  const symptomCount = events.filter(e => e.event_type === 'symptom').length;
  const consultCount = events.filter(e => e.event_type === 'consultation').length;
  const treatCount = events.filter(e => e.event_type === 'treatment_start').length;
  const apptCount = events.filter(e => e.event_type === 'appointment').length;

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Skin Health Progress Timeline
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            A unified chronological history of skin lesion photographs, AI predictions, recorded symptoms, doctor consultations, and prescribed regimens.
          </p>
        </div>

        <button
          onClick={fetchTimeline}
          disabled={loading}
          style={{
            padding: '7px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title="Refresh timeline activities"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'All', label: `All Activities (${events.length})` },
          { key: 'photos', label: `Skin Photos (${photoCount})` },
          { key: 'ai', label: `AI Diagnostic (${aiCount})` },
          { key: 'symptoms', label: `Symptoms (${symptomCount})` },
          { key: 'consultations', label: `Visits (${consultCount})` },
          { key: 'treatments', label: `Treatments (${treatCount})` },
          { key: 'appointments', label: `Appointments (${apptCount})` }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: filterType === f.key ? '1px solid #0d6efd' : '1px solid #e2e8f0',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: filterType === f.key ? '#eff6ff' : '#ffffff',
              color: filterType === f.key ? '#0d6efd' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 18px',
          borderRadius: 8,
          marginBottom: 20,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchTimeline}
            style={{
              padding: '5px 12px',
              backgroundColor: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Timeline List */}
      {loading ? (
        <div className="project-card" style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <RefreshCw size={26} className="animate-spin" color="#0d6efd" />
          </div>
          <div style={{ fontWeight: 600, color: '#334155' }}>Loading chronological timeline...</div>
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="project-card" style={{ textAlign: 'center', padding: '50px 24px', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <History size={46} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Your Skin Health Timeline is Empty
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 460, margin: '0 auto 20px' }}>
            Your skin records, symptoms, consultations and follow-up activities will appear here when you add or receive updates.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {setActiveTab && (
              <>
                <button
                  onClick={() => setActiveTab('diagnose')}
                  className="btn-submit"
                  style={{ fontSize: '0.825rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  <span>+ Take AI Scan</span>
                </button>
                <button
                  onClick={() => setActiveTab('symptoms')}
                  className="btn-outline"
                  style={{ fontSize: '0.825rem', padding: '8px 14px' }}
                >
                  + Log Symptoms
                </button>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="btn-outline"
                  style={{ fontSize: '0.825rem', padding: '8px 14px' }}
                >
                  + Book Appointment
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="project-card" style={{ padding: '24px 20px' }}>
          <div className="timeline" style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #e2e8f0' }}>
            {filteredEvents.map(evt => {
              const badge = getEventBadge(evt.event_type);
              const IconComp = badge.icon;

              return (
                <div key={evt.event_id} style={{ position: 'relative', marginBottom: 24 }}>
                  {/* Timeline Dot */}
                  <div style={{
                    position: 'absolute',
                    left: -33,
                    top: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: badge.color,
                    border: '3px solid #ffffff',
                    boxShadow: '0 0 0 2px #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} />

                  {/* Event Card */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '16px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <IconComp size={12} />
                          <span>{badge.label}</span>
                        </span>

                        {evt.body_location && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: '0.75rem',
                            color: '#64748b',
                            backgroundColor: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            <MapPin size={11} /> {evt.body_location}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>{formatEventDate(evt.date)}</span>
                      </div>
                    </div>

                    {/* Event Title */}
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
                      {evt.title}
                    </h4>

                    {/* Subtitle */}
                    {evt.subtitle && (
                      <div style={{ fontSize: '0.85rem', color: '#0d6efd', fontWeight: 600, marginBottom: 6 }}>
                        {evt.subtitle}
                      </div>
                    )}

                    {/* Description */}
                    {evt.description && (
                      <p style={{ fontSize: '0.825rem', color: '#475569', margin: '0 0 10px', lineHeight: 1.5 }}>
                        {evt.description}
                      </p>
                    )}

                    {/* Image Preview (if present) */}
                    {evt.image_url && (
                      <div style={{ marginTop: 8, marginBottom: 10, maxWidth: 220, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <img
                          src={getImageUrl(evt.image_url)}
                          alt={evt.title}
                          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 150, objectFit: 'contain', backgroundColor: '#f8fafc' }}
                        />
                      </div>
                    )}

                    {/* Link to view record module */}
                    {evt.link_tab && setActiveTab && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(evt.link_tab)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0d6efd',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>Open related {evt.event_type.replace('_', ' ')} record</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
