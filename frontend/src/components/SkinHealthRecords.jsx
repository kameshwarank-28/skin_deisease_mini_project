import React, { useState, useEffect } from 'react';
import { FolderHeart, Trash2, X, MapPin, Pencil } from 'lucide-react';
import api, { getImageUrl } from '../services/api';

const BODY_LOCATIONS = [
  'Face', 'Neck', 'Chest', 'Back', 'Abdomen',
  'Left Arm', 'Right Arm', 'Hands',
  'Left Leg', 'Right Leg', 'Feet', 'Scalp', 'Other'
];

export default function SkinHealthRecords({ setActiveTab, onCompareSelect }) {
  const [records, setRecords] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState('All');

  // Form State for creating record
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bodyLocation, setBodyLocation] = useState('Face');
  const [captureDate, setCaptureDate] = useState(new Date().toISOString().slice(0, 16));
  const [userNotes, setUserNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedPredictionId, setSelectedPredictionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Detail / Edit modal state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchRecords();
    fetchPredictionHistory();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/skin-records');
      setRecords(res.data || []);
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictionHistory = async () => {
    try {
      const res = await api.get('/api/history?limit=15');
      setPredictions(res.data || []);
    } catch (err) {
      console.error('Error fetching predictions:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSelectedPredictionId('');
    }
  };

  const handleSelectPrediction = (predId) => {
    setSelectedPredictionId(predId);
    setSelectedFile(null);
    const pred = predictions.find(p => p.id === parseInt(predId));
    if (pred && pred.image_preview) {
      setPreviewUrl(pred.image_preview);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!selectedFile && !selectedPredictionId) {
      setFormError('Please select a photo file or an existing AI scan.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const formData = new FormData();
    formData.append('body_location', bodyLocation);
    formData.append('capture_date', new Date(captureDate).toISOString());
    formData.append('user_notes', userNotes);

    if (selectedFile) {
      formData.append('file', selectedFile);
    } else if (selectedPredictionId) {
      formData.append('prediction_id', selectedPredictionId);
    }

    try {
      await api.post('/api/skin-records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowCreateModal(false);
      resetForm();
      fetchRecords();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save skin health record.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedPredictionId('');
    setUserNotes('');
    setFormError(null);
  };

  const handleUpdateRecord = async () => {
    if (!selectedRecord) return;
    try {
      const res = await api.put(`/api/skin-records/${selectedRecord.id}`, {
        body_location: editLocation,
        user_notes: editNotes
      });
      setSelectedRecord(res.data);
      setIsEditing(false);
      fetchRecords();
    } catch (err) {
      alert('Failed to update record: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteRecord = async (id) => {
    try {
      await api.delete(`/api/skin-records/${id}`);
      setDeleteConfirmId(null);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
      fetchRecords();
    } catch (err) {
      alert('Failed to delete record: ' + (err.response?.data?.detail || err.message));
    }
  };

  const filteredRecords = filterLocation === 'All'
    ? records
    : records.filter(r => r.body_location.toLowerCase() === filterLocation.toLowerCase());

  return (
    <div>
      {/* Top Banner & Header */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0d6efd', margin: 0 }}>
            Skin Health Record Management
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: '4px 0 0' }}>
            Store and track photos of affected skin sites, document body locations, and link with AI diagnosis history.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="btn-submit"
        >
          + Add New Skin Record
        </button>
      </div>

      {/* Location Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 16 }}>
        <button
          onClick={() => setFilterLocation('All')}
          className={filterLocation === 'All' ? 'btn-submit' : 'btn-outline'}
          style={{ padding: '5px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
        >
          All Locations ({records.length})
        </button>
        {BODY_LOCATIONS.map(loc => {
          const count = records.filter(r => r.body_location.toLowerCase() === loc.toLowerCase()).length;
          if (count === 0 && filterLocation !== loc) return null;
          return (
            <button
              key={loc}
              onClick={() => setFilterLocation(loc)}
              className={filterLocation === loc ? 'btn-submit' : 'btn-outline'}
              style={{ padding: '5px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              {loc} ({count})
            </button>
          );
        })}
      </div>

      {/* Records Gallery Grid */}
      {loading ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          Loading skin health records...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <FolderHeart size={44} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#495057' }}>No Records Found</h3>
          <p style={{ fontSize: '0.85rem' }}>No skin records found for the selected filter.</p>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="btn-submit"
            style={{ marginTop: 10 }}
          >
            + Create First Record
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {filteredRecords.map(rec => (
            <div
              key={rec.id}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ height: 180, backgroundColor: '#e9ecef', position: 'relative' }}>
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
                  backgroundColor: '#0d6efd',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4
                }}>
                  {rec.body_location}
                </span>
                <span style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: 4
                }}>
                  {new Date(rec.capture_date).toLocaleDateString()}
                </span>
              </div>

              <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {rec.predicted_disease ? (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: '#6c757d', textTransform: 'uppercase' }}>AI Prediction</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0d6efd' }}>
                      {rec.predicted_disease}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: 6 }}>
                    Self-monitored photo
                  </div>
                )}

                {rec.user_notes ? (
                  <p style={{ fontSize: '0.8rem', color: '#495057', margin: '0 0 10px', flex: 1 }}>
                    {rec.user_notes.length > 80 ? rec.user_notes.slice(0, 80) + '...' : rec.user_notes}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: '#adb5bd', fontStyle: 'italic', margin: '0 0 10px', flex: 1 }}>
                    No notes entered.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', borderTop: '1px solid #f1f3f5', paddingTop: 10 }}>
                  <button
                    onClick={() => {
                      setSelectedRecord(rec);
                      setEditLocation(rec.body_location);
                      setEditNotes(rec.user_notes || '');
                      setIsEditing(false);
                    }}
                    className="btn-outline"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '4px 6px', justifyContent: 'center' }}
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      if (onCompareSelect) onCompareSelect(rec);
                      setActiveTab('comparison');
                    }}
                    className="btn-outline"
                    title="Compare in side-by-side tool"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: '#198754', color: '#198754' }}
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(rec.id)}
                    className="btn-outline"
                    title="Delete record"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: '#dc3545', color: '#dc3545', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE RECORD MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0d6efd', fontSize: '1.2rem' }}>Add New Skin Health Record</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord}>
              {/* Option to pick from recent AI predictions or upload new photo */}
              <div className="form-group">
                <label className="form-label">Image Source:</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="source"
                      checked={!selectedPredictionId}
                      onChange={() => { setSelectedPredictionId(''); }}
                    />
                    Upload New Photo File
                  </label>
                  {predictions.length > 0 && (
                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="source"
                        checked={!!selectedPredictionId}
                        onChange={() => { if (predictions.length > 0) handleSelectPrediction(predictions[0].id); }}
                      />
                      Select from Recent AI Scans
                    </label>
                  )}
                </div>

                {!selectedPredictionId ? (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="form-control"
                  />
                ) : (
                  <select
                    className="form-select"
                    value={selectedPredictionId}
                    onChange={(e) => handleSelectPrediction(e.target.value)}
                  >
                    {predictions.map(p => (
                      <option key={p.id} value={p.id}>
                        Scan #{p.id} — {p.predicted_class} ({new Date(p.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}

                {previewUrl && (
                  <div style={{ marginTop: 10, textAlign: 'center' }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 4, border: '1px solid var(--border-color)' }}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Affected Body Location *</label>
                <select
                  value={bodyLocation}
                  onChange={(e) => setBodyLocation(e.target.value)}
                  className="form-select"
                  required
                >
                  {BODY_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Capture Date & Time</label>
                <input
                  type="datetime-local"
                  value={captureDate}
                  onChange={(e) => setCaptureDate(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Personal Observations & Notes</label>
                <textarea
                  rows={3}
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Note any visible changes, duration of spot, or sensations..."
                  className="form-control"
                />
              </div>

              {formError && (
                <div style={{ padding: '8px 12px', backgroundColor: '#f8d7da', color: '#842029', borderRadius: 4, marginBottom: 12, fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-submit"
                >
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD DETAIL / EDIT MODAL */}
      {selectedRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0d6efd', fontSize: '1.2rem' }}>
                Skin Record #{selectedRecord.id} Details
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 18, marginBottom: 18 }}>
              <div>
                <img
                  src={getImageUrl(selectedRecord.image_url) || selectedRecord.thumbnail_b64}
                  alt={selectedRecord.body_location}
                  onError={(e) => {
                    if (selectedRecord.thumbnail_b64 && e.target.src !== selectedRecord.thumbnail_b64) {
                      e.target.src = selectedRecord.thumbnail_b64;
                    }
                  }}
                  style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border-color)', objectFit: 'contain' }}
                />
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#6c757d', textAlign: 'center' }}>
                  Captured: {new Date(selectedRecord.capture_date).toLocaleString()}
                </div>
              </div>

              <div>
                {!isEditing ? (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <span className="badge-label badge-info-custom" style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} />
                        <span>{selectedRecord.body_location}</span>
                      </span>
                    </div>

                    {selectedRecord.predicted_disease && (
                      <div style={{ background: '#e7f1ff', padding: '8px 12px', borderRadius: 4, marginBottom: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: '#084298', fontWeight: 600 }}>ASSOCIATED AI PREDICTION</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#052c65' }}>
                          {selectedRecord.predicted_disease}
                        </div>
                        {selectedRecord.confidence_score && (
                          <div style={{ fontSize: '0.8rem', color: '#0d6efd' }}>
                            Confidence: {(selectedRecord.confidence_score * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ fontSize: '0.85rem', color: '#212529' }}>User Notes:</strong>
                      <p style={{ fontSize: '0.85rem', color: '#495057', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                        {selectedRecord.user_notes || 'No notes provided.'}
                      </p>
                    </div>

                    {selectedRecord.symptoms && selectedRecord.symptoms.length > 0 && (
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: '#212529' }}>Associated Symptoms:</strong>
                        <ul style={{ paddingLeft: 18, fontSize: '0.825rem', marginTop: 4, color: '#495057' }}>
                          {selectedRecord.symptoms.map(s => (
                            <li key={s.id}>
                              <strong>{s.symptom_name}</strong>: {s.severity} ({s.duration || 'recent'})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="form-group">
                      <label className="form-label">Body Location:</label>
                      <select
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="form-select"
                      >
                        {BODY_LOCATIONS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Notes:</label>
                      <textarea
                        rows={4}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="form-control"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dee2e6', paddingTop: 14 }}>
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-outline"
                    style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Pencil size={14} />
                    <span>Edit Record</span>
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        if (onCompareSelect) onCompareSelect(selectedRecord);
                        setSelectedRecord(null);
                        setActiveTab('comparison');
                      }}
                      className="btn-submit"
                      style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                    >
                      Compare in Slider
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(selectedRecord.id)}
                      className="btn-outline"
                      style={{ borderColor: '#dc3545', color: '#dc3545', fontSize: '0.85rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="btn-outline"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Cancel Edit
                  </button>
                  <button
                    onClick={handleUpdateRecord}
                    className="btn-submit"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }}>
            <h3 style={{ color: '#dc3545', margin: '0 0 10px' }}>Confirm Deletion</h3>
            <p style={{ fontSize: '0.875rem', color: '#495057', marginBottom: 20 }}>
              Are you sure you want to delete this skin record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecord(deleteConfirmId)}
                className="btn-submit"
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

