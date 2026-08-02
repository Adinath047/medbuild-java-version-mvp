import React, { useState, useEffect } from 'react';
import { useNotificationStore, EMRNotification } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';

export function EmergencyBanner() {
  const { user } = useAuthStore();
  const { emergencyAlerts, markAsRead } = useNotificationStore();

  if (!user || user.role !== 'doctor' || emergencyAlerts.length === 0) {
    return null;
  }

  return (
    <div style={{
      margin: '16px 24px 0 24px',
      padding: '16px 20px',
      background: '#fef2f2',
      border: '1.5px solid #fca5a5',
      borderRadius: '16px',
      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)'
    }} className="no-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: '#dc2626',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: '#991b1b', fontSize: 14 }}>
            EMERGENCY CLINICAL ALERTS ({emergencyAlerts.length})
          </div>
          <div style={{ color: '#7f1d1d', fontSize: 13, marginTop: 4 }}>
            {emergencyAlerts.map((alert, i) => (
              <div key={alert.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: i < emergencyAlerts.length - 1 ? '1px solid #fca5a5' : 'none'
              }}>
                <div>
                  <strong>{alert.message}</strong>
                  {alert.patientName && <span> (Patient: <strong>{alert.patientName}</strong> - UHID: {alert.patientUhid || '—'})</span>}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    minHeight: 'auto',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onClick={() => markAsRead(alert.id)}
                >
                  Acknowledge &amp; Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative', marginRight: 8 }} className="no-print">
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          background: isOpen ? 'var(--primary-light)' : 'transparent',
          border: 'none',
          borderRadius: 10,
          padding: 8,
          cursor: 'pointer',
          color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          transition: 'all 0.15s ease'
        }}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 2px var(--surface)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '115%',
          right: 0,
          width: 340,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-xl)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg)'
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              Notifications ({unreadCount})
            </div>
            {notifications.length > 0 && (
              <button
                onClick={() => markAllAsRead()}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No unread notifications
              </div>
            ) : (
              notifications.map((n: EMRNotification) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>
                    {n.message}
                  </div>
                  {n.createdAt && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
