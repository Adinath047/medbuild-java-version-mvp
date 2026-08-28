import React, { useState } from 'react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-color, #0f172a)',
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface, #f8fafc)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary, #0f766e)' }}>
              Medbuilds EMR Legal & Compliance
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
              DPDP Act 2023 & Ayushman Bharat Digital Mission (ABDM) Compliant
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: 'var(--bg-muted, #f1f5f9)',
          }}
        >
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'privacy' ? 'var(--bg-card, #fff)' : 'transparent',
              fontWeight: activeTab === 'privacy' ? 700 : 500,
              color: activeTab === 'privacy' ? 'var(--primary, #0f766e)' : 'var(--text-muted, #64748b)',
              borderBottom: activeTab === 'privacy' ? '2.5px solid var(--primary, #0f766e)' : 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Privacy Policy (DPDP & EMR)
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'terms' ? 'var(--bg-card, #fff)' : 'transparent',
              fontWeight: activeTab === 'terms' ? 700 : 500,
              color: activeTab === 'terms' ? 'var(--primary, #0f766e)' : 'var(--text-muted, #64748b)',
              borderBottom: activeTab === 'terms' ? '2.5px solid var(--primary, #0f766e)' : 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Terms of Service
          </button>
        </div>

        {/* Modal Body Content */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
            lineHeight: 1.6,
            fontSize: 13.5,
          }}
        >
          {activeTab === 'privacy' ? (
            <div>
              <h4 style={{ margin: '0 0 8px', color: 'var(--primary, #0f766e)', fontSize: 16 }}>
                Patient Electronic Health Records Privacy Policy
              </h4>
              <p style={{ color: 'var(--text-muted, #475569)', fontSize: 12, marginBottom: 16 }}>
                Effective Date: January 1, 2026 | Version 2.1.0 | Compliance: DPDP Act 2023 & NHA Guidelines
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>1. Data Collection & Encrypted Storage</h5>
              <p>
                Medbuilds Hospital EMR collects patient demographic data, clinical encounters, diagnostic reports, vitals, and prescription history. All Electronic Health Records (EHR) are encrypted in transit using TLS 1.3 and at rest using AES-256 standards.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>2. Clinical Purpose & Usage</h5>
              <p>
                Your health data is used exclusively by authorized attending physicians, nurses, and hospital staff for medical diagnosis, treatment planning, pharmacy fulfillment, and billing. No patient data is shared with un-affiliated third parties or advertisers.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>3. ABDM & Health Information Exchange</h5>
              <p>
                If linked to an ABHA (Ayushman Bharat Health Account), health records may be securely linked to the National Health Grid only upon explicit patient consent during every transfer request.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>4. Patient Consent & Audit Logging</h5>
              <p>
                Patients retain the right to view, download digital copies, or revoke non-emergency consent. Every clinical lookup and record modification is recorded with immutable audit timestamps.
              </p>
            </div>
          ) : (
            <div>
              <h4 style={{ margin: '0 0 8px', color: 'var(--primary, #0f766e)', fontSize: 16 }}>
                Hospital EMR & Digital Prescription Terms of Service
              </h4>
              <p style={{ color: 'var(--text-muted, #475569)', fontSize: 12, marginBottom: 16 }}>
                Effective Date: January 1, 2026 | Version 2.1.0
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>1. Medical Advice Disclaimer</h5>
              <p>
                Digital prescriptions, lab orders, and discharge summaries issued through Medbuilds EMR are generated by licensed healthcare practitioners. Printed slips are valid legal prescriptions when accompanied by doctor registration credentials or signature.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>2. User Account & Credential Security</h5>
              <p>
                Doctors, nurses, and administrative personnel must maintain strict confidentiality of authentication tokens and passwords. Unauthorized access or sharing of credentials violates hospital security policies.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>3. Emergency Break-Glass Protocols</h5>
              <p>
                In life-critical clinical emergencies, authorized emergency staff may access vital medical records under emergency break-glass protocols. All such access is automatically logged and flagged for administrative review.
              </p>

              <h5 style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700 }}>4. System Availability & Offline Cache</h5>
              <p>
                Medbuilds EMR utilizes offline-first local cache synchronization to guarantee uninterrupted clinical workflows even during internet outages.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface, #f8fafc)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
            Medbuilds EMR Systems © 2026
          </span>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
