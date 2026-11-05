import React, { useState, useEffect } from 'react';
import { Stethoscope, Building, Calendar, X } from 'lucide-react';
import api from '../services/api';

export default function ConsultationManager({ setActiveTab }) {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [doctorName, setDoctorName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [consultationDate, setConsultationDate] = useState(new Date().toISOString().slice(0, 10));
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  const [expectedReviewDate, setExpectedReviewDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/consultations');
      setConsultations(res.data || []);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setDoctorName('');
    setClinicName('');
    setConsultationDate(new Date().toISOString().slice(0, 10));
    setDoctorDiagnosis('');
    setConsultationNotes('');
    setFollowUpInstructions('');
    setExpectedReviewDate('');
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditingId(c.id);
    setDoctorName(c.doctor_name);
    setClinicName(c.clinic_name);
    setConsultationDate(new Date(c.consultation_date).toISOString().slice(0, 10));
    setDoctorDiagnosis(c.doctor_diagnosis);
    setConsultationNotes(c.consultation_notes || '');
    setFollowUpInstructions(c.follow_up_instructions || '');
    setExpectedReviewDate(c.expected_review_date ? new Date(c.expected_review_date).toISOString().slice(0, 10) : '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!doctorName || !clinicName || !doctorDiagnosis) {
      setFormError('Doctor name, clinic name, and clinical diagnosis are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      doctor_name: doctorName.trim(),
      clinic_name: clinicName.trim(),
      consultation_date: new Date(consultationDate).toISOString(),
      doctor_diagnosis: doctorDiagnosis.trim(),
      consultation_notes: consultationNotes.trim() || null,
      follow_up_instructions: followUpInstructions.trim() || null,
      expected_review_date: expectedReviewDate ? new Date(expectedReviewDate).toISOString() : null
    };

    try {
      if (editingId) {
        await api.put(`/api/consultations/${editingId}`, payload);
      } else {
        await api.post('/api/consultations', payload);
      }
      setShowModal(false);
      fetchConsultations();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save consultation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/consultations/${id}`);
      setDeleteId(null);
      fetchConsultations();
    } catch (err) {
      alert('Failed to delete consultation: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
            Dermatologist Consultation Records
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
            Document official dermatologist clinical evaluations, verified diagnoses, and physician recommendations.
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn-submit">
          + Add Consultation
        </button>
      </div>

      {/* Consultations List */}
      {loading ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          Loading consultations...
        </div>
      ) : consultations.length === 0 ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 50, color: '#6c757d' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Stethoscope size={44} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#495057' }}>No Consultation Records Documented</h3>
          <p style={{ fontSize: '0.85rem', maxWidth: 450, margin: '0 auto 16px' }}>
            Keep track of professional clinical evaluations, dermatologist diagnoses, and physician-guided instructions.
          </p>
          <button onClick={handleOpenCreate} className="btn-submit">
            + Document First Visit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {consultations.map(c => (
            <div key={c.id} className="project-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f3f5', paddingBottom: 12, marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                    Dr. {c.doctor_name}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#6c757d', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Building size={14} color="#1177DE" />
                    <span>{c.clinic_name}</span>
                    <span>•</span>
                    <Calendar size={14} color="#64748b" />
                    <span>Visit Date: {new Date(c.consultation_date).toLocaleDateString([], { dateStyle: 'long' })}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', borderColor: '#dc3545', color: '#dc3545' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Diagnosis Box */}
                <div style={{ backgroundColor: '#EAF3FC', border: '1px solid #7CB0EA', borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#084298', fontWeight: 700, textTransform: 'uppercase' }}>
                    Physician's Clinical Diagnosis
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#052c65', marginTop: 4 }}>
                    {c.doctor_diagnosis}
                  </div>
                  {c.expected_review_date && (
                    <div style={{ fontSize: '0.8rem', color: '#1177DE', marginTop: 8 }}>
                      Expected Review: {new Date(c.expected_review_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Instructions & Notes */}
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: '0.85rem', color: '#212529' }}>Doctor's Instructions:</strong>
                    <p style={{ fontSize: '0.85rem', color: '#495057', margin: '4px 0 0' }}>
                      {c.follow_up_instructions || <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>None specified.</span>}
                    </p>
                  </div>
                  {c.consultation_notes && (
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#212529' }}>Clinical Notes:</strong>
                      <p style={{ fontSize: '0.85rem', color: '#495057', margin: '4px 0 0' }}>
                        {c.consultation_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADD / EDIT CONSULTATION */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1177DE', fontSize: '1.2rem' }}>
                {editingId ? 'Edit Consultation Record' : 'Document Dermatologist Consultation'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Dermatologist Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Emily Vance"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hospital / Clinic *</label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Skin Clinic"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Consultation Date *</label>
                  <input
                    type="date"
                    value={consultationDate}
                    onChange={(e) => setConsultationDate(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Review Date</label>
                  <input
                    type="date"
                    value={expectedReviewDate}
                    onChange={(e) => setExpectedReviewDate(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dermatologist's Clinical Diagnosis *</label>
                <input
                  type="text"
                  placeholder="e.g. Mild Atopic Dermatitis, Seborrheic Keratosis"
                  value={doctorDiagnosis}
                  onChange={(e) => setDoctorDiagnosis(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Physician's Instructions & Care Guidance</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Apply prescribed cream twice daily after showering, avoid fragrance soaps..."
                  value={followUpInstructions}
                  onChange={(e) => setFollowUpInstructions(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Clinical Notes</label>
                <textarea
                  rows={2}
                  placeholder="Biopsy recommendations, blood test referrals, or clinical comments..."
                  value={consultationNotes}
                  onChange={(e) => setConsultationNotes(e.target.value)}
                  className="form-control"
                />
              </div>

              {formError && (
                <div style={{ padding: '8px 12px', backgroundColor: '#f8d7da', color: '#842029', borderRadius: 4, marginBottom: 12, fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-submit">
                  {submitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Save Consultation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
            <h4 style={{ color: '#dc3545', margin: '0 0 10px' }}>Delete Consultation Record</h4>
            <p style={{ fontSize: '0.85rem', color: '#495057', marginBottom: 18 }}>
              Are you sure you want to remove this consultation?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} className="btn-outline">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-submit"
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

