// client/src/pages/BillingPage.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { db, markPending } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { triggerSyncBroadcast } from '../sync/syncManager';
import { v4 as uuid } from 'uuid';
import { printInvoice } from '../utils/printTemplates';

const PAY_MODES = ['Cash','Card','UPI','Insurance','Online'];
const STATUS_COLOR: Record<string,string> = { 'Paid':'badge-success','Partial':'badge-warning','Pending':'badge-danger','Waived':'badge-neutral' };

const EMPTY_ITEM = { description:'', quantity:1, unit_price:0, amount:0 };

export default function BillingPage({ onNavigate, data }: { onNavigate:(p:string,d?:any)=>void; data?: any }) {
  const { user } = useAuthStore();
  const [bills, setBills]       = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [patientId, setPatientId] = useState('');
  const [items, setItems]       = useState([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState('0');
  const [payMode, setPayMode]   = useState('Cash');
  const [paidAmount, setPaid]   = useState('');
  const [notes, setNotes]       = useState('');
  const [patientFilterId, setPatientFilterId] = useState(data?.patientId || '');
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState('All');
  
  // Record Payment modal state
  const [recordPaymentBill, setRecordPaymentBill] = useState<any>(null);
  const [newPaidAmount, setNewPaidAmount] = useState('');
  const [newPayMode, setNewPayMode] = useState('Cash');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Bed Stay Billing State
  const [activeTab, setActiveTab] = useState<'opd' | 'bed'>('opd');
  const [bedStays, setBedStays] = useState<any[]>([]);
  const [loadingStays, setLoadingStays] = useState(false);
  const [selectedStayForBill, setSelectedStayForBill] = useState<any>(null);

  async function fetchBedStays() {
    setLoadingStays(true);
    try {
      const res = await apiClient.get('/beds/history');
      const unbilled = (res.data || []).filter((stay: any) => stay.billing_status === 'Unbilled');
      setBedStays(unbilled);
    } catch (err) {
      console.error('Failed to fetch bed stays:', err);
    } finally {
      setLoadingStays(false);
    }
  }

  function handleBillStay(stay: any) {
    setSelectedStayForBill(stay);
    setPatientId(stay.patient_id);
    setItems([{
      description: `Bed Stay: Room ${stay.room} (${stay.bed_number}) — ${stay.stay_days} days`,
      quantity: stay.stay_days,
      unit_price: 0,
      amount: 0,
    }]);
    setDiscount('0');
    setPaid('');
    setNotes(`Bed stay charges for admission on ${new Date(stay.admitted_at).toLocaleDateString('en-IN')}`);
    setShowAdd(true);
  }

  useEffect(() => {
    if (activeTab === 'bed') {
      fetchBedStays();
    }
  }, [activeTab]);

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recordPaymentBill) return;
    
    const dueAmount = Math.max(0, (recordPaymentBill.net_amount || 0) - (recordPaymentBill.paid_amount || 0));
    if (dueAmount <= 0) {
      alert('This invoice is already fully paid.');
      return;
    }

    const amt = parseFloat(newPaidAmount || '0');
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (amt > dueAmount) {
      alert(`Payment amount (₹${amt}) cannot exceed the balance due (₹${dueAmount}).`);
      return;
    }
    
    setSubmittingPayment(true);
    const cumulativePaid = (recordPaymentBill.paid_amount || 0) + amt;
    
    try {
      const res = await apiClient.put(`/billing/${recordPaymentBill.id}/payment`, {
        paid_amount: cumulativePaid,
        payment_mode: newPayMode,
      });
      
      // Update local bills list
      setBills(prev => prev.map(b => b.id === recordPaymentBill.id ? res.data : b));
      setRecordPaymentBill(null);
      alert('Payment recorded successfully.');
      triggerSyncBroadcast();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to record payment.');
    } finally {
      setSubmittingPayment(false);
    }
  }
  const [doctorInfo, setDoctorInfo] = useState<any>(null);  // auto-filled from encounter
  const [fetchingDoctor, setFetchingDoctor] = useState(false);

  const addReadyItem = (description: string, price: number) => {
    setItems(prev => {
      if (prev.length === 1 && prev[0].description === '' && prev[0].unit_price === 0) {
        return [{ description, quantity: 1, unit_price: price, amount: price }];
      }
      return [...prev, { description, quantity: 1, unit_price: price, amount: price }];
    });
  };

  const total    = items.reduce((s,i)=>s+(i.quantity*i.unit_price),0);
  const net      = Math.max(0, total - parseFloat(discount||'0'));
  const paid     = parseFloat(paidAmount||'0');

  const setItem  = (i:number, k:string, v:any) => setItems(ms=>ms.map((m,j)=>j===i ? { ...m, [k]:v, amount: k==='quantity'||k==='unit_price' ? (k==='quantity'?v:m.quantity) * (k==='unit_price'?v:m.unit_price) : m.amount } : m));

  useEffect(() => {
    if (data?.patientId) {
      setPatientFilterId(data.patientId);
      setPatientId(data.patientId);
    }
    if (data?.showAdd) {
      setShowAdd(true);
    }
  }, [data?.patientId, data?.showAdd]);

  useEffect(()=>{
    (async()=>{
      try { const r=await apiClient.get('/billing'); setBills(r.data); }
      catch { setBills(await db.billing.toArray()); }
      finally { setLoading(false); }
    })();
    (async()=>{
      try { const r=await apiClient.get('/patients',{params:{limit:200}}); setPatients(Array.isArray(r.data) ? r.data : (r.data?.patients || [])); }
      catch { setPatients(await db.patients.toArray()); }
    })();
  },[]);

  // When patient changes, look up their latest encounter → doctor → auto-fill fee
  useEffect(() => {
    if (!patientId) { setDoctorInfo(null); return; }
    (async () => {
      setFetchingDoctor(true);
      try {
        // Get latest encounter for this patient
        const encRes = await apiClient.get('/encounters', { params: { patient_id: patientId, limit: 1 } });
        const enc = Array.isArray(encRes.data) ? encRes.data[0] : encRes.data?.encounters?.[0];
        if (!enc?.doctor_id) { setDoctorInfo(null); return; }

        // Get doctor details (includes consultation_fee)
        const usersRes = await apiClient.get('/users');
        const usersList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.users || []);
        const doctor = usersList.find((u: any) => u.id === enc.doctor_id);
        if (!doctor) { setDoctorInfo(null); return; }

        setDoctorInfo(doctor);
        // Pre-fill first line item with doctor's consultation fee
        if (doctor.consultation_fee > 0) {
          setItems([{
            description: `Consultation Fee — Dr. ${doctor.name}`,
            quantity: 1,
            unit_price: doctor.consultation_fee,
            amount: doctor.consultation_fee,
          }]);
        }
      } catch {
        setDoctorInfo(null);
      } finally {
        setFetchingDoctor(false);
      }
    })();
  }, [patientId]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!patientId) return;
    setSaving(true);
    const now=new Date().toISOString(); const id=uuid();
    const payload:any={
      id, hospital_id:user?.hospitalId||'hsp-001', patient_id:patientId,
      items:items.map(i=>({...i,amount:i.quantity*i.unit_price})),
      total_amount:total, discount:parseFloat(discount||'0'), net_amount:net,
      paid_amount:paid, payment_mode:payMode,
      payment_status: paid>=net?'Paid':paid>0?'Partial':'Pending',
      notes:notes||null, billed_by:user?.id, created_at:now,
      bill_type: selectedStayForBill ? 'bed_stay' : 'consultation',
      doctor_id: doctorInfo?.id || null,
      bed_admission_id: selectedStayForBill ? selectedStayForBill.id : null,
    };
    try {
      const r = await apiClient.post('/billing', payload);
      await db.billing.put({ ...r.data, _syncStatus: 'synced' });
      setBills(b => [r.data, ...b]);
      triggerSyncBroadcast();
    }
    catch {
      await markPending(db.billing,'create',payload);
      await db.billing.put(payload);
      setBills(b=>[payload,...b]);
      triggerSyncBroadcast();
    }
    finally {
      setSaving(false); setShowAdd(false);
      setItems([{...EMPTY_ITEM}]); setPatientId(''); setPaid('');
      setDoctorInfo(null);
      setSelectedStayForBill(null);
      if (activeTab === 'bed') {
        fetchBedStays();
      }
    }
  }

  const activeBills = patientFilterId ? bills.filter(b => b.patient_id === patientFilterId) : bills;
  const filtered = (filter==='All' ? bills : bills.filter(b=>b.payment_status===filter))
    .filter(b => !patientFilterId || b.patient_id === patientFilterId);

  function handlePrint(b: any) {
    const patient = patients.find((p: any) => p.id === b.patient_id);
    const items   = Array.isArray(b.items) ? b.items : (typeof b.items === 'string' ? (() => { try { return JSON.parse(b.items); } catch { return []; } })() : []);
    const total   = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);
    printInvoice({
      invoice: { id: b.id, invoice_number: b.invoice_number, created_at: b.created_at, payment_mode: b.payment_mode, payment_status: b.payment_status },
      patient: { name: b.patient_name || patient?.name || '—', uhid: b.uhid || patient?.uhid, phone: patient?.phone },
      items,
      totals: { total, discount: b.discount || 0, net: b.net_amount || total, paid: b.paid_amount || 0 },
      billedBy: user?.name,
      notes: b.notes,
    });
  }

  const consultationRate = doctorInfo?.consultation_fee || user?.consultationFee || 500;
  const followupRate     = doctorInfo?.followup_fee || user?.followupFee || 200;
  const bedRate          = doctorInfo?.bed_per_day_charge || user?.bedPerDayCharge || 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                New Invoice
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select className="input" value={patientId} onChange={e=>setPatientId(e.target.value)} required>
                    <option value="">— Select —</option>
                    {patients.map(p=><option key={p.id} value={p.id}>{p.name} ({p.uhid})</option>)}
                  </select>
                </div>

                {/* Ready Items / Quick Add */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block', fontWeight: 600, fontSize: 12, color: 'var(--text-sec)' }}>Quick Add Common Items:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '6px 10px', height: 'auto', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                      onClick={() => addReadyItem('Doctor Consultation', consultationRate)}
                    >
                      Consultation (₹{consultationRate})
                    </button>
                    {followupRate > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '6px 10px', height: 'auto', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                        onClick={() => addReadyItem('Follow-up Consultation', followupRate)}
                      >
                        Follow-up (₹{followupRate})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '6px 10px', height: 'auto', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                      onClick={() => addReadyItem('General Bed Ward (1 Day)', bedRate)}
                    >
                      Bed Charge (₹{bedRate}/day)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '6px 10px', height: 'auto', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                      onClick={() => addReadyItem('ICU Bed Stay (1 Day)', 3000)}
                    >
                      ICU Bed (₹3,000)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '6px 10px', height: 'auto', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                      onClick={() => addReadyItem('CBC Blood Test', 350)}
                    >
                      CBC Blood Test (₹350)
                    </button>
                  </div>
                  {fetchingDoctor && (
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6,fontSize:12,color:'var(--text-muted)'}}>
                      <div className="spinner spinner-sm"/> Looking up doctor fee…
                    </div>
                  )}
                  {doctorInfo && !fetchingDoctor && (
                    <div style={{
                      marginTop:8, padding:'8px 12px', borderRadius:8,
                      background:'#f0fdf4', border:'1px solid #86efac',
                      display:'flex', alignItems:'center', gap:10, fontSize:12,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#16a34a' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <div>
                        <div style={{fontWeight:700,color:'#15803d'}}>Dr. {doctorInfo.name}</div>
                        <div style={{color:'#64748b'}}>
                          OPD Fee auto-filled: <strong>₹{doctorInfo.consultation_fee}</strong>
                          {doctorInfo.followup_fee > 0 && ` · Follow-up: ₹${doctorInfo.followup_fee}`}
                        </div>
                      </div>
                      <button type="button" style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:12}}
                        onClick={()=>{setDoctorInfo(null);setItems([{...EMPTY_ITEM}]);}}>
                        ✕ Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div className="section-label">Line Items</div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setItems(i=>[...i,{...EMPTY_ITEM}])}>+ Add Row</button>
                  </div>
                  {items.map((item,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 60px 90px 80px 30px',gap:8,marginBottom:8,alignItems:'center'}}>
                      <input className="input" placeholder="Description" value={item.description} onChange={e=>setItem(i,'description',e.target.value)} />
                      <input className="input" type="number" min={1} placeholder="Qty" value={item.quantity} onChange={e=>setItem(i,'quantity',parseInt(e.target.value)||1)} />
                      <input className="input" type="number" min={0} placeholder="Rate ₹" value={item.unit_price} onChange={e=>setItem(i,'unit_price',parseFloat(e.target.value)||0)} />
                      <div style={{textAlign:'right',fontWeight:700,fontSize:14}}>₹{(item.quantity*item.unit_price).toFixed(0)}</div>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={()=>setItems(x=>x.filter((_,j)=>j!==i))} disabled={items.length===1}>✕</button>
                    </div>
                  ))}
                  <div style={{borderTop:'2px solid var(--border)',paddingTop:10,display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-muted)'}}>Subtotal</span><strong>₹{total.toFixed(2)}</strong></div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'var(--text-muted)'}}>Discount</span>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <span>₹</span><input className="input" type="number" min={0} max={total} value={discount} onChange={e=>setDiscount(e.target.value)} style={{width:90}} />
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:16}}><span>Net Total</span><span style={{color:'var(--primary)'}}>₹{net.toFixed(2)}</span></div>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="input" value={payMode} onChange={e=>setPayMode(e.target.value)}>
                      {PAY_MODES.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount Paid ₹</label>
                    <input className="input" type="number" min={0} max={net} placeholder={`Max ₹${net.toFixed(0)}`} value={paidAmount} onChange={e=>setPaid(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="input" placeholder="Any billing notes…" value={notes} onChange={e=>setNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'✓ Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recordPaymentBill && (() => {
        const netAmt = recordPaymentBill.net_amount || 0;
        const paidAmt = recordPaymentBill.paid_amount || 0;
        const dueAmt = Math.max(0, netAmt - paidAmt);
        const isFullyPaid = dueAmt <= 0;

        return (
          <div className="modal-overlay" onClick={() => setRecordPaymentBill(null)}>
            <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Record Payment</div>
                <button className="modal-close" onClick={() => setRecordPaymentBill(null)}>✕</button>
              </div>
              <form onSubmit={handleRecordPaymentSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'var(--surface-alt)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>INVOICE #{recordPaymentBill.invoice_number || recordPaymentBill.id.slice(0,8)}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Patient: {recordPaymentBill.patient_name || '—'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, fontSize: 12 }}>
                      <div>Net Total: <strong>₹{netAmt}</strong></div>
                      <div>Paid: <strong style={{ color: 'var(--success)' }}>₹{paidAmt}</strong></div>
                      <div>Due: <strong style={{ color: dueAmt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{dueAmt}</strong></div>
                    </div>
                  </div>

                  {isFullyPaid && (
                    <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                      ✓ This invoice is fully paid. No balance is due.
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">New Payment Amount (₹) *</label>
                    <input
                      className="input"
                      type="number"
                      min={isFullyPaid ? "0" : "1"}
                      max={isFullyPaid ? undefined : dueAmt}
                      placeholder={isFullyPaid ? "Invoice fully paid" : "Enter collected amount"}
                      value={newPaidAmount}
                      onChange={e => setNewPaidAmount(e.target.value)}
                      disabled={isFullyPaid}
                      required={!isFullyPaid}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode *</label>
                    <select
                      className="input"
                      value={newPayMode}
                      onChange={e => setNewPayMode(e.target.value)}
                      disabled={isFullyPaid}
                      required={!isFullyPaid}
                    >
                      {PAY_MODES.map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setRecordPaymentBill(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submittingPayment || isFullyPaid}>
                    {submittingPayment ? 'Saving...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Page Header */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Financial Operations</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: '-0.3px', color: 'var(--text)' }}>Billing & Invoices</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
            Generate invoices, track pending/collected payments, and audit patient accounts.
          </p>
        </div>
        <button className="btn btn-primary" style={{ background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={()=>setShowAdd(true)}>
          <span>+ Create Invoice</span>
        </button>
      </div>

      {/* Dynamic Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: TOTAL BILLED */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Billed</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>
              ₹{activeBills.reduce((acc, b) => acc + (b.net_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Across all outpatient invoices</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>

        {/* Card 2: TOTAL COLLECTED */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Collected</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginTop: 8 }}>
              ₹{activeBills.reduce((acc, b) => acc + (b.paid_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Paid & partially paid receipts</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>

        {/* Card 3: OUTSTANDING BAL */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Outstanding Bal</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)', marginTop: 8 }}>
              ₹{Math.max(0, activeBills.reduce((acc, b) => acc + (b.net_amount || 0), 0) - activeBills.reduce((acc, b) => acc + (b.paid_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Pending collection</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
        </div>
      </div>

      {/* Main navigation tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('opd')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'opd' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'opd' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 14,
            padding: '4px 12px 10px 12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Outpatient (OPD) Invoices
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bed')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'bed' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'bed' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 14,
            padding: '4px 12px 10px 12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 19h20M22 8v11M2 8h20M6 12h4a2 2 0 0 1 2 2v5"/></svg>
            Bed Stay (IPD) Billing
          </span>
        </button>
      </div>

      {activeTab === 'opd' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Patient Filter Banner */}
          {patientFilterId && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-mid)',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--text-sec)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <span>
                🔍 Showing bills only for patient: <strong>{patients.find(p => p.id === patientFilterId)?.name || 'Loading patient details...'}</strong>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', minHeight: 24, fontSize: 11, color: 'var(--primary)' }}
                onClick={() => {
                  setPatientFilterId('');
                  setPatientId('');
                }}
              >
                Clear Patient Filter
              </button>
            </div>
          )}

          {/* Filter status row */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {['All','Pending','Partial','Paid'].map(f=>(
              <button
                key={f}
                type="button"
                className="btn btn-sm"
                onClick={()=>setFilter(f)}
                style={{
                  borderRadius: '20px',
                  padding: '5px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  background: filter === f ? 'var(--primary)' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--text-sec)',
                  border: filter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                  transition: 'all 0.1s ease'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <h3>No invoices found</h3>
              <p>Try switching to another filter status tab.</p>
            </div>
          ) : (
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Details</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount · Paid</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b: any) => {
                      const patient = patients.find((p: any) => p.id === b.patient_id);
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                            {b.invoice_number || b.id.slice(0, 8)}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', cursor: 'pointer' }} onClick={() => onNavigate('patient_detail', { patientId: b.patient_id })}>
                              {b.patient_name || patient?.name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              UHID: {b.uhid || patient?.uhid || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                            {new Date(b.created_at).toLocaleDateString('en-IN')}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                            {b.notes || (b.bill_type === 'bed_stay' ? 'Bed stay IPD accommodation' : 'OPD Consultation & Pharmacy')}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)' }}>
                            <div>Net: <strong>₹{b.net_amount?.toLocaleString('en-IN')}</strong></div>
                            <div style={{ color: 'var(--success)', marginTop: 2 }}>Paid: ₹{b.paid_amount?.toLocaleString('en-IN') || 0}</div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span className={`badge ${
                              b.payment_status === 'Paid' ? 'badge-success' :
                              b.payment_status === 'Partial' ? 'badge-warning' :
                              'badge-neutral'
                            }`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                              {b.payment_status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              {['Pending', 'Partial'].includes(b.payment_status) && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 10px', fontSize: 11.5, minHeight: 'auto', fontWeight: 600 }}
                                  onClick={() => {
                                    setRecordPaymentBill(b);
                                    setNewPaidAmount((b.net_amount - (b.paid_amount || 0)).toFixed(0));
                                    setNewPayMode(b.payment_mode || 'Cash');
                                  }}
                                >
                                  Record Payment
                                </button>
                              )}
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ padding: 6, minHeight: 'auto', color: 'var(--text-muted)' }}
                                onClick={() => handlePrint(b)} 
                                title="Print Invoice"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingStays ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : bedStays.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M2 4v16M2 19h20M22 8v11M2 8h20M6 12h4a2 2 0 0 1 2 2v5"/></svg>
              </span>
              <h3>No unbilled stay records</h3>
              <p>All inpatient admissions are fully billed or active.</p>
            </div>
          ) : (
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Room & Bed</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stay Period</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bedStays.map((stay: any) => (
                      <tr key={stay.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{stay.patient_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>UHID: {stay.patient_uhid}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{stay.room} ({stay.bed_number})</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stay.ward} · {stay.bed_type}</div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                          <div>In: {new Date(stay.admitted_at).toLocaleDateString('en-IN')}</div>
                          {stay.discharged_at ? (
                            <div style={{ marginTop: 2 }}>Out: {new Date(stay.discharged_at).toLocaleDateString('en-IN')}</div>
                          ) : (
                            <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>Currently Admitted</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                          {stay.stay_days} {stay.stay_days === 1 ? 'day' : 'days'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${stay.status === 'Admitted' ? 'badge-success' : 'badge-neutral'}`}>
                            {stay.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleBillStay(stay)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Bill Stay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
