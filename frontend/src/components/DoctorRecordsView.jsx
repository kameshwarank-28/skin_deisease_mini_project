import React, { useState, useEffect } from 'react';
import {
  FolderHeart,
  Search,
  Filter,
  Eye,
  Stethoscope,
  Pill,
  Calendar,
  User,
  Images,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Loader2,
  ExternalLink
} from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function DoctorRecordsView({ setActiveTab }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordModal, setSelectedRecordModal] = useState(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/all-patient-records');
      setRecords(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor patient records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique patient options
  const uniquePatients = Array.from(new Set(records.map(r => r.patient_name || `Patient #${r.user_id}`)));
  const uniqueLocations = Array.from(new Set(records.map(r => r.body_location).filter(Boolean)));

  const filteredRecords = records.filter(r => {
    const pName = r.patient_name || `Patient #${r.user_id}`;
    const matchesPatient = selectedPatientFilter === 'all' || pName === selectedPatientFilter;
    const matchesLocation = selectedLocationFilter === 'all' || r.body_location === selectedLocationFilter;
    const q = searchQuery.toLowerCase();
    const disease = (r.predicted_disease || '').toLowerCase();
    const notes = (r.user_notes || '').toLowerCase();
    return matchesPatient && matchesLocation && (pName.toLowerCase().includes(q) || disease.includes(q) || notes.includes(q));
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
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
        <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading patient skin records...</div>
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
          backgroundColor: '#f0fdfa',
          border: '1px solid #ccfbf1',
          borderRadius: 20,
          fontSize: '0.75rem',
          color: '#0d9488',
          fontWeight: 600,
          marginBottom: 8
        }}>
          <ShieldCheck size={14} />
          <span>Longitudinal Lesion Monitoring Repository</span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          Authorized Patient Skin Records ({records.length})
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Browse high-resolution photographs, AI diagnostic classification scores, and lesion progression details for authorized connected patients.
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
              value={selectedPatientFilter}
              onChange={(e) => setSelectedPatientFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="all">All Connected Patients ({uniquePatients.length})</option>
              {uniquePatients.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Location Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#64748b' }}>Location:</span>
            <select
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="all">All Body Locations</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Search records or diagnoses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
          />
        </div>
      </div>

      {/* Records Grid */}
      {filteredRecords.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '48px 20px',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <FolderHeart size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No Skin Records Found</div>
          <p style={{ fontSize: '0.825rem', maxWidth: 400, margin: '6px auto 0' }}>
            No records matched the current filter criteria, or connected patients have not uploaded lesion photographs yet.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16
        }}>
          {filteredRecords.map(rec => (
            <div
              key={rec.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                {/* Lesion Photo Preview */}
                <div style={{ height: 160, backgroundColor: '#0f172a', overflow: 'hidden', position: 'relative' }}>
                  {rec.image_filename ? (
                    <img
                      src={getImageUrl(rec.image_filename)}
                      alt={rec.body_location}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      <Images size={36} />
                    </div>
                  )}

                  <span style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {rec.body_location || 'Skin Lesion'}
                  </span>

                  <span style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#38bdf8',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {rec.patient_name || `Patient #${rec.user_id}`}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Captured: {formatDate(rec.capture_date)}
                    </span>
                    {rec.confidence_score && (
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#0d9488' }}>
                        {Math.round(rec.confidence_score * 100)}% AI Conf.
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', lineHeight: 1.3 }}>
                    {rec.predicted_disease || 'Lesion Entry'}
                  </h3>

                  {rec.user_notes && (
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 10px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      "{rec.user_notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSelectedRecordModal(rec)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: '#0d6efd',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Eye size={14} />
                  <span>Inspect Lesion</span>
                </button>

                <button
                  onClick={() => setActiveTab('doctor_consultations')}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Document Consultation Note"
                >
                  <Stethoscope size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Clinical Lesion Inspection
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Patient: {selectedRecordModal.patient_name || `Patient #${selectedRecordModal.user_id}`}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ height: 300, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <img
                src={getImageUrl(selectedRecordModal.image_filename)}
                alt={selectedRecordModal.body_location}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, backgroundColor: '#f8fafc', padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Body Location</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{selectedRecordModal.body_location}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>AI Prediction</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0d6efd' }}>{selectedRecordModal.predicted_disease || 'None'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Confidence Score</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0d9488' }}>
                  {selectedRecordModal.confidence_score ? `${Math.round(selectedRecordModal.confidence_score * 100)}%` : 'N/A'}
                </div>
              </div>
            </div>

            {selectedRecordModal.user_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Patient Clinical Notes</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  "{selectedRecordModal.user_notes}"
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedRecordModal(null)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedRecordModal(null);
                  setActiveTab('doctor_consultations');
                }}
                style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Stethoscope size={14} />
                <span>Create Consultation</span>
              </button>
              <button
                onClick={() => {
                  setSelectedRecordModal(null);
                  setActiveTab('doctor_treatments');
                }}
                style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Pill size={14} />
                <span>Prescribe Treatment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
