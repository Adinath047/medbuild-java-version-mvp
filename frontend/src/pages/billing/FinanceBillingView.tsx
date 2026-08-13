// client/src/pages/billing/FinanceBillingView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { db, markPending } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';
import { useSync } from '../../sync/useSync';
import { triggerSyncBroadcast } from '../../sync/syncManager';
import { v4 as uuid } from 'uuid';
import { printInvoice } from '../../utils/printTemplates';

const PAY_MODES = ['Cash', 'Card', 'UPI', 'Insurance', 'Online'];
const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0, amount: 0 };

export default function FinanceBillingView({ onNavigate, data }: { onNavigate: (p: string, d?: any) => void; data?: any }) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [bills, setBills] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState('0');
  const [payMode, setPayMode] = useState('Cash');
  const [paidAmount, setPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [patientFilterId, setPatientFilterId] = useState(data?.patientId || '');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Paid'>('All');
  
  // Record Payment modal state
  const [recordPaymentBill, setRecordPaymentBill] = useState<any>(null);
  const [newPaidAmount, setNewPaidAmount] = useState('');
  const [newPayMode, setNewPayMode] = useState('Cash');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Bed Stay Billing State
  const [activeTab, setActiveTab] = useState<'opd' | 'bed'>('opd');
  const [bedStays, setBedStays] = useState<any[]>([]);
  const [loadingStays, setLoadingStays] = useState(false);

  const fetchBills = async () => {
    try {
      const r = await apiClient.get('/billing');
      if (Array.isArray(r.data)) {
        setBills(r.data);
      }
    } catch {
      const local = await db.billing.toArray();
      setBills(local);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const r = await apiClient.get('/patients', { params: { limit: 200 } });
      setPatients(Array.isArray(r.data) ? r.data : (r.data?.patients || []));
    } catch {
      const local = await db.patients.toArray();
      setPatients(local);
    }
  };

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

  useEffect(() => {
    fetchBills();
    fetchPatients();
  }, []);

  useEffect(() => {
    if (syncCount > 0) {
      fetchBills();
      fetchPatients();
    }
  }, [syncCount]);

  useEffect(() => {
    if (activeTab === 'bed') {
      fetchBedStays();
    }
  }, [activeTab]);

  useEffect(() => {
    if (data?.patientId) {
      setPatientFilterId(data.patientId);
      setPatientId(data.patientId);
    }
    if (data?.showAdd) {
      setShowAdd(true);
    }
  }, [data?.patientId, data?.showAdd]);

  function handleBillStay(stay: any) {
    setPatientId(stay.patient_id);
    setItems([{
      description: `Bed Stay: Room ${stay.room || ''} (${stay.bed_number || ''}) — ${stay.stay_days || 1} days`,
      quantity: stay.stay_days || 1,
      unit_price: 1000,
      amount: (stay.stay_days || 1) * 1000,
    }]);
    setDiscount('0');
    setPaid('');
    setNotes(`Bed stay charges for admission on ${stay.admitted_at ? new Date(stay.admitted_at).toLocaleDateString('en-IN') : 'admission'}`);
    setShowAdd(true);
  }

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recordPaymentBill) return;
    
    const net = Number(recordPaymentBill.net_amount) || 0;
    const currentPaid = Number(recordPaymentBill.paid_amount) || 0;
    const dueAmount = Math.max(0, net - currentPaid);
    
    if (dueAmount <= 0) {
      alert('This invoice is already fully paid.');
      setRecordPaymentBill(null);
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
    const cumulativePaid = currentPaid + amt;
    const isFullyPaidNow = cumulativePaid >= net;
    const calculatedStatus = isFullyPaidNow ? 'Paid' : 'Partial';
    
    try {
      const res = await apiClient.put(`/billing/${recordPaymentBill.id}/payment`, {
        paid_amount: cumulativePaid,
        payment_mode: newPayMode,
        payment_status: calculatedStatus,
      });
      
      const updated = res.data || {
        ...recordPaymentBill,
        paid_amount: cumulativePaid,
        balance_due: Math.max(0, net - cumulativePaid),
        payment_mode: newPayMode,
        payment_status: calculatedStatus,
      };

      setBills(prev => prev.map(b => b.id === recordPaymentBill.id ? updated : b));
      await db.billing.put(updated);
      setRecordPaymentBill(null);
      triggerSyncBroadcast();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to record payment.');
    } finally {
      setSubmittingPayment(false);
      fetchBills();
    }
  }

  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [fetchingDoctor, setFetchingDoctor] = useState(false);

  const addReadyItem = (description: string, price: number) => {
    setItems(prev => {
      if (prev.length === 1 && prev[0].description === '' && prev[0].unit_price === 0) {
        return [{ description, quantity: 1, unit_price: price, amount: price }];
      }
      return [...prev, { description, quantity: 1, unit_price: price, amount: price }];
    });
  };

  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const net = Math.max(0, total - parseFloat(discount || '0'));
  const paid = parseFloat(paidAmount || '0');

  const setItem = (i: number, k: string, v: any) => setItems(ms => ms.map((m, j) => j === i ? { ...m, [k]: v, amount: k === 'quantity' || k === 'unit_price' ? (k === 'quantity' ? v : m.quantity) * (k === 'unit_price' ? v : m.unit_price) : m.amount } : m));

  useEffect(() => {
    if (!patientId) { setDoctorInfo(null); return; }
    (async () => {
      setFetchingDoctor(true);
      try {
        const encRes = await apiClient.get('/encounters', { params: { patient_id: patientId, limit: 1 } });
        const latestEnc = Array.isArray(encRes.data) && encRes.data.length > 0 ? encRes.data[0] : null;
        if (latestEnc && latestEnc.doctor_id) {
          const docRes = await apiClient.get(`/users/${latestEnc.doctor_id}`);
          setDoctorInfo(docRes.data);
          const fee = docRes.data?.consultation_fee || docRes.data?.consultationFee;
          if (fee && fee > 0) {
            setItems(prev => {
              const hasDocFee = prev.some(it => it.description.toLowerCase().includes('consultation'));
              if (!hasDocFee) {
                const docName = docRes.data?.name ? (docRes.data.name.toLowerCase().startsWith('dr.') ? docRes.data.name : `Dr. ${docRes.data.name}`) : 'Doctor';
                const itemLabel = `Consultation Fee — ${docName} (${docRes.data?.specialization || 'General'})`;
                if (prev.length === 1 && prev[0].description === '' && prev[0].unit_price === 0) {
                  return [{ description: itemLabel, quantity: 1, unit_price: fee, amount: fee }];
                }
                return [{ description: itemLabel, quantity: 1, unit_price: fee, amount: fee }, ...prev];
              }
              return prev;
            });
          }
        } else {
          setDoctorInfo(null);
        }
      } catch {
        setDoctorInfo(null);
      } finally {
        setFetchingDoctor(false);
      }
    })();
  }, [patientId]);

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return alert('Select a patient');
    const validItems = items.filter(i => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) return alert('Add at least one valid item');
    setSaving(true);
    const pat = patients.find(p => p.id === patientId);

    const isPaid = paid >= net && net > 0;
    const computedStatus = isPaid ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

    const b = {
      id: uuid(),
      patient_id: patientId,
      patient_name: pat?.name || '—',
      uhid: pat?.uhid || '—',
      doctor_id: doctorInfo?.id || user?.id || null,
      doctor_name: doctorInfo?.name || user?.name || null,
      bill_type: activeTab === 'bed' ? 'bed_stay' : 'OPD',
      items: validItems,
      gross_amount: total,
      discount: parseFloat(discount || '0'),
      tax: 0,
      net_amount: net,
      paid_amount: paid,
      balance_due: Math.max(0, net - paid),
      payment_mode: payMode,
      payment_status: computedStatus,
      notes,
      created_at: new Date().toISOString(),
      sync_status: 'synced'
    };

    try {
      const res = await apiClient.post('/billing', b);
      const savedBill = res.data || b;
      setBills(x => [savedBill, ...x]);
      await db.billing.put(savedBill);
    } catch {
      await db.billing.put({ ...b, _syncStatus: 'pending' } as any);
      await markPending(db.billing, 'create', b as any);
      setBills(x => [b, ...x]);
    } finally {
      setSaving(false);
      setShowAdd(false);
      setItems([{ ...EMPTY_ITEM }]);
      setDiscount('0');
      setPaid('');
      setNotes('');
      triggerSyncBroadcast();
      fetchBills();
    }
  }

  function handlePrint(bill: any) {
    const pat = patients.find(p => p.id === bill.patient_id) || { name: bill.patient_name, uhid: bill.uhid };
    printInvoice({
      invoice: bill,
      patient: { name: bill.patient_name || pat.name || 'Patient', uhid: bill.uhid || pat.uhid || '—' },
      items: bill.items && bill.items.length > 0 ? bill.items : [{ description: bill.notes || 'OPD Consultation & Hospital Services', quantity: 1, unit_price: bill.net_amount || 0, amount: bill.net_amount || 0 }],
      totals: { total: bill.gross_amount || bill.net_amount || 0, discount: bill.discount || 0, net: bill.net_amount || 0, paid: bill.paid_amount || 0 },
      billedBy: user?.name,
      notes: bill.notes
    });
  }

  // Filtered bills list
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const isPaid = (b.payment_status === 'Paid') || ((b.paid_amount || 0) >= (b.net_amount || 0) && (b.net_amount || 0) > 0);
      if (filter === 'Paid') return isPaid;
      if (filter === 'Pending') return !isPaid;
      return true;
    });
  }, [bills, filter]);

  // Financial KPIs
  const totalCollected = useMemo(() => {
    return bills.reduce((s, b) => s + (Number(b.paid_amount) || 0), 0);
  }, [bills]);

  const totalPending = useMemo(() => {
    return bills.reduce((s, b) => {
      const netAmt = Number(b.net_amount) || 0;
      const paidAmt = Number(b.paid_amount) || 0;
      const due = Math.max(0, netAmt - paidAmt);
      return s + due;
    }, 0);
  }, [bills]);

  const pendingInvoicesCount = useMemo(() => {
    return bills.filter(b => {
      const netAmt = Number(b.net_amount) || 0;
      const paidAmt = Number(b.paid_amount) || 0;
      return netAmt > paidAmt;
    }).length;
  }, [bills]);

  const dueAmt = recordPaymentBill ? Math.max(0, (recordPaymentBill.net_amount || 0) - (recordPaymentBill.paid_amount || 0)) : 0;
  const netAmt = recordPaymentBill ? (recordPaymentBill.net_amount || 0) : 0;
  const paidAmt = recordPaymentBill ? (recordPaymentBill.paid_amount || 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner */}
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Finance & Revenue</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Hospital Invoices & Payments</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Manage OPD consultation fees, IPD bed stay settlements, and track payment receipts.</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowAdd(true); setPatientId(patientFilterId || ''); }} style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8 }}>
            + Create New Invoice
          </button>
        </div>
      </div>

      {/* Financial Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ margin: 0, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Revenue Collected</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)', marginTop: 8 }}>₹{Math.round(totalCollected).toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Payment settlements received</div>
        </div>

        <div className="card" style={{ margin: 0, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Outstanding Dues</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: totalPending > 0 ? 'var(--danger)' : 'var(--text-muted)', marginTop: 8 }}>
            ₹{Math.round(totalPending).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Across pending invoices</div>
        </div>

        <div className="card" style={{ margin: 0, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Invoices</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{pendingInvoicesCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Awaiting collection</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Invoice Records</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['All', 'Pending', 'Paid'] as const).map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : filteredBills.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No invoice records found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Date</th>
                <th>Particulars</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(b => {
                const patient = patients.find(p => p.id === b.patient_id);
                const netAmount = Number(b.net_amount) || 0;
                const paidAmount = Number(b.paid_amount) || 0;
                const isFullyPaid = paidAmount >= netAmount && netAmount > 0;
                const displayStatus = isFullyPaid ? 'Paid' : (b.payment_status || (paidAmount > 0 ? 'Partial' : 'Pending'));

                return (
                  <tr key={b.id}>
                    <td><code>#{b.invoice_number || b.id.slice(0, 8)}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.patient_name || patient?.name || 'Registered Patient'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>UHID: {b.uhid || patient?.uhid || '—'}</div>
                    </td>
                    <td>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{b.notes || (b.bill_type === 'bed_stay' ? 'Bed stay IPD accommodation' : 'OPD Consultation')}</td>
                    <td>
                      <div>Net: <strong>₹{netAmount.toLocaleString('en-IN')}</strong></div>
                      <div style={{ color: 'var(--success)', fontSize: 11 }}>Paid: ₹{paidAmount.toLocaleString('en-IN')}</div>
                    </td>
                    <td>
                      <span className={`badge ${displayStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {!isFullyPaid && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setRecordPaymentBill(b);
                              const remaining = Math.max(0, netAmount - paidAmount);
                              setNewPaidAmount(remaining.toString());
                              setNewPayMode(b.payment_mode || 'Cash');
                            }}
                          >
                            Record Payment
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => handlePrint(b)}>Print</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {recordPaymentBill && (
        <div className="modal-overlay" onClick={() => setRecordPaymentBill(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button className="modal-close" onClick={() => setRecordPaymentBill(null)}>✕</button>
            </div>
            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface-alt)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>INVOICE #{recordPaymentBill.invoice_number || recordPaymentBill.id.slice(0,8)}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    Patient: {recordPaymentBill.patient_name || patients.find(p => p.id === recordPaymentBill.patient_id)?.name || 'Registered Patient'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, fontSize: 12 }}>
                    <div>Net Total: <strong>₹{netAmt}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--success)' }}>₹{paidAmt}</strong></div>
                    <div>Due: <strong style={{ color: dueAmt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{dueAmt}</strong></div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">New Payment Amount (₹) *</label>
                  <input className="input" type="number" value={newPaidAmount} onChange={e => setNewPaidAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode *</label>
                  <select className="input" value={newPayMode} onChange={e => setNewPayMode(e.target.value)}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRecordPaymentBill(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingPayment}>
                  {submittingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Invoice Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Hospital Invoice</div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBill}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Select Patient *</label>
                  <select className="input" value={patientId} onChange={e => setPatientId(e.target.value)} required>
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.uhid || p.phone || 'No UHID'})</option>
                    ))}
                  </select>
                </div>

                {/* Items list */}
                <div className="form-group">
                  <label className="form-label">Invoice Items & Charges</label>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                      <input className="input" placeholder="Service description" value={item.description} onChange={e => setItem(i, 'description', e.target.value)} required />
                      <input className="input" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => setItem(i, 'quantity', parseInt(e.target.value) || 1)} required />
                      <input className="input" type="number" min="0" placeholder="Unit Price" value={item.unit_price} onChange={e => setItem(i, 'unit_price', parseFloat(e.target.value) || 0)} required />
                      {items.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setItems(items.filter((_, idx) => idx !== i))}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>+ Add Item</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Discount (₹)</label>
                    <input className="input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Paid Amount (₹)</label>
                    <input className="input" type="number" value={paidAmount} onChange={e => setPaid(e.target.value)} placeholder={`Total: ₹${net}`} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="input" value={payMode} onChange={e => setPayMode(e.target.value)}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes & Observations</label>
                  <textarea className="input" placeholder="Additional billing notes..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Generating Invoice...' : `Create Invoice (Net: ₹${net})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
