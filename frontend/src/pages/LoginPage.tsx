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
  billing:        'Billing / Finance',
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
    setLoading(true);
    try {
      const res = await apiClient.get(`/auth/hospital/${codeToVerify.trim()}/staff`);
      
      if (!res.data || !res.data.hospital || !Array.isArray(res.data.staff)) {
        throw new Error('Invalid response format from server');
      }

      setHospitalName(res.data.hospital.name);
      setStaff(res.data.staff);
      setStep('auth');
      
      if (saveToLocal) {
        localStorage.setItem('last_hospital_code', codeToVerify.trim().toLowerCase());
      }
      
      // Pre-select first user of default role if available
      const defaultRoleUsers = res.data.staff.filter((s: any) => s.role === 'doctor');
      if (defaultRoleUsers.length > 0) {
        setSelectedStaffId(defaultRoleUsers[0].id);
      } else {
        setSelectedStaffId('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid Hospital Code or connection error.');
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
    const ok = await login(selectedUser.email, password);
    setLoading(false);
    if (!ok) {
      setError('Incorrect password. Please try again.');
    }
  }

  return (
    <div className="login-root">
      <div className="login-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="login-logo-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <img 
            src="/logo.jpg" 
            alt="MedBuilds Logo" 
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 14, 
              objectFit: 'cover',
              marginBottom: 8
            }} 
          />
          <div>
            <div className="login-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px' }}>MedBuilds</div>
            <div className="login-sub" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Hospital Information System</div>
          </div>
        </div>

        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        {step === 'hospital' ? (
          <form onSubmit={handleVerifyHospital} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Enter Hospital Code *</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. hsp-001"
                value={hospitalCode}
                onChange={e => setHospitalCode(e.target.value.toLowerCase().trim())}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{ textTransform: 'lowercase' }}
              />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <div className="spinner spinner-sm"/> : 'Verify Hospital →'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', fontSize: 11.5, background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}
                onClick={() => {
                  setHospitalCode('CLI-001');
                  verifyCode('CLI-001');
                }}
              >
                Demo 2-Member Small Clinic (`CLI-001`)
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              >
                Change Hospital
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Select Role *</label>
              <select
                className="input"
                value={role}
                onChange={e => handleRoleChange(e.target.value)}
              >
                {Object.entries(ROLE_LABELS).map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Select Name *</label>
              <select
                className="input"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                required
              >
                <option value="">— Select Staff Member —</option>
                {staff
                  .filter(s => s.role === role)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                }
              </select>
              {staff.filter(s => s.role === role).length === 0 && (
                <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>
                  No active staff registered under this role.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Enter Password *</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading || !selectedStaffId}>
              {loading ? <><div className="spinner spinner-sm"/>Signing in…</> : 'Sign In'}
            </button>
          </form>
        )}
        
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-light)',
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
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0, textDecoration: 'underline' }}
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
          fontSize: 11,
          color: 'var(--text-sec)',
          lineHeight: 1.45,
          textAlign: 'center'
        }}>
          <strong>Medical & Legal Disclaimer:</strong> Medicos is a clinical workflow assistance tool. It does not replace professional medical judgment, diagnosis, or treatment decisions.
        </div>

        <PrivacyTermsModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      </div>
    </div>
  );
}
