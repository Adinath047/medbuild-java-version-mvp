// client/src/pages/AdminPortal.tsx
// Private admin portal — only for registering/managing doctors & receptionists.
// This screen is NOT accessible from the login credentials shared with staff.
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

const ROLES = ['doctor', 'receptionist', 'nurse', 'lab_technician', 'pharmacist', 'admin', 'billing'] as const;
const SPECIALIZATIONS = [
  'General Medicine','General Surgery','Pediatrics','Obstetrics & Gynaecology',
  'Cardiology','Neurology','Orthopedics','Ophthalmology','ENT','Dermatology',
  'Psychiatry','Pulmonology','Nephrology','Urology','Gastroenterology','Oncology',
  'Endocrinology','Emergency Medicine','Radiology','Pathology','Dentistry','Other',
];

const ROLE_COLOR: Record<string, string> = { doctor:'#0d9488', receptionist:'#d97706', nurse:'#7c3aed', lab_technician:'#0369a1', pharmacist:'#16a34a', admin:'#2563eb', billing:'#be123c' };
const ROLE_BG:    Record<string, string> = { doctor:'#f0fdf4', receptionist:'#fffbeb', nurse:'#f5f3ff', lab_technician:'#e0f2fe', pharmacist:'#dcfce7', admin:'#eff6ff', billing:'#ffe4e6' };

