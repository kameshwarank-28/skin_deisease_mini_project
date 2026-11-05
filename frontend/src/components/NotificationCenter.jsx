import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import api from '../services/api';

export default function NotificationCenter({ onNotificationRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All' | 'Unread' | 'Warnings'

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (onNotificationRead) onNotificationRead();
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (onNotificationRead) onNotificationRead();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const filtered = notifications.filter(n => {
    if (filterType === 'Unread') return !n.is_read;
    if (filterType === 'Warnings') return n.urgency === 'Urgent' || n.urgency === 'Warning';
    return true;
  });

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'Urgent':
        return (
          <span className="badge-label badge-danger-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> Urgent Medical Notice
          </span>
        );
      case 'Warning':
        return (
          <span className="badge-label badge-warning-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> Worsening Alert
          </span>
        );
      default:
        return (
          <span className="badge-label badge-info-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Info size={12} /> Reminder
          </span>
        );
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
            Notifications & Clinical Safety Alerts
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
            Scheduled follow-up reminders, automated symptom worsening advisories, and clinical reassessment recommendations.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilterType('All')}
            className={filterType === 'All' ? 'btn-submit' : 'btn-outline'}
            style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilterType('Unread')}
            className={filterType === 'Unread' ? 'btn-submit' : 'btn-outline'}
            style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          >
            Unread ({notifications.filter(n => !n.is_read).length})
          </button>
          <button
            onClick={() => setFilterType('Warnings')}
            className={filterType === 'Warnings' ? 'btn-submit' : 'btn-outline'}
            style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <AlertTriangle size={13} />
            <span>Alerts ({notifications.filter(n => n.urgency === 'Urgent' || n.urgency === 'Warning').length})</span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          Loading notification feed...
        </div>
      ) : filtered.length === 0 ? (
        <div className="project-card" style={{ textAlign: 'center', padding: 50, color: '#6c757d' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Bell size={44} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#495057' }}>No Notifications</h3>
          <p style={{ fontSize: '0.85rem' }}>No alerts match your current filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(n => (
            <div
              key={n.id}
              className="project-card"
              style={{
                margin: 0,
                backgroundColor: n.is_read ? '#ffffff' : (n.urgency === 'Urgent' ? '#fff5f5' : '#f0f7ff'),
                borderLeft: n.urgency === 'Urgent' ? '5px solid #dc3545' : n.urgency === 'Warning' ? '5px solid #ffc107' : '5px solid #1177DE',
                padding: '16px 20px',
                boxShadow: n.is_read ? 'var(--shadow-sm)' : '0 2px 8px rgba(13,110,253,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {getUrgencyBadge(n.urgency)}
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                    {n.title}
                  </h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                    {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#333333', margin: '4px 0 0', lineHeight: 1.5 }}>
                {n.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

