import React, { useState, useEffect, useRef } from 'react';
import api, { getStoredUser, clearAuthSession } from '../services/api';
import { User, Shield, Bell, Settings, Lock, Edit3, Key, LogOut, CheckCircle2, AlertCircle, Camera, UploadCloud, Trash2, RefreshCw, Stethoscope, UserCheck } from 'lucide-react';

export default function UserProfileSettings({ initialTab = 'profile', onUserChanged, onLogoutClick }) {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [patientProfile, setPatientProfile] = useState(null);
  const [activeSection, setActiveSection] = useState(initialTab === 'settings' ? 'settings' : 'profile');

  // Edit Profile modal state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    patient_name: '',
    age: '',
    gender: 'Prefer not to say',
    phone_number: '',
    email_address: '',
    additional_details: ''
  });

  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Preferences
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [urgentWarnings, setUrgentWarnings] = useState(true);
  const [autoDeduplication, setAutoDeduplication] = useState(true);

  // Profile Picture Upload State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSuccessMsg, setPhotoSuccessMsg] = useState(null);
  const [photoErrorMsg, setPhotoErrorMsg] = useState(null);
  const photoInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchProfileAndPatientData();
    if (initialTab === 'settings') {
      setActiveSection('settings');
    }
  }, [initialTab]);

  const fetchProfileAndPatientData = async () => {
    try {
      const userRes = await api.get('/api/auth/me');
      setCurrentUser(userRes.data);
      localStorage.setItem('dermai_user', JSON.stringify(userRes.data));

      const profRes = await api.get('/api/patient-profile');
      setPatientProfile(profRes.data);
      if (profRes.data) {
        setEditFormData({
          patient_name: profRes.data.patient_name || '',
          age: profRes.data.age || '',
          gender: profRes.data.gender || 'Prefer not to say',
          phone_number: profRes.data.phone_number || '',
          email_address: profRes.data.email_address || '',
          additional_details: profRes.data.additional_details || ''
        });
      }
    } catch (e) {
      console.warn('Profile/Patient fetch error:', e);
    }
  };

  const handlePhotoSelect = (e) => {
    setPhotoErrorMsg(null);
    setPhotoSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoErrorMsg('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErrorMsg('Image size exceeds 5 MB. Please choose a smaller image.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setPhotoPreview(loadEvt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!photoPreview) return;
    setPhotoUploading(true);
    setPhotoErrorMsg(null);
    setPhotoSuccessMsg(null);
    try {
      const res = await api.post('/api/user/profile-picture', {
        image_base64: photoPreview
      });
      const updatedPicture = res.data.profile_picture;
      const updatedUser = { ...currentUser, profile_picture: updatedPicture };
      setCurrentUser(updatedUser);
      localStorage.setItem('dermai_user', JSON.stringify(updatedUser));
      setPhotoSuccessMsg('Profile photo updated successfully!');
      setPhotoFile(null);
      setPhotoPreview(null);
      if (onUserChanged) onUserChanged(updatedUser);
      window.dispatchEvent(new CustomEvent('dermai-profile-updated', { detail: updatedUser }));
    } catch (err) {
      setPhotoErrorMsg(err.response?.data?.detail || 'Failed to update profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    setPhotoUploading(true);
    setPhotoErrorMsg(null);
    setPhotoSuccessMsg(null);
    try {
      await api.delete('/api/user/profile-picture');
      const updatedUser = { ...currentUser, profile_picture: null };
      setCurrentUser(updatedUser);
      localStorage.setItem('dermai_user', JSON.stringify(updatedUser));
      setPhotoSuccessMsg('Profile photo removed.');
      setPhotoFile(null);
      setPhotoPreview(null);
      if (onUserChanged) onUserChanged(updatedUser);
      window.dispatchEvent(new CustomEvent('dermai-profile-updated', { detail: updatedUser }));
    } catch (err) {
      setPhotoErrorMsg(err.response?.data?.detail || 'Failed to remove profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const ageNum = parseInt(editFormData.age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      setErrorMsg('Please enter a valid age between 0 and 130.');
      setLoading(false);
      return;
    }

    try {
      const endpoint = patientProfile ? '/api/patient-profile' : '/api/patient-profile';
      const method = patientProfile ? api.put : api.post;
      const res = await method(endpoint, {
        patient_name: editFormData.patient_name.trim(),
        age: ageNum,
        gender: editFormData.gender,
        phone_number: editFormData.phone_number.trim() || null,
        email_address: editFormData.email_address.trim() || null,
        additional_details: editFormData.additional_details.trim() || null
      });

      setPatientProfile(res.data);
      setShowEditProfile(false);
      setSuccessMsg('Patient profile updated successfully.');
      if (onUserChanged) onUserChanged();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update patient profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword || !newPassword) {
      setErrorMsg('Please fill in both current and new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Confirm password does not match new password.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
      setSuccessMsg('Account password changed successfully.');
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
            Account Profile & System Settings
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
            Manage your patient account credentials, privacy preferences, and notification rules.
          </p>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setActiveSection('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={activeSection === 'profile' ? 'btn-submit' : 'btn-outline'}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            User Profile
          </button>
          <button
            onClick={() => { setActiveSection('settings'); setErrorMsg(null); setSuccessMsg(null); }}
            className={activeSection === 'settings' ? 'btn-submit' : 'btn-outline'}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Preferences & Settings
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#d1e7dd', color: '#0f5132', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#f8d7da', color: '#842029', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profile Section: 2-Column Responsive Layout */}
      {activeSection === 'profile' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          alignItems: 'start',
          maxWidth: 1040
        }}>
          {/* Left Column: Active Account & Profile Details Card */}
          <div className="project-card">
            <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Authenticated Account</span>
              <span className="badge-label badge-success-custom">Active Session</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#1177DE',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(13,110,253,0.3)',
                overflow: 'hidden'
              }}>
                {currentUser?.profile_picture ? (
                  <img
                    src={currentUser.profile_picture}
                    alt={currentUser?.full_name || 'User'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : 'U'
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1177DE' }}>
                  {currentUser?.full_name || 'User'}
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  @{currentUser?.username || 'user'} • {currentUser?.email}
                </div>
              </div>
            </div>

            {/* Patient Profile Card Details */}
            <div style={{ background: '#EAF3FC', border: '1px solid #7CB0EA', padding: 14, borderRadius: 8, marginBottom: 18, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #7CB0EA', pb: 6, paddingBottom: 6 }}>
                <strong style={{ color: '#1177DE' }}>Patient Profile</strong>
                <button
                  onClick={() => setShowEditProfile(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1177DE',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Edit3 size={13} /> Edit Profile
                </button>
              </div>

              {patientProfile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div><strong>Patient Name:</strong> {patientProfile.patient_name}</div>
                  <div><strong>Age:</strong> {patientProfile.age} yrs • <strong>Gender:</strong> {patientProfile.gender || 'Not specified'}</div>
                  {patientProfile.phone_number && <div><strong>Phone:</strong> {patientProfile.phone_number}</div>}
                  {patientProfile.email_address && <div><strong>Email:</strong> {patientProfile.email_address}</div>}
                  {patientProfile.additional_details && (
                    <div style={{ marginTop: 4, fontStyle: 'italic', color: '#64748b' }}>
                      "{patientProfile.additional_details}"
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>
                  No patient profile registered yet.{' '}
                  <button
                    onClick={() => setShowEditProfile(true)}
                    style={{ background: 'none', border: 'none', color: '#1177DE', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Create One Now
                  </button>
                </div>
              )}
            </div>

            {/* Account Details */}
            <div style={{ background: '#ffffff', border: '1px solid #7CB0EA', padding: 12, borderRadius: 6, marginBottom: 18, fontSize: '0.825rem' }}>
              <div style={{ marginBottom: 4 }}><strong>User ID:</strong> #{currentUser?.id} (Tenant Isolation Enforced)</div>
              <div style={{ marginBottom: 4 }}><strong>Timezone:</strong> {currentUser?.timezone || 'UTC'}</div>
              <div><strong>Registered:</strong> {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'N/A'}</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowChangePassword(true)}
                className="btn-outline"
                style={{ flex: 1, fontSize: '0.8rem', justifyContent: 'center' }}
              >
                <Key size={14} style={{ marginRight: 4 }} /> Change Password
              </button>
              <button
                onClick={onLogoutClick}
                className="btn-outline"
                style={{ flex: 1, fontSize: '0.8rem', justifyContent: 'center', color: '#ef4444', borderColor: '#fca5a5' }}
              >
                <LogOut size={14} style={{ marginRight: 4 }} /> Sign Out
              </button>
            </div>
          </div>

          {/* Right Column: Profile Photo Card (In the circled area!) */}
          <div className="project-card">
            <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentUser?.role === 'doctor' ? <Stethoscope size={18} color="#1177DE" /> : <Camera size={18} color="#1177DE" />}
                <span>{currentUser?.role === 'doctor' ? 'Doctor Clinical Portrait' : 'Patient Profile Photo'}</span>
              </div>
              <span className="badge-label badge-info-custom">
                {currentUser?.role === 'doctor' ? 'Official Clinician' : 'Patient ID'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
              {/* Circular Avatar Display */}
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 16 }}>
                <div style={{
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  backgroundColor: '#1177DE',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3.2rem',
                  fontWeight: 700,
                  border: '3.5px solid #1177DE',
                  boxShadow: '0 8px 24px rgba(17, 119, 222, 0.25)',
                  overflow: 'hidden',
                  background: '#ffffff'
                }}>
                  {(photoPreview || currentUser?.profile_picture) ? (
                    <img
                      src={photoPreview || currentUser.profile_picture}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#1177DE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </div>

                {/* Floating Camera Button badge */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Choose new photo"
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    backgroundColor: '#1177DE',
                    color: '#ffffff',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={18} />
                </button>
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: 12 }}>
                {(photoPreview || currentUser?.profile_picture) ? (
                  <span className="badge-label badge-success-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={12} /> {currentUser?.role === 'doctor' ? 'Official Portrait Active' : 'Profile Photo Active'}
                  </span>
                ) : (
                  <span className="badge-label badge-warning-custom">
                    No Custom Photo Set
                  </span>
                )}
              </div>

              {/* Feedback messages */}
              {photoSuccessMsg && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 6,
                  color: '#065f46',
                  fontSize: '0.825rem',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <CheckCircle2 size={15} /> {photoSuccessMsg}
                </div>
              )}
              {photoErrorMsg && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#b91c1c',
                  fontSize: '0.825rem',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <AlertCircle size={15} /> {photoErrorMsg}
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={photoInputRef}
                onChange={handlePhotoSelect}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                style={{ display: 'none' }}
              />

              {/* Upload Dropzone / Action Area */}
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{
                  width: '100%',
                  border: '2px dashed #7CB0EA',
                  borderRadius: 8,
                  backgroundColor: '#EAF3FC',
                  padding: '16px 12px',
                  cursor: 'pointer',
                  marginBottom: 14,
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <UploadCloud size={24} color="#1177DE" />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1177DE' }}>
                  {currentUser?.role === 'doctor' ? 'Click to Upload Clinical Photo' : 'Click to Upload Patient Photo'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Supports JPEG, PNG, or WEBP (up to 5MB)
                </div>
              </div>

              {/* Save / Cancel pending preview actions */}
              {photoPreview && (
                <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={handleSavePhoto}
                    disabled={photoUploading}
                    className="btn-submit"
                    style={{ flex: 1, fontSize: '0.825rem', padding: '8px 12px' }}
                  >
                    {photoUploading ? 'Saving Photo...' : 'Save Profile Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                    className="btn-outline"
                    style={{ fontSize: '0.825rem', padding: '8px 12px' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Remove Photo Button if a photo is currently set */}
              {currentUser?.profile_picture && !photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoUploading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px'
                  }}
                >
                  <Trash2 size={13} /> Remove Current Photo
                </button>
              )}

              {/* Informative Guidance */}
              <div style={{
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#ffffff',
                border: '1px solid #7CB0EA',
                fontSize: '0.775rem',
                color: '#64748b',
                lineHeight: 1.45,
                textAlign: 'left',
                width: '100%'
              }}>
                {currentUser?.role === 'doctor'
                  ? '🩺 Clinician Note: Your verified clinical photo is displayed in connected patient dossiers, consultation notes, and official prescription regimens.'
                  : '🛡️ Patient Note: Your uploaded photo helps your dermatologists and clinical staff identify you during video and in-person consultations.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 480px) 1fr', gap: 20 }}>
          <div className="project-card">
            <div className="project-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={16} color="#1177DE" />
              <span>System Preferences & Alerts</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1177DE' }}>In-App Follow-up Reminders</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Receive 24-hour advance notifications for scheduled doctor visits</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppAlerts}
                    onChange={(e) => setInAppAlerts(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #EAF3FC', paddingTop: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1177DE' }}>Symptom Worsening Warnings</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Automatic clinical safety alerts when severity escalates to severe</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={urgentWarnings}
                    onChange={(e) => setUrgentWarnings(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #EAF3FC', paddingTop: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1177DE' }}>SHA-256 Image Deduplication</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Prevent duplicate file storage when identical photos are re-scanned</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDeduplication}
                    onChange={(e) => setAutoDeduplication(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMsg('Preferences saved successfully.');
                    setTimeout(() => setSuccessMsg(null), 3000);
                  }}
                  className="btn-submit"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Save Settings & Preferences
                </button>
              </div>
            </div>
          </div>

          <div className="project-card">
            <div className="project-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="#1177DE" />
              <span>Security & Account Actions</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 12 }}>
                Current session is authenticated via <strong>HS256 JSON Web Token</strong>. All requests carry strict tenant isolation headers.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="btn-outline"
                  style={{ fontSize: '0.825rem' }}
                >
                  Change Password
                </button>
                <button
                  onClick={onLogoutClick}
                  className="btn-outline"
                  style={{ fontSize: '0.825rem', color: '#ef4444', borderColor: '#fca5a5' }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{patientProfile ? 'Edit Patient Profile' : 'Create Patient Profile'}</h3>
              <button onClick={() => setShowEditProfile(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleUpdateProfile} style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.patient_name}
                  onChange={(e) => setEditFormData({ ...editFormData, patient_name: e.target.value })}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Age *</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    required
                    value={editFormData.age}
                    onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                    className="form-select"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone_number}
                    onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={editFormData.email_address}
                    onChange={(e) => setEditFormData({ ...editFormData, email_address: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Additional Details / Medical Notes</label>
                <textarea
                  rows={3}
                  value={editFormData.additional_details}
                  onChange={(e) => setEditFormData({ ...editFormData, additional_details: e.target.value })}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={() => setShowEditProfile(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button onClick={() => setShowChangePassword(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleChangePassword} style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password (min 6 characters) *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={() => setShowChangePassword(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
