import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Camera, AlertTriangle } from 'lucide-react';
import api, { getStoredToken, getStoredUser, clearAuthSession } from './services/api';

import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import PatientProfileSetup from './components/PatientProfileSetup';

// Patient Components
import DashboardOverview from './components/DashboardOverview';
import SkinHealthRecords from './components/SkinHealthRecords';
import SymptomTracker from './components/SymptomTracker';
import ConsultationManager from './components/ConsultationManager';
import TreatmentRecords from './components/TreatmentRecords';
import AppointmentReminders from './components/AppointmentReminders';
import ImageComparisonView from './components/ImageComparisonView';
import SkinTimelineView from './components/SkinTimelineView';
import NotificationCenter from './components/NotificationCenter';
import UserProfileSettings from './components/UserProfileSettings';

// Doctor Components
import DoctorOverview from './components/DoctorOverview';
import DoctorPatientsView from './components/DoctorPatientsView';
import DoctorAppointmentsView from './components/DoctorAppointmentsView';
import DoctorConsultationsView from './components/DoctorConsultationsView';
import DoctorTreatmentsView from './components/DoctorTreatmentsView';
import DoctorTimelineView from './components/DoctorTimelineView';

// Original Vision Transformer Components
import UploadSection from './components/UploadSection';
import WebcamCapture from './components/WebcamCapture';
import ResultsView from './components/ResultsView';
import DiseaseLibrary from './components/DiseaseLibrary';
import AboutProject from './components/AboutProject';
import HistoryView from './components/HistoryView';

