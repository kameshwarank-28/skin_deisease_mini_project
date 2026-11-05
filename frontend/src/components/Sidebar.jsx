import React from 'react';
import {
  LayoutDashboard,
  ScanSearch,
  FolderHeart,
  Activity,
  Images,
  History,
  Stethoscope,
  Pill,
  CalendarDays,
  Bell,
  UserRound,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  UserCheck,
  FileCheck,
  Clock
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  unreadCount = 0,
  currentUser = null,
  onLogoutClick
}) {
  const isDoctor = currentUser?.role === 'doctor';

  const patientNavGroups = [
    {
      group: 'OVERVIEW',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      group: 'AI & SKIN MONITORING',
      items: [
        { key: 'diagnose', label: 'AI Classification', icon: ScanSearch },
        { key: 'records', label: 'Skin Records', icon: FolderHeart },
        { key: 'symptoms', label: 'Symptoms & Observations', icon: Activity },
        { key: 'timeline', label: 'Skin Timeline', icon: History }
      ]
    },
    {
      group: 'DOCTOR & MEDICAL CARE',
      items: [
        { key: 'my_dermatologist', label: 'My Dermatologist', icon: Stethoscope },
        { key: 'consultations', label: 'Consultations', icon: FileCheck },
        { key: 'treatments', label: 'Treatments', icon: Pill },
        { key: 'appointments', label: 'Appointments', icon: CalendarDays }
      ]
    },
    {
      group: 'ACCOUNT',
      items: [
        { key: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
        { key: 'profile', label: 'Profile', icon: UserRound },
        { key: 'settings', label: 'Settings', icon: Settings },
        { key: 'logout', label: 'Logout', icon: LogOut, isAction: true }
      ]
    }
  ];

  const doctorNavGroups = [
    {
      group: 'OVERVIEW',
      items: [
        { key: 'doctor_overview', label: 'Doctor Overview', icon: LayoutDashboard }
      ]
    },
    {
      group: 'PATIENT MANAGEMENT',
      items: [
        { key: 'doctor_patients', label: 'My Patients', icon: Users },
        { key: 'doctor_requests', label: 'Patient Requests', icon: UserCheck },
        { key: 'doctor_records', label: 'Skin Records', icon: FolderHeart },
        { key: 'doctor_symptoms', label: 'Symptom History', icon: Activity },
        { key: 'doctor_timeline', label: 'Skin Timeline', icon: History }
      ]
    },
    {
      group: 'CLINICAL MANAGEMENT',
      items: [
        { key: 'doctor_appointments', label: 'Appointments', icon: CalendarDays },
        { key: 'doctor_consultations', label: 'Consultations', icon: Stethoscope },
        { key: 'doctor_treatments', label: 'Treatments', icon: Pill },
        { key: 'doctor_followups', label: 'Follow-ups', icon: Clock }
      ]
    },
    {
      group: 'ACCOUNT',
      items: [
        { key: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
        { key: 'profile', label: 'Doctor Profile', icon: UserRound },
        { key: 'settings', label: 'Settings', icon: Settings },
        { key: 'logout', label: 'Logout', icon: LogOut, isAction: true }
      ]
    }
  ];

  const navGroups = isDoctor ? doctorNavGroups : patientNavGroups;

  const handleNavClick = (key) => {
    if (key === 'logout') {
      if (onLogoutClick) onLogoutClick();
      return;
    }
    setActiveTab(key);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  const userInitial = currentUser?.full_name
    ? currentUser.full_name.trim()[0].toUpperCase()
    : (currentUser?.username ? currentUser.username.trim()[0].toUpperCase() : 'U');
  const userName = currentUser?.full_name || currentUser?.username || 'User';
  const userEmail = currentUser?.email || (currentUser?.username ? `@${currentUser.username}` : '');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1040,
            transition: 'opacity 0.25s ease'
          }}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`app-sidebar ${collapsed ? 'collapsed' : 'expanded'} ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: collapsed ? 72 : 250,
          backgroundColor: '#10254C',
          color: '#EAF3FC',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRight: '1px solid rgba(164, 211, 226, 0.2)',
          boxShadow: '4px 0 16px rgba(47, 79, 79, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Brand / Logo Header */}
        <div
          style={{
            height: 64,
            padding: collapsed ? '0 12px' : '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(164, 211, 226, 0.2)',
            backgroundColor: 'rgba(0, 0, 0, 0.08)'
          }}
        >
          <div
            onClick={() => handleNavClick(isDoctor ? 'doctor_overview' : 'dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              userSelect: 'none',
              overflow: 'hidden'
            }}
            title="DermAI Health Monitor"
          >
            {/* Logo Emblem */}
            <div
              style={{
                width: 38,
                height: 38,
                minWidth: 38,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #1177DE 0%, #448EE2 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
                boxShadow: '0 2px 8px rgba(0, 124, 134, 0.45)'
              }}
            >
              +
            </div>

            {/* Logo Text (hidden when collapsed) */}
            {!collapsed && (
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.15 }}>
                  Derm<span style={{ color: '#448EE2' }}>AI</span>
                </div>
                <div style={{ fontSize: '0.675rem', fontWeight: 600, color: '#7CB0EA', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Health Monitor
                </div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-mobile-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: collapsed ? '12px 8px' : '12px 12px'
          }}
        >
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: collapsed ? 14 : 18 }}>
              {/* Group Section Header */}
              {!collapsed ? (
                <div
                  style={{
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    color: '#7CB0EA',
                    letterSpacing: '0.8px',
                    padding: '8px 10px 4px',
                    textTransform: 'uppercase',
                    userSelect: 'none'
                  }}
                >
                  {group.group}
                </div>
              ) : (
                <div
                  style={{
                    height: 1,
                    backgroundColor: 'rgba(164, 211, 226, 0.2)',
                    margin: '8px 6px'
                  }}
                />
              )}

              {/* Group Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      title={collapsed ? `${item.label} ${item.badge ? `(${item.badge})` : ''}` : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'space-between',
                        width: '100%',
                        padding: collapsed ? '10px 0' : '9px 12px',
                        borderRadius: 7,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isActive ? '#1177DE' : 'transparent',
                        color: isActive ? '#ffffff' : '#7CB0EA',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '0.875rem',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        boxShadow: isActive ? '0 2px 10px rgba(0, 178, 169, 0.35)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 178, 169, 0.15)';
                          e.currentTarget.style.color = '#EAF3FC';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#7CB0EA';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Icon
                          size={19}
                          style={{
                            color: isActive ? '#ffffff' : '#448EE2',
                            flexShrink: 0
                          }}
                        />
                        {!collapsed && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                      </div>

                      {/* Badge / Counter */}
                      {item.badge !== undefined && item.badge > 0 && (
                        !collapsed ? (
                          <span
                            style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 10,
                              minWidth: 18,
                              textAlign: 'center',
                              boxShadow: '0 1px 4px rgba(239, 68, 68, 0.5)'
                            }}
                          >
                            {item.badge}
                          </span>
                        ) : (
                          <span
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 14,
                              width: 8,
                              height: 8,
                              backgroundColor: '#ef4444',
                              borderRadius: '50%',
                              boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)'
                            }}
                          />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Logout Button */}
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 10 }}>
            <button
              onClick={onLogoutClick}
              title={collapsed ? 'Sign Out' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: '#f87171',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.color = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#f87171';
              }}
            >
              <LogOut size={19} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>

        {/* Sidebar Footer: User Profile & Collapse Toggle */}
        <div
          style={{
            padding: collapsed ? '10px 8px' : '12px 14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          {/* User Profile Mini Badge */}
          <div
            onClick={() => handleNavClick('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              flex: 1,
              overflow: 'hidden',
              padding: collapsed ? '4px 0' : '4px 6px',
              borderRadius: 6
            }}
            title={`${userName} (${userEmail}) - View Profile`}
          >
            <div
              style={{
                width: 34,
                height: 34,
                minWidth: 34,
                borderRadius: '50%',
                backgroundColor: '#1177DE',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: '2px solid rgba(164, 211, 226, 0.4)',
                overflow: 'hidden'
              }}
            >
              {currentUser?.profile_picture ? (
                <img
                  src={currentUser.profile_picture}
                  alt={userName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                userInitial
              )}
            </div>

            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#EAF3FC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#7CB0EA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userEmail}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-collapse-btn"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              width: 28,
              height: 28,
              minWidth: 28,
              borderRadius: 6,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}

