// client/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore, normalizeAuthUser } from '../store/authStore';
import { db, markPending } from '../db/localDB';
import { apiClient } from '../api/client';
import { printPrescriptionSlip } from '../utils/printTemplates';


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
                <input className="input" placeholder="Full Name" value={form.name} onChange={e=>set('name',e.target.value)} required />
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </span>
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
export default function SettingsPage({ onNavigate }: { onNavigate?: (p: string, d?: any) => void } = {}) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Tab state
  const [activeTab, setActiveTab] = useState<'users'|'system'|'medicines'>(isAdmin ? 'users' : 'system');

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

  const getInitialProfile = (u: any) => ({
    name: u?.name || '',
    phone: u?.phone || (u as any)?.phone || '',
    specialization: u?.specialization || '',
    licenseNumber: u?.licenseNumber || (u as any)?.license_number || '',
    qualification: u?.qualification || '',
    registrationNumber: u?.registrationNumber || (u as any)?.registration_number || '',
    consultationFee: u?.consultationFee !== undefined && u?.consultationFee !== null ? String(u.consultationFee) : ((u as any)?.consultation_fee !== undefined && (u as any)?.consultation_fee !== null ? String((u as any).consultation_fee) : '500'),
    followupFee: u?.followupFee !== undefined && u?.followupFee !== null ? String(u.followupFee) : ((u as any)?.followup_fee !== undefined && (u as any)?.followup_fee !== null ? String((u as any).followup_fee) : '300'),
    bedPerDayCharge: u?.bedPerDayCharge !== undefined && u?.bedPerDayCharge !== null ? String(u.bedPerDayCharge) : ((u as any)?.bed_per_day_charge !== undefined && (u as any)?.bed_per_day_charge !== null ? String((u as any).bed_per_day_charge) : '1500'),
    letterhead: u?.letterhead || '',
    photoUrl: u?.photoUrl || (u as any)?.photo_url || '',
    showDiagnosisOnPrint: u?.showDiagnosisOnPrint !== undefined ? !!u.showDiagnosisOnPrint : ((u as any)?.show_diagnosis_on_print !== undefined ? ((u as any).show_diagnosis_on_print === 1 || (u as any).show_diagnosis_on_print === true) : true),
    showInvestigationsOnPrint: u?.showInvestigationsOnPrint !== undefined ? !!u.showInvestigationsOnPrint : ((u as any)?.show_investigations_on_print !== undefined ? ((u as any).show_investigations_on_print === 1 || (u as any).show_investigations_on_print === true) : true),
    showVitalsOnPrint: u?.showVitalsOnPrint !== undefined ? !!u.showVitalsOnPrint : ((u as any)?.show_vitals_on_print !== undefined ? ((u as any).show_vitals_on_print === 1 || (u as any).show_vitals_on_print === true) : true),
    printMarginTop: u?.printMarginTop !== undefined ? u.printMarginTop : ((u as any)?.print_margin_top !== undefined ? (u as any).print_margin_top : 35),
    printMarginBottom: u?.printMarginBottom !== undefined ? u.printMarginBottom : ((u as any)?.print_margin_bottom !== undefined ? (u as any).print_margin_bottom : 15),
    printMarginLeftRight: u?.printMarginLeftRight !== undefined ? u.printMarginLeftRight : ((u as any)?.print_margin_left_right !== undefined ? (u as any).print_margin_left_right : 18),
    printFontSize: u?.printFontSize !== undefined ? u.printFontSize : ((u as any)?.print_font_size !== undefined ? (u as any).print_font_size : 11),
  });

  // Practitioner profile state
  const [profileForm, setProfileForm] = useState(() => getInitialProfile(user));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

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

  // Only initialize profileForm once per logged-in user to prevent background pollers
  // or state updates from resetting fields while the practitioner is typing or saving
  const initialUserLoadedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (user?.id && initialUserLoadedRef.current !== user.id) {
      initialUserLoadedRef.current = user.id;
      setProfileForm(getInitialProfile(user));
    }
  }, [user?.id]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      const payload = {
        name: profileForm.name,
        phone: profileForm.phone,
        specialization: profileForm.specialization,
        license_number: profileForm.licenseNumber,
        licenseNumber: profileForm.licenseNumber,
        qualification: profileForm.qualification,
        registration_number: profileForm.registrationNumber,
        registrationNumber: profileForm.registrationNumber,
        consultation_fee: parseFloat(String(profileForm.consultationFee)) || 0,
        consultationFee: parseFloat(String(profileForm.consultationFee)) || 0,
        followup_fee: parseFloat(String(profileForm.followupFee)) || 0,
        followupFee: parseFloat(String(profileForm.followupFee)) || 0,
        bed_per_day_charge: parseFloat(String(profileForm.bedPerDayCharge)) || 0,
        bedPerDayCharge: parseFloat(String(profileForm.bedPerDayCharge)) || 0,
        letterhead: profileForm.letterhead,
        photo_url: profileForm.photoUrl,
        photoUrl: profileForm.photoUrl,
        show_diagnosis_on_print: !!profileForm.showDiagnosisOnPrint,
        show_investigations_on_print: !!profileForm.showInvestigationsOnPrint,
        show_vitals_on_print: !!profileForm.showVitalsOnPrint,
        print_margin_top: !isNaN(Number(profileForm.printMarginTop)) ? Number(profileForm.printMarginTop) : 35,
        print_margin_bottom: !isNaN(Number(profileForm.printMarginBottom)) ? Number(profileForm.printMarginBottom) : 15,
        print_margin_left_right: !isNaN(Number(profileForm.printMarginLeftRight)) ? Number(profileForm.printMarginLeftRight) : 18,
        print_font_size: !isNaN(Number(profileForm.printFontSize)) ? Number(profileForm.printFontSize) : 11,
      };

      const res = await apiClient.patch('/users/me/profile', payload);
      const rawUpdated = res.data?.user || res.data || {};

      const mergedUser = {
        ...(user || {}),
        ...rawUpdated,
        name: profileForm.name,
        phone: profileForm.phone,
        specialization: profileForm.specialization,
        licenseNumber: profileForm.licenseNumber,
        qualification: profileForm.qualification,
        registrationNumber: profileForm.registrationNumber,
        consultationFee: payload.consultation_fee,
        followupFee: payload.followup_fee,
        bedPerDayCharge: payload.bed_per_day_charge,
        letterhead: profileForm.letterhead,
        photoUrl: profileForm.photoUrl,
        showDiagnosisOnPrint: !!profileForm.showDiagnosisOnPrint,
        showInvestigationsOnPrint: !!profileForm.showInvestigationsOnPrint,
        showVitalsOnPrint: !!profileForm.showVitalsOnPrint,
        printMarginTop: payload.print_margin_top,
        printMarginBottom: payload.print_margin_bottom,
        printMarginLeftRight: payload.print_margin_left_right,
        printFontSize: payload.print_font_size,
      };

      const normalized = normalizeAuthUser(mergedUser);
      useAuthStore.setState({ user: normalized });
      localStorage.setItem('emr_user', JSON.stringify(normalized));

      setProfileSuccess('Profile saved successfully.');
    } catch (err: any) {
      setProfileError(err?.response?.data?.error || err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
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
      const usersList = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      setStaff(usersList);
    } catch (e:any) {
      setStaffError(e?.response?.data?.error || 'Cannot load staff — is the server running?');
    } finally { setLoadingStaff(false); }
  }

  const filteredStaff = roleFilter === 'all' ? (staff || []) : (staff || []).filter(s => s.role === roleFilter);

  const staffByRole = {
    all: (staff || []).length,
    doctor: (staff || []).filter(s=>s.role==='doctor').length,
    nurse: (staff || []).filter(s=>s.role==='nurse').length,
    receptionist: (staff || []).filter(s=>s.role==='receptionist').length,
    admin: (staff || []).filter(s=>s.role==='admin').length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">
            {isAdmin ? 'Manage staff, system & clinical preferences' : 'Manage your clinical profile, credentials & preferences'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{width:'100%'}}>
        {isAdmin && (
          <button className={`tab${activeTab==='users'?' active':''}`} onClick={()=>setActiveTab('users')}>
            Staff Management
          </button>
        )}
        <button className={`tab${activeTab==='system'?' active':''}`} onClick={()=>setActiveTab('system')}>
          {user?.role === 'doctor' ? 'Practitioner Profile & Preferences' : (isAdmin ? 'System Preferences' : 'My Profile')}
        </button>
        {(isAdmin || user?.role === 'doctor') && (
          <button className={`tab${activeTab==='medicines'?' active':''}`} onClick={()=>setActiveTab('medicines')}>
            Medicines Directory
          </button>
        )}
      </div>


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
                ? <div className="empty-state">
                    <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text-muted)' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <h3>No staff found</h3><p>Add your first staff member.</p>
                  </div>
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
                                  {s.name ? s.name.trim().split(/\s+/).filter(Boolean).map((w: string) => (w || '').charAt(0)).join('').slice(0, 2).toUpperCase() : 'S'}
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
                              {(() => {
                                const active = s.is_active !== undefined ? (s.is_active === 1 || s.is_active === true) : (s.isActive !== undefined ? (s.isActive === 1 || s.isActive === true) : true);
                                return (
                                  <span className={`badge ${active ? 'badge-success' : 'badge-neutral'}`}>
                                    {active ? 'Active' : 'Inactive'}
                                  </span>
                                );
                              })()}
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

      {/* ── System / Profile tab ── */}
      {activeTab === 'system' && (
        <>
          {user && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">{user?.role === 'doctor' ? 'Practitioner Profile & Credentials' : 'Profile Settings'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {user?.email} • <span style={{ textTransform: 'capitalize' }}>{user?.role || 'doctor'}</span>
                  </div>
                </div>
                <span className={`badge ${ROLE_COLORS[user?.role || 'doctor']}`} style={{ textTransform: 'capitalize' }}>
                  {ROLE_LABELS[user?.role || 'doctor']}
                </span>
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            Select Photo
                          </span>
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              Clear
                            </span>
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
                      onChange={e => setProfileForm(f => ({ ...f, consultationFee: e.target.value }))}
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
                      onChange={e => setProfileForm(f => ({ ...f, followupFee: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bed Per Day Charges (₹)</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      value={profileForm.bedPerDayCharge}
                      onChange={e => setProfileForm(f => ({ ...f, bedPerDayCharge: e.target.value }))}
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
              ? <div className="empty-state">
                  <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text-muted)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>
                  </div>
                  <h3>No medicines found</h3><p>Try searching for a different keyword or add a new medicine.</p>
                </div>
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


    </>
  );
}
