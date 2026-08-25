import React from 'react';
import { useAuthStore } from '../store/authStore';

interface TrialContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialContactModal({ isOpen, onClose }: TrialContactModalProps) {
  const { user, trialEndsAt } = useAuthStore();

  if (!isOpen) return null;

  const email = 'contact@rotstruck.com';
  const mobile = '+91 98765 43210';
  const mailtoSubject = encodeURIComponent(`Account Upgrade Inquiry - ${user?.hospitalId || 'Hospital'}`);
  const mailtoBody = encodeURIComponent(
    `Hello Rotstruck Team,\n\n` +
    `We would like to activate our full hospital account.\n\n` +
    `Hospital ID: ${user?.hospitalId || 'N/A'}\n` +
    `Contact Person: ${user?.name || 'Staff'}\n` +
    `Trial Period: ${trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : 'Active Trial'}\n\n` +
    `Please assist with account activation.`
  );
  const mailtoLink = `mailto:${email}?subject=${mailtoSubject}&body=${mailtoBody}`;
  const telLink = `tel:${mobile.replace(/\s+/g, '')}`;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="modal"
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          maxWidth: 420,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid var(--border, #e2e8f0)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#065f46',
            padding: '16px 20px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Contact Us</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 11.5, color: '#a7f3d0' }}>Rotstruck Pvt. Ltd.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#d1fae5',
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close modal"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 22 }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: 18
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
              Rotstruck Pvt. Ltd.
            </h4>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-sec, #64748b)' }}>
              Official Medical Software & Enterprise Support
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 18
            }}
          >
            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: 'rgba(5, 150, 105, 0.12)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Email Us</div>
                <a
                  href={mailtoLink}
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#059669',
                    textDecoration: 'none',
                    wordBreak: 'break-all'
                  }}
                >
                  {email}
                </a>
              </div>
            </div>

            {/* Mobile / Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: 'rgba(5, 150, 105, 0.12)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Mobile Number</div>
                <a
                  href={telLink}
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text-main, #0f172a)',
                    textDecoration: 'none'
                  }}
                >
                  {mobile}
                </a>
              </div>
            </div>
          </div>

          {/* Hospital Context */}
          {user?.hospitalId && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted, #94a3b8)',
                textAlign: 'center',
                marginBottom: 18
              }}
            >
              Your Hospital ID: <strong style={{ color: 'var(--text-sec, #475569)' }}>{user.hospitalId}</strong>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={mailtoLink}
              className="btn btn-primary"
              style={{
                flex: 1,
                fontSize: 13,
                padding: '9px 12px',
                textAlign: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                textDecoration: 'none'
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{
                flex: 1,
                fontSize: 13,
                padding: '9px 12px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
