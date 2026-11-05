import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
  CalendarDays
} from 'lucide-react';

const PAGE_METADATA = {
  dashboard: { title: 'Dashboard Overview', breadcrumb: 'Overview' },
  diagnose: { title: 'AI Skin Disease Classification', breadcrumb: 'AI & Skin Monitoring' },
  records: { title: 'Skin Health Records', breadcrumb: 'AI & Skin Monitoring' },
  symptoms: { title: 'Symptoms & Observations', breadcrumb: 'AI & Skin Monitoring' },
  comparison: { title: 'Longitudinal Image Comparison', breadcrumb: 'AI & Skin Monitoring' },
  timeline: { title: 'Skin Progress Timeline', breadcrumb: 'AI & Skin Monitoring' },
  my_dermatologist: { title: 'My Dermatologist', breadcrumb: 'Doctor & Medical Care' },
  consultations: { title: 'Dermatologist Consultations', breadcrumb: 'Doctor & Medical Care' },
  treatments: { title: 'Prescribed Treatment Regimens', breadcrumb: 'Doctor & Medical Care' },
  appointments: { title: 'Follow-up Appointment Management', breadcrumb: 'Doctor & Medical Care' },
  doctor_overview: { title: 'Clinical Practice Overview', breadcrumb: 'Overview' },
  doctor_patients: { title: 'Connected Patient Management', breadcrumb: 'Patient Management' },
  doctor_requests: { title: 'Patient Connection Requests', breadcrumb: 'Patient Management' },
  doctor_records: { title: 'Patient Skin Health Records', breadcrumb: 'Patient Management' },
  doctor_symptoms: { title: 'Patient Symptom History', breadcrumb: 'Patient Management' },
  doctor_timeline: { title: 'Patient Skin Progression Timeline', breadcrumb: 'Patient Management' },
  doctor_appointments: { title: 'Clinical Appointments & Schedule', breadcrumb: 'Clinical Management' },
  doctor_consultations: { title: 'Dermatology Consultations', breadcrumb: 'Clinical Management' },
  doctor_treatments: { title: 'Prescription & Treatment Plans', breadcrumb: 'Clinical Management' },
  doctor_followups: { title: 'Follow-up Tracking & Reviews', breadcrumb: 'Clinical Management' },
  notifications: { title: 'Notifications & Safety Advisories', breadcrumb: 'Account' },
  profile: { title: 'User Profile & Clinical Credentials', breadcrumb: 'Account' },
  settings: { title: 'Account Settings', breadcrumb: 'Account' },
  library: { title: 'Dermatological Encyclopedia', breadcrumb: 'Resources' },
  history: { title: 'Classification History Log', breadcrumb: 'Resources' }
};

