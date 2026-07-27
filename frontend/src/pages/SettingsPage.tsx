// client/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { db, markPending } from '../db/localDB';
import { apiClient } from '../api/client';
import { printPrescriptionSlip } from '../utils/printTemplates';
import AuditLogViewer from '../components/AuditLogViewer';

const ROLES = ['doctor','nurse','receptionist','admin'] as const;
const SPECIALIZATIONS = [
  'General Medicine','General Surgery','Pediatrics','Obstetrics & Gynaecology',
  'Cardiology','Cardiothoracic Surgery','Neurology','Neurosurgery',
  'Orthopedics','Ophthalmology','ENT','Dermatology','Psychiatry',
  'Pulmonology','Nephrology','Urology','Gastroenterology','Oncology',
  'Endocrinology','Rheumatology','Anesthesiology','Radiology',
  'Pathology','Dentistry','Physiotherapy','Emergency Medicine','Other',
];

const ROLE_COLORS: Record<string,string> = {
  admin:'badge-danger', doctor:'badge-info', nurse:'badge-success', receptionist:'badge-warning',
};
const ROLE_LABELS: Record<string,string> = {
  admin:'Admin', doctor:'Doctor', nurse:'Nurse', receptionist:'Receptionist',
};

// ── Add Staff Modal ───────────────────────────────────────────────────
function AddUserModal({ onClose, onDone }: { onClose:()=>void; onDone:(u:any)=>void }) {
  const [form, setForm] = useState({
    name:'', email:'', password:'', role:'doctor' as typeof ROLES[number],
    specialization:'', phone:'', license_number:'',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k:string, v:string) => setForm(f => ({...f,[k]:v}));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError('Name, email and password are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true); setError('');
    try {
      const res = await apiClient.post('/users', form);
      onDone(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create user. Is the server running?');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Staff Member</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="input" placeholder="Dr. Ramesh Kumar" value={form.name} onChange={e=>set('name',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="input" type="email" placeholder="dr.kumar@hospital.local" value={form.email} onChange={e=>set('email',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={e=>set('password',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e=>set('phone',e.target.value)} />
              </div>

              {form.role === 'doctor' && <>
                <div style={{gridColumn:'1/-1'}} className="form-group">
                  <label className="form-label">Specialization</label>
                  <select className="input" value={form.specialization} onChange={e=>set('specialization',e.target.value)}>
                    <option value="">— Select specialization —</option>
                    {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:'1/-1'}} className="form-group">
                  <label className="form-label">Medical Council License No.</label>
                  <input className="input" placeholder="e.g. MH-12345" value={form.license_number} onChange={e=>set('license_number',e.target.value)} />
                </div>
              </>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Adding…</> : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Staff Modal ──────────────────────────────────────────────────
function EditUserModal({ user, onClose, onDone }: { user:any; onClose:()=>void; onDone:(u:any)=>void }) {
  const [form, setForm] = useState({
    name: user.name, phone: user.phone||'', specialization: user.specialization||'', license_number: user.license_number||'', is_active: user.is_active,
  });
  const [newPwd, setNewPwd]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [pwdSaving, setPwdSave] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const set = (k:string, v:any) => setForm(f => ({...f,[k]:v}));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      await apiClient.patch(`/users/${user.id}`, form);
      setSuccess('Saved successfully');
      onDone({ ...user, ...form });
    } catch (err:any) { setError(err?.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function resetPwd() {
    if (!newPwd || newPwd.length < 6) { setError('Password must be at least 6 characters'); return; }
    setPwdSave(true); setError(''); setSuccess('');
    try {
      await apiClient.post(`/users/${user.id}/reset-password`, { password: newPwd });
      setSuccess('Password reset successfully'); setNewPwd('');
    } catch (err:any) { setError(err?.response?.data?.error || 'Reset failed'); }
    finally { setPwdSave(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{user.name}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{user.email} · <span className={`badge ${ROLE_COLORS[user.role]}`}>{ROLE_LABELS[user.role]}</span></div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {error   && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" value={form.name} onChange={e=>set('name',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" value={form.phone} onChange={e=>set('phone',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="input" value={form.is_active} onChange={e=>set('is_active', Number(e.target.value))}>
                  <option value={1}>Active</option>
                  <option value={0}>Deactivated</option>
                </select>
              </div>
              {user.role === 'doctor' && <>
                <div style={{gridColumn:'1/-1'}} className="form-group">
                  <label className="form-label">Specialization</label>
                  <select className="input" value={form.specialization} onChange={e=>set('specialization',e.target.value)}>
                    <option value="">— None —</option>
                    {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:'1/-1'}} className="form-group">
                  <label className="form-label">License Number</label>
                  <input className="input" value={form.license_number} onChange={e=>set('license_number',e.target.value)} />
                </div>
              </>}
            </div>

            {/* Password reset section */}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:4}}>
              <div className="form-label" style={{marginBottom:8}}>Reset Password</div>
              <div style={{display:'flex',gap:8}}>
                <input className="input" type="password" placeholder="New password (min 6 chars)" value={newPwd} onChange={e=>setNewPwd(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={resetPwd} disabled={pwdSaving}>
                  {pwdSaving ? <div className="spinner spinner-sm"/> : 'Reset'}
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
                  if (!confirm(`Permanently remove ${user.name}?`)) return;
                  setSaving(true);
                  try {
                    await apiClient.delete(`/users/${user.id}`);
                    onDone({ ...user, _deleted: true });
                  } catch (err: any) {
                    setError(err?.response?.data?.error || 'Delete failed');
                    setSaving(false);
                  }
                }}>
                🗑 Delete
              </button>
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

// ── Add Medicine Modal ────────────────────────────────────────────────
function AddMedicineModal({ onClose, onDone }: { onClose:()=>void; onDone:(m:any)=>void }) {
  const [form, setForm] = useState({
    name: '', generics: '', strengths: '', defaultDose: '', category: 'General'
  });
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Medicine name is required'); return; }
    onDone({
      name: form.name.trim(),
      generics: form.generics.split(',').map(x => x.trim()).filter(Boolean),
      strengths: form.strengths.split('\n').map(x => x.trim()).filter(Boolean),
      defaultDose: form.defaultDose.trim(),
      category: form.category.trim()
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add New Medicine</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:12}}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Medicine Name *</label>
              <input className="input" placeholder="e.g. Paracetamol 500mg" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Names (comma separated)</label>
              <input className="input" placeholder="e.g. Acetaminophen" value={form.generics} onChange={e=>setForm(f=>({...f, generics:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Available Strengths (one per line)</label>
              <textarea className="input" style={{minHeight:60}} placeholder="e.g.&#10;500 mg&#10;650 mg" value={form.strengths} onChange={e=>setForm(f=>({...f, strengths:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Dose Strength</label>
              <input className="input" placeholder="e.g. 500 mg" value={form.defaultDose} onChange={e=>setForm(f=>({...f, defaultDose:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="input" placeholder="e.g. Analgesics" value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Medicine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Medicine Modal ───────────────────────────────────────────────
function EditMedicineModal({ medicine, onClose, onDone, onDelete }: { medicine:any; onClose:()=>void; onDone:(id:string, m:any)=>void; onDelete:(id:string)=>void }) {
  const [form, setForm] = useState({
    name: medicine.name,
    generics: Array.isArray(medicine.generics) ? medicine.generics.join(', ') : '',
    strengths: Array.isArray(medicine.strengths) ? medicine.strengths.join('\n') : '',
    defaultDose: medicine.default_dose || '',
    category: medicine.category || '',
    is_active: medicine.is_active ?? 1
  });
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Medicine name is required'); return; }
    onDone(medicine.id, {
      name: form.name.trim(),
      generics: form.generics.split(',').map((x: string) => x.trim()).filter(Boolean),
      strengths: form.strengths.split('\n').map((x: string) => x.trim()).filter(Boolean),
      defaultDose: form.defaultDose.trim(),
      category: form.category.trim(),
      is_active: Number(form.is_active)
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Medicine</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:12}}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Medicine Name *</label>
              <input className="input" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Names (comma separated)</label>
              <input className="input" value={form.generics} onChange={e=>setForm(f=>({...f, generics:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Available Strengths (one per line)</label>
              <textarea className="input" style={{minHeight:60}} value={form.strengths} onChange={e=>setForm(f=>({...f, strengths:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Dose Strength</label>
              <input className="input" value={form.defaultDose} onChange={e=>setForm(f=>({...f, defaultDose:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="input" value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="input" value={form.is_active} onChange={e=>setForm(f=>({...f, is_active:Number(e.target.value)}))}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <div style={{ marginRight:'auto' }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }} onClick={() => { if(confirm('Delete this medicine?')) onDelete(medicine.id); }}>
                🗑 Delete
              </button>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Tab state
  const [activeTab, setActiveTab] = useState<'users'|'system'|'medicines'|'health'|'audit'>(isAdmin ? 'users' : 'system');

  // System Monitor tab state
  const [healthData, setHealthData] = useState<any>(null);
  const [healthError, setHealthError] = useState('');
  const [selectedError, setSelectedError] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'health') {
      fetchHealth();
      const interval = setInterval(fetchHealth, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  async function fetchHealth() {
    try {
      const res = await apiClient.get('/system-health/health');
      setHealthData(res.data);
      setHealthError('');
    } catch (err: any) {
      setHealthError(err.response?.data?.error || 'Failed to fetch health metrics');
    }
  }

  async function triggerMockError() {
    try {
      await apiClient.get('/system-health/trigger-error');
    } catch (err) {
      console.warn('Mock error response received (expected):', err);
      fetchHealth();
    }
  }

  function formatUptime(seconds: number) {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins > 0 ? `${mins}m ` : ''}${secs}s`;
  }

  // Medicines manager state
  const [meds, setMeds] = useState<any[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [medPage, setMedPage] = useState(0);
  const [showAddMed, setShowAddMed] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);
  const medsPerPage = 12;

  // Load medicines from IndexedDB
  useEffect(() => {
    if (activeTab === 'medicines') {
      loadMedicines();
    }
  }, [activeTab]);

  async function loadMedicines() {
    const all = await db.medicines.toArray();
    all.sort((a, b) => a.name.localeCompare(b.name));
    setMeds(all);
  }

  async function handleAddMedicine(medData: any) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = {
      id,
      hospital_id: user?.hospitalId || 'hsp-001',
      name: medData.name,
      generics: medData.generics,
      strengths: medData.strengths,
      default_dose: medData.defaultDose || null,
      category: medData.category || null,
      is_active: 1,
      created_at: now,
      updated_at: now
    };
    await markPending(db.medicines, 'create', payload);
    await db.medicines.put(payload);
    await loadMedicines();
    setShowAddMed(false);
  }

  async function handleUpdateMedicine(id: string, medData: any) {
    const existing = meds.find(m => m.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const payload = {
      ...existing,
      name: medData.name,
      generics: medData.generics,
      strengths: medData.strengths,
      default_dose: medData.defaultDose || null,
      category: medData.category || null,
      is_active: medData.is_active,
      updated_at: now
    };
    await markPending(db.medicines, 'update', payload);
    await db.medicines.put(payload);
    await loadMedicines();
    setEditMed(null);
  }

  async function handleDeleteMedicine(id: string) {
    const existing = meds.find(m => m.id === id);
    if (!existing) return;
    await markPending(db.medicines, 'delete', existing);
    await db.medicines.delete(id);
    await loadMedicines();
    setEditMed(null);
  }

  const filteredMeds = meds.filter(m => {
    if (!medSearch) return true;
    const q = medSearch.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      (Array.isArray(m.generics) && m.generics.some((g: string) => g.toLowerCase().includes(q))) ||
      m.category?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filteredMeds.length / medsPerPage);
  const paginatedMeds = filteredMeds.slice(medPage * medsPerPage, (medPage + 1) * medsPerPage);

  // Practitioner profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: (user as any)?.phone || '',
    specialization: user?.specialization || '',
    licenseNumber: user?.licenseNumber || '',
    qualification: user?.qualification || '',
    registrationNumber: user?.registrationNumber || '',
    consultationFee: user?.consultationFee || 0,
    followupFee: user?.followupFee || 0,
    letterhead: user?.letterhead || '',
    photoUrl: user?.photoUrl || '',
    showDiagnosisOnPrint: user?.showDiagnosisOnPrint !== undefined ? !!user.showDiagnosisOnPrint : true,
    showInvestigationsOnPrint: user?.showInvestigationsOnPrint !== undefined ? !!user.showInvestigationsOnPrint : true,
    showVitalsOnPrint: user?.showVitalsOnPrint !== undefined ? !!user.showVitalsOnPrint : true,
    printMarginTop: user?.printMarginTop !== undefined ? user.printMarginTop : 35,
    printMarginBottom: user?.printMarginBottom !== undefined ? user.printMarginBottom : 15,
    printMarginLeftRight: user?.printMarginLeftRight !== undefined ? user.printMarginLeftRight : 18,
    printFontSize: user?.printFontSize !== undefined ? user.printFontSize : 11,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [letterheadScan, setLetterheadScan] = useState<string>('');
  const [fullBleed, setFullBleed] = useState(localStorage.getItem('print_letterhead_full_bleed_' + user?.id) === 'true');

  useEffect(() => {
    if (user?.id) {
      setFullBleed(localStorage.getItem('print_letterhead_full_bleed_' + user.id) === 'true');
    }
  }, [user?.id]);
  const [isDraggingLine, setIsDraggingLine] = useState(false);

  // Load stored letterhead scan reference from local storage on mount/user change
  useEffect(() => {
    if (user?.id) {
      const storedScan = localStorage.getItem(`letterhead_scan_${user.id}`);
      if (storedScan) {
        setLetterheadScan(storedScan);
      }
    }
  }, [user?.id]);

  const handleUploadLetterheadScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setProfileError('Letterhead scan/photo must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLetterheadScan(base64);
      if (user?.id) {
        localStorage.setItem(`letterhead_scan_${user.id}`, base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLetterheadScan = () => {
    setLetterheadScan('');
    if (user?.id) {
      localStorage.removeItem(`letterhead_scan_${user.id}`);
    }
  };

  const handleDoctorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Practitioner photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm(f => ({ ...f, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Drag-and-drop pointer handlers for the calibration line
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingLine(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingLine) return;
    const container = document.getElementById('letterhead-calibrator-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(453, e.clientY - rect.top));
    // Convert 453px to 297mm (A4 page height)
    const marginMm = Math.round(relativeY * (297 / 453));
    // Bound top margin between 15mm and 120mm to prevent covering too much
    const boundedMm = Math.max(15, Math.min(120, marginMm));
    setProfileForm(f => ({ ...f, printMarginTop: boundedMm }));
  };

  const stopDrag = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDraggingLine(false);
  };

  // Sync profileForm state if user loads/updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: (user as any).phone || '',
        specialization: user.specialization || '',
        licenseNumber: user.licenseNumber || '',
        qualification: user.qualification || '',
        registrationNumber: user.registrationNumber || '',
        consultationFee: user.consultationFee || 0,
        followupFee: user.followupFee || 0,
        letterhead: user.letterhead || '',
        photoUrl: user.photoUrl || '',
        showDiagnosisOnPrint: user.showDiagnosisOnPrint !== undefined ? !!user.showDiagnosisOnPrint : true,
        showInvestigationsOnPrint: user.showInvestigationsOnPrint !== undefined ? !!user.showInvestigationsOnPrint : true,
        showVitalsOnPrint: user.showVitalsOnPrint !== undefined ? !!user.showVitalsOnPrint : true,
        printMarginTop: user.printMarginTop !== undefined ? user.printMarginTop : 35,
        printMarginBottom: user.printMarginBottom !== undefined ? user.printMarginBottom : 15,
        printMarginLeftRight: user.printMarginLeftRight !== undefined ? user.printMarginLeftRight : 18,
        printFontSize: user.printFontSize !== undefined ? user.printFontSize : 11,
      });
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      await apiClient.patch('/users/me/profile', {
        name: profileForm.name,
        phone: profileForm.phone,
        specialization: profileForm.specialization,
        license_number: profileForm.licenseNumber,
        qualification: profileForm.qualification,
        registration_number: profileForm.registrationNumber,
        consultation_fee: parseFloat(profileForm.consultationFee as any) || 0,
        followup_fee: parseFloat(profileForm.followupFee as any) || 0,
        letterhead: profileForm.letterhead,
        photo_url: profileForm.photoUrl,
        show_diagnosis_on_print: !!profileForm.showDiagnosisOnPrint,
        show_investigations_on_print: !!profileForm.showInvestigationsOnPrint,
        show_vitals_on_print: !!profileForm.showVitalsOnPrint,
        print_margin_top: !isNaN(Number(profileForm.printMarginTop)) ? Number(profileForm.printMarginTop) : 35,
        print_margin_bottom: !isNaN(Number(profileForm.printMarginBottom)) ? Number(profileForm.printMarginBottom) : 15,
        print_margin_left_right: !isNaN(Number(profileForm.printMarginLeftRight)) ? Number(profileForm.printMarginLeftRight) : 18,
        print_font_size: !isNaN(Number(profileForm.printFontSize)) ? Number(profileForm.printFontSize) : 11,
      });
      setProfileSuccess('Practitioner profile updated successfully.');
      // Refresh the session to update user in authStore
      await useAuthStore.getState().restoreSession();
    } catch (err: any) {
      setProfileError(err?.response?.data?.error || err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handlePrintCalibrationSheet() {
    printPrescriptionSlip({
      doctor: {
        name: user?.name ?? 'Practitioner',
        role: user?.role ?? 'Doctor',
        letterhead: profileForm.letterhead || undefined,
        qualification: profileForm.qualification || undefined,
        regNo: profileForm.registrationNumber || undefined,
      },
      patient: {
        name: 'Calibration Test Page',
        uhid: 'CAL-00000',
        age: 35,
        sex: 'M',
        allergies: []
      },
      medicines: [],
      slipToken: 'CALIBRATION',
      printMarginTop: Number(profileForm.printMarginTop),
      printMarginBottom: Number(profileForm.printMarginBottom),
      printMarginLeftRight: Number(profileForm.printMarginLeftRight),
      printFontSize: Number(profileForm.printFontSize),
      isCalibrationTest: true
    });
  }

  // User management state
  const [staff, setStaff]       = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError]     = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (isAdmin) loadStaff();
  }, [isAdmin]);

  async function loadStaff() {
    setLoadingStaff(true); setStaffError('');
    try {
      const res = await apiClient.get('/users');
      setStaff(res.data.users);
    } catch (e:any) {
      setStaffError(e?.response?.data?.error || 'Cannot load staff — is the server running?');
    } finally { setLoadingStaff(false); }
  }

  const filteredStaff = roleFilter === 'all' ? staff : staff.filter(s => s.role === roleFilter);

  const staffByRole = {
    all: staff.length,
    doctor: staff.filter(s=>s.role==='doctor').length,
    nurse: staff.filter(s=>s.role==='nurse').length,
    receptionist: staff.filter(s=>s.role==='receptionist').length,
    admin: staff.filter(s=>s.role==='admin').length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Manage staff, system & preferences</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{width:'100%'}}>
        {isAdmin && (
          <button className={`tab${activeTab==='users'?' active':''}`} onClick={()=>setActiveTab('users')}>
            Staff Management
          </button>
        )}
        {(isAdmin || user?.role === 'doctor') && (
          <button className={`tab${activeTab==='medicines'?' active':''}`} onClick={()=>setActiveTab('medicines')}>
            Medicines Directory
          </button>
        )}
        <button className={`tab${activeTab==='system'?' active':''}`} onClick={()=>setActiveTab('system')}>
          System
        </button>
        <button className={`tab${activeTab==='health'?' active':''}`} onClick={()=>setActiveTab('health')}>
          🛡️ API Health Monitor
        </button>
        {(isAdmin || user?.role === 'doctor') && (
          <button className={`tab${activeTab==='audit'?' active':''}`} onClick={()=>setActiveTab('audit')}>
            📜 HIPAA / DPDP Audit Logs
          </button>
        )}
      </div>

      {/* ── Audit Logs tab ── */}
      {activeTab === 'audit' && (
        <AuditLogViewer />
      )}

      {/* ── Staff Management tab ── */}
      {activeTab === 'users' && isAdmin && (
        <>
          {showAdd && <AddUserModal onClose={()=>setShowAdd(false)} onDone={u=>{ setStaff(s=>[u,...s]); setShowAdd(false); }} />}
          {editUser && <EditUserModal user={editUser} onClose={()=>setEditUser(null)} onDone={updated=>{
            if (updated._deleted) {
              setStaff(s => s.filter(x => x.id !== updated.id));
            } else {
              setStaff(s => s.map(x=>x.id===updated.id?{...x,...updated}:x));
            }
            setEditUser(null);
          }} />}

          {/* Stats row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:10}}>
            {(['all','doctor','nurse','receptionist','admin'] as const).map(r => (
              <div key={r}
                onClick={()=>setRoleFilter(r)}
                style={{
                  background: roleFilter===r ? 'var(--primary-light)' : 'var(--surface)',
                  border: `1px solid ${roleFilter===r ? 'var(--primary-mid)' : 'var(--border)'}`,
                  borderRadius:'var(--radius-lg)', padding:'12px 14px',
                  cursor:'pointer', transition:'all 0.12s',
                }}>
                <div style={{fontSize:22,fontWeight:700,color:roleFilter===r?'var(--primary)':'var(--text)'}}>{staffByRole[r]}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'capitalize',marginTop:2}}>{r==='all'?'Total Staff':ROLE_LABELS[r]+'s'}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                {roleFilter==='all' ? 'All Staff' : `${ROLE_LABELS[roleFilter]}s`}
                <span style={{marginLeft:8,fontSize:11,color:'var(--text-muted)',fontWeight:400}}>({filteredStaff.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add Staff</button>
            </div>

            {staffError && <div className="alert alert-warning" style={{margin:16}}>{staffError}</div>}

            {loadingStaff
              ? <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
              : filteredStaff.length === 0
                ? <div className="empty-state"><span className="empty-icon">👥</span><h3>No staff found</h3><p>Add your first staff member.</p></div>
                : <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Specialization</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map(s => (
                          <tr key={s.id}>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <div style={{
                                  width:32,height:32,borderRadius:'50%',
                                  background:`var(--primary-grad)`,color:'#fff',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:12,fontWeight:700,flexShrink:0,
                                  opacity: s.is_active ? 1 : 0.4,
                                }}>
                                  {s.name?.split(' ').map((w:string)=>w[0]).join('').slice(0,2)}
                                </div>
                                <div>
                                  <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={`badge ${ROLE_COLORS[s.role]}`}>{ROLE_LABELS[s.role]}</span></td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.specialization || '—'}</td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.phone || '—'}</td>
                            <td>
                              <span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>
                                {s.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setEditUser(s)}>Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            }
          </div>
        </>
      )}

      {/* ── System tab ── */}
      {activeTab === 'system' && (
        <>
          {/* Profile */}
          <div className="card">
            <div className="card-header"><div className="card-title">My Profile</div></div>
            <div className="card-body">
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <div style={{
                  width:52,
                  height:52,
                  borderRadius:14,
                  background:'var(--primary-grad)',
                  color:'#fff',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:20,
                  fontWeight:700,
                  overflow: 'hidden'
                }}>
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2)
                  )}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:700}}>{user?.name}</div>
                  <div style={{color:'var(--text-muted)',fontSize:13}}>{user?.email}</div>
                  <div style={{marginTop:5}}><span className={`badge ${ROLE_COLORS[user?.role||'doctor']}`} style={{textTransform:'capitalize'}}>{ROLE_LABELS[user?.role||'doctor']}</span></div>
                </div>
              </div>
            </div>
          </div>

          {user && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">{user?.role === 'doctor' ? 'Practitioner Settings' : 'Profile Settings'}</div>
              </div>
              <form onSubmit={handleSaveProfile} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}
                {profileError && <div className="alert alert-danger">{profileError}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Doctor Profile Photo Uploader */}
                  <div style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                    marginBottom: 8
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      flexShrink: 0,
                      border: '1px solid #bfdbfe',
                      overflow: 'hidden'
                    }}>
                      {profileForm.photoUrl ? (
                        <img src={profileForm.photoUrl} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        profileForm.name ? profileForm.name[0].toUpperCase() : (user?.role === 'doctor' ? 'D' : 'U')
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{user?.role === 'doctor' ? 'Practitioner Profile Photo' : 'Profile Photo'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <label className="btn btn-ghost btn-sm" style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          fontSize: 11,
                          minHeight: 'auto',
                          border: '1px solid var(--border)',
                          background: '#fff',
                          margin: 0
                        }}>
                          📷 Select Photo
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleDoctorPhotoChange}
                          />
                        </label>
                        {profileForm.photoUrl && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{
                              color: 'var(--danger)',
                              padding: '4px 10px',
                              fontSize: 11,
                              minHeight: 'auto',
                              border: '1px solid var(--border-light)'
                            }}
                            onClick={() => setProfileForm(f => ({ ...f, photoUrl: '' }))}
                          >
                            🗑 Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      className="input"
                      value={profileForm.name}
                      onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="input"
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  {user?.role === 'doctor' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Specialization</label>
                    <select
                      className="input"
                      value={profileForm.specialization}
                      onChange={e => setProfileForm(f => ({ ...f, specialization: e.target.value }))}
                    >
                      <option value="">— Select specialization —</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medical Council License No.</label>
                    <input
                      className="input"
                      placeholder="e.g. MH-12345"
                      value={profileForm.licenseNumber}
                      onChange={e => setProfileForm(f => ({ ...f, licenseNumber: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Qualification</label>
                      <input
                        className="input"
                        placeholder="e.g. MBBS, MD (Medicine)"
                        value={profileForm.qualification}
                        onChange={e => setProfileForm(f => ({ ...f, qualification: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Medical Council Registration No.</label>
                      <input
                        className="input"
                        placeholder="e.g. MCI-12345"
                        value={profileForm.registrationNumber}
                        onChange={e => setProfileForm(f => ({ ...f, registrationNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consultation Fee (₹) *</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={profileForm.consultationFee}
                      onChange={e => setProfileForm(f => ({ ...f, consultationFee: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up Fee (₹) *</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={profileForm.followupFee}
                      onChange={e => setProfileForm(f => ({ ...f, followupFee: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Custom Letterhead</label>
                    
                    {profileForm.letterhead && profileForm.letterhead.startsWith('data:image/') ? (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Current Letterhead Banner Image:</div>
                        <div style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#f8fafc' }}>
                          <img src={profileForm.letterhead} style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} alt="Letterhead Preview" />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)', color: 'var(--danger)', padding: '2px 6px', minHeight: 'auto', border: '1px solid #fee2e2' }}
                            onClick={() => setProfileForm(f => ({ ...f, letterhead: '' }))}
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 12 }}>Custom Header Text (Optional)</label>
                          <textarea
                            className="input"
                            style={{ fontFamily: 'monospace', minHeight: 80 }}
                            placeholder="e.g.&#10;DR. PRIYA SHARMA, MD&#10;Cardiologist&#10;Reg No: MH-12345 · Phone: +91 98765 43210"
                            value={profileForm.letterhead}
                            onChange={e => setProfileForm(f => ({ ...f, letterhead: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface-alt)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Or Upload Letterhead Image banner (replaces text)</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1024 * 1024) {
                              setProfileError('Letterhead image must be under 1MB.');
                              e.target.value = '';
                              return;
                            }
                            setProfileError('');
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              setProfileForm(f => ({ ...f, letterhead: base64 }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Recommended size: ~211mm × 32mm (roughly A4 width, and about 3-3.5cm tall, or 800×120px) under 1MB. This banner image will override the default clinic branding header on printed prescriptions.
                      </small>
                    </div>
                  </div>
                </>
              )}
            </div>

                {user?.role === 'doctor' && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Prescription Print Preferences</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Configure what clinical sections should be shown when you print a prescription.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={profileForm.showDiagnosisOnPrint}
                        onChange={e => setProfileForm(f => ({ ...f, showDiagnosisOnPrint: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                      <span>Show Diagnosis on printed prescriptions</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={profileForm.showInvestigationsOnPrint}
                        onChange={e => setProfileForm(f => ({ ...f, showInvestigationsOnPrint: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                      <span>Show Recommended Investigations on printed prescriptions</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={profileForm.showVitalsOnPrint}
                        onChange={e => setProfileForm(f => ({ ...f, showVitalsOnPrint: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                      <span>Show Patient Vitals (BP, Pulse, Weight, Height, BMI) on printed prescriptions</span>
                    </label>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Print Layout Calibration & Margins</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                    Calibrate margins to match your clinic's pre-printed letterhead pads. Upload a scan of your letterhead below to drag-and-set coordinates visually.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start', marginTop: 8 }}>
                    {/* Left Column: Settings and Uploader */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Step 1: Upload photo */}
                      <div className="card-body" style={{ background: '#f8fafc', border: '1px dashed var(--border)', borderRadius: 'var(--radius-xl)', padding: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>1. Upload Reference Letterhead Photo/Scan</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11.5, lineHeight: '15px', marginBottom: 12 }}>
                          Take a straight-on photo of a blank sheet of your clinic letterhead lying flat. Upload it to drag the margins visually.
                        </p>
                        
                        {!letterheadScan ? (
                          <label style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px 10px',
                            background: '#fff',
                            border: '1px dashed var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}>
                            <span style={{ fontSize: 24, marginBottom: 6 }}>📷</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Choose Letterhead Photo</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>JPG, PNG under 3MB</span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleUploadLetterheadScan}
                            />
                          </label>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>📄</span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Reference Scan Active</div>
                                <div style={{ fontSize: 10, color: 'var(--success)' }}>Visual backdrop loaded</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', minHeight: 'auto', color: 'var(--danger)', fontSize: 11 }}
                              onClick={handleClearLetterheadScan}
                            >
                              Reset Photo
                            </button>
                          </div>
                        )}
                        
                        {letterheadScan && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer', userSelect: 'none', marginTop: 12 }}>
                            <input
                              type="checkbox"
                              checked={fullBleed}
                              onChange={e => {
                                setFullBleed(e.target.checked);
                                if (user?.id) {
                                  localStorage.setItem('print_letterhead_full_bleed_' + user.id, String(e.target.checked));
                                }
                              }}
                              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                            />
                            <span><strong>Full-Bleed Letterhead Banner:</strong> Stretch reference scan edge-to-edge of paper</span>
                          </label>
                        )}
                      </div>

                      {/* Step 2: Slider Adjustments */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                            Top Margin / Blank Zone: {profileForm.printMarginTop} mm
                          </label>
                          <input
                            type="range"
                            min="15"
                            max="120"
                            step="1"
                            value={profileForm.printMarginTop}
                            onChange={e => setProfileForm(f => ({ ...f, printMarginTop: Number(e.target.value) }))}
                            style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                          />
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            Reserved blank height for your letterhead logo and header artwork.
                          </small>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                            Left/Right Margins: {profileForm.printMarginLeftRight} mm
                          </label>
                          <input
                            type="range"
                            min="10"
                            max="30"
                            step="1"
                            value={profileForm.printMarginLeftRight}
                            onChange={e => setProfileForm(f => ({ ...f, printMarginLeftRight: Number(e.target.value) }))}
                            style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                          />
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            Safety padding from left/right edges (18mm recommended).
                          </small>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                            Bottom Margin: {profileForm.printMarginBottom} mm
                          </label>
                          <input
                            type="range"
                            min="15"
                            max="45"
                            step="1"
                            value={profileForm.printMarginBottom}
                            onChange={e => setProfileForm(f => ({ ...f, printMarginBottom: Number(e.target.value) }))}
                            style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                          />
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            Safety padding from the bottom edge (15mm minimum).
                          </small>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                            Body Font Size: {profileForm.printFontSize} pt
                          </label>
                          <input
                            type="range"
                            min="8"
                            max="16"
                            step="0.5"
                            value={profileForm.printFontSize}
                            onChange={e => setProfileForm(f => ({ ...f, printFontSize: Number(e.target.value) }))}
                            style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                          />
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            Base font size for printed text.
                          </small>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Interactive Visual A4 page calibrator */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 8 }}>
                        2. Drag Visual Red Line to Clear Your Header:
                      </div>
                      
                      <div
                        id="letterhead-calibrator-container"
                        onPointerMove={handlePointerMove}
                        style={{
                          position: 'relative',
                          width: 320,
                          height: 453, // A4 aspect ratio (320x453 px representing 210x297 mm)
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          boxShadow: 'var(--shadow-md)',
                          overflow: 'hidden',
                          userSelect: 'none'
                        }}
                      >
                        {/* Letterhead Scan Image (Full Bleed or Centered aligned to margins) */}
                        {letterheadScan && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: fullBleed ? 0 : profileForm.printMarginLeftRight * (320 / 210),
                            right: fullBleed ? 0 : profileForm.printMarginLeftRight * (320 / 210),
                            height: profileForm.printMarginTop * (453 / 297),
                            backgroundImage: `url(${letterheadScan})`,
                            backgroundSize: 'contain',
                            backgroundPosition: 'center top',
                            backgroundRepeat: 'no-repeat',
                            opacity: 0.85,
                            transition: 'left 0.05s ease, right 0.05s ease, height 0.05s ease'
                          }} />
                        )}
                        {/* Background Overlay: if no scan uploaded, show a hatched indicator in the header space */}
                        {!letterheadScan && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: profileForm.printMarginTop * (453 / 297),
                            background: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #f8fafc 10px, #f8fafc 20px)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            opacity: 0.85,
                            transition: 'height 0.05s ease'
                          }}>
                            <span style={{ fontSize: 16 }}>🏢</span>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Pre-Printed Header Space</span>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({profileForm.printMarginTop} mm reserved)</span>
                          </div>
                        )}

                        {/* Interactive Drag Line */}
                        <div
                          onPointerDown={startDrag}
                          onPointerUp={stopDrag}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: profileForm.printMarginTop * (453 / 297),
                            height: 6,
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderTop: '2px dashed #ef4444',
                            borderBottom: '2px dashed #ef4444',
                            cursor: 'ns-resize',
                            zIndex: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: 'translateY(-3px)'
                          }}
                        >
                          <div style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            boxShadow: 'var(--shadow-sm)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            transform: 'translateY(-1px)'
                          }}>
                            ↕ {profileForm.printMarginTop} mm (Drag me)
                          </div>
                        </div>

                        {/* Mock Prescription Content (Always pushed down by top margin) */}
                        <div style={{
                          position: 'absolute',
                          left: profileForm.printMarginLeftRight * (320 / 210),
                          right: profileForm.printMarginLeftRight * (320 / 210),
                          bottom: profileForm.printMarginBottom * (453 / 297),
                          top: profileForm.printMarginTop * (453 / 297),
                          paddingTop: 10,
                          fontSize: 9.5,
                          color: '#334155',
                          fontFamily: 'system-ui, sans-serif',
                          lineHeight: '13px',
                          pointerEvents: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          borderLeft: '1px dotted #cbd5e1',
                          borderRight: '1px dotted #cbd5e1',
                          borderBottom: '1px dotted #cbd5e1',
                          background: 'rgba(255,255,255,0.85)',
                          transition: 'top 0.05s ease, left 0.05s ease, right 0.05s ease, bottom 0.05s ease'
                        }}>
                          {/* Rx Header */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: 3, marginBottom: 6, fontWeight: 600, fontSize: 8.5 }}>
                              <span>Jane Doe · F/32</span>
                              <span>UHID: Med-100223</span>
                            </div>

                            {/* Rx Symbol */}
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>Rx</div>

                            {/* Medicine list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>1. Tab. Paracetamol 650mg</strong>
                                <span>1-0-1 · 5 days</span>
                              </div>
                              <div style={{ fontSize: 7.5, color: '#64748b', paddingLeft: 8 }}>Take after meals</div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>2. Cap. Amoxicillin 500mg</strong>
                                <span>1-1-1 · 7 days</span>
                              </div>
                              <div style={{ fontSize: 7.5, color: '#64748b', paddingLeft: 8 }}>Complete the full course</div>
                            </div>
                          </div>

                          {/* Footer details */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 4, fontSize: 8, color: '#475569', fontWeight: 600 }}>
                            <span>Dr. Aarav Mehta (Specialist)</span>
                            <span>Signature: [Verified]</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        Top Header / Blank Zone: {profileForm.printMarginTop} mm
                      </label>
                      <input
                        type="range"
                        min="15"
                        max="120"
                        step="1"
                        value={profileForm.printMarginTop}
                        onChange={e => setProfileForm(f => ({ ...f, printMarginTop: Number(e.target.value) }))}
                        style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Height reserved at the top for pre-printed branding.
                      </small>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        Left/Right Margins: {profileForm.printMarginLeftRight} mm
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="30"
                        step="1"
                        value={profileForm.printMarginLeftRight}
                        onChange={e => setProfileForm(f => ({ ...f, printMarginLeftRight: Number(e.target.value) }))}
                        style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Safety spacing from left and right edges (15mm-20mm recommended).
                      </small>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        Bottom Margin: {profileForm.printMarginBottom} mm
                      </label>
                      <input
                        type="range"
                        min="15"
                        max="45"
                        step="1"
                        value={profileForm.printMarginBottom}
                        onChange={e => setProfileForm(f => ({ ...f, printMarginBottom: Number(e.target.value) }))}
                        style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Safety spacing from the bottom edge (15mm minimum).
                      </small>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        Body Font Size: {profileForm.printFontSize} pt
                      </label>
                      <input
                        type="range"
                        min="8"
                        max="16"
                        step="0.5"
                        value={profileForm.printFontSize}
                        onChange={e => setProfileForm(f => ({ ...f, printFontSize: Number(e.target.value) }))}
                        style={{ width: '100%', height: 6, borderRadius: 3, accentColor: 'var(--primary)' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Base font size for printed text.
                      </small>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handlePrintCalibrationSheet}
                      style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      🖨️ Print Layout Calibration Sheet
                    </button>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                      Prints a dashed boundary box corresponding exactly to these margins to verify alignment.
                    </div>
                  </div>
                </div>
              </>
            )}

                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 10 }} disabled={savingProfile}>
                  {savingProfile ? <><div className="spinner spinner-sm" />Saving Profile…</> : 'Save Profile'}
                </button>
              </form>
            </div>
          )}


        </>
      )}
      {/* ── Medicines Directory tab ── */}
      {activeTab === 'medicines' && (isAdmin || user?.role === 'doctor') && (
        <>
          {showAddMed && <AddMedicineModal onClose={()=>setShowAddMed(false)} onDone={handleAddMedicine} />}
          {editMed && <EditMedicineModal medicine={editMed} onClose={()=>setEditMed(null)} onDone={handleUpdateMedicine} onDelete={handleDeleteMedicine} />}

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="card-title">
                Medicines Master Directory
                <span style={{marginLeft:8,fontSize:11,color:'var(--text-muted)',fontWeight:400}}>({filteredMeds.length} items)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ width: 220, height: 36, padding: '0 12px' }}
                  placeholder="Search medicines..."
                  value={medSearch}
                  onChange={e => { setMedSearch(e.target.value); setMedPage(0); }}
                />
                <button className="btn btn-primary btn-sm" onClick={()=>setShowAddMed(true)}>+ Add Medicine</button>
              </div>
            </div>

            {paginatedMeds.length === 0
              ? <div className="empty-state"><span className="empty-icon">💊</span><h3>No medicines found</h3><p>Try searching for a different keyword or add a new medicine.</p></div>
              : <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Medicine Name</th>
                          <th>Generics</th>
                          <th>Category</th>
                          <th>Strengths</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMeds.map(m => (
                          <tr key={m.id}>
                            <td>
                              <div>
                                <div style={{fontWeight:600,fontSize:13}}>{m.name}</div>
                                {m.default_dose && <small style={{color:'var(--text-muted)'}}>Default Dose: {m.default_dose}</small>}
                              </div>
                            </td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>
                              {Array.isArray(m.generics) && m.generics.length > 0 ? m.generics.join(', ') : '—'}
                            </td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>{m.category || '—'}</td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {Array.isArray(m.strengths) && m.strengths.map((s: string) => (
                                  <span key={s} className="badge badge-neutral" style={{ fontSize: 10 }}>{s}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${m.is_active !== 0 ? 'badge-success' : 'badge-neutral'}`}>
                                {m.is_active !== 0 ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setEditMed(m)}>Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                      <button className="btn btn-secondary btn-sm" disabled={medPage === 0} onClick={() => setMedPage(p => Math.max(0, p - 1))}>
                        Previous
                      </button>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {medPage + 1} of {totalPages}</span>
                      <button className="btn btn-secondary btn-sm" disabled={medPage >= totalPages - 1} onClick={() => setMedPage(p => Math.min(totalPages - 1, p + 1))}>
                        Next
                      </button>
                    </div>
                  )}
                </>
            }
          </div>
        </>
      )}

      {/* ── API Health Monitor tab ── */}
      {activeTab === 'health' && (
        <>
          {/* Status grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Overall Status */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: healthData?.metrics?.status === 'healthy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {healthData?.metrics?.status === 'healthy' ? '🟢' : '🔴'}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>System Status</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: healthData?.metrics?.status === 'healthy' ? '#10b981' : '#ef4444' }}>
                  {healthData?.metrics?.status === 'healthy' ? 'HEALTHY' : 'DEGRADED'}
                </div>
              </div>
            </div>

            {/* Database connection */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: healthData?.metrics?.dbStatus === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                💾
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Database Connection</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: healthData?.metrics?.dbStatus === 'connected' ? '#10b981' : '#ef4444' }}>
                  {healthData?.metrics?.dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                ⏱️
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Server Uptime</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {healthData ? formatUptime(healthData.metrics.uptime) : '—'}
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                📊
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Memory Usage (RSS)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {healthData?.metrics?.memory?.rss || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Diagnostic controls card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">EMR Diagnostic Tools</div>
              <button className="btn btn-danger btn-sm" onClick={triggerMockError}>
                ⚠️ Trigger Test API Error
              </button>
            </div>
            <div className="card-body" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Clicking the test button will trigger a mock server error (`500 Internal Server Error`) to verify that the error handling logging and monitoring is functioning correctly.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
            {/* Live API Traffic Log */}
            <div className="card">
              <div className="card-header"><div className="card-title">Live API Request Logs (Auto-refreshing)</div></div>
              {healthError && <div className="alert alert-danger" style={{ margin: 16 }}>{healthError}</div>}
              {!healthData
                ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                : healthData.logs.length === 0
                  ? <div className="empty-state"><span className="empty-icon">📡</span><h3>No API calls logged yet</h3><p>Make some clicks on the EMR system to generate request logs.</p></div>
                  : <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Method</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Latency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {healthData.logs.map((log: any) => {
                            const methodColors: Record<string, string> = {
                              GET: '#2563eb', POST: '#16a34a', PUT: '#d97706', DELETE: '#dc2626'
                            };
                            const statusColor = log.statusCode >= 500 ? '#ef4444' : log.statusCode >= 400 ? '#f59e0b' : '#10b981';
                            const localTime = new Date(log.timestamp).toLocaleTimeString();
                            return (
                              <tr key={log.id} style={{ cursor: log.error ? 'pointer' : 'default', background: log.error ? 'rgba(239, 68, 68, 0.03)' : undefined }} onClick={() => log.error && setSelectedError(log)}>
                                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{localTime}</td>
                                <td><span style={{ fontWeight: 800, fontSize: 11, color: methodColors[log.method] || '#6b7280' }}>{log.method}</span></td>
                                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.url}</td>
                                <td><span className="badge" style={{ background: statusColor, color: '#fff', fontWeight: 700 }}>{log.statusCode}</span></td>
                                <td style={{ fontSize: 12, fontWeight: 500 }}>{log.responseTimeMs} ms</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
              }
            </div>

            {/* Error logs detail column */}
            <div className="card">
              <div className="card-header"><div className="card-title">Failed Requests Detail</div></div>
              <div className="card-body">
                {selectedError ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Error detail</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedError(null)}>Clear selection</button>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Failed Endpoint</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, wordBreak: 'break-all', marginTop: 4 }}>
                        <span style={{ color: '#ef4444', marginRight: 6 }}>{selectedError.method}</span>
                        {selectedError.url}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{new Date(selectedError.timestamp).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database/Server Error Details</div>
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, color: '#b91c1c',
                        marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                      }}>
                        {selectedError.error}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Response Latency</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{selectedError.responseTimeMs} ms</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                    <p style={{ fontSize: 13 }}>Select any failed request from the logs table to analyze its database error detail.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
