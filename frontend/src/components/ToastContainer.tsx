// frontend/src/components/ToastContainer.tsx
import React, { useState } from 'react';
import { useToastStore, ToastItem, ToastType } from '../store/toastStore';

const TOAST_THEMES: Record<ToastType, {
  bg: string;
  borderColor: string;
  badgeBg: string;
  badgeIcon: JSX.Element;
}> = {
  success: {
    bg: '#f0fdf4',
    borderColor: '#22c55e',
    badgeBg: '#22c55e',
    badgeIcon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  info: {
    bg: '#eff6ff',
    borderColor: '#3b82f6',
    badgeBg: '#3b82f6',
    badgeIcon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a6 6 0 0 0-6 6c0 2.22 1.21 4.16 3 5.2V15a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.8c1.79-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6z" />
        <line x1="10" y1="19" x2="14" y2="19" strokeWidth="2" />
        <line x1="11" y1="22" x2="13" y2="22" strokeWidth="2" />
      </svg>
    ),
  },
  warning: {
    bg: '#fffbeb',
    borderColor: '#f59e0b',
    badgeBg: '#f59e0b',
    badgeIcon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="6" x2="12" y2="13" />
        <circle cx="12" cy="17.5" r="1.2" fill="#ffffff" stroke="none" />
      </svg>
    ),
  },
  error: {
    bg: '#fef2f2',
    borderColor: '#ef4444',
    badgeBg: '#ef4444',
    badgeIcon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const { removeToast, pauseToast, resumeToast } = useToastStore();
  const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info;
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => pauseToast(toast.id)}
      onMouseLeave={() => resumeToast(toast.id)}
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 18px',
        background: theme.bg,
        border: `1.5px solid ${theme.borderColor}`,
        borderRadius: '20px',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
        animation: 'medbuildsToastSlideIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        transformOrigin: 'top right',
        transition: 'all 0.2s ease',
        width: '100%',
        maxWidth: '430px',
      }}
    >
      {/* Variant Circular Badge with White Vector Icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: theme.badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
        }}
      >
        {theme.badgeIcon}
      </div>

      {/* Title & Subtext Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '14.5px',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.25,
            letterSpacing: '-0.2px',
          }}
        >
          {toast.title}
        </h4>
        <p
          style={{
            margin: '3px 0 0 0',
            fontSize: '13px',
            fontWeight: 400,
            color: '#475569',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
          {toast.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
              }}
              style={{
                marginLeft: '8px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a',
                textDecoration: 'underline',
                cursor: 'pointer',
                display: 'inline',
              }}
            >
              {toast.action.label}
            </button>
          )}
        </p>
      </div>

      {/* Top-Right Dismiss ✕ Button */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        onMouseEnter={() => setIsCloseHovered(true)}
        onMouseLeave={() => setIsCloseHovered(false)}
        aria-label="Dismiss notification"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          border: 'none',
          background: isCloseHovered ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
          color: isCloseHovered ? '#0f172a' : '#64748b',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s ease, color 0.15s ease',
          padding: 0,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore(state => state.toasts);

  if (!toasts.length) return null;

  return (
    <>
      <style>{`
        @keyframes medbuildsToastSlideIn {
          0% {
            opacity: 0;
            transform: translate3d(40px, 0, 0) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
      `}</style>
      <aside
        aria-label="System notifications"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '430px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </aside>
    </>
  );
}
