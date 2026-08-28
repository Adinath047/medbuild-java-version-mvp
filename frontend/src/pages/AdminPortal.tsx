// client/src/pages/AdminPortal.tsx
// Private master admin portal for hospital management, staff directory, DPDP erasure, and audit logs.
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

const ROLES = ['doctor', 'receptionist', 'nurse', 'lab_technician', 'pharmacist', 'admin'] as const;
const SPECIALIZATIONS = [
  'General Medicine','General Surgery','Pediatrics','Obstetrics & Gynaecology',
  'Cardiology','Neurology','Orthopedics','Ophthalmology','ENT','Dermatology',
  'Psychiatry','Pulmonology','Nephrology','Urology','Gastroenterology','Oncology',
  'Endocrinology','Emergency Medicine','Radiology','Pathology','Dentistry','Other',
];

const ROLE_COLOR: Record<string, string> = { 
  doctor:'#0d9488', 
  receptionist:'#d97706', 
  nurse:'#7c3aed', 
  lab_technician:'#0369a1', 
  pharmacist:'#16a34a', 
  admin:'#2563eb' 
};

const ROLE_BG: Record<string, string> = { 
  doctor:'#f0fdf4', 
  receptionist:'#fffbeb', 
  nurse:'#f5f3ff', 
  lab_technician:'#e0f2fe', 
  pharmacist:'#dcfce7', 
  admin:'#eff6ff' 
};

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  nurse: 'Nurse',
  lab_technician: 'Lab Technician',
  pharmacist: 'Pharmacist',
  admin: 'Hospital Admin'
};

