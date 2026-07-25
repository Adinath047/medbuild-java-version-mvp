// client/src/pages/PharmacyBillingPage.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { printPharmacyBill } from '../utils/printTemplates';

const PAY_MODES = ['Cash','Card','UPI','Insurance','Online'];
const STATUS_COLOR: Record<string,string> = {
  'Paid':'badge-success','Partial':'badge-warning','Pending':'badge-danger',
};

interface MedRow { name: string; strength: string; quantity: number; unit_price: number; }
const EMPTY_MED: MedRow = { name:'', strength:'', quantity:1, unit_price:0 };

export default function PharmacyBillingPage({ onNavigate }: { onNavigate:(p:string,d?:any)=>void }) {
  const { user } = useAuthStore();
  const [bills, setBills]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [filter, setFilter]       = useState('All');

  // Form state
  const [rxToken, setRxToken]     = useState('');
  const [rxData, setRxData]       = useState<any>(null);
  const [patientId, setPatientId] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [meds, setMeds]           = useState<MedRow[]>([{ ...EMPTY_MED }]);
  const [discount, setDiscount]   = useState('0');
  const [payMode, setPayMode]     = useState('Cash');
  const [paidAmount, setPaid]     = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const total = meds.reduce((s, m) => s + m.quantity * m.unit_price, 0);
  const net   = Math.max(0, total - parseFloat(discount || '0'));

  useEffect(() => {
    (async () => {
      try { const r = await apiClient.get('/pharmacy'); setBills(r.data); }
      catch { setBills([]); }
      finally { setLoading(false); }
    })();
  }, []);

  // Search prescription by Rx slip token
  async function searchRx() {
    if (!rxToken.trim()) return;
    setSearching(true); setSearchErr(''); setRxData(null);
    try {
      const r = await apiClient.get(`/prescriptions/slip/${rxToken.trim().toUpperCase()}`);
      const rx = r.data;
      setRxData(rx);
      setPatientId(rx.patient_id);
      setPrescriptionId(rx.id);
      setPatientName(rx.patient_name || '—');
      // Pre-populate medicines from prescription
      const rxMeds = Array.isArray(rx.medicines) ? rx.medicines : [];
      if (rxMeds.length) {
        setMeds(rxMeds.map((m: any) => ({
          name: `${m.name}${m.strength ? ` ${m.strength}` : ''}`,
          strength: m.strength || '',
          quantity: 1,
          unit_price: 0,
        })));
      }
    } catch {
      setSearchErr('Rx token not found. Check the token on the prescription slip.');
    } finally { setSearching(false); }
  }

  const setMed = (i: number, k: keyof MedRow, v: any) =>
    setMeds(ms => ms.map((m, j) => j === i ? { ...m, [k]: v } : m));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) { alert('Scan an Rx token or set patient first'); return; }
    const validMeds = meds.filter(m => m.name.trim() && m.unit_price > 0);
    if (!validMeds.length) { alert('Add at least one medicine with a price'); return; }
    setSaving(true);
    const payload = {
      patient_id: patientId,
      prescription_id: prescriptionId || undefined,
      medicines: validMeds.map(m => ({ ...m, amount: m.quantity * m.unit_price })),
      discount: parseFloat(discount || '0'),
      paid_amount: parseFloat(paidAmount || '0'),
      payment_mode: payMode,
      notes: notes || undefined,
    };
    try {
      const r = await apiClient.post('/pharmacy', payload);
      setBills(b => [r.data, ...b]);
      resetForm();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save. Is the server running?');
    } finally { setSaving(false); }
  }

  function resetForm() {
    setShowAdd(false); setRxToken(''); setRxData(null);
    setPatientId(''); setPrescriptionId(''); setPatientName('');
    setMeds([{ ...EMPTY_MED }]); setDiscount('0'); setPaid(''); setNotes('');
    setSearchErr('');
  }

  function handlePrint(b: any) {
    const medicines = Array.isArray(b.medicines) ? b.medicines : [];
    printPharmacyBill({
      invoice: { id: b.id, invoice_number: b.invoice_number, created_at: b.created_at,
                 payment_mode: b.payment_mode, payment_status: b.payment_status },
      patient: { name: b.patient_name || '—', uhid: b.uhid },
      medicines,
      totals: { total: b.total_amount, discount: b.discount, net: b.net_amount, paid: b.paid_amount },
      pharmacistName: user?.name,
      notes: b.notes,
    });
  }

  const filtered = filter === 'All' ? bills : bills.filter(b => b.payment_status === filter);

  return (
    <>
      {showAdd && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" style={{ maxWidth:660 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">💊 New Pharmacy Bill</div>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">

                {/* Rx Token Search */}
                <div className="form-group">
                  <label className="form-label">Rx Token (from prescription slip)</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input className="input" placeholder="e.g. ABC123DEF456"
                      value={rxToken} onChange={e => setRxToken(e.target.value.toUpperCase())}
                      style={{ fontFamily:'monospace', letterSpacing:1 }} />
                    <button type="button" className="btn btn-secondary" style={{ flexShrink:0 }}
                      onClick={searchRx} disabled={searching}>
                      {searching ? <div className="spinner spinner-sm"/> : '🔍 Search'}
                    </button>
                  </div>
                  {searchErr && <div className="alert alert-danger" style={{ marginTop:8 }}>{searchErr}</div>}
                </div>

                {/* Patient info from Rx */}
                {rxData && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                    <div style={{ display:'flex', gap:24 }}>
                      <div><div style={{ fontSize:10, color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>Patient</div>
                        <div style={{ fontWeight:700 }}>{rxData.patient_name}</div></div>
                      <div><div style={{ fontSize:10, color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>UHID</div>
                        <div style={{ fontWeight:600, fontFamily:'monospace' }}>{rxData.uhid}</div></div>
                      <div><div style={{ fontSize:10, color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>Doctor</div>
                        <div style={{ fontWeight:600 }}>Dr. {rxData.doctor_name}</div></div>
                    </div>
                  </div>
                )}

                {/* Medicines */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div className="section-label">Medicines Dispensed</div>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setMeds(m => [...m, { ...EMPTY_MED }])}>+ Add Row</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 80px 90px 80px 28px',
                    gap:6, marginBottom:6, padding:'0 2px' }}>
                    {['Medicine / Brand', 'Qty', 'Rate ₹', 'Amt', ''].map(h =>
                      <div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
                        textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</div>)}
                  </div>
                  {meds.map((m, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 80px 90px 80px 28px',
                      gap:6, marginBottom:6, alignItems:'center' }}>
                      <input className="input" placeholder="Medicine name" value={m.name}
                        onChange={e => setMed(i, 'name', e.target.value)} />
                      <input className="input" type="number" min={1} value={m.quantity}
                        onChange={e => setMed(i, 'quantity', parseInt(e.target.value) || 1)} />
                      <input className="input" type="number" min={0} step={0.5} placeholder="0.00"
                        value={m.unit_price}
                        onChange={e => setMed(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                      <div style={{ textAlign:'right', fontWeight:700, fontSize:14 }}>
                        ₹{(m.quantity * m.unit_price).toFixed(0)}</div>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => setMeds(x => x.filter((_, j) => j !== i))}
                        disabled={meds.length === 1}>✕</button>
                    </div>
                  ))}

                  <div style={{ borderTop:'2px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'var(--text-muted)' }}>Subtotal</span>
                      <strong>₹{total.toFixed(2)}</strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'var(--text-muted)' }}>Discount</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span>₹</span>
                        <input className="input" type="number" min={0} max={total} value={discount}
                          onChange={e => setDiscount(e.target.value)} style={{ width:90 }} />
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16 }}>
                      <span>Net Total</span>
                      <span style={{ color:'var(--primary)' }}>₹{net.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:4 }}>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="input" value={payMode} onChange={e => setPayMode(e.target.value)}>
                      {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount Paid ₹</label>
                    <input className="input" type="number" min={0} max={net}
                      placeholder={`Max ₹${net.toFixed(0)}`} value={paidAmount}
                      onChange={e => setPaid(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="input" placeholder="Any dispensing notes…" value={notes}
                    onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '💊 Saving…' : '💊 Create Pharmacy Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">💊 Pharmacy Billing</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
            Medicines dispensed — separate from consultation fees
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Bill</button>
      </div>

      <div className="tabs">
        {['All','Pending','Partial','Paid'].map(f => (
          <button key={f} className={`tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {loading
        ? <div style={{ padding:48, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
        : filtered.length === 0
          ? <div className="card"><div className="empty-state">
              <span className="empty-icon">💊</span>
              <h3>No pharmacy bills</h3>
              <p>Use an Rx token from a prescription slip to quickly add medicines.</p>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Bill</button>
            </div></div>
          : <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Invoice</th><th>Patient</th><th>Items</th>
                    <th>Total</th><th>Paid</th><th>Mode</th><th>Status</th><th>Date</th><th></th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((b: any) => {
                      const meds = Array.isArray(b.medicines) ? b.medicines : [];
                      return (
                        <tr key={b.id}>
                          <td style={{ fontWeight:700, color:'var(--primary)', fontSize:12, fontFamily:'monospace' }}>
                            {b.invoice_number || b.id.slice(0,8)}</td>
                          <td>
                            <div style={{ fontWeight:600 }}>{b.patient_name || '—'}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{b.uhid || ''}</div>
                          </td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {meds.length} item{meds.length !== 1 ? 's' : ''}
                          </td>
                          <td style={{ fontWeight:700 }}>₹{b.net_amount?.toFixed(2) || '0.00'}</td>
                          <td style={{ color:'var(--success)', fontWeight:600 }}>₹{b.paid_amount?.toFixed(2) || '0.00'}</td>
                          <td style={{ fontSize:12 }}>{b.payment_mode}</td>
                          <td><span className={`badge ${STATUS_COLOR[b.payment_status] || 'badge-neutral'}`}>{b.payment_status}</span></td>
                          <td style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => handlePrint(b)} title="Print Bill">🖨️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', gap:24 }}>
                <div style={{ fontSize:13 }}><strong>Total Billed:</strong> ₹{filtered.reduce((s:number,b:any)=>s+(b.net_amount||0),0).toFixed(2)}</div>
                <div style={{ fontSize:13, color:'var(--success)' }}><strong>Collected:</strong> ₹{filtered.reduce((s:number,b:any)=>s+(b.paid_amount||0),0).toFixed(2)}</div>
                <div style={{ fontSize:13, color:'var(--danger)' }}><strong>Outstanding:</strong> ₹{filtered.reduce((s:number,b:any)=>s+Math.max(0,(b.net_amount||0)-(b.paid_amount||0)),0).toFixed(2)}</div>
              </div>
            </div>
      }
    </>
  );
}
