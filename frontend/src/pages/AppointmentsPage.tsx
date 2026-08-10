// client/src/pages/AppointmentsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { db, markPending } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { v4 as uuid } from 'uuid';
import { validatePhone, validateRequired, isValidPhone, extractServerError } from '../utils/validation';
import { useSync } from '../sync/useSync';
import { triggerSyncBroadcast } from '../sync/syncManager';

const STATUS_FLOW: Record<string,string> = { 'Scheduled':'Confirmed','Confirmed':'Checked-In','Checked-In':'Completed' };
const STATUS_COLOR: Record<string,string> = { 'Scheduled':'badge-info','Confirmed':'badge-success','Checked-In':'badge-purple','Completed':'badge-neutral','Cancelled':'badge-danger','No-Show':'badge-warning','Pending':'badge-warning' };

function today() { return new Date().toISOString().split('T')[0]; }

const formatDoctorName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().startsWith('dr.') ? name : `Dr. ${name}`;
};

export default function AppointmentsPage({ onNavigate, data }: { onNavigate:(p:string,d?:any)=>void; data?:any }) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [date, setDate]   = useState(today());
  const [selectedFilter, setSelectedFilter] = useState<'Today' | 'Upcoming' | 'Completed' | 'Cancelled' | 'All'>('Today');
  const [searchText, setSearchText] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [form, setForm] = useState({ patient_id:'', doctor_id:'', date:today(), time:'09:00', reason:'' });
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState<{name:string; phone:string; sex:'Male'|'Female'|'Other'}>({ name: '', phone: '', sex: 'Male' });
  const [patientSearch, setPatientSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookError, setBookError] = useState('');
  const set = (k:string, v:string) => setForm(f=>({...f,[k]:v}));

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (user?.role === 'doctor') {
        params.doctor_id = user.id;
      }
      const res = await apiClient.get('/appointments', { params });
      setAppts(res.data);
    } catch {
      let data = await db.appointments.toArray();
      if (user?.role === 'doctor') {
        data = data.filter((a: any) => a.doctor_id === user.id);
      }
      setAppts(data);
    } finally { if (!isSilent) setLoading(false); }
  }, [user]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    if (syncCount > 0) {
      load(true);
    }
  }, [syncCount, load]);
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail?.date || customEvent.detail?.date === date) {
        console.log('[ws] Reloading appointments silently for date:', date);
        load(true);
      }
    };
    window.addEventListener('emr:appointments-update', handleUpdate);
    return () => window.removeEventListener('emr:appointments-update', handleUpdate);
  }, [date, load]);
  useEffect(() => {
    (async () => {
      try { const r = await apiClient.get('/patients',{params:{limit:200}}); setPatients(Array.isArray(r.data) ? r.data : (r.data?.patients || [])); }
      catch { setPatients(await db.patients.toArray()); }
    })();
    (async () => {
      try { const r = await apiClient.get('/users/doctors'); setDoctors(Array.isArray(r.data) ? r.data : (r.data?.doctors || [])); }
      catch { /* ignore offline docs for now */ }
    })();
  }, []);

  useEffect(() => {
    if (data?.showAdd) {
      setShowAdd(true);
      if (data?.prefillPatient) set('patient_id', data.prefillPatient);
      if (data?.prefillDoctor) set('doctor_id', data.prefillDoctor);
      if (data?.reason) set('reason', data.reason);
    }
  }, [data]);

  async function bookAppt(e:React.FormEvent) {
    e.preventDefault();
    setBookError('');

    // Client-side validation
    if (!isNewPatient && !form.patient_id) {
      setBookError('Please select a patient.');
      return;
    }
    if (isNewPatient) {
      if (!newPatient.name.trim()) { setBookError('Patient name is required.'); return; }
      if (newPatient.phone && !isValidPhone(newPatient.phone)) {
        setBookError('Please enter a valid phone number.'); return;
      }
    }
    if (!form.doctor_id) { setBookError('Please select a doctor.'); return; }
    if (!form.date)      { setBookError('Date is required.'); return; }
    if (!form.time)      { setBookError('Time is required.'); return; }
    // Prevent booking more than 1 year ahead
    const apptDate = new Date(form.date);
    const daysForward = (apptDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysForward > 365) { setBookError('Cannot book more than 1 year in advance.'); return; }

    setSaving(true);
    
    let finalPatientId = form.patient_id;
    if (isNewPatient) {
      try {
        const pRes = await apiClient.post('/patients', newPatient);
        await db.patients.put({ ...pRes.data, _syncStatus: 'synced' });
        finalPatientId = pRes.data.id;
        setPatients(p => [...p, pRes.data]);
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status === 422 || status === 400) {
          setBookError(extractServerError(err));
          setSaving(false);
          return;
        }
        const pId = uuid();
        const payload = { id: pId, uhid: 'UHID-001-' + Math.floor(Math.random()*1000000), hospital_id: user?.hospitalId||'hsp-001', ...newPatient, allergies: [], chronic_conditions: [], current_medications: [], is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await markPending(db.patients, 'create', payload);
        await db.patients.put(payload);
        finalPatientId = pId;
        setPatients(p => [...p, payload]);
      }
    }

    const id = uuid(); const now = new Date().toISOString();
    const patientObj = patients.find(p => p.id === finalPatientId);
    const doctorObj = doctors.find(d => d.id === (form.doctor_id || user?.id));
    
    const payload: any = { 
      id, 
      hospital_id: user?.hospitalId||'hsp-001', 
      ...form, 
      patient_id: finalPatientId, 
      doctor_id: form.doctor_id||user?.id, 
      status: 'Scheduled', 
      token_number: appts.length + 1, 
      created_at: now, 
      updated_at: now,
      patient_name: patientObj ? patientObj.name : (isNewPatient ? newPatient.name : 'Patient'),
      uhid: patientObj ? patientObj.uhid : 'UHID-TEMP',
      doctor_name: doctorObj ? doctorObj.name : (user?.name || 'Doctor')
    };
    try {
      const r = await apiClient.post('/appointments', payload);
      await db.appointments.put({ ...r.data, _syncStatus: 'synced' });
      setAppts(a=>[...a,r.data]);
      triggerSyncBroadcast();
      setShowAdd(false); setIsNewPatient(false);
    } catch (err) {
      const status = (err as any)?.response?.status;
      if (status === 422 || status === 400 || status === 409) {
        setBookError(extractServerError(err));
        setSaving(false);
        return;
      }
      await markPending(db.appointments, 'create', payload);
      await db.appointments.put(payload);
      setAppts(a=>[...a,payload]);
      triggerSyncBroadcast();
      setShowAdd(false); setIsNewPatient(false);
    } finally { setSaving(false); }
  }

  const filteredPatients = patients.filter(p => !patientSearch || p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone?.includes(patientSearch) || p.uhid?.includes(patientSearch));

  async function updateStatus(id:string, status:string) {
    try { 
      const r = await apiClient.put(`/appointments/${id}/status`,{status}); 
      await db.appointments.put({ ...r.data, _syncStatus: 'synced' });
      setAppts(a=>a.map(x=>x.id===id?r.data:x)); 
      triggerSyncBroadcast();
    }
    catch { 
      const existing = appts.find(x => x.id === id);
      if (existing) {
        const payload = { ...existing, status, updated_at: new Date().toISOString() };
        await markPending(db.appointments, 'update', payload);
      } else {
        await db.appointments.update(id,{status,_syncStatus:'pending'}); 
      }
      setAppts(a=>a.map(x=>x.id===id?{...x,status}:x)); 
      triggerSyncBroadcast();
    }
  }

  const grouped = appts.reduce((acc:any,a:any)=>{ const k=a.doctor_name||'Doctor'; if(!acc[k])acc[k]=[]; acc[k].push(a); return acc; },{});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Book Appointment</div><button className="modal-close" onClick={()=>setShowAdd(false)}>✕</button></div>
            <form onSubmit={bookAppt}>
              <div className="modal-body">
                {bookError && <div className="alert alert-danger" style={{marginBottom:12}}>⚠️ {bookError}</div>}
                <div style={{display:'flex',gap:10,marginBottom:12}}>
                  <label style={{display:'flex',gap:4,alignItems:'center'}}>
                    <input type="radio" checked={!isNewPatient} onChange={()=>setIsNewPatient(false)} /> Existing Patient
                  </label>
                  <label style={{display:'flex',gap:4,alignItems:'center'}}>
                    <input type="radio" checked={isNewPatient} onChange={()=>setIsNewPatient(true)} /> New Patient (Caller)
                  </label>
                </div>
                
                {!isNewPatient ? (
                  <div className="form-group">
                    <label className="form-label">Search Patient (Name, Phone, UHID) *</label>
                    <input className="input" placeholder="Search..." value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} style={{marginBottom:8}} />
                    <select className="input" value={form.patient_id} onChange={e=>set('patient_id',e.target.value)} required>
                      <option value="">— Select Patient —</option>
                      {filteredPatients.map(p=><option key={p.id} value={p.id}>{p.name} - {p.phone||'No Phone'} ({p.uhid})</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12, marginBottom:12}}>
                    <div className="form-group"><label className="form-label">Name *</label><input className="input" required value={newPatient.name} onChange={e=>setNewPatient({...newPatient,name:e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">Phone *</label><input className="input" required value={newPatient.phone} onChange={e=>setNewPatient({...newPatient,phone:e.target.value})} /></div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Doctor *</label>
                  <select className="input" value={form.doctor_id} onChange={e=>set('doctor_id',e.target.value)} required>
                    <option value="">— Select Doctor —</option>
                    {doctors.map(d => {
                      const cleanDocName = formatDoctorName(d.name);
                      return <option key={d.id} value={d.id}>{cleanDocName} {d.specialization ? `(${d.specialization})` : ''}</option>;
                    })}
                    {user?.role === 'doctor' && !doctors.find(d=>d.id===user.id) && <option value={user.id}>{formatDoctorName(user.name)} (Me)</option>}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label className="form-label">Date</label><input className="input" type="date" value={form.date} onChange={e=>set('date',e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Time</label><input className="input" type="time" value={form.time} onChange={e=>set('time',e.target.value)} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Reason</label><input className="input" placeholder="Reason for visit" value={form.reason} onChange={e=>set('reason',e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Booking…':'✓ Book'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Title Header Section */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 4
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Scheduling</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: '-0.3px', color: 'var(--text)' }}>Appointment Center</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
          A calm, focused view of upcoming and past appointments.
        </p>
      </div>

      {/* Search & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          maxWidth: 360
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
          <input 
            placeholder="Search patient, doctor..." 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 13, color: 'var(--text)' }}
          />
        </div>

        <button 
          className="btn btn-primary" 
          style={{ background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} 
          onClick={()=>setShowAdd(true)}
        >
          <span>+ New Appointment</span>
        </button>
      </div>

      {/* Tabs list (Today, Upcoming, Completed, Cancelled, All) */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {[
          { label: 'Today', key: 'Today' },
          { label: 'Upcoming', key: 'Upcoming' },
          { label: 'Completed', key: 'Completed' },
          { label: 'Cancelled', key: 'Cancelled' },
          { label: 'All', key: 'All' }
        ].map(tab => {
          const isActive = selectedFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedFilter(tab.key as any)}
              style={{
                borderRadius: '20px',
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: 12.5,
                background: isActive ? 'var(--primary)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text-sec)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                transition: 'all 0.1s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid view of Appointments */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        (() => {
          const filtered = appts.filter(a => {
            const todayStr = today();
            if (selectedFilter === 'Today') {
              if (a.date !== todayStr) return false;
            } else if (selectedFilter === 'Upcoming') {
              if (a.date <= todayStr || a.status === 'Cancelled' || a.status === 'Completed') return false;
            } else if (selectedFilter === 'Completed') {
              if (a.status !== 'Completed') return false;
            } else if (selectedFilter === 'Cancelled') {
              if (a.status !== 'Cancelled') return false;
            }

            if (searchText.trim()) {
              const query = searchText.toLowerCase().trim();
              const pName = (a.patient_name || '').toLowerCase();
              const dName = (a.doctor_name || '').toLowerCase();
              const reason = (a.reason || '').toLowerCase();
              const uhid = (a.uhid || '').toLowerCase();
              return pName.includes(query) || dName.includes(query) || reason.includes(query) || uhid.includes(query);
            }
            return true;
          });

          if (filtered.length === 0) {
            return (
              <div className="empty-state" style={{ padding: '60px 24px', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <h3>No appointments found</h3>
                <p>No appointments match the current status filter or search query.</p>
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: 16, background: 'var(--primary)', border: 'none', fontWeight: 600 }}
                  onClick={() => setShowAdd(true)}
                >
                  + Book New Appointment
                </button>
              </div>
            );
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.sort((a,b) => a.time.localeCompare(b.time)).map((a: any) => {
                const isCancelled = a.status === 'Cancelled';
                const isCompleted = a.status === 'Completed';

                const patientObj = patients.find(p => p.id === a.patient_id);
                const doctorObj = doctors.find(d => d.id === a.doctor_id);
                const patientName = a.patient_name || patientObj?.name || 'Patient';
                const doctorName = a.doctor_name || doctorObj?.name || 'Doctor';

                return (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      margin: 0,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      padding: 18,
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Time & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🕒 {a.time}
                      </div>
                      <span className={`badge ${STATUS_COLOR[a.status] || 'badge-neutral'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {a.status}
                      </span>
                    </div>

                    {/* Patient Info Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        border: '1px solid var(--border-light)',
                        overflow: 'hidden'
                      }}>
                        {a.patient_photo ? (
                          <img src={a.patient_photo} alt={patientName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          patientName ? patientName[0].toUpperCase() : 'P'
                        )}
                      </div>
                      <div>
                        <div 
                          style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}
                          onClick={() => onNavigate('patient_detail', { patientId: a.patient_id })}
                        >
                          {patientName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {a.reason || 'General checkup'}
                        </div>
                      </div>
                    </div>

                    {/* Doctor Info Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700
                      }}>
                        🩺
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 500 }}>
                        {formatDoctorName(doctorName)} · <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{a.specialization || doctorObj?.specialization || 'Cardiology'}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    {/* Actions Row at bottom */}
                    {!isCancelled && !isCompleted && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                        {['Scheduled', 'Confirmed', 'Pending'].includes(a.status || 'Scheduled') ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ 
                              flex: 1.5, 
                              background: a.status === 'Pending' ? '#10b981' : 'var(--primary)', 
                              border: 'none', 
                              fontWeight: 600, 
                              fontSize: 12, 
                              minHeight: 30 
                            }}
                            onClick={() => updateStatus(a.id, 'Checked-In')}
                          >
                            {a.status === 'Pending' ? 'Accept' : 'Check-in'}
                          </button>
                        ) : a.status === 'Checked-In' ? (
                          user?.role === 'doctor' ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1.5, background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12, minHeight: 30 }}
                                onClick={() => onNavigate('new_prescription', { patientId: a.patient_id })}
                              >
                                Prescribe
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, fontWeight: 600, fontSize: 12, minHeight: 30 }}
                                onClick={() => updateStatus(a.id, 'Completed')}
                              >
                                Complete
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ flex: 1.5, background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12, minHeight: 30 }}
                              onClick={() => updateStatus(a.id, 'Completed')}
                            >
                              Complete
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1.5, background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12, minHeight: 30 }}
                            onClick={() => updateStatus(a.id, 'Completed')}
                          >
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, fontWeight: 600, fontSize: 12, minHeight: 30 }}
                          onClick={() => updateStatus(a.id, 'Cancelled')}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
