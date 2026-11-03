import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ScanSearch,
  FolderHeart,
  Activity,
  Images,
  Stethoscope,
  Pill,
  CalendarDays,
  History,
  BookOpen,
  Bell
} from 'lucide-react';
import api, { getStoredUser } from '../services/api';

export default function Navbar({ activeTab, setActiveTab }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(getStoredUser());

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications?unread_only=true');
      setUnreadCount((res.data || []).length);
    } catch (e) {
      // Quiet fail on network hiccups
    }
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'diagnose', label: 'AI Classification', icon: ScanSearch },
    { key: 'records', label: 'Skin Records', icon: FolderHeart },
    { key: 'symptoms', label: 'Symptom Tracker', icon: Activity },
    { key: 'comparison', label: 'Image Comparison', icon: Images },
    { key: 'consultations', label: 'Consultations', icon: Stethoscope },
    { key: 'treatments', label: 'Treatments', icon: Pill },
    { key: 'appointments', label: 'Appointments', icon: CalendarDays },
    { key: 'timeline', label: 'Timeline', icon: History },
    { key: 'library', label: 'Library', icon: BookOpen }
  ];

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #dee2e6',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Top Header Row */}
      <div style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Project Branding */}
        <div
          onClick={() => setActiveTab('dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{
            width: 34,
            height: 34,
            backgroundColor: '#0d6efd',
            color: '#ffffff',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.2rem',
            boxShadow: '0 2px 4px rgba(13,110,253,0.3)'
          }}>
            +
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#212529', margin: 0, lineHeight: 1.2 }}>
              DermAI Health Monitor
            </h1>
            <span style={{ fontSize: '0.725rem', color: '#6c757d' }}>
              Skin Classification, Longitudinal Records & Follow-up Support
            </span>
          </div>
        </div>

        {/* Right Header: Notifications & Profile Shortcut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Notification Button */}
          <button
            onClick={() => setActiveTab('notifications')}
            style={{
              position: 'relative',
              backgroundColor: activeTab === 'notifications' ? '#e7f1ff' : '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Bell size={16} />
            <span style={{ fontSize: '0.8rem' }}>Alerts</span>
            {unreadCount > 0 && (
              <span style={{
                backgroundColor: '#dc3545',
                color: '#ffffff',
                borderRadius: '50%',
                padding: '1px 6px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              backgroundColor: activeTab === 'profile' ? '#e7f1ff' : '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#0d6efd',
              color: '#fff',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {currentUser?.full_name ? currentUser.full_name[0] : 'U'}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#212529' }}>
              {currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'Profile'}
            </span>
          </button>
        </div>
      </div>

      {/* Nav Tabs Bar */}
      <div style={{ borderTop: '1px solid #f1f3f5', backgroundColor: '#fcfcfd' }}>
        <div style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '4px 16px',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              style={{
                backgroundColor: activeTab === item.key ? '#0d6efd' : 'transparent',
                color: activeTab === item.key ? '#ffffff' : '#495057',
                border: 'none',
                padding: '7px 12px',
                borderRadius: 4,
                fontSize: '0.825rem',
                fontWeight: activeTab === item.key ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              {item.icon && <item.icon size={15} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
