import React, { useState } from 'react';
import { UserCheck, Shield, AlertCircle, ArrowRight, HeartHandshake } from 'lucide-react';
import api from '../services/api';

export default function PatientProfileSetup({ currentUser, onProfileCreated }) {
  const [formData, setFormData] = useState({
    patient_name: currentUser?.full_name || '',
    age: '',
    gender: 'Prefer not to say',
    phone_number: currentUser?.phone_number || '',
    email_address: currentUser?.email || '',
    additional_details: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.patient_name.trim()) {
      setErrorMessage('Patient Name is required.');
      return;
    }

    const ageNum = parseInt(formData.age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      setErrorMessage('Please enter a valid age between 0 and 130.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/patient-profile', {
        patient_name: formData.patient_name.trim(),
        age: ageNum,
        gender: formData.gender,
        phone_number: formData.phone_number.trim() || null,
        email_address: formData.email_address.trim() || null,
        additional_details: formData.additional_details.trim() || null
      });

      onProfileCreated(res.data);
    } catch (err) {
      console.error('Create profile error:', err);
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || 'Could not save patient profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '28px 16px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 560,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Welcome Banner */}
        <div style={{
          backgroundColor: '#0b1329',
          padding: '28px 24px',
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: 'rgba(13, 110, 253, 0.15)',
            color: '#38bdf8',
            marginBottom: 12,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <HeartHandshake size={28} />
          </div>
          <h1 style={{
            margin: '0 0 6px',
            fontSize: '1.45rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff'
          }}>
            Welcome to DermAI Health Monitor
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            color: '#94a3b8'
          }}>
            Create your patient profile to get started.
          </p>
        </div>

        {/* Profile Form */}
        <div style={{ padding: '28px 24px' }}>
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#b91c1c',
              fontSize: '0.85rem',
              marginBottom: 18
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Patient Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Patient Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.patient_name}
                onChange={(e) => handleChange('patient_name', e.target.value)}
                placeholder="Enter patient full name"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Age & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Age <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  value={formData.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  placeholder="e.g. 34"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Gender <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(Optional)</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Phone & Email (Optional) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Contact Phone <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => handleChange('phone_number', e.target.value)}
                  placeholder="e.g. +1 555-0100"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Contact Email <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  value={formData.email_address}
                  onChange={(e) => handleChange('email_address', e.target.value)}
                  placeholder="e.g. patient@mail.com"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Additional Details (Optional) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Additional Details / Medical History <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={formData.additional_details}
                onChange={(e) => handleChange('additional_details', e.target.value)}
                placeholder="Mention known skin conditions, allergies, skin sensitivity, or medical history..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.875rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0d6efd',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0b5ed7'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0d6efd'; }}
            >
              {loading ? 'Saving Profile...' : 'Create Patient Profile'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

