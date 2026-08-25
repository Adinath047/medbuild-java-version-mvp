import React, { useState } from 'react';
import TrialContactModal from './TrialContactModal';

interface WriteBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WriteBlockModal({ isOpen, onClose }: WriteBlockModalProps) {
  const [isContactOpen, setIsContactOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <>
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
            maxWidth: 440,
            width: '100%',
            overflow: 'hidden',
            border: '1px solid var(--border, #e2e8f0)',
            padding: 24,
            textAlign: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 119, 6, 0.12)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
            Read-Only Mode Active
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13.5, color: 'var(--text-sec, #64748b)', lineHeight: 1.5 }}>
            Your trial period has ended. Your data is safe and fully accessible in read-only mode. Contact our team to activate your full account.
          </p>

          <div
            style={{
              backgroundColor: 'var(--bg, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 12,
              color: 'var(--text-sec, #475569)',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>Rotstruck Pvt. Ltd. — Support & Sales:</div>
            <div>Email: <a href="mailto:contact@rotstruck.com" style={{ color: '#059669', fontWeight: 600, textDecoration: 'underline' }}>contact@rotstruck.com</a></div>
            <div>Phone: <a href="tel:+919876543210" style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)', textDecoration: 'none' }}>+91 98765 43210</a></div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              Continue in Read-Only
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsContactOpen(true);
              }}
              className="btn btn-primary"
              style={{ fontSize: 13, padding: '8px 18px' }}
            >
              Get in Touch
            </button>
          </div>
        </div>
      </div>

      <TrialContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
