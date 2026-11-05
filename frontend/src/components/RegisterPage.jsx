import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, Mail, Phone, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, Stethoscope, UserCheck, Award, Building, BookOpen } from 'lucide-react';
import api from '../services/api';
import LoginDoodleBackground from './LoginDoodleBackground';

export default function RegisterPage({ onSwitchToLogin, onRegistrationSuccess }) {
  const [role, setRole] = useState('patient'); // 'patient' | 'doctor'
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    // Doctor specific fields
    medicalRegNo: '',
    qualification: '',
    specialization: '',
    hospitalName: '',
    yearsExperience: '',
    bio: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Client-side validations
    const {
      fullName,
      username,
      email,
      password,
      confirmPassword,
      phoneNumber,
      medicalRegNo,
      qualification,
      specialization,
      hospitalName,
      yearsExperience,
      bio
    } = formData;

    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters long.');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Confirm Password does not match Password.');
      return;
    }

    if (role === 'doctor') {
      if (!medicalRegNo.trim()) {
        setErrorMessage('Medical Registration / License Number is required for clinicians.');
        return;
      }
      if (!qualification.trim()) {
        setErrorMessage('Medical qualification (e.g. MBBS, MD) is required.');
        return;
      }
      if (!specialization.trim()) {
        setErrorMessage('Specialization (e.g. Dermatology) is required.');
        return;
      }
      if (!hospitalName.trim()) {
        setErrorMessage('Hospital / Clinic affiliation is required.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password: password,
        role: role,
        phone_number: phoneNumber.trim() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      };

      if (role === 'doctor') {
        payload.medical_reg_no = medicalRegNo.trim();
        payload.qualification = qualification.trim();
        payload.specialization = specialization.trim();
        payload.hospital_name = hospitalName.trim();
        payload.years_experience = yearsExperience ? parseInt(yearsExperience, 10) : null;
        payload.bio = bio.trim() || null;
      }

      const res = await api.post('/api/auth/register', payload);

      if (role === 'doctor') {
        setSuccessMessage('Doctor account registered and verified! Redirecting to doctor login...');
      } else {
        setSuccessMessage('Patient account created successfully! Redirecting to sign in...');
      }

      // Delay briefly to allow user to see the success confirmation, then redirect to login
      setTimeout(() => {
        onRegistrationSuccess(username.trim());
      }, 1600);

    } catch (err) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C8DEF7',
      padding: '24px 16px',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* Dynamic Doodle Background: Patient Skin Care vs Doctor Clinical */}
      <LoginDoodleBackground role={role} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: role === 'doctor' ? 560 : 480,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 12px 30px -5px rgba(16, 37, 76, 0.15), 0 8px 14px -6px rgba(16, 37, 76, 0.08)',
        border: '1.5px solid #7CB0EA',
        overflow: 'hidden',
        transition: 'max-width 0.25s ease'
      }}>
        {/* Top Header Banner */}
        <div style={{
          backgroundColor: '#10254C',
          padding: '22px 24px',
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: 'rgba(13, 110, 253, 0.15)',
            color: '#448EE2',
            marginBottom: 8,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <h1 style={{
            margin: '0 0 4px',
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff'
          }}>
            Register for DermAI
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.825rem',
            color: '#94a3b8'
          }}>
            Create your secure healthcare portal account
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px' }}>
          {/* Role Selection Segmented Control */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontSize: '0.775rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#64748b',
              marginBottom: 8
            }}>
              Account Role
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              backgroundColor: '#EAF3FC',
              padding: 4,
              borderRadius: 8
            }}>
              <button
                type="button"
                onClick={() => { setRole('patient'); setErrorMessage(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: role === 'patient' ? '#1177DE' : 'transparent',
                  color: role === 'patient' ? '#ffffff' : '#4B6B94',
                  boxShadow: role === 'patient' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <UserCheck size={16} />
                <span>Patient Account</span>
              </button>

              <button
                type="button"
                onClick={() => { setRole('doctor'); setErrorMessage(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: role === 'doctor' ? '#1177DE' : 'transparent',
                  color: role === 'doctor' ? '#ffffff' : '#4B6B94',
                  boxShadow: role === 'doctor' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Stethoscope size={16} />
                <span>Doctor / Clinician</span>
              </button>
            </div>
          </div>

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
              fontSize: '0.825rem',
              marginBottom: 16
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              backgroundColor: '#EAF3FC',
              border: '1px solid #7CB0EA',
              borderRadius: 8,
              color: '#1177DE',
              fontSize: '0.825rem',
              marginBottom: 16
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                {role === 'doctor' ? 'Doctor Full Name' : 'Full Name'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder={role === 'doctor' ? 'e.g. Dr. Jane Mitchell, MD' : 'e.g. John Doe'}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.875rem',
                  border: '1px solid #7CB0EA',
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            {/* Username & Email in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Username <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder={role === 'doctor' ? 'e.g. dr_mitchell' : 'e.g. jdoe'}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="e.g. jane@clinic.com"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.875rem',
                    border: '1px solid #7CB0EA',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            </div>

            {/* Phone Number */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Phone Number <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                placeholder="e.g. +1 555-0199"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.875rem',
                  border: '1px solid #7CB0EA',
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            {/* DOCTOR SPECIFIC FIELDS */}
            {role === 'doctor' && (
              <div style={{
                backgroundColor: '#EAF3FC',
                border: '1px solid #7CB0EA',
                borderRadius: 8,
                padding: '14px',
                marginBottom: 14
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1177DE',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Award size={16} style={{ color: '#1177DE' }} />
                  <span>Clinical & Professional Credentials</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                      Medical Reg / License # <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.medicalRegNo}
                      onChange={(e) => handleChange('medicalRegNo', e.target.value)}
                      placeholder="e.g. DMR-93821"
                      required={role === 'doctor'}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.825rem',
                        border: '1px solid #7CB0EA',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                      Qualification <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => handleChange('qualification', e.target.value)}
                      placeholder="e.g. MBBS, MD Dermatology"
                      required={role === 'doctor'}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.825rem',
                        border: '1px solid #7CB0EA',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                      Specialization <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={(e) => handleChange('specialization', e.target.value)}
                      placeholder="e.g. Clinical Dermatology"
                      required={role === 'doctor'}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.825rem',
                        border: '1px solid #7CB0EA',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                      Hospital / Clinic <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalName}
                      onChange={(e) => handleChange('hospitalName', e.target.value)}
                      placeholder="e.g. City Health Dermatology"
                      required={role === 'doctor'}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.825rem',
                        border: '1px solid #7CB0EA',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                    Years of Clinical Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.yearsExperience}
                    onChange={(e) => handleChange('yearsExperience', e.target.value)}
                    placeholder="e.g. 10"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.825rem',
                      border: '1px solid #7CB0EA',
                      borderRadius: 6,
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Password & Confirm Password in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 34px 9px 12px',
                      fontSize: '0.875rem',
                      border: '1px solid #7CB0EA',
                      borderRadius: 6,
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="Repeat password"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 34px 9px 12px',
                      fontSize: '0.875rem',
                      border: '1px solid #7CB0EA',
                      borderRadius: 6,
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Register Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#10254C',
                color: '#ffffff',
                border: '1px solid #1177DE',
                borderRadius: 8,
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(47, 79, 79, 0.25)',
                transition: 'background-color 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#1177DE';
                  e.currentTarget.style.borderColor = '#1177DE';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#1177DE';
                  e.currentTarget.style.borderColor = '#1177DE';
                }
              }}
            >
              {loading ? 'Creating Account...' : `Register as ${role === 'doctor' ? 'Dermatologist' : 'Patient'}`}
              {!loading && <ArrowRight size={18} />}</button>
          </form>

          {/* Back to Login Link */}
          <div style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid #EAF3FC',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: '#64748b'
          }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: '#1177DE',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.85rem',
                textDecoration: 'underline'
              }}
            >
              Sign In Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