export default function TopHeader({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  setMobileOpen,
  unreadCount = 0,
  currentUser = null,
  onLogoutClick
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentPage = PAGE_METADATA[activeTab] || { title: 'Health Monitor', breadcrumb: 'Overview' };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = currentUser?.full_name
    ? currentUser.full_name.trim()[0].toUpperCase()
    : (currentUser?.username ? currentUser.username.trim()[0].toUpperCase() : 'U');
  const userName = currentUser?.full_name || currentUser?.username || 'User';
  const userEmail = currentUser?.email || (currentUser?.username ? `@${currentUser.username}` : '');

  return (
    <header
      className="top-header"
      style={{
        height: 64,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #7CB0EA',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1020,
        boxShadow: '0 1px 4px rgba(47, 79, 79, 0.05)'
      }}
    >
      {/* Left: Mobile Drawer Trigger / Desktop Toggle + Page Title + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Toggle Button */}
        <button
          onClick={() => {
            // If on mobile view, toggle drawer; else toggle collapse
            if (window.innerWidth <= 900) {
              setMobileOpen(true);
            } else {
              setCollapsed(!collapsed);
            }
          }}
          className="header-toggle-btn"
          title="Toggle Navigation"
          style={{
            background: 'none',
            border: '1px solid #7CB0EA',
            borderRadius: 6,
            padding: '6px 8px',
            color: '#1177DE',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EAF3FC';
            e.currentTarget.style.color = '#1177DE';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#1177DE';
          }}
        >
          <Menu size={20} />
        </button>

        {/* Title & Breadcrumbs */}
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.725rem', color: '#5b7979', fontWeight: 500 }}>
            <span>DermAI</span>
            <span>/</span>
            <span>{currentPage.breadcrumb}</span>
            <span>/</span>
            <span style={{ color: '#1177DE', fontWeight: 600 }}>{currentPage.title}</span>
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1177DE', margin: 0, lineHeight: 1.2 }}>
            {currentPage.title}
          </h2>
        </div>
      </div>

      {/* Right: Quick Scan + Notifications + Profile Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Quick New Scan Action Button */}
        {activeTab !== 'diagnose' && currentUser?.role !== 'doctor' && (
          <button
            onClick={() => setActiveTab('diagnose')}
            className="header-quick-scan-btn"
            style={{
              backgroundColor: '#10254C',
              color: '#ffffff',
              border: '1px solid #1177DE',
              borderRadius: 6,
              padding: '7px 15px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1177DE';
              e.currentTarget.style.borderColor = '#1177DE';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1177DE';
              e.currentTarget.style.borderColor = '#1177DE';
              e.currentTarget.style.color = '#ffffff';
            }}
          >
            <Sparkles size={15} />
            <span>+ New AI Scan</span>
          </button>
        )}

        {/* Quick Schedule Appointment Action Button for Doctor */}
        {activeTab !== 'doctor_appointments' && currentUser?.role === 'doctor' && (
          <button
            onClick={() => setActiveTab('doctor_appointments')}
            className="header-quick-scan-btn"
            style={{
              backgroundColor: '#10254C',
              color: '#ffffff',
              border: '1px solid #1177DE',
              borderRadius: 6,
              padding: '7px 15px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1177DE';
              e.currentTarget.style.borderColor = '#1177DE';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1177DE';
              e.currentTarget.style.borderColor = '#1177DE';
              e.currentTarget.style.color = '#ffffff';
            }}
          >
            <CalendarDays size={15} />
            <span>+ Schedule Appointment</span>
          </button>
        )}

        {/* Notification Bell with live count */}
        <button
          onClick={() => setActiveTab('notifications')}
          title={unreadCount > 0 ? `${unreadCount} unread health alerts` : 'Notifications'}
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: activeTab === 'notifications' ? '#EAF3FC' : '#ffffff',
            border: `1px solid ${activeTab === 'notifications' ? '#1177DE' : '#7CB0EA'}`,
            color: activeTab === 'notifications' ? '#1177DE' : '#1177DE',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EAF3FC';
            e.currentTarget.style.borderColor = '#448EE2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = activeTab === 'notifications' ? '#EAF3FC' : '#ffffff';
            e.currentTarget.style.borderColor = activeTab === 'notifications' ? '#1177DE' : '#7CB0EA';
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.675rem',
                fontWeight: 700,
                borderRadius: 10,
                padding: '1px 5px',
                minWidth: 16,
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Dropdown Pill */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              backgroundColor: dropdownOpen ? '#EAF3FC' : '#ffffff',
              border: '1px solid #7CB0EA',
              borderRadius: 24,
              padding: '4px 10px 4px 5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Avatar Circle */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                backgroundColor: '#1177DE',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {userInitial}
            </div>

            {/* User Name */}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1177DE' }}>
              {userName}
            </span>

            <ChevronDown size={14} style={{ color: '#5b7979' }} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 230,
                backgroundColor: '#ffffff',
                borderRadius: 8,
                border: '1px solid #7CB0EA',
                boxShadow: '0 10px 25px rgba(47, 79, 79, 0.15)',
                padding: '6px 0',
                zIndex: 1100,
                animation: 'fadeIn 0.15s ease'
              }}
            >
              {/* Dropdown User Info Header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #EAF3FC' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1177DE' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#5b7979', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="badge-label badge-success-custom" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    {currentUser?.role === 'doctor' ? 'Verified Dermatologist' : 'Authenticated Patient'}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <button
                onClick={() => {
                  setActiveTab('profile');
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  border: 'none',
                  background: 'none',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EAF3FC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <User size={16} style={{ color: '#1177DE' }} />
                <span>My Health Profile</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('settings');
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  border: 'none',
                  background: 'none',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EAF3FC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Settings size={16} style={{ color: '#64748b' }} />
                <span>Account Settings</span>
              </button>

              <div style={{ height: 1, backgroundColor: '#EAF3FC', margin: '4px 0' }} />

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onLogoutClick();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  border: 'none',
                  background: 'none',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut size={16} style={{ color: '#ef4444' }} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

