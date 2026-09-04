import React, { useState, useEffect } from 'react';
import { apiClient, setAccessToken } from '../api/client';
import { useAuthStore, normalizeAuthUser } from '../store/authStore';

interface TokenData {
  valid: boolean;
  email?: string;
  name?: string;
  role?: string;
  hospitalName?: string;
  hospitalId?: string;
  message?: string;
}

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Doctor (Clinical OPD)',
  receptionist: 'Receptionist (Front Desk)',
  nurse: 'Nurse (Station & Vitals)',
  lab_technician: 'Lab Technician',
  pharmacist: 'Pharmacist',
  billing: 'Billing Specialist',
  admin: 'Hospital Administrator'
};

export default function AcceptInvitePage() {
  const [token, setToken] = useState<string>('');
  const [validating, setValidating] = useState<boolean>(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Extract token from URL path (/accept-invite/<token>) or search params (?token=...)
    const pathParts = window.location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const urlParams = new URLSearchParams(window.location.search);
    const rawToken = urlParams.get('token') || (lastPart && lastPart !== 'accept-invite' ? lastPart : '');

    if (!rawToken) {
      setValidating(false);
      setError('No invite token found in URL.');
      return;
    }

    setToken(rawToken);
    validateToken(rawToken);
  }, []);

  async function validateToken(t: string) {
    setValidating(true);
    setError('');
    try {
      const res = await apiClient.get<TokenData>(`/auth/invites/validate?token=${encodeURIComponent(t)}`);
      setTokenData(res.data);
      if (!res.data.valid) {
        setError(res.data.message || 'This invitation link is invalid or has expired.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to validate invitation link.';
      setError(msg);
    } finally {
      setValidating(false);
    }
  }

  // Password strength calculations
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isMatch = password.length > 0 && password === confirmPassword;

  const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasMinLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/invites/accept', {
        token,
        password
      });

      setSuccess(true);

      // ── Auto-login: persist session using the same keys the rest of the app reads ──
      if (res.data?.token) {
        // Clear any old session/navigation state from previous accounts on this browser
        localStorage.removeItem('emr_user');
        localStorage.removeItem('emr_token');
        sessionStorage.removeItem('emr_current_page');

        // 1. Store token under 'emr_token' (the key apiClient & authStore both read)
        setAccessToken(res.data.token);
        localStorage.setItem('emr_token', res.data.token);

        // 2. Normalise and persist user object to 'emr_user'
        if (res.data?.user) {
          const normalizedUser = normalizeAuthUser(res.data.user);
          localStorage.setItem('emr_user', JSON.stringify(normalizedUser));
          if (normalizedUser.hospitalId) {
            localStorage.setItem('last_hospital_code', normalizedUser.hospitalId);
          }
          useAuthStore.setState({ user: normalizedUser, isLoading: false });
        } else if (tokenData?.hospitalId) {
          localStorage.setItem('last_hospital_code', tokenData.hospitalId);
        }

        // 3. Small delay so the success banner is visible, then navigate to dashboard
        setTimeout(() => {
          window.location.href = '/';
        }, 1800);
      } else {
        // No JWT returned — redirect to login so user can sign in manually
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }

    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to set password. Link may be expired.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)'
    }}>
      <div style={{
        maxWidth: 460,
        width: '100%',
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Brand Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
          padding: '28px 32px',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/logo.jpg"
              alt="Medbuilds EMR"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}
            />
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                Medbuilds EMR
              </h2>
              <p style={{ fontSize: 12, color: '#ccfbf1', margin: '4px 0 0' }}>
                Clinical Onboarding & Access Portal
              </p>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div style={{ padding: '32px' }}>
          {validating ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                Validating invitation security token…
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Verifying cryptographic credentials with PostgreSQL server.
              </p>
            </div>
          ) : error && !tokenData?.valid ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' }}>
                Invitation Link Invalid or Expired
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>
                {error}
              </p>
              <a
                href="/"
                style={{
                  display: 'inline-block',
                  background: '#0f766e',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600
                }}
              >
                Return to Login
              </a>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
                Password Set Successfully!
              </h3>
              {tokenData?.hospitalId && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 8,
                  padding: '6px 14px',
                  display: 'inline-block',
                  margin: '0 auto 12px',
                  fontSize: 12.5,
                  color: '#166534'
                }}>
                  Your Hospital Code: <strong style={{ fontFamily: 'monospace', fontSize: 13.5 }}>{tokenData.hospitalId}</strong>
                </div>
              )}
              <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 16px' }}>
                Your account is now active. Redirecting you to your clinical dashboard…
              </p>
              <div className="spinner spinner-sm" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <div>
              {/* Profile Invite Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.5px' }}>
                    {tokenData?.hospitalName || 'Medbuilds Hospital'}
                  </div>
                  {tokenData?.hospitalId && (
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: '#0f766e',
                      color: '#ffffff',
                      letterSpacing: '0.5px'
                    }}>
                      Code: {tokenData.hospitalId}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                  {tokenData?.name || 'Staff Member'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#ccfbf1',
                    color: '#0f766e'
                  }}>
                    {ROLE_LABEL[tokenData?.role || ''] || tokenData?.role || 'Staff'}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {tokenData?.email}
                  </span>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: '#dc2626',
                  marginBottom: 16
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                    Create Master Password *
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter password (minimum 8 chars)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  
                  {/* Password Strength Meter */}
                  {password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                        {[1, 2, 3, 4].map(idx => (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: idx <= strengthScore
                                ? (strengthScore <= 2 ? '#ef4444' : strengthScore === 3 ? '#f59e0b' : '#10b981')
                                : '#e2e8f0',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
                        <span style={{ color: hasMinLength ? '#10b981' : '#94a3b8' }}>✓ 8+ chars</span>
                        <span style={{ color: hasUpper ? '#10b981' : '#94a3b8' }}>✓ Uppercase</span>
                        <span style={{ color: hasLower ? '#10b981' : '#94a3b8' }}>✓ Lowercase</span>
                        <span style={{ color: hasNumber ? '#10b981' : '#94a3b8' }}>✓ Number</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                  {confirmPassword.length > 0 && (
                    <div style={{ fontSize: 11, marginTop: 4, color: isMatch ? '#10b981' : '#ef4444' }}>
                      {isMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !hasMinLength || !isMatch}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  {submitting ? (
                    <>
                      <div className="spinner spinner-sm" />
                      Setting Password & Logging In…
                    </>
                  ) : (
                    'Activate Account & Log In'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
