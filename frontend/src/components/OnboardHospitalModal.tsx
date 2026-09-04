import React, { useState } from 'react';
import { apiClient } from '../api/client';

const HOSPITAL_TYPES = [
  'General Hospital',
  'Multi-Specialty Hospital',
  'Super Specialty Clinic',
  'Primary Health Center',
  'Day Care Surgical Center',
  'Diagnostic & Pathology Center',
  'Maternity & Pediatric Hospital'
];

interface OnboardHospitalModalProps {
  onClose: () => void;
  onSuccess: (hospital: any) => void;
}

export default function OnboardHospitalModal({ onClose, onSuccess }: OnboardHospitalModalProps) {
  const [form, setForm] = useState({
    hospital_name: '',
    hospital_type: 'General Hospital',
    city: '',
    phone: '',
    admin_name: '',
    admin_email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hospital_name || !form.admin_email) {
      setError('Hospital name and Administrator email are required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/onboard-hospital', form);
      setSuccessData(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to onboard hospital tenant.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="onboard-modal-title">
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/logo.jpg"
              alt="Medbuilds"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
              }}
            />
            <div>
              <h3 id="onboard-modal-title" style={{ fontSize: 16.5, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Onboard New Hospital Tenant
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Provisions a 30-day trial and sends activation email strictly to the Hospital Administrator.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {successData ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h4 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
              Hospital Successfully Provisioned!
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Invitation email with 48h activation link has been sent to:
              <br />
              <strong style={{ color: 'var(--text)' }}>{successData.admin_email}</strong>
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              textAlign: 'left',
              marginBottom: 24,
              fontSize: 12.5
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Hospital Tenant ID:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f766e' }}>{successData.hospital_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Hospital Name:</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{successData.hospital_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Plan:</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>30-Day Medical Trial Active</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 0', fontWeight: 700 }}
              onClick={() => onSuccess(successData)}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
              {error && (
                <div className="alert alert-danger" style={{ fontSize: 12.5 }}>
                  {error}
                </div>
              )}

              {/* Section 1: Hospital Details */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px' }}>
                1. Hospital Information
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Hospital / Clinic Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Metro Specialist Hospital"
                  value={form.hospital_name}
                  onChange={e => setForm({ ...form, hospital_name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Facility Type</label>
                  <select
                    className="input"
                    value={form.hospital_type}
                    onChange={e => setForm({ ...form, hospital_type: e.target.value })}
                  >
                    {HOSPITAL_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>City / Region</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Mumbai, Maharashtra"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>
              </div>

              {/* Section 2: Hospital Administrator Details */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginTop: 8 }}>
                2. Hospital Administrator (Recipient of Invitation)
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Administrator Email Address *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. director@metrohospital.org"
                  value={form.admin_email}
                  onChange={e => setForm({ ...form, admin_email: e.target.value })}
                  required
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Only this administrator will receive the setup email to manage the hospital.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Administrator Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dr. Rajesh Patel (Director)"
                    value={form.admin_name}
                    onChange={e => setForm({ ...form, admin_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Phone (Optional)</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. +91 98765 43210"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm" />
                    Provisioning Tenant…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Provision &amp; Send Admin Invite
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
