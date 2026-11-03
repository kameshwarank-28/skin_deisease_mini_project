import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';
import api, { setAuthSession } from '../services/api';

export default function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [selectedRole, setSelectedRole] = useState('patient'); // 'patient' | 'doctor'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        username: username.trim(),
        password: password,
        role: selectedRole
      });

      const { access_token, user, has_patient_profile } = res.data;
      setAuthSession(access_token, user);
      onLoginSuccess(access_token, user, has_patient_profile);
    } catch (err) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || 'Invalid username or password. Please try again.');
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
      backgroundColor: '#f1f5f9',
      padding: '24px 16px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Top Header Banner */}
        <div style={{
          backgroundColor: '#0b1329',
          padding: '26px 24px 22px',
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: 'rgba(13, 110, 253, 0.15)',
            color: '#38bdf8',
            marginBottom: 10,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <ShieldCheck size={26} />
          </div>
          <h1 style={{
            margin: '0 0 4px',
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff'
          }}>
            DermAI Health Monitor
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.825rem',
            color: '#94a3b8'
          }}>
            Dual-Role Clinical Decision Support & Patient Portal
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px' }}>
          {/* Role Selection Segmented Control */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: '0.775rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#64748b',
              marginBottom: 8
            }}>
              Select Account Type
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              backgroundColor: '#f1f5f9',
              padding: 4,
              borderRadius: 8
            }}>
              <button
                type="button"
                onClick={() => { setSelectedRole('patient'); setErrorMessage(''); }}
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
                  backgroundColor: selectedRole === 'patient' ? '#ffffff' : 'transparent',
                  color: selectedRole === 'patient' ? '#0d6efd' : '#64748b',
                  boxShadow: selectedRole === 'patient' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <UserCheck size={16} />
                <span>Patient Login</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedRole('doctor'); setErrorMessage(''); }}
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
                  backgroundColor: selectedRole === 'doctor' ? '#0b1329' : 'transparent',
                  color: selectedRole === 'doctor' ? '#38bdf8' : '#64748b',
                  boxShadow: selectedRole === 'doctor' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Stethoscope size={16} />
                <span>Doctor Login</span>
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h2 style={{
              margin: '0 0 2px',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#0f172a'
            }}>
              {selectedRole === 'patient' ? 'Patient Sign In' : 'Clinician / Doctor Sign In'}
            </h2>
            <p style={{
              margin: 0,
              fontSize: '0.825rem',
              color: '#64748b'
            }}>
              {selectedRole === 'patient'
                ? 'Sign in to access your personal skin health records and monitor progress.'
                : 'Sign in to manage connected patients, review appointments, and record clinical consults.'}
            </p>
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

          <form onSubmit={handleSubmit}>
            {/* Username Field */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6
              }}>
                Username or Email
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}>
                  <User size={18} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedRole === 'patient' ? 'e.g. alan' : 'e.g. dr_smith'}
                  autoComplete="username"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#ffffff'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0d6efd'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}>
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 38px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#ffffff'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0d6efd'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                backgroundColor: selectedRole === 'doctor' ? '#0b1329' : '#0d6efd',
                color: selectedRole === 'doctor' ? '#38bdf8' : '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.925rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: selectedRole === 'doctor'
                  ? '0 2px 4px rgba(11, 19, 41, 0.3)'
                  : '0 2px 4px rgba(13, 110, 253, 0.2)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = selectedRole === 'doctor' ? '#172554' : '#0b5ed7';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = selectedRole === 'doctor' ? '#0b1329' : '#0d6efd';
                }
              }}
            >
              {loading ? 'Authenticating...' : `Sign In as ${selectedRole === 'patient' ? 'Patient' : 'Doctor'}`}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Switch to Register link */}
          <div style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: '#64748b'
          }}>
            Don't have an account yet?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#0d6efd',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.85rem',
                textDecoration: 'underline'
              }}
            >
              Register New Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