export default function App() {
  // Authentication & Profile states
  const [token, setToken] = useState(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [hasPatientProfile, setHasPatientProfile] = useState(false);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Navigation & Hash-based Layout states (Phase 11 - no reload, smooth state transition)
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) return hash;
    const user = getStoredUser();
    return user?.role === 'doctor' ? 'doctor_overview' : 'dashboard';
  });

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('dermai_sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // AI Classification Workbench State
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'camera'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Preselected record for comparison
  const [preselectedCompareRecord, setPreselectedCompareRecord] = useState(null);

  // Tab change handler that updates URL hash smoothly without reloading the page
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (window.location.hash !== `#${newTab}`) {
      window.location.hash = `#${newTab}`;
    }
  };

  // Listen to browser hash changes (for back/forward buttons and direct bookmark navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  // Listen for auth-expired event
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setCurrentUser(null);
      setHasPatientProfile(false);
      setAuthView('login');
    };
    window.addEventListener('dermai-auth-expired', handleExpired);
    return () => window.removeEventListener('dermai-auth-expired', handleExpired);
  }, []);

  // Validate existing session on initial mount
  useEffect(() => {
    async function verifySession() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setToken(null);
        setCurrentUser(null);
        setHasPatientProfile(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const meRes = await api.get('/api/auth/me');
        const user = meRes.data;
        setCurrentUser(user);
        localStorage.setItem('dermai_user', JSON.stringify(user));

        if (user.role === 'doctor') {
          setHasPatientProfile(true);
          const currentHash = window.location.hash.replace('#', '');
          if (!currentHash || currentHash === 'dashboard') {
            setActiveTab('doctor_overview');
            window.location.hash = '#doctor_overview';
          }
        } else {
          const profRes = await api.get('/api/patient-profile');
          if (profRes.data && profRes.data.patient_name) {
            setHasPatientProfile(true);
          } else {
            setHasPatientProfile(false);
          }
        }

        fetchUnreadNotifications();
      } catch (err) {
        console.warn('Session verification failed:', err);
        clearAuthSession();
        setToken(null);
        setCurrentUser(null);
        setHasPatientProfile(false);
      } finally {
        setCheckingAuth(false);
      }
    }

    verifySession();
  }, []);

  // Poll notifications when logged in
  useEffect(() => {
    if (!token) return;

    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 25000);
    return () => clearInterval(interval);
  }, [token]);

  const handleToggleCollapse = (val) => {
    setCollapsed(val);
    localStorage.setItem('dermai_sidebar_collapsed', String(val));
  };

  const fetchUserData = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setCurrentUser(res.data);
      localStorage.setItem('dermai_user', JSON.stringify(res.data));
    } catch (e) {
      console.warn('User data fetch:', e);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications?unread_only=true');
      setUnreadCount((res.data || []).length);
    } catch (e) {
      // Quiet fail
    }
  };

  const handleLoginSuccess = (newToken, user, hasProfile) => {
    setToken(newToken);
    setCurrentUser(user);
    if (user?.role === 'doctor') {
      setHasPatientProfile(true);
      setActiveTab('doctor_overview');
      window.location.hash = '#doctor_overview';
    } else {
      setHasPatientProfile(Boolean(hasProfile));
      setActiveTab('dashboard');
      window.location.hash = '#dashboard';
    }
  };

  const handleProfileCreated = (profile) => {
    setHasPatientProfile(true);
    setActiveTab('dashboard');
    window.location.hash = '#dashboard';
    fetchUserData();
  };

  const handleLogout = () => {
    clearAuthSession();
    setToken(null);
    setCurrentUser(null);
    setHasPatientProfile(false);
    setShowLogoutConfirm(false);
    setAuthView('login');
    window.location.hash = '';
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setErrorMessage(null);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async (base64Img) => {
    setPreviewUrl(base64Img);
    setInputMode('upload');
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/api/predict/camera', {
        image_base64: base64Img
      });
      setResult(res.data);
    } catch (err) {
      console.error('Camera prediction error:', err);
      setErrorMessage(err.response?.data?.detail || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/api/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      console.error('File prediction error:', err);
      setErrorMessage(err.response?.data?.detail || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial auth check loading state
  if (checkingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1329',
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <ShieldCheck size={40} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>DermAI Health Monitor</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>Validating secure session...</div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Login or Register WITHOUT sidebar
  if (!token) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onSwitchToLogin={() => setAuthView('login')}
          onRegistrationSuccess={(registeredUsername) => setAuthView('login')}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView('register')}
      />
    );
  }

  // 3. Authenticated but NO Patient Profile: Render Profile Setup ONLY for Patients
  if (currentUser?.role === 'patient' && !hasPatientProfile) {
    return (
      <PatientProfileSetup
        currentUser={currentUser}
        onProfileCreated={handleProfileCreated}
      />
    );
  }

  const isDoctor = currentUser?.role === 'doctor';

  // 4. Fully Authenticated Platform: Render Sidebar & Role-Based Dashboard
  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f8fafc' }}>
      {/* 1. COLLAPSIBLE LEFT SIDEBAR (Dynamic for Patient or Doctor) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        collapsed={collapsed}
        setCollapsed={handleToggleCollapse}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        unreadCount={unreadCount}
        currentUser={currentUser}
        onLogoutClick={() => setShowLogoutConfirm(true)}
      />

      {/* 2. MAIN WORKSPACE LAYOUT (AUTO-ADJUSTS TO SIDEBAR) */}
      <div
        className={`main-wrapper ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
        style={{
          flex: 1,
          marginLeft: collapsed ? 72 : 250,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* TOP HEADER */}
        <TopHeader
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          collapsed={collapsed}
          setCollapsed={handleToggleCollapse}
          setMobileOpen={setMobileOpen}
          unreadCount={unreadCount}
          currentUser={currentUser}
          onLogoutClick={() => setShowLogoutConfirm(true)}
        />

        {/* MAIN APPLICATION WORKSPACE CONTENT */}
        <main className="content-area" style={{ flex: 1, padding: '24px 28px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {/* ==================== DOCTOR PLATFORM TABS ==================== */}
          {isDoctor && (
            <>
              {activeTab === 'doctor_overview' && (
                <DoctorOverview
                  setActiveTab={handleTabChange}
                  onSelectPatient={(pat) => handleTabChange('doctor_patients')}
                />
              )}

              {activeTab === 'doctor_patients' && (
                <DoctorPatientsView setActiveTab={handleTabChange} />
              )}

              {activeTab === 'doctor_appointments' && (
                <DoctorAppointmentsView />
              )}

              {activeTab === 'doctor_consultations' && (
                <DoctorConsultationsView />
              )}

              {activeTab === 'doctor_treatments' && (
                <DoctorTreatmentsView />
              )}

              {activeTab === 'doctor_timeline' && (
                <DoctorTimelineView />
              )}
            </>
          )}

          {/* ==================== PATIENT PLATFORM TABS ==================== */}
          {!isDoctor && (
            <>
              {/* Tab 1: Dashboard Overview */}
              {activeTab === 'dashboard' && (
                <DashboardOverview
                  setActiveTab={handleTabChange}
                  onSelectRecordForCompare={(rec) => {
                    setPreselectedCompareRecord(rec);
                    handleTabChange('comparison');
                  }}
                />
              )}

              {/* Tab 2: AI Skin Disease Classification */}
              {activeTab === 'diagnose' && (
                <div>
                  <div className="project-card" style={{ textAlign: 'center', padding: '16px 20px' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0d6efd', marginBottom: 4 }}>
                      Real-Time Skin Lesion Classification
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
                      Upload a skin lesion photograph or take a live webcam photo to run deep learning classification, uncertainty entropy estimation, and visual attention heatmap overlays.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 20 }}>
                    {/* Left Box: Image Input */}
                    <div className="project-card">
                      <div className="project-card-header">
                        Step 1: Select Input Image
                      </div>

                      {/* Input Mode Selector */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMode('upload');
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                          className={inputMode === 'upload' ? 'btn-submit' : 'btn-outline'}
                          style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
                          title="Click to select lesion image from your computer"
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMode('camera');
                            setResult(null);
                            setErrorMessage(null);
                          }}
                          className={inputMode === 'camera' ? 'btn-submit' : 'btn-outline'}
                          style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
                        >
                          Use Webcam
                        </button>
                      </div>

                      {/* Input Box */}
                      {inputMode === 'upload' ? (
                        <UploadSection
                          onFileSelected={handleFileSelect}
                          onFileRemoved={handleRemoveImage}
                          selectedFile={selectedFile}
                          previewUrl={previewUrl}
                          loading={loading}
                          fileInputRef={fileInputRef}
                        />
                      ) : (
                        <WebcamCapture
                          onCapture={handleCameraCapture}
                          onCancel={() => setInputMode('upload')}
                        />
                      )}

                      {/* Error Box */}
                      {errorMessage && (
                        <div style={{
                          marginTop: 12,
                          padding: '8px 12px',
                          backgroundColor: '#f8d7da',
                          border: '1px solid #f5c2c7',
                          borderRadius: 4,
                          color: '#842029',
                          fontSize: '0.85rem'
                        }}>
                          {errorMessage}
                        </div>
                      )}

                      {/* Submit / Predict Button */}
                      {inputMode === 'upload' && (
                        <div style={{ marginTop: 16 }}>
                          <button
                            type="button"
                            onClick={handleAnalyzeFile}
                            disabled={!selectedFile || loading}
                            className="btn-submit"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              opacity: (!selectedFile || loading) ? 0.6 : 1,
                              cursor: (!selectedFile || loading) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {loading ? 'Classifying Image...' : (selectedFile ? 'Predict Disease' : 'Select an Image to Predict')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Box: Prediction Results */}
                    <div>
                      {result ? (
                        <ResultsView
                          result={result}
                          originalImage={previewUrl}
                          onSavedToRecords={() => handleTabChange('records')}
                        />
                      ) : (
                        <div className="project-card" style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#6c757d' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                            <Camera size={44} color="#94a3b8" />
                          </div>
                          <h3 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: 6 }}>No Image Analyzed Yet</h3>
                          <p style={{ fontSize: '0.85rem', maxWidth: 300 }}>
                            Please select or capture a skin lesion image on the left and click <strong>"Predict Disease"</strong> to see the classification results.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Skin Health Records */}
              {activeTab === 'records' && (
                <SkinHealthRecords
                  setActiveTab={handleTabChange}
                  onCompareSelect={(rec) => {
                    setPreselectedCompareRecord(rec);
                    handleTabChange('comparison');
                  }}
                />
              )}

              {/* Tab 4: Symptom Tracker */}
              {activeTab === 'symptoms' && <SymptomTracker />}

              {/* Tab 5: Image Comparison */}
              {activeTab === 'comparison' && (
                <ImageComparisonView preselectedRecord={preselectedCompareRecord} />
              )}

              {/* Tab 6: Skin Progress Timeline */}
              {activeTab === 'timeline' && <SkinTimelineView setActiveTab={handleTabChange} />}

              {/* Tab 7: Consultations */}
              {activeTab === 'consultations' && (
                <ConsultationManager setActiveTab={handleTabChange} />
              )}

              {/* Tab 8: Treatment Records */}
              {activeTab === 'treatments' && <TreatmentRecords setActiveTab={handleTabChange} />}

              {/* Tab 9: Follow-up Appointments */}
              {activeTab === 'appointments' && (
                <AppointmentReminders setActiveTab={handleTabChange} />
              )}
            </>
          )}

          {/* ==================== COMMON / SHARED TABS ==================== */}
          {/* Notifications Center */}
          {activeTab === 'notifications' && (
            <NotificationCenter onNotificationRead={fetchUnreadNotifications} />
          )}

          {/* User Profile */}
          {activeTab === 'profile' && (
            <UserProfileSettings
              initialTab="profile"
              onUserChanged={fetchUserData}
              onLogoutClick={() => setShowLogoutConfirm(true)}
            />
          )}

          {/* Account Settings */}
          {activeTab === 'settings' && (
            <UserProfileSettings
              initialTab="settings"
              onUserChanged={fetchUserData}
              onLogoutClick={() => setShowLogoutConfirm(true)}
            />
          )}

          {/* Disease Library (Original) */}
          {activeTab === 'library' && <DiseaseLibrary />}

          {/* About Project (Original) */}
          {activeTab === 'about' && <AboutProject />}

          {/* Prediction History Log (Original) */}
          {activeTab === 'history' && <HistoryView />}
        </main>

        {/* Medical Disclaimer Footer */}
        <footer style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '14px 20px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          DermAI Dual-Role Platform • AI Vision Transformer Classification & Healthcare Follow-up Management • Clinical Decision Support
        </footer>
      </div>

      {/* 3. LOGOUT CONFIRMATION DIALOG */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <AlertTriangle size={24} color="#ef4444" />
            </div>
            <h3 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700 }}>
              Sign Out of DermAI?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 20 }}>
              You will be signed out of {isDoctor ? 'clinician profile' : 'patient profile'} <strong>{currentUser?.full_name || currentUser?.username || 'User'}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="btn-submit"
                style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444', justifyContent: 'center' }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
