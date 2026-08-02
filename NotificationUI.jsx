// NotificationUI.jsx
//
// Toast stack + notification bell, both driven by the shared store in
// notification-store.jsx. Mount <ToastStack /> once near the root of your
// app (inside <NotificationProvider>), and drop <NotificationBell /> into
// your top nav / header wherever it currently lives.

import { useNotifications } from './notification-store';

const TYPE_STYLES = {
  info:    { border: '#1d4ed8', bg: '#eff6ff', text: '#1e3a8a' },
  success: { border: '#15803d', bg: '#f0fdf4', text: '#14532d' },
  warning: { border: '#b45309', bg: '#fffbeb', text: '#78350f' },
  error:   { border: '#b91c1c', bg: '#fef2f2', text: '#7f1d1d' },
};

export function ToastStack() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        width: 320,
      }}
    >
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info;
        return (
          <div
            key={toast.id}
            style={{
              borderLeft: `4px solid ${style.border}`,
              background: style.bg,
              color: style.text,
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 13.5,
              lineHeight: 1.4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: style.text,
                fontSize: 15,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function NotificationBell() {
  const { unreadCount, markAllRead } = useNotifications();

  return (
    <button
      onClick={markAllRead}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 20 }} aria-hidden="true">🔔</span>
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: '#dc2626',
            color: 'white',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
