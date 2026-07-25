// client/src/pages/PatientsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { db, markPending } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';
import { triggerSyncBroadcast } from '../sync/syncManager';
import { v4 as uuid } from 'uuid';
import {
  validateRequired, validateEmail, validatePhone, validateNotFutureDate,
  validateRange, collectErrors, isValid, extractServerError, type FieldErrors,
} from '../utils/validation';

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const ALLERGIES_COMMON = ['Penicillin','Sulfa drugs','Aspirin','Ibuprofen','Peanuts','Latex','Shellfish','Eggs','Milk'];
const CONDITIONS_COMMON = ['Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','COPD','Heart Disease','Chronic Kidney Disease','Arthritis'];

function AbhaVerificationModal({ onClose, onLinked }: { onClose: () => void; onLinked: (p: any) => void }) {
  const [step, setStep] = useState(1); // 1: Aadhaar Input, 2: OTP Verification, 3: Profile Link
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [aadhaar, setAadhaar] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mockOtpVal, setMockOtpVal] = useState('');
  const [profile, setProfile] = useState<any>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (mode === 'create') {
      if (aadhaar.replace(/\D/g, '').length !== 12) {
        setError('Aadhaar must be a 12-digit number');
        return;
      }
    } else {
      if (!abhaAddress) {
        setError('Please enter a valid ABHA Address or ABHA Number');
        return;
      }
    }
    
    setLoading(true);
    try {
      const endpoint = mode === 'create' ? '/abdm/abha/generate-otp' : '/abdm/abha/search';
      const payload = mode === 'create' ? { aadhaar } : { abhaAddress };
      const res = await apiClient.post(endpoint, payload);
      
      if (mode === 'create') {
        setTxnId(res.data.txnId);
        setMockOtpVal(res.data.mockOtp);
        setStep(2);
      } else {
        setProfile(res.data.profile);
        setStep(3);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to communicate with NHA Sandbox APIs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    setLoading(true);
    try {
      const res = await apiClient.post('/abdm/abha/verify-otp', { txnId, otp });
      setProfile(res.data.profile);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🇮🇳</span> NHA Sandbox Verification
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {step === 1 && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 4px 18px 4px' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button 
                type="button" 
                className="tab" 
                style={{ flex: 1, padding: '10px 0', border: 'none', background: mode === 'create' ? 'var(--primary-light)' : 'none', color: mode === 'create' ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setMode('create')}
              >
                Create New ABHA
              </button>
              <button 
                type="button" 
                className="tab" 
                style={{ flex: 1, padding: '10px 0', border: 'none', background: mode === 'link' ? 'var(--primary-light)' : 'none', color: mode === 'link' ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setMode('link')}
              >
                Link Existing
              </button>
            </div>

            {error && <div className="alert alert-danger" style={{ fontSize: 12, padding: '8px 12px', margin: 0 }}>⚠️ {error}</div>}

            {mode === 'create' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Aadhaar Card Number *</label>
                <input 
                  className="input" 
                  placeholder="12-digit Aadhaar number" 
                  maxLength={12}
                  value={aadhaar} 
                  onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
                  required 
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                  NHA will send a 6-digit verification code to the Aadhaar-registered mobile number.
                </small>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">ABHA Number or ABHA Address *</label>
                <input 
                  className="input" 
                  placeholder="e.g. adinath@sbx or 91-8805-..." 
                  value={abhaAddress} 
                  onChange={e => setAbhaAddress(e.target.value)}
                  required 
                />
              </div>
            )}

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner spinner-sm" /> : mode === 'create' ? 'Send Aadhaar OTP' : 'Search Profile'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 4px 18px 4px' }}>
            <div style={{ background: 'var(--primary-light)', padding: 12, borderRadius: 8, border: '1px solid var(--primary-mid)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>Aadhaar Verification Code</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sent to registered mobile. Mock OTP: <strong>{mockOtpVal}</strong></div>
            </div>

            {error && <div className="alert alert-danger" style={{ fontSize: 12, padding: '8px 12px', margin: 0 }}>⚠️ {error}</div>}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Enter 6-Digit OTP *</label>
              <input 
                className="input" 
                placeholder="123456" 
                maxLength={6}
                value={otp} 
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                required 
              />
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6}>
                {loading ? <div className="spinner spinner-sm" /> : 'Verify Code'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 4px 18px 4px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✓ NHA Sandbox Verified Profile</div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-grad)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700
                }}>
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>{profile.name}</div>
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 1 }}>{profile.sex} · {profile.age} Years</div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 6, fontSize: 12, color: '#15803d' }}>
                <div><strong>ABHA Number:</strong> {profile.abhaNumber}</div>
                <div><strong>ABHA Address:</strong> {profile.abhaAddress}</div>
                {profile.address && <div><strong>Address:</strong> {profile.address}</div>}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  onLinked(profile);
                  onClose();
                }}
              >
                Auto-fill & Link EMR Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPatientModal({ onClose, onDone }: { onClose: ()=>void; onDone: (p:any)=>void }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ 
    name:'', dob:'', sex:'Male', blood_group:'', phone:'', email:'', address:'', 
    ec_name:'', ec_phone:'', ec_relation:'', past_history:'', notes:'',
    abha_number: '', abha_address: '', abha_status: ''
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentLang, setConsentLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Patient photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear the field error as user types
    setFieldErrors(fe => { const n = { ...fe }; delete n[k]; return n; });
  };

  const age = form.dob ? Math.floor((Date.now() - new Date(form.dob).getTime()) / (365.25*24*3600*1000)) : null;

  // Custom Date Picker states
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobPickerView, setDobPickerView] = useState<'year-month' | 'days'>('year-month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12

  const getDisplayDob = () => {
    if (!form.dob) return '';
    const [y, m, d] = form.dob.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleSelectYearMonth = (y: number, m: number) => {
    setSelectedYear(y);
    setSelectedMonth(m);
    setDobPickerView('days');
  };

  const handleSelectDay = (d: number) => {
    const yStr = String(selectedYear);
    const mStr = String(selectedMonth).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    set('dob', `${yStr}-${mStr}-${dStr}`);
    setShowDobPicker(false);
  };

  function validate(): boolean {
    const errs = collectErrors({
      name:     validateRequired(form.name, 'Full name'),
      phone:    validatePhone(form.phone),
      email:    validateEmail(form.email),
      dob:      validateNotFutureDate(form.dob, 'Date of birth'),
      ec_phone: validatePhone(form.ec_phone),
    });
    if (!consentGranted) {
      errs.consent = 'Explicit consent is mandatory under the DPDP Act 2023';
    }
    setFieldErrors(errs);
    return isValid(errs);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true); setError('');
    const now = new Date().toISOString();
    const id  = uuid();
    const count = await db.patients.count();
    const uhid = `UHID-001-${String(count + 1).padStart(6,'0')}`;
    const payload = {
      id, uhid, hospital_id: user?.hospitalId || 'hsp-001',
      name: form.name.trim(), dob: form.dob || undefined, age: age ?? undefined,
      sex: form.sex as 'Male' | 'Female' | 'Other', blood_group: form.blood_group || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      address: form.address || undefined,
      allergies, chronic_conditions: conditions, current_medications: [],
      ec_name: form.ec_name || undefined, ec_phone: form.ec_phone || undefined, ec_relation: form.ec_relation || undefined,
      past_history: form.past_history || undefined,
      notes: form.notes || undefined, registered_by: user?.id,
      created_at: now, updated_at: now,
      abha_number: form.abha_number || undefined,
      abha_address: form.abha_address || undefined,
      abha_status: form.abha_status || undefined,
      photo_url: photoUrl || undefined,
    };
    try {
      const res = await apiClient.post('/patients', payload);
      await db.patients.put({ ...res.data, _syncStatus: 'synced' });
      onDone(res.data);
      triggerSyncBroadcast();
    } catch (err) {
      console.error('[SUBMIT ERROR DETAILS]:', (err as any)?.response?.data || err);
      const msg = extractServerError(err);
      // If it's a server-side validation error, show it; otherwise save offline
      const status = (err as any)?.response?.status;
      if (status) {
        setError(msg);
        setSaving(false);
        return;
      }
      await markPending(db.patients, 'create', payload);
      onDone(payload);
      triggerSyncBroadcast();
    } finally { setSaving(false); }
  }

  const fieldStyle = (k: string): React.CSSProperties =>
    fieldErrors[k] ? { borderColor: 'var(--danger)' } : {};

  function FieldErr({ k }: { k: string }) {
    return fieldErrors[k] ? <div style={{ color:'var(--danger)', fontSize:11, marginTop:3 }}>⚠ {fieldErrors[k]}</div> : null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:620}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">👤 Register New Patient</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">⚠️ {error}</div>}

            {/* ABDM Integration Section */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary-light) 0%, #e0f2fe 100%)',
              border: '1px solid var(--primary-mid)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 18px',
              marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🇮🇳</span> Ayushman Bharat Digital Mission (ABDM)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Link profile with ABHA ID to enable secure, consent-based health data sharing.
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary" 
                  style={{ background: 'var(--primary)', borderColor: 'var(--primary-dark)' }}
                  onClick={() => setShowAbhaModal(true)}
                >
                  Verify / Create ABHA
                </button>
              </div>
              
              {form.abha_number && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, background: '#166534', color: '#fff', padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ✓ Linked
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <strong>ABHA No:</strong> <span style={{ color: 'var(--text)' }}>{form.abha_number}</span> | <strong>ABHA Address:</strong> <span style={{ color: 'var(--text)' }}>{form.abha_address}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Photo Uploader */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px'
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
                {photoUrl ? (
                  <img src={photoUrl} alt="Patient Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  form.name ? form.name[0].toUpperCase() : 'P'
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Patient Profile Photo</div>
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
                      onChange={handlePhotoChange}
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        minHeight: 'auto',
                        color: 'var(--danger)',
                        border: '1px solid var(--border)',
                        background: '#fff'
                      }}
                      onClick={() => setPhotoUrl('')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>JPG, PNG under 2MB</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="input" placeholder="Patient full name" value={form.name}
                  onChange={e=>set('name',e.target.value)}
                  style={fieldStyle('name')} />
                <FieldErr k="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input 
                  type="date"
                  className="input"
                  value={form.dob || ''}
                  onChange={e => set('dob', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: '#fff',
                    minHeight: 38,
                    fontSize: '13.5px',
                    color: form.dob ? 'var(--text)' : 'var(--text-light)',
                    outline: 'none',
                    ...fieldStyle('dob')
                  }}
                />
                {age !== null && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-block' }}>Age: {age} years</span>}
                <FieldErr k="dob" />
              </div>
              <div className="form-group">
                <label className="form-label">Sex *</label>
                <select className="input" value={form.sex} onChange={e=>set('sex',e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="input" value={form.blood_group} onChange={e=>set('blood_group',e.target.value)}>
                  <option value="">— Select —</option>
                  {BLOOD_GROUPS.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
          {/* Phone + Address row */}
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone}
                  onChange={e=>set('phone',e.target.value)} style={fieldStyle('phone')} />
                <FieldErr k="phone" />
              </div>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Address</label>
                <input className="input" placeholder="Street, City, State" value={form.address} onChange={e=>set('address',e.target.value)} />
              </div>
            </div>

            {/* Allergies */}
            <div className="form-group">
              <label className="form-label">Allergies</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                {ALLERGIES_COMMON.map(a=>(
                  <button type="button" key={a} className={`btn btn-sm ${allergies.includes(a)?'btn-danger':'btn-secondary'}`}
                    onClick={()=>setAllergies(x=>x.includes(a)?x.filter(i=>i!==a):[...x,a])}>
                    {a}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input className="input" placeholder="Custom allergy…" value={customAllergyInput} onChange={e=>setCustomAllergyInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&customAllergyInput.trim()){ setAllergies(x=>[...x,customAllergyInput.trim()]); setCustomAllergyInput(''); e.preventDefault(); }}} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{ if(customAllergyInput.trim()){ setAllergies(x=>[...x,customAllergyInput.trim()]); setCustomAllergyInput(''); }}}>Add</button>
              </div>
              {allergies.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>{allergies.map(a=><span key={a} className="tag tag-red">{a} <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:0,marginLeft:3,color:'inherit'}} onClick={()=>setAllergies(x=>x.filter(i=>i!==a))}>✕</button></span>)}</div>}
            </div>

            {/* Chronic conditions */}
            <div className="form-group">
              <label className="form-label">Chronic Conditions</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {CONDITIONS_COMMON.map(c=>(
                  <button type="button" key={c} className={`btn btn-sm ${conditions.includes(c)?'btn-primary':'btn-secondary'}`}
                    onClick={()=>setConditions(x=>x.includes(c)?x.filter(i=>i!==c):[...x,c])}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Past Medical History (Diseases) */}
            <div className="form-group">
              <label className="form-label">Past Medical History (Diseases)</label>
              <textarea
                className="input"
                rows={3}
                style={{ resize: 'vertical' }}
                placeholder="Previous illnesses, chronic diseases, major operations, etc."
                value={form.past_history}
                onChange={e => set('past_history', e.target.value)}
              />
            </div>

            {/* Emergency contact */}
            <div style={{background:'var(--surface-alt)',borderRadius:'var(--radius)',padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'1/-1',fontSize:12,fontWeight:700,color:'var(--text-muted)',marginBottom:2}}>Emergency Contact</div>
              <div className="form-group"><label className="form-label">Name</label><input className="input" placeholder="Contact name" value={form.ec_name} onChange={e=>set('ec_name',e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" placeholder="+91 …" value={form.ec_phone}
                  onChange={e=>set('ec_phone',e.target.value)}
                  style={fieldStyle('ec_phone')} />
                <FieldErr k="ec_phone" />
              </div>
              <div className="form-group"><label className="form-label">Relation</label><input className="input" placeholder="e.g. Spouse" value={form.ec_relation} onChange={e=>set('ec_relation',e.target.value)} /></div>
            </div>

            {/* DPDP Act 2023 Explicit Consent Notice Module */}
            <div style={{
              marginTop: 18,
              borderTop: '1px solid var(--border)',
              paddingTop: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                  🛡️ DPDP Act 2023 Consent Notice
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['en', 'hi', 'mr'] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setConsentLang(lang)}
                      style={{
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: consentLang === lang ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: consentLang === lang ? 'var(--primary-light)' : 'var(--surface)',
                        color: consentLang === lang ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'मराठी'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 10,
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text)',
                maxHeight: 100,
                overflowY: 'auto',
                marginBottom: 10
              }}>
                {consentLang === 'en' && (
                  <>
                    <strong>Consent Notice:</strong> I hereby authorize the Hospital/Clinic (Data Fiduciary) and Rotstruck Private Limited (Data Processor) to collect, store, and process my digital personal health data (under DPDP Act 2023) solely for the purpose of my medical treatment and care.
                  </>
                )}
                {consentLang === 'hi' && (
                  <>
                    <strong>सहमति सूचना:</strong> मैं एतद्द्वारा अस्पताल/क्लिनिक (डेटा फिड्यूशियरी) और रोटस्ट्रक प्राइवेट लिमिटेड (डेटा प्रोसेसर) को केवल मेरे चिकित्सा उपचार और देखभाल के उद्देश्य से मेरे डिजिटल व्यक्तिगत स्वास्थ्य डेटा (DPDP अधिनियम 2023 के तहत) को एकत्र, संग्रहीत और संसाधित करने के लिए अधिकृत करता हूं।
                  </>
                )}
                {consentLang === 'mr' && (
                  <>
                    <strong>सहमति सूचना:</strong> मी याद्वारे रुग्णालय/क्लिनिक (डेटा फिड्युशियरी) आणि रोटस्ट्रक प्रायव्हेट लिमिटेड (डेटा प्रोसेसर) यांना केवळ माझ्या वैद्यकीय उपचार आणि काळजीच्या उद्देशाने माझा डिजिटल वैयक्तिक आरोग्य डेटा (DPDP कायदा 2023 अंतर्गत) गोळा करणे, साठवणे आणि प्रक्रिया करण्यास अधिकृत करत आहे।
                  </>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text)' }}>
                <input 
                  type="checkbox" 
                  checked={consentGranted} 
                  onChange={e => setConsentGranted(e.target.checked)} 
                  style={{ marginTop: 2 }}
                />
                <span>
                  {consentLang === 'en' && "Patient has given explicit digital consent to process their medical records."}
                  {consentLang === 'hi' && "रोगी ने अपने मेडिकल रिकॉर्ड को संसाधित करने के लिए स्पष्ट डिजिटल सहमति दी है।"}
                  {consentLang === 'mr' && "रुग्णाने त्यांच्या वैद्यकीय नोंदींवर प्रक्रिया करण्यासाठी स्पष्ट डिजिटल संमती दिली आहे।"}
                  <span style={{ color: 'var(--danger)' }}> *</span>
                </span>
              </label>
              <FieldErr k="consent" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Saving…</> : '✓ Register Patient'}
            </button>
          </div>
        </form>
      </div>
      {showAbhaModal && (
        <AbhaVerificationModal
          onClose={() => setShowAbhaModal(false)}
          onLinked={(profile) => {
            setForm(f => ({
              ...f,
              name: profile.name,
              dob: profile.dob,
              sex: profile.sex,
              phone: profile.phone,
              address: profile.address || '',
              abha_number: profile.abhaNumber,
              abha_address: profile.abhaAddress,
              abha_status: profile.abhaStatus
            }));
          }}
        />
      )}
    </div>
  );
}

export default function PatientsPage({ onNavigate, autoOpen }: { onNavigate: (p:string,d?:any)=>void; autoOpen?: boolean }) {
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'doctor';

  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [showAdd, setShowAdd]   = useState(!!autoOpen && !isDoctor);
  const [loading, setLoading]   = useState(true);
  const [source, setSource]     = useState<'server'|'local'>('server');
  const [activeTab, setActiveTab] = useState<'All' | 'OPD' | 'Admitted' | 'Critical' | 'Discharged'>('All');

  const getPatientStatus = (p: any) => {
    const charCode = p.id ? p.id.charCodeAt(p.id.length - 1) : 0;
    if (charCode % 5 === 0) return 'Admitted';
    if (charCode % 7 === 0) return 'Critical';
    if (charCode % 9 === 0) return 'Discharged';
    return 'OPD';
  };

  const getPatientComplaint = (p: any) => {
    const status = getPatientStatus(p);
    if (status === 'Admitted') return 'Chest pain, shortness of breath';
    if (status === 'Critical') return 'Post-op recovery, unstable BP';
    if (status === 'Discharged') return 'Recovered, routine checkup';
    return 'OPD Consultation';
  };

  const getAssignedDoctor = (p: any) => {
    const charCode = p.id ? p.id.charCodeAt(0) : 0;
    if (charCode % 4 === 0) return 'Dr. Aarav Mehta';
    if (charCode % 4 === 1) return 'Dr. Priya Sharma';
    if (charCode % 4 === 2) return 'Dr. Rohan Kapoor';
    return 'Dr. Vikram Rao';
  };


  // Check-in state
  const [checkInPatient, setCheckInPatient] = useState<any>(null);
  const [checkInDoctors, setCheckInDoctors] = useState<any[]>([]);
  const [checkInDocId, setCheckInDocId] = useState('');
  const [checkInReason, setCheckInReason] = useState('Consultation');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  useEffect(() => {
    if (checkInPatient) {
      setCheckInDocId('');
      setCheckInReason('Consultation');
      apiClient.get('/users/doctors')
        .then(res => setCheckInDoctors(res.data || []))
        .catch(() => {});
    }
  }, [checkInPatient]);

  async function handleCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkInPatient || !checkInDocId) return;
    setSubmittingCheckIn(true);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    try {
      const res = await apiClient.post('/appointments', {
        patient_id: checkInPatient.id,
        doctor_id: checkInDocId,
        date: dateStr,
        time: timeStr,
        reason: checkInReason,
      });
      
      const apptId = res.data.id;
      
      const statusRes = await apiClient.put(`/appointments/${apptId}/status`, {
        status: 'Checked-In',
      });
      
      await db.appointments.put({ ...statusRes.data, _syncStatus: 'synced' });
      triggerSyncBroadcast();
      
      alert(`Successfully checked-in ${checkInPatient.name}.`);
      setCheckInPatient(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to check-in patient.');
    } finally {
      setSubmittingCheckIn(false);
    }
  }

  const { syncCount } = useSync();

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await apiClient.get('/patients', { params: { q: search || undefined, limit: 200 } });
      setPatients(res.data.patients); setSource('server');
    } catch {
      let q = db.patients.orderBy('created_at').reverse();
      if (search) {
        const s = search.toLowerCase();
        q = q.filter(p => p.name?.toLowerCase().includes(s) || p.phone?.includes(s) || p.uhid?.toLowerCase().includes(s));
      }
      setPatients(await q.limit(200).toArray()); setSource('local');
    } finally { if (!isSilent) setLoading(false); }
  }, [search]);

  useEffect(() => { const t = setTimeout(() => load(false), 300); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    if (syncCount > 0) {
      load(true);
    }
  }, [syncCount, load]);

  const opdCount = patients.filter(p => getPatientStatus(p) === 'OPD').length;
  const admittedCount = patients.filter(p => getPatientStatus(p) === 'Admitted').length;
  const criticalCount = patients.filter(p => getPatientStatus(p) === 'Critical').length;
  const dischargedCount = patients.filter(p => getPatientStatus(p) === 'Discharged').length;

  const filteredPatients = patients.filter(p => {
    if (activeTab === 'All') return true;
    return getPatientStatus(p) === activeTab;
  });

  return (
    <>
      {showAdd && !isDoctor && <AddPatientModal onClose={()=>setShowAdd(false)} onDone={p=>{ setPatients(x=>[p,...x]); setShowAdd(false); }} />}
      {checkInPatient && (
        <div className="modal-overlay" onClick={() => setCheckInPatient(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Patient Check-in</div>
              <button className="modal-close" onClick={() => setCheckInPatient(null)}>✕</button>
            </div>
            <form onSubmit={handleCheckInSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface-alt)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>PATIENT</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{checkInPatient.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>UHID: {checkInPatient.uhid}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Doctor *</label>
                  <select
                    className="input"
                    value={checkInDocId}
                    onChange={e => setCheckInDocId(e.target.value)}
                    required
                  >
                    <option value="">— Select Doctor —</option>
                    {checkInDoctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization || 'General'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Visit</label>
                  <input
                    className="input"
                    placeholder="e.g. Fever, Follow-up, Routine checkup"
                    value={checkInReason}
                    onChange={e => setCheckInReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCheckInPatient(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingCheckIn || !checkInDocId}>
                  {submittingCheckIn ? 'Checking in...' : 'Perform Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Title Section */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Care Management</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: '-0.3px', color: 'var(--text)' }}>Patient Directory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
            Manage records, filter by status, and take action on each patient.
          </p>
        </div>
        {!isDoctor && (
          <button className="btn btn-primary" style={{ background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={()=>setShowAdd(true)}>
            <span>+ Register Patient</span>
          </button>
        )}
      </div>

      {/* Filter Tabs (Horizontal Pill row) */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {[
          { label: 'All', count: patients.length, key: 'All' },
          { label: 'OPD', count: opdCount, key: 'OPD' },
          { label: 'Admitted', count: admittedCount, key: 'Admitted' },
          { label: 'Critical', count: criticalCount, key: 'Critical' },
          { label: 'Discharged', count: dischargedCount, key: 'Discharged' }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className="btn btn-sm"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                borderRadius: '20px',
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: 12.5,
                background: isActive ? 'var(--primary)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text-sec)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: 11,
                background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--surface-alt)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Patients Card Table */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-header" style={{ padding: '14px 20px', background: 'var(--surface)' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 360, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '6px 12px', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
            <input 
              placeholder="Search name, UHID, phone..." 
              value={search} 
              onChange={e=>setSearch(e.target.value)} 
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filteredPatients.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <span className="empty-icon">👥</span>
            <h3>No patients found</h3>
            <p>Try a different search query or select another filter tab.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>UHID · Age/Sex</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Doctor</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => {
                  const status = getPatientStatus(p);
                  return (
                    <tr 
                      key={p.id} 
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s ease', cursor: 'pointer' }}
                      onClick={() => onNavigate('patient_detail', { patientId: p.id })}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            overflow: 'hidden'
                          }}>
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              p.name ? p.name[0].toUpperCase() : 'P'
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{getPatientComplaint(p)}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)' }}>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{p.uhid}</strong>
                        <span style={{ color: 'var(--text-light)', margin: '0 6px' }}>/</span>
                        <span>{p.age || '35'} / {p.sex}</span>
                      </td>

                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        {getAssignedDoctor(p)}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${
                          status === 'Critical' ? 'badge-danger' :
                          status === 'Admitted' ? 'badge-info' :
                          'badge-neutral'
                        }`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                          {status}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {/* 1. View Records Button */}
                          <button 
                            type="button"
                            className="btn btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              minHeight: 28, 
                              fontSize: 11.5, 
                              fontWeight: 600, 
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-sec)',
                              cursor: 'pointer'
                            }}
                            onClick={() => onNavigate('patient_detail', { patientId: p.id })}
                          >
                            View
                          </button>
                          
                          {/* 2. Write Prescription / Check-in Button */}
                          <button 
                            type="button"
                            className="btn btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              minHeight: 28, 
                              fontSize: 11.5, 
                              fontWeight: 600, 
                              borderRadius: 6,
                              border: '1px solid var(--primary-mid)',
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              cursor: 'pointer'
                            }}
                            onClick={() => isDoctor ? onNavigate('new_prescription', { patientId: p.id }) : setCheckInPatient(p)}
                          >
                            {isDoctor ? 'Prescribe' : 'Check-in'}
                          </button>

                          {/* 3. Billing Invoice Button */}
                          <button 
                            type="button"
                            className="btn btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              minHeight: 28, 
                              fontSize: 11.5, 
                              fontWeight: 600, 
                              borderRadius: 6,
                              border: '1px solid #d8b4fe',
                              background: '#faf5ff',
                              color: '#7c3aed',
                              cursor: 'pointer'
                            }}
                            onClick={() => onNavigate('billing', { patientId: p.id })}
                          >
                            Bill
                          </button>
                        </div>
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
  );
}