// ── Add Staff Modal ────────────────────────────────────────────────────
function AddModal({ onClose, onDone }: { onClose: () => void; onDone: (u: any) => void }) {
  const [form, setForm] = useState({
    name:'', email:'', password:'', confirmPassword:'',
    role:'doctor' as typeof ROLES[number],
    staff_type: 'front_desk',    // for receptionist sub-type
    specialization:'', phone:'', license_number:'',
    consultation_fee: '', followup_fee:'',  // for doctor rates
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified]   = useState<boolean|null>(null);

  const set = (k: string, v: string) => {
    // Restrictions while filling
    if (k === 'phone') {
      const val = v.replace(/\D/g, '').slice(0, 10);
      setForm(f => ({ ...f, [k]: val }));
      return;
    }
    if (k === 'name' && /[^a-zA-Z.\s]/.test(v)) return; // Only letters, dots and spaces

    setForm(f => ({ ...f, [k]: v }));
  };

  async function verifyLicense() {
    if (!form.license_number) { setError('Enter license number first'); return; }
    setVerifying(true); setError(''); setVerified(null);
    try {
      const res = await apiClient.post('/users/verify-license', { license_number: form.license_number });
      if (res.data.verified) setVerified(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Verification failed');
      setVerified(false);
    } finally { setVerifying(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      const res = await apiClient.post('/users', form);
      onDone(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Failed. Is the server running?');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Register New Staff</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

              <div style={{ gridColumn:'1/-1' }} className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} required />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Only letters and spaces allowed.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="nurse">Nurse</option>
                  <option value="lab_technician">Lab Technician</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="billing">Insurance / Billing</option>
                  <option value="admin">Hospital Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" type="tel" placeholder="10-digit number" value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={10} />
              </div>

              <div style={{ gridColumn:'1/-1' }} className="form-group">
                <label className="form-label">Login Email *</label>
                <input className="input" type="email" placeholder="dr.kumar@hospital.local" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
              </div>

              {form.role === 'receptionist' && (
                <div style={{ gridColumn:'1/-1' }} className="form-group">
                  <label className="form-label">Staff Function *</label>
                  <select className="input" value={form.staff_type} onChange={e => set('staff_type', e.target.value)}>
                    <option value="front_desk">🖥️ Front Desk (Patients, Appointments, Billing)</option>
                    <option value="pharmacy">💊 Pharmacy (Medicine dispensing only)</option>
                  </select>
                </div>
              )}

              {form.role === 'doctor' && (
                <>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">Specialization</label>
                    <select className="input" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
                      <option value="">— Select —</option>
                      {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">License / Registration No.</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" placeholder="e.g. MH-12345" 
                        value={form.license_number} 
                        onChange={e => { set('license_number', e.target.value.toUpperCase()); setVerified(null); }} 
                        style={{ borderColor: verified === true ? '#16a34a' : verified === false ? '#dc2626' : undefined }}
                      />
                      <button type="button" className="btn btn-secondary" 
                        onClick={verifyLicense} 
                        disabled={verifying || !form.license_number}
                        style={{ flexShrink: 0 }}>
                        {verifying ? <div className="spinner spinner-sm"/> : verified ? '✓ Verified' : 'Verify Gov'}
                      </button>
                    </div>
                    {verified === true && <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4 }}>Verified in NMC National Medical Register</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">OPD Consultation Fee ₹</label>
                    <input className="input" type="number" min={0} step={50} placeholder="e.g. 500"
                      value={form.consultation_fee} onChange={e => set('consultation_fee', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up Fee ₹</label>
                    <input className="input" type="number" min={0} step={50} placeholder="e.g. 200"
                      value={form.followup_fee} onChange={e => set('followup_fee', e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Registering…</> : 'Register Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit / Reset-password Modal ────────────────────────────────────────
function EditModal({ staff, onClose, onDone }: { staff: any; onClose: () => void; onDone: (u: any) => void }) {
  const [form, setForm] = useState({
    name: staff.name, phone: staff.phone||'',
    specialization: staff.specialization||'', license_number: staff.license_number||'',
    is_active: staff.is_active,
    staff_type: staff.staff_type || 'front_desk',
    consultation_fee: staff.consultation_fee || 0,
    followup_fee: staff.followup_fee || 0,
  });
  const [newPwd, setNewPwd]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [error, setError]     = useState('');
  const [ok, setOk]           = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setOk('');
    try {
      await apiClient.patch(`/users/${staff.id}`, form);
      setOk('Saved'); onDone({ ...staff, ...form });
    } catch (err: any) { setError(err?.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function resetPwd() {
    if (!newPwd || newPwd.length < 6) { setError('Password must be at least 6 characters'); return; }
    setPwdBusy(true); setError(''); setOk('');
    try {
      await apiClient.post(`/users/${staff.id}/reset-password`, { password: newPwd });
      setOk('Password reset'); setNewPwd('');
    } catch (err: any) { setError(err?.response?.data?.error || 'Reset failed'); }
    finally { setPwdBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{staff.name}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
              <span style={{ color: ROLE_COLOR[staff.role], fontWeight:600, textTransform:'capitalize' }}>{staff.role}</span> · {staff.email}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {ok    && <div className="alert alert-success">✓ {ok}</div>}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }} className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="input" value={form.is_active} onChange={e => set('is_active', Number(e.target.value))}>
                  <option value={1}>Active</option>
                  <option value={0}>Deactivated</option>
                </select>
              </div>
              {staff.role === 'receptionist' && (
                <div style={{ gridColumn:'1/-1' }} className="form-group">
                  <label className="form-label">Staff Function</label>
                  <select className="input" value={form.staff_type} onChange={e => set('staff_type', e.target.value)}>
                    <option value="front_desk">🖥️ Front Desk</option>
                    <option value="pharmacy">💊 Pharmacy</option>
                  </select>
                </div>
              )}
              {staff.role === 'doctor' && (
                <>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">Specialization</label>
                    <select className="input" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
                      <option value="">— None —</option>
                      {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">License No.</label>
                    <input className="input" value={form.license_number} onChange={e => set('license_number', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">OPD Consultation Fee ₹</label>
                    <input className="input" type="number" min={0} step={50}
                      value={form.consultation_fee}
                      onChange={e => set('consultation_fee', e.target.value as any)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up Fee ₹</label>
                    <input className="input" type="number" min={0} step={50}
                      value={form.followup_fee}
                      onChange={e => set('followup_fee', e.target.value as any)} />
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:14 }}>
              <div className="form-label" style={{ marginBottom:6 }}>Reset Password</div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" type="password" placeholder="New password (min 6)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                <button type="button" className="btn btn-secondary" style={{ flexShrink:0 }} onClick={resetPwd} disabled={pwdBusy}>
                  {pwdBusy ? <div className="spinner spinner-sm"/> : 'Reset'}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <div style={{ marginRight:'auto' }}>
              <button type="button" className="btn btn-ghost btn-sm"
                style={{ color:'var(--danger)' }}
                disabled={saving}
                onClick={async () => {
                  if (!confirm(`Permanently remove ${staff.name}?`)) return;
                  setSaving(true);
                  try {
                    await apiClient.delete(`/users/${staff.id}`);
                    onDone({ ...staff, _deleted: true });
                  } catch (err: any) {
                    const msg = err?.response?.data?.message || err?.response?.data?.error || 'Delete failed';
                    setError(msg);
                    setSaving(false);
                  }
                }}>
                🗑️ Delete
              </button>
              {error && error.includes('records') && (
                <button type="button" className="btn btn-secondary" 
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await apiClient.patch(`/users/${staff.id}/status`, { is_active: 0 });
                      onDone({ ...staff, is_active: 0 });
                    } catch (err) {
                      setError('Deactivation failed');
                    } finally {
                      setSaving(false);
                    }
                  }}>
                  ⏹️ Deactivate Instead
                </button>
              )}
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PatientErasureTab() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [erasingPat, setErasingPat] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    setLoading(true);
    setActionError('');
    try {
      const res = await apiClient.get('/patients?limit=200');
      setPatients(res.data.patients || []);
    } catch (err: any) {
      setActionError('Failed to load patient records.');
    } finally {
      setLoading(false);
    }
  }

  async function handleErasure() {
    if (confirmText !== 'ERASE') {
      setActionError('Please type ERASE to confirm.');
      return;
    }
    setBusy(true);
    setActionError('');
    setSuccessMsg('');
    try {
      await apiClient.post(`/patients/${erasingPat.id}/erasure`);
      setSuccessMsg(`Patient ${erasingPat.name} has been cleanly deleted under Right to Erasure.`);
      setPatients(prev => prev.filter(p => p.id !== erasingPat.id));
      setErasingPat(null);
      setConfirmText('');
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to execute erasure.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.uhid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="alert alert-warning" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        <strong>⚖️ Indian DPDP Act 2023 Compliance Portal</strong>
        <span>Section 12: Right to Erasure ("Right to be Forgotten"). Hospital Master Admin may permanently delete patient profiles and associated medical history upon verified request.</span>
      </div>

      {actionError && <div className="alert alert-danger">⚠️ {actionError}</div>}
      {successMsg && <div className="alert alert-success">✓ {successMsg}</div>}

      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div className="search-bar" style={{ flex:1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search patients by name or UHID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding:60, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <h3>No patients found</h3>
            <p>Try a different search query or select another patient.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>UHID</th>
                  <th>Sex & Age</th>
                  <th>Phone</th>
                  <th>ABHA Number</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email || 'No email'}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.uhid}</td>
                    <td>{p.sex} · {p.age ? `${p.age}y` : '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.abha_number ? `🇮🇳 ${p.abha_number}` : 'Not Linked'}</td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', background: 'none' }}
                        onClick={() => { setErasingPat(p); setActionError(''); setSuccessMsg(''); }}
                      >
                        🗑️ Erase Data
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {erasingPat && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="modal-title" style={{ color: 'var(--danger)' }}>🚨 Critical: Right to Erasure</div>
              <button className="modal-close" onClick={() => setErasingPat(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
              <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                <strong>WARNING:</strong> You are about to permanently erase <strong>{erasingPat.name}</strong> ({erasingPat.uhid}) from the database.
                <br /><br />
                This action is irreversible and will permanently delete all associated medical consultations, vitals, prescriptions, bills, and appointments under the DPDP Act 2023 Right to be Forgotten.
              </div>

              <div className="form-group">
                <label className="form-label">Type <strong>ERASE</strong> below to confirm:</label>
                <input 
                  className="input" 
                  placeholder="ERASE" 
                  value={confirmText} 
                  onChange={e => setConfirmText(e.target.value)} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setErasingPat(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleErasure}
                disabled={busy || confirmText !== 'ERASE'}
              >
                {busy ? 'Erasing…' : 'Confirm Absolute Erasure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Portal ───────────────────────────────────────────────────────
export default function AdminPortal() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'staff' | 'erasure'>('staff');
  const [staff, setStaff]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch]         = useState('');

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get('/users');
      setStaff(res.data.users);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Cannot connect to server. Start the backend first.');
    } finally { setLoading(false); }
  }

  const filtered = staff.filter(s => {
    const matchRole   = roleFilter === 'all' || s.role === roleFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts: Record<string, number> = {
    all: staff.length,
    doctor: staff.filter(s => s.role === 'doctor').length,
    receptionist: staff.filter(s => s.role === 'receptionist').length,
    nurse: staff.filter(s => s.role === 'nurse').length,
    lab_technician: staff.filter(s => s.role === 'lab_technician').length,
    pharmacist: staff.filter(s => s.role === 'pharmacist').length,
    billing: staff.filter(s => s.role === 'billing').length,
    admin: staff.filter(s => s.role === 'admin').length,
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', flexDirection:'column' }}>
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onDone={u => { setStaff(s => [u, ...s]); setShowAdd(false); }} />}
      {editing  && <EditModal staff={editing} onClose={() => setEditing(null)} onDone={updated => {
        if (updated._deleted) {
          setStaff(s => s.filter(x => x.id !== updated.id));
        } else {
          setStaff(s => s.map(x => x.id === updated.id ? { ...x, ...updated } : x));
        }
        setEditing(null);
      }} />}

      <header style={{ background:'#fff', borderBottom:'1px solid var(--border)', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'var(--shadow-sm)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpg" alt="MedBuilds Logo" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6 }} />
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', lineHeight:1 }}>MedBuilds</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>Admin · Staff Management</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontWeight:600, fontSize:13 }}>{user?.name}</div>
            <div style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>Administrator</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px', width:'100%', flex:1 }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button 
            type="button"
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: 14,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'staff' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              outline: 'none'
            }}
          >
            👥 Staff Directory
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('erasure')}
            style={{
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: 14,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'erasure' ? '2px solid var(--danger)' : '2px solid transparent',
              color: activeTab === 'erasure' ? 'var(--danger)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              outline: 'none'
            }}
          >
            ⚖️ Patient Erasure (DPDP)
          </button>
        </div>

        {activeTab === 'staff' ? (
          <>
            {/* Stats */}
            <div style={{ display:'flex', overflowX:'auto', gap:12, marginBottom:20, paddingBottom: 8 }}>
              {([['all','Total Staff','#6b7280'],['doctor','Doctors','#0d9488'],['receptionist','Receptionists','#d97706'],['nurse','Nurses','#7c3aed'],['lab_technician','Lab','#0369a1'],['pharmacist','Pharmacy','#16a34a'],['billing','Billing','#be123c'],['admin','Admins','#2563eb']] as const).map(([r, label, color]) => (
                <div key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    flex: '0 0 auto',
                    minWidth: 120,
                    background: roleFilter === r ? '#fff' : '#fff',
                    border: `2px solid ${roleFilter === r ? color : 'var(--border)'}`,
                    borderRadius:'var(--radius-lg)', padding:'16px', cursor:'pointer',
                    transition:'all 0.15s', boxShadow: roleFilter === r ? 'var(--shadow-sm)' : 'none',
                  }}>
                  <div style={{ fontSize:24, fontWeight:800, color }}>{counts[r]}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
              <div className="search-bar" style={{ flex:1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Register Staff</button>
            </div>

            {/* Table card */}
            <div className="card">
              {error && <div className="alert alert-warning" style={{ margin:16 }}>⚠ {error}</div>}
              {loading
                ? <div style={{ padding:60, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
                : filtered.length === 0
                  ? (
                    <div className="empty-state">
                      <span className="empty-icon">👥</span>
                      <h3>{search ? 'No results' : 'No staff yet'}</h3>
                      <p>{search ? 'Try a different search.' : 'Register your first doctor or receptionist.'}</p>
                      {!search && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Register Staff</button>}
                    </div>
                  )
                  : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th>Role</th>
                            <th>Specialization</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(s => (
                            <tr key={s.id}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div style={{
                                    width:36, height:36, borderRadius:'50%', flexShrink:0,
                                    background: ROLE_BG[s.role] || '#f1f5f9',
                                    border: `2px solid ${ROLE_COLOR[s.role] || '#94a3b8'}`,
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:12, fontWeight:700, color: ROLE_COLOR[s.role] || '#64748b',
                                    opacity: s.is_active ? 1 : 0.45,
                                    overflow: 'hidden'
                                  }}>
                                    {s.photo_url ? (
                                      <img src={s.photo_url} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    ) : (
                                      s.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                  <span style={{
                                    fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20,
                                    background: ROLE_BG[s.role] || '#f1f5f9',
                                    color: ROLE_COLOR[s.role] || '#64748b',
                                    textTransform:'capitalize',
                                    border: `1px solid ${ROLE_COLOR[s.role]}33`,
                                    display:'inline-block',
                                  }}>{s.role}</span>
                                  {s.role === 'receptionist' && s.staff_type === 'pharmacy' && (
                                    <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20,
                                      background:'#ecfdf5', color:'#059669', border:'1px solid #a7f3d0', display:'inline-block' }}>💊 Pharmacy</span>
                                  )}
                                  {s.role === 'doctor' && (s.consultation_fee > 0 || s.followup_fee > 0) && (
                                    <span style={{ fontSize:9.5, color:'#64748b' }}>
                                      OPD ₹{s.consultation_fee || 0} · FU ₹{s.followup_fee || 0}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontSize:12, color:'var(--text-muted)' }}>{s.specialization || '—'}</td>
                              <td style={{ fontSize:12, color:'var(--text-muted)' }}>{s.phone || '—'}</td>
                              <td>
                                <span style={{
                                  fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20,
                                  background: s.is_active ? '#f0fdf4' : '#fef2f2',
                                  color: s.is_active ? '#16a34a' : '#dc2626',
                                  border: `1px solid ${s.is_active ? '#bbf7d0' : '#fecaca'}`,
                                }}>{s.is_active ? 'Active' : 'Inactive'}</span>
                              </td>
                              <td>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              }
            </div>
          </>
        ) : (
          <PatientErasureTab />
        )}
      </div>
    </div>
  );
}
