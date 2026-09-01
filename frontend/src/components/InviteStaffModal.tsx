import React, { useState } from 'react';
import { apiClient } from '../api/client';

const ROLES = [
  { value: 'doctor', label: 'Doctor (OPD & Clinical Care)' },
  { value: 'nurse', label: 'Nurse (Station & Vitals)' },
  { value: 'receptionist', label: 'Receptionist (Front Desk)' },
  { value: 'lab_technician', label: 'Lab Technician (Pathology)' },
  { value: 'pharmacist', label: 'Pharmacist (Dispensary)' },
  { value: 'billing', label: 'Billing / Finance Officer' },
  { value: 'admin', label: 'Hospital Administrator' }
];

const SPECIALIZATIONS = [
  'General Medicine', 'General Surgery', 'Pediatrics', 'Obstetrics & Gynaecology',
  'Cardiology', 'Neurology', 'Orthopedics', 'Ophthalmology', 'ENT', 'Dermatology',
  'Psychiatry', 'Pulmonology', 'Nephrology', 'Urology', 'Gastroenterology', 'Oncology',
  'Endocrinology', 'Emergency Medicine', 'Radiology', 'Pathology', 'Dentistry', 'Other'
];

interface InviteStaffModalProps {
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export default function InviteStaffModal({ onClose, onSuccess }: InviteStaffModalProps) {
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'doctor',
    specialization: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.role) {
      setError('Email and role are required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await apiClient.post('/auth/invite', form);
      setSuccess(true);
      setTimeout(() => {
        onSuccess(form.email);
      }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to send invitation email.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#ccfbf1',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <h3 id="invite-modal-title" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Invite Staff Member via Email
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Recipient receives a secure, 48-hour activation link to set their own password.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {success ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
              Invitation Email Dispatched!
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              An activation email has been sent to <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
              {error && (
                <div className="alert alert-danger" style={{ fontSize: 12.5 }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Email Address *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. doctor@hospital.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  autoFocus
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Activation link with 48h expiration will be sent here.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dr. Priya Nair"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Role & Access *</label>
                  <select
                    className="input"
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role === 'doctor' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Specialization</label>
                    <select
                      className="input"
                      value={form.specialization}
                      onChange={e => setForm({ ...form, specialization: e.target.value })}
                    >
                      <option value="">Select Specialization</option>
                      {SPECIALIZATIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
              )}

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  <strong>Security Note:</strong> No temporary passwords are generated or sent. The invited user will choose their own private password on the verification screen.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {loading ? (
                  <>
                    <div className="spinner spinner-sm" />
                    Sending Invite…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Invitation Email
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