// ── Add Staff Modal ────────────────────────────────────────────────────
function AddModal({ onClose, onDone }: { onClose: () => void; onDone: (u: any) => void }) {
  const [form, setForm] = useState({
    name:'', email:'', password:'', confirmPassword:'',
    role:'doctor' as typeof ROLES[number],
    staff_type: 'front_desk',
    specialization:'', phone:'', license_number:'',
    consultation_fee: '', followup_fee:'',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified]   = useState<boolean|null>(null);

  const set = (k: string, v: string) => {
    if (k === 'phone') {
      const val = v.replace(/\D/g, '').slice(0, 10);
      setForm(f => ({ ...f, [k]: val }));
      return;
    }
    if (k === 'name' && /[^a-zA-Z.\s]/.test(v)) return;

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
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Register New Staff Member</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Provision credentials and set role permissions</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

              <div style={{ gridColumn:'1/-1' }} className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="input" placeholder="e.g. Dr. Rajesh Patel" value={form.name} onChange={e => set('name', e.target.value)} required />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Only letters and spaces allowed.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Role & Access *</label>
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="doctor">Doctor (OPD & Clinical)</option>
                  <option value="receptionist">Receptionist (Front Desk)</option>
                  <option value="nurse">Nurse (Station & Vitals)</option>
                  <option value="lab_technician">Lab Technician</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="admin">Hospital Master Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Phone</label>
                <input className="input" type="tel" placeholder="10-digit number" value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={10} />
              </div>

              <div style={{ gridColumn:'1/-1' }} className="form-group">
                <label className="form-label">Login Email Address *</label>
                <input className="input" type="email" placeholder="staff.name@medbuilds.com" value={form.email} onChange={e => set('email', e.target.value)} required />
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
                    <option value="front_desk">Front Desk (Patients, Appointments, Billing)</option>
                    <option value="pharmacy">Pharmacy Counter (Dispensing)</option>
                  </select>
                </div>
              )}

              {form.role === 'doctor' && (
                <>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">Medical Specialization</label>
                    <select className="input" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
                      <option value="">— Select Specialization —</option>
                      {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }} className="form-group">
                    <label className="form-label">NMC / State License No.</label>
                    <input className="input" placeholder="e.g. MH-12345 (Optional)" 
                      value={form.license_number} 
                      onChange={e => set('license_number', e.target.value.toUpperCase())} 
                    />
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
              {saving ? <><div className="spinner spinner-sm"/>Registering…</> : 'Register Staff Member'}
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
    is_active: staff.is_active !== undefined ? (staff.is_active ? 1 : 0) : 1,
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
      setOk('Changes saved successfully'); onDone({ ...staff, ...form });
    } catch (err: any) { setError(err?.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function resetPwd() {
    if (!newPwd || newPwd.length < 6) { setError('Password must be at least 6 characters'); return; }
    setPwdBusy(true); setError(''); setOk('');
    try {
      await apiClient.post(`/users/${staff.id}/reset-password`, { password: newPwd });
      setOk('Password reset successfully'); setNewPwd('');
    } catch (err: any) { setError(err?.response?.data?.error || 'Reset failed'); }
    finally { setPwdBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{staff.name}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
              <span style={{ color: ROLE_COLOR[staff.role] || 'var(--primary)', fontWeight:700, textTransform:'capitalize' }}>
                {ROLE_LABEL[staff.role] || staff.role}
              </span> · {staff.email}
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
                <label className="form-label">Account Status</label>
                <select className="input" value={form.is_active} onChange={e => set('is_active', Number(e.target.value))}>
                  <option value={1}>Active</option>
                  <option value={0}>Deactivated</option>
                </select>
              </div>
              {staff.role === 'receptionist' && (
                <div style={{ gridColumn:'1/-1' }} className="form-group">
                  <label className="form-label">Staff Function</label>
                  <select className="input" value={form.staff_type} onChange={e => set('staff_type', e.target.value)}>
                    <option value="front_desk">Front Desk</option>
                    <option value="pharmacy">Pharmacy Counter</option>
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

            <div style={{ borderTop:'1px solid var(--border)', marginTop:12, paddingTop:14 }}>
              <div className="form-label" style={{ marginBottom:6, fontWeight: 700 }}>Reset Staff Password</div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" type="password" placeholder="New password (min 6 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                <button type="button" className="btn btn-secondary" style={{ flexShrink:0 }} onClick={resetPwd} disabled={pwdBusy}>
                  {pwdBusy ? <div className="spinner spinner-sm"/> : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <div style={{ marginRight:'auto' }}>
              <button type="button" className="btn btn-ghost btn-sm"
                style={{ color:'var(--danger)', fontWeight: 600 }}
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
                Delete Account
              </button>
              {error && error.includes('records') && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}
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
                  Deactivate Instead
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

// ── DPDP Patient Erasure Tab Component ─────────────────────────────────
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
      setPatients(Array.isArray(res.data) ? res.data : (res.data?.patients || []));
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
    (p.uhid && p.uhid.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  return (
    <div>
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20, background: '#fffbeb', border: '1px solid #fef3c7' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>
              Digital Personal Data Protection (DPDP) Act 2023 Compliance
            </h4>
            <p style={{ fontSize: 12.5, color: '#b45309', marginTop: 4, lineHeight: '1.5' }}>
              Section 12: Right to Erasure ("Right to be Forgotten"). As Master Admin, you can permanently sanitize patient records and associated data upon validated legal request.
            </p>
          </div>
        </div>
      </div>

      {actionError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{actionError}</div>}
      {successMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ {successMsg}</div>}

      <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
        <div className="search-bar" style={{ flex:1, margin: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search patients by Name, UHID, or Phone…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>✕</button>
          )}
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding:60, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/> Loading patients...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>No patient records found</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient Details</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>UHID</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demographics</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ABHA ID</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.email || 'No email registered'}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--primary)' }}>{p.uhid}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text)' }}>{p.sex} · {p.age ? `${p.age} yrs` : '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text)' }}>{p.phone || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{p.abha_number ? `${p.abha_number}` : 'Not Linked'}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ color: 'var(--danger)', borderColor: '#fecaca', background: '#fef2f2', fontWeight: 600 }}
                        onClick={() => { setErasingPat(p); setActionError(''); setSuccessMsg(''); }}
                      >
                        Request Erasure
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
        <div className="modal-overlay" onClick={() => setErasingPat(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="modal-title" style={{ color: 'var(--danger)', fontWeight: 700 }}>Critical: Absolute Patient Erasure</div>
              <button className="modal-close" onClick={() => setErasingPat(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
              <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', fontSize: 12.5, color: '#991b1b', lineHeight: 1.5 }}>
                <strong>WARNING:</strong> You are executing a DPDP Right to be Forgotten request for <strong>{erasingPat.name}</strong> ({erasingPat.uhid}).
                <br /><br />
                This action will permanently delete all encounters, vitals, prescriptions, bills, and lab results linked to this patient.
              </div>

              <div className="form-group">
                <label className="form-label">Type <strong>ERASE</strong> to confirm authorization:</label>
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
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 700 }}
                onClick={handleErasure}
                disabled={busy || confirmText !== 'ERASE'}
              >
                {busy ? 'Erasing…' : 'Execute Absolute Erasure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hospital Config & Settings Tab ─────────────────────────────────────
function HospitalConfigTab() {
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState(() => {
    const local = localStorage.getItem('hospital_master_config');
    return local ? JSON.parse(local) : {
      name: 'Medbuilds Super Specialty Hospital',
      tagline: 'Excellence in Healthcare & Clinical Operations',
      reg_no: 'REG-MH-2026-88910',
      address: '102 Medical Enclave, Civil Hospital Road, Mumbai',
      phone: '+91 22 2840 9000',
      emergency_contact: '+91 22 2840 9999 (24x7 Emergency Line)',
      opd_default_fee: '500',
      followup_default_fee: '200',
      gstin: '27AAAAA0000A1Z5',
    };
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('hospital_master_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {saved && <div className="alert alert-success">✓ Hospital configuration updated successfully!</div>}
      <div className="card" style={{ padding: '24px 28px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Hospital Profile & Master Settings</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>General institutional details used on patient invoices, OPD slips, and prescriptions.</p>

        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1' }} className="form-group">
            <label className="form-label">Hospital Name</label>
            <input className="input" value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Registration / License No.</label>
            <input className="input" value={config.reg_no} onChange={e => setConfig({ ...config, reg_no: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">GSTIN / Tax ID</label>
            <input className="input" value={config.gstin} onChange={e => setConfig({ ...config, gstin: e.target.value })} />
          </div>

          <div style={{ gridColumn: '1/-1' }} className="form-group">
            <label className="form-label">Address</label>
            <input className="input" value={config.address} onChange={e => setConfig({ ...config, address: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Primary Phone</label>
            <input className="input" value={config.phone} onChange={e => setConfig({ ...config, phone: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">24x7 Emergency Hotline</label>
            <input className="input" value={config.emergency_contact} onChange={e => setConfig({ ...config, emergency_contact: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Default OPD Consultation Fee ₹</label>
            <input className="input" type="number" value={config.opd_default_fee} onChange={e => setConfig({ ...config, opd_default_fee: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Default Follow-up Fee ₹</label>
            <input className="input" type="number" value={config.followup_default_fee} onChange={e => setConfig({ ...config, followup_default_fee: e.target.value })} required />
          </div>

          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px' }}>Save Hospital Config</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Security & Audit Logs Tab ──────────────────────────────────────────
function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/audit-logs');
        setLogs(res.data || []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>HIPAA Audit Trail</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>Active</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Aspect-based auto logging</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>DPDP Data Guard</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>Compliant</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sec 12 Erasure Enforced</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Recorded Logs</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{logs.length} Logged</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Audit trail items</div>
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Security & Administrative Audit Log</h3>
        </div>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No audit logs recorded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Event Action</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Executed By</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>{l.action || l.event || 'System Action'}</td>
                    <td style={{ padding: '14px 20px' }}>{l.userName || l.user_id || l.user || 'System'}</td>
                    <td style={{ padding: '14px 20px' }}>{l.userRole || l.role || 'User'}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: 12 }}>{l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span className="badge badge-success" style={{ fontSize: 10.5, padding: '3px 10px' }}>{l.status || 'Recorded'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin Portal Component ─────────────────────────────────────────────
export default function AdminPortal() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab]   = useState<'staff' | 'erasure' | 'config' | 'audit'>('staff');
  const [staff, setStaff]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]         = useState('');

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get('/users');
      const usersList = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      setStaff(usersList);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Cannot connect to server. Start the backend first.');
    } finally { setLoading(false); }
  }

  const filtered = (staff || []).filter(s => {
    const matchRole   = roleFilter === 'all' || s.role === roleFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const isActive = s.is_active !== undefined ? (s.is_active === 1 || s.is_active === true) : (s.isActive !== undefined ? (s.isActive === 1 || s.isActive === true) : true);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && isActive) || (statusFilter === 'inactive' && !isActive);
    return matchRole && matchSearch && matchStatus;
  });

  const counts: Record<string, number> = {
    all: (staff || []).length,
    doctor: (staff || []).filter(s => s.role === 'doctor').length,
    receptionist: (staff || []).filter(s => s.role === 'receptionist').length,
    nurse: (staff || []).filter(s => s.role === 'nurse').length,
    lab_technician: (staff || []).filter(s => s.role === 'lab_technician').length,
    pharmacist: (staff || []).filter(s => s.role === 'pharmacist').length,
    billing: (staff || []).filter(s => s.role === 'billing').length,
    admin: (staff || []).filter(s => s.role === 'admin').length,
  };

  return (
    <div style={{ width:'100%', flex:1, background:'#f8fafc', minHeight: '100vh', display:'flex', flexDirection:'column' }}>
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onDone={u => { setStaff(s => [u, ...s]); setShowAdd(false); }} />}
      {editing  && <EditModal staff={editing} onClose={() => setEditing(null)} onDone={updated => {
        if (updated._deleted) {
          setStaff(s => s.filter(x => x.id !== updated.id));
        } else {
          setStaff(s => s.map(x => x.id === updated.id ? { ...x, ...updated } : x));
        }
        setEditing(null);
      }} />}

      {/* Top Console Header */}
      <header style={{ 
        background: '#fff', 
        borderBottom: '1px solid var(--border)', 
        padding: '0 32px', 
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexShrink: 0, 
        boxShadow: 'var(--shadow-sm)' 
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ 
            width: 38, 
            height: 38, 
            borderRadius: 10, 
            background: 'var(--primary-light)', 
            color: 'var(--primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 800, 
            fontSize: 16 
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><path d="M9 10h6"/><path d="M12 7v6"/><path d="M9 18h6"/></svg>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', letterSpacing: '-0.3px', lineHeight:1 }}>Medbuilds</div>
            <div style={{ fontSize:10, fontWeight: 700, color:'var(--primary)', letterSpacing: '0.8px', marginTop: 3 }}>ADMINISTRATION CONSOLE</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#059669',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: '4px 10px',
            borderRadius: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            System Online • DPDP Compliant
          </span>

          <div style={{ height: 24, width: 1, background: 'var(--border)' }} />

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:700, fontSize:13, color: 'var(--text)' }}>{user?.name || 'Master Admin'}</div>
              <div style={{ fontSize:10, color:'#dc2626', fontWeight:700, textTransform: 'uppercase' }}>Administrator</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout} style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign out</button>
          </div>
        </div>
      </header>

      {/* Main Executive Body Container */}
      <div style={{ maxWidth: 1320, margin:'0 auto', padding:'24px 28px', width:'100%', flex:1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Navigation Tabs Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid var(--border)', 
          paddingBottom: 0 
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              type="button"
              onClick={() => setActiveTab('staff')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: 13.5,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'staff' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Staff Directory & Access
              <span style={{ 
                fontSize: 11, 
                padding: '2px 8px', 
                borderRadius: 20, 
                background: activeTab === 'staff' ? 'var(--primary-light)' : '#f1f5f9', 
                color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)', 
                fontWeight: 700 
              }}>
                {staff.length}
              </span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('erasure')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: 13.5,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'erasure' ? '2.5px solid var(--danger)' : '2.5px solid transparent',
                color: activeTab === 'erasure' ? 'var(--danger)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Patient Erasure (DPDP)
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('config')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: 13.5,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'config' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                color: activeTab === 'config' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Hospital Profile
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('audit')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: 13.5,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'audit' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Audit & Security Logs
            </button>
          </div>

          {activeTab === 'staff' && (
            <button 
              type="button" 
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, boxShadow: 'var(--shadow-sm)' }}
              onClick={() => setShowAdd(true)}
            >
              + Register New Staff Member
            </button>
          )}
        </div>

        {/* Tab Content 1: Staff Directory */}
        {activeTab === 'staff' && (
          <>
            {/* Role Filter Counter Grid */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: 10 }}>
                Role Directory & Staff Distribution
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                gap: 12 
              }}>
                {([
                  ['all','Total Staff','#6b7280'],
                  ['doctor','Doctors','#0d9488'],
                  ['receptionist','Receptionists','#d97706'],
                  ['nurse','Nurses','#7c3aed'],
                  ['lab_technician','Lab Techs','#0369a1'],
                  ['pharmacist','Pharmacy','#16a34a'],
                  ['admin','Admins','#2563eb']
                ] as const).map(([r, label, color]) => {
                  const selected = roleFilter === r;
                  return (
                    <div 
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      style={{
                        background: selected ? '#fff' : 'var(--surface)',
                        border: `2px solid ${selected ? color : 'var(--border)'}`,
                        borderRadius: 'var(--radius-lg)', 
                        padding: '14px 16px', 
                        cursor: 'pointer',
                        transition: 'all 0.15s ease', 
                        boxShadow: selected ? 'var(--shadow)' : 'var(--shadow-xs)',
                        transform: selected ? 'translateY(-2px)' : 'none'
                      }}
                    >
                      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{counts[r]}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--text)' : 'var(--text-muted)', marginTop: 6 }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Search Toolbar Card */}
            <div className="card" style={{ padding: '14px 18px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 300 }}>
                  <div className="search-bar" style={{ flex: 1, margin: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input 
                      placeholder="Search staff by Name or Email address…" 
                      value={search} 
                      onChange={e => setSearch(e.target.value)} 
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>✕</button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                    <select 
                      className="input" 
                      style={{ padding: '6px 12px', fontSize: 12, minWidth: 110 }}
                      value={statusFilter} 
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>

                  {roleFilter !== 'all' && (
                    <button 
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: 'var(--primary)' }}
                      onClick={() => setRoleFilter('all')}
                    >
                      Clear Role Filter ({roleFilter})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Directory Table Card */}
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', overflow: 'hidden', padding: 0 }}>
              {error && <div className="alert alert-warning" style={{ margin: 16 }}>⚠ {error}</div>}
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/> Loading staff directory...</div>
              ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: '50px 24px' }}>
                  <span className="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 10 }}>{search ? 'No matching staff members' : 'No staff registered'}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{search ? 'Try adjusting your search criteria.' : 'Click below to register the hospital\'s first doctor or receptionist.'}</p>
                  {!search && (
                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>+ Register Staff</button>
                  )}
                </div>
              ) : (
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Staff Member</th>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role & Access</th>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Specialization / Dept</th>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact Phone</th>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const active = s.is_active !== undefined ? (s.is_active === 1 || s.is_active === true) : (s.isActive !== undefined ? (s.isActive === 1 || s.isActive === true) : true);
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s ease' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
                                <div style={{
                                  width: 36, 
                                  height: 36, 
                                  borderRadius: '50%', 
                                  background: ROLE_BG[s.role] || 'var(--primary-light)',
                                  color: ROLE_COLOR[s.role] || 'var(--primary)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  fontWeight: 700, 
                                  fontSize: 14, 
                                  overflow: 'hidden',
                                  flexShrink: 0
                                }}>
                                  {s.photo_url ? (
                                    <img src={s.photo_url} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  ) : (
                                    s.name ? s.name[0].toUpperCase() : 'S'
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{s.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.email}</div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                <span style={{
                                  fontSize: 11, 
                                  fontWeight: 700, 
                                  padding: '3px 10px', 
                                  borderRadius: 20,
                                  background: ROLE_BG[s.role] || '#f1f5f9',
                                  color: ROLE_COLOR[s.role] || '#64748b',
                                  border: `1px solid ${ROLE_COLOR[s.role]}44`,
                                  display: 'inline-block',
                                }}>
                                  {ROLE_LABEL[s.role] || s.role}
                                </span>

                                {s.role === 'receptionist' && s.staff_type === 'pharmacy' && (
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                    Pharmacy Counter
                                  </span>
                                )}

                                {s.role === 'doctor' && (s.consultation_fee > 0 || s.followup_fee > 0) && (
                                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                                    OPD: ₹{s.consultation_fee || 0} · FU: ₹{s.followup_fee || 0}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)' }}>
                              {s.specialization || (s.role === 'doctor' ? 'General OPD' : 'Hospital Operations')}
                              {s.license_number && (
                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Lic: {s.license_number}</div>
                              )}
                            </td>

                            <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)' }}>
                              {s.phone || '—'}
                            </td>

                            <td style={{ padding: '14px 20px' }}>
                              <span style={{
                                fontSize: 11, 
                                fontWeight: 700, 
                                padding: '3px 10px', 
                                borderRadius: 20,
                                background: active ? '#ecfdf5' : '#fef2f2',
                                color: active ? '#047857' : '#dc2626',
                                border: `1px solid ${active ? '#a7f3d0' : '#fecaca'}`,
                              }}>
                                {active ? 'Active' : 'Deactivated'}
                              </span>
                            </td>

                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px 12px', fontSize: 12, minHeight: 28, fontWeight: 600 }} 
                                onClick={() => setEditing(s)}
                              >
                                Edit / Reset
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab Content 2: Patient Erasure */}
        {activeTab === 'erasure' && <PatientErasureTab />}

        {/* Tab Content 3: Hospital Profile & Master Settings */}
        {activeTab === 'config' && <HospitalConfigTab />}

        {/* Tab Content 4: Audit & Security Logs */}
        {activeTab === 'audit' && <AuditLogsTab />}

      </div>
    </div>
  );
}
