import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { PrivacyTermsModal } from '../components/PrivacyTermsModal';

const ROLE_LABELS: Record<string, string> = {
  admin:          'Administrator',
  doctor:         'Doctor',
  receptionist:   'Receptionist',
  nurse:          'Nurse',
  lab_technician: 'Lab Technician',
  pharmacist:     'Pharmacist',
  billing:        'Billing Staff',
};

export default function LoginPage() {
  const { login } = useAuthStore();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  // Hospital Verification
  const [hospitalCode, setHospitalCode] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [staff, setStaff]               = useState<any[]>([]);
  const [step, setStep]                 = useState<'hospital' | 'auth'>('hospital');
  
  // Credentials
  const [role, setRole]                 = useState('doctor');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  // Load saved hospital code on mount
  React.useEffect(() => {
    const savedCode = localStorage.getItem('last_hospital_code');
    if (savedCode) {
      setHospitalCode(savedCode);
      verifyCode(savedCode, false);
    }
  }, []);

  // Core verification logic
  async function verifyCode(codeToVerify: string, saveToLocal = true) {
    setError('');
    const cleanCode = (codeToVerify || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!cleanCode) {
      setError('Please enter a valid Hospital Code (e.g. hsp-001).');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get(`/auth/hospital/${encodeURIComponent(cleanCode)}/staff`);
      
      if (!res.data || !res.data.hospital || !Array.isArray(res.data.staff)) {
        throw new Error('Invalid response format from server');
      }

      if (res.data.staff.length === 0) {
        throw new Error(`Hospital Code '${cleanCode}' has no active registered staff members.`);
      }

      const canonicalHospitalId = res.data.hospital.id || cleanCode;
      setHospitalName(res.data.hospital.name);
      setHospitalCode(canonicalHospitalId);
      setStaff(res.data.staff);
      setStep('auth');
      
      if (saveToLocal) {
        localStorage.setItem('last_hospital_code', canonicalHospitalId);
      }
      
      // Auto-select first doctor, fall back to admin, then any first staff
      const allStaff: any[] = res.data.staff;
      const doctorUsers = allStaff.filter((s: any) => s.role === 'doctor');
      const adminUsers  = allStaff.filter((s: any) => s.role === 'admin');
      if (doctorUsers.length > 0) {
        setRole('doctor');
        setSelectedStaffId(doctorUsers[0].id);
      } else if (adminUsers.length > 0) {
        setRole('admin');
        setSelectedStaffId(adminUsers[0].id);
      } else if (allStaff.length > 0) {
        const firstStaff = allStaff[0];
        setRole(firstStaff.role);
        setSelectedStaffId(firstStaff.id);
      } else {
        setSelectedStaffId('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Invalid Hospital Code or connection error.');
      if (!saveToLocal) {
        // Clear corrupt/invalid saved code
        localStorage.removeItem('last_hospital_code');
        setStep('hospital');
      }
    } finally {
      setLoading(false);
    }
  }

  // Verify Hospital Code from manual form submission
  async function handleVerifyHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalCode.trim()) {
      setError('Please enter a Hospital Code.');
      return;
    }
    await verifyCode(hospitalCode);
  }

  // Handle Role Selection change
  function handleRoleChange(selectedRole: string) {
    setRole(selectedRole);
    const filtered = staff.filter(s => s.role === selectedRole);
    if (filtered.length > 0) {
      setSelectedStaffId(filtered[0].id);
    } else {
      setSelectedStaffId('');
    }
  }

  // Sign In using email and password
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedStaffId) {
      setError('Please select your staff name.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    const selectedUser = staff.find(s => s.id === selectedStaffId);
    if (!selectedUser) {
      setError('Selected user not found.');
      return;
    }

    setLoading(true);
    const ok = await login(selectedUser.id, password, hospitalCode);
    setLoading(false);
    if (!ok) {
      setError('Incorrect password. Please try again.');
    }
  }

  return (
    <main className="login-root" role="main" aria-label="Hospital Information System Login">
      <div className="login-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="login-logo-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <img 
            src="/logo.jpg" 
            alt="MedBuilds Hospital Information System" 
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 14, 
              objectFit: 'cover',
              marginBottom: 8
            }} 
          />
          <div>
            <h1 className="login-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', margin: 0 }}>MedBuilds</h1>
            <div className="login-sub" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Hospital Information System</div>
          </div>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {step === 'hospital' ? (
          <form onSubmit={handleVerifyHospital} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-label="Hospital Verification Form">
            <div className="form-group">
              <label htmlFor="hospital-code" className="form-label">Enter Hospital Code *</label>
              <input
                id="hospital-code"
                className="input"
                type="text"
                placeholder="Enter Clinic or Hospital Code"
                value={hospitalCode}
                onChange={e => setHospitalCode(e.target.value.toLowerCase().trim())}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Hospital Code"
                style={{ textTransform: 'lowercase' }}
              />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} aria-label="Verify Hospital">
              {loading ? <div className="spinner spinner-sm" aria-hidden="true"/> : 'Verify Hospital →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-label="Staff Login Form">
            <div style={{ background: 'var(--surface-alt)', padding: 10, borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>HOSPITAL</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{hospitalName}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: 0, minHeight: 'auto', marginTop: 4, color: 'var(--danger)' }}
                onClick={() => {
                  setStep('hospital');
                  setHospitalCode('');
                  setStaff([]);
                  setSelectedStaffId('');
                  setPassword('');
                  localStorage.removeItem('last_hospital_code');
                }}
                aria-label="Change Selected Hospital"
              >
                Change Hospital
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="select-role" className="form-label">Select Role *</label>
              <select
                id="select-role"
                className="input"
                value={role}
                onChange={e => handleRoleChange(e.target.value)}
                aria-label="Select Role"
              >
                {Object.entries(ROLE_LABELS).map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="select-staff" className="form-label">Select Name *</label>
              <select
                id="select-staff"
                className="input"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                required
                aria-label="Select Staff Member"
              >
                <option value="">— Select Staff Member —</option>
                {(Array.isArray(staff) ? staff : [])
                  .filter(s => s.role === role)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                }
              </select>
              {(Array.isArray(staff) ? staff : []).filter(s => s.role === role).length === 0 && (
                <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>
                  No active staff registered under this role.
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Enter Password *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-label="Password"
                  style={{ width: '100%', paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading || !selectedStaffId} aria-label="Sign In">
              {loading ? <><div className="spinner spinner-sm" aria-hidden="true"/>Signing in…</> : 'Sign In'}
            </button>
          </form>
        )}
        
        <div style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: 'var(--text-muted)',
          marginTop: 20,
          fontWeight: 600,
          letterSpacing: '0.4px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12
        }}>
          <span>Powered by Rotstruck Pvt Ltd</span>
          <span>•</span>
          <button 
            type="button" 
            onClick={() => setShowPrivacyModal(true)} 
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: 0, textDecoration: 'underline' }}
            aria-label="Open Privacy Policy and Terms of Service"
          >
            Privacy Policy & Terms
          </button>
        </div>

        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          fontSize: 11.5,
          color: 'var(--text-sec)',
          lineHeight: 1.45,
          textAlign: 'center'
        }}>
          <strong>Medical & Legal Disclaimer:</strong> Medbuilds is a clinical workflow assistance tool. It does not replace professional medical judgment, diagnosis, or treatment decisions.
        </div>

        <PrivacyTermsModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      </div>
    </main>
  );
}
