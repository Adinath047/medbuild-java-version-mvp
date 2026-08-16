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

const PRESET_SERVICES = [
  { name: 'OPD Consultation', defaultPrice: 500, category: 'Consultation' },
  { name: 'Follow-up Consultation', defaultPrice: 300, category: 'Consultation' },
  { name: 'General Ward Bed (Per Day)', defaultPrice: 1500, category: 'Bed Stay' },
  { name: 'Semi-Private Bed (Per Day)', defaultPrice: 2500, category: 'Bed Stay' },
  { name: 'Private Room Bed (Per Day)', defaultPrice: 3500, category: 'Bed Stay' },
  { name: 'ICU Bed Stay (Per Day)', defaultPrice: 4500, category: 'Bed Stay' },
  { name: 'Emergency / Day Care Bed (Per Day)', defaultPrice: 1000, category: 'Bed Stay' },
];

export default function FinanceBillingView({ onNavigate, data }: { onNavigate: (p: string, d?: any) => void; data?: any }) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [bills, setBills] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState('0');
  const [payMode, setPayMode] = useState('Cash');
  const [paidAmount, setPaid] = useState('');
  const [isManualPaid, setIsManualPaid] = useState(false);
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

  function getStayDailyRate(ward?: string, bedType?: string): number {
    const w = (ward || '').toLowerCase();
    const t = (bedType || '').toLowerCase();
    if (w.includes('icu') || t.includes('icu')) return 4500;
    if (w.includes('semi') || t.includes('semi')) return 2500;
    if (w.includes('private') || t.includes('private')) return 3500;
    if (w.includes('emergency') || t.includes('emergency') || w.includes('day') || t.includes('day')) return 1000;
    return 1500;
  }

  async function fetchBedStays() {
    setLoadingStays(true);
    try {
      const res = await apiClient.get('/beds/history');
      setBedStays(res.data || []);
    } catch (err) {
      console.error('Failed to fetch bed stays:', err);
    } finally {
      setLoadingStays(false);
    }
  }

  useEffect(() => {
    fetchBills();
    fetchPatients();
    fetchBedStays();
  }, []);

  useEffect(() => {
    if (syncCount > 0) {
      fetchBills();
      fetchPatients();
      fetchBedStays();
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
      const found = patients.find(p => p.id === data.patientId);
      if (found) setPatientSearchTerm(`${found.name} (${found.uhid || 'No UHID'})`);
    }
    if (data?.showAdd) {
      setShowAdd(true);
    }
  }, [data?.patientId, data?.showAdd, patients]);

  function handleBillStay(stay: any) {
    setPatientId(stay.patient_id);
    const pat = patients.find(p => p.id === stay.patient_id);
    if (pat) setPatientSearchTerm(`${pat.name} (${pat.uhid || 'No UHID'})`);
    const rate = getStayDailyRate(stay.ward, stay.bed_type);
    const days = stay.stay_days || 1;
    setItems([{
      description: `Bed Stay: Room ${stay.room || ''} (${stay.bed_number || ''}) — ${stay.ward || 'General'} Ward (${days} days @ ₹${rate}/day)`,
      quantity: days,
      unit_price: rate,
      amount: days * rate,
    }]);
    setDiscount('0');
    setPaid('');
    setIsManualPaid(false);
    setNotes(`Bed stay charges for Room ${stay.room || ''} (${stay.bed_number || ''}) — Admitted: ${stay.admitted_at ? new Date(stay.admitted_at).toLocaleDateString('en-IN') : '—'}, Discharged: ${stay.discharged_at ? new Date(stay.discharged_at).toLocaleDateString('en-IN') : 'Today'}`);
    setShowAdd(true);
  }

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recordPaymentBill) return;
    
    const net = Number(recordPaymentBill.net_amount) || 0;
    const currentPaid = Number(recordPaymentBill.paid_amount) || 0;
    const dueAmount = Number(recordPaymentBill.balance_due) !== undefined ? Number(recordPaymentBill.balance_due) : Math.max(0, net - currentPaid);
    
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

  // Auto-sync paid amount to net total unless user has manually customized it
  useEffect(() => {
    if (!isManualPaid) {
      setPaid(net > 0 ? String(net) : '');
    }
  }, [net, isManualPaid]);

  const setItem = (i: number, k: string, v: any) => {
    setItems(ms => ms.map((m, j) => {
      if (j !== i) return m;
      const updated = { ...m, [k]: v };
      if (k === 'description') {
        const foundPreset = PRESET_SERVICES.find(ps => ps.name.toLowerCase() === String(v).trim().toLowerCase());
        if (foundPreset && (m.unit_price === 0 || !m.unit_price)) {
          updated.unit_price = foundPreset.defaultPrice;
        }
      }
      if (k === 'quantity' || k === 'unit_price' || k === 'description') {
        const q = k === 'quantity' ? Number(v) || 1 : Number(updated.quantity) || 1;
        const u = k === 'unit_price' ? Number(v) || 0 : Number(updated.unit_price) || 0;
        updated.amount = q * u;
      }
      return updated;
    }));
  };

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

  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return patients;
    const q = patientSearchTerm.toLowerCase().trim();
    return patients.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.uhid?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  }, [patients, patientSearchTerm]);

  const selectedPatientObj = useMemo(() => {
    return patients.find(p => p.id === patientId) || null;
  }, [patients, patientId]);

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return alert('Please search and select a patient first.');
    const validItems = items.filter(i => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) return alert('Please add at least one valid billing item with a description and amount.');
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
      setPatientId('');
      setPatientSearchTerm('');
      setShowPatientDropdown(false);
      setItems([{ ...EMPTY_ITEM }]);
      setDiscount('0');
      setPaid('');
      setIsManualPaid(false);
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

      {/* View Mode Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid var(--border-light)', paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('opd')}
          className={`btn btn-sm ${activeTab === 'opd' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 8 }}
        >
          All Invoices & Payments ({bills.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('bed'); fetchBedStays(); }}
          className={`btn btn-sm ${activeTab === 'bed' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          Bed Stay Billing Records (IPD)
          {bedStays.filter(s => s.billing_status !== 'Billed').length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {bedStays.filter(s => s.billing_status !== 'Billed').length} Unbilled
            </span>
          )}
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {activeTab === 'opd' ? (
          <>
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
          </>
        ) : (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Bed Stay Admissions & Billing Records</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Audit trail of inpatient stays, stay durations, daily rates, and billing settlements</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={fetchBedStays}>
                Refresh Stays
              </button>
            </div>

            {loadingStays ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
            ) : bedStays.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No bed stay admission records found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Room & Bed</th>
                    <th>Ward</th>
                    <th>Admitted</th>
                    <th>Discharged</th>
                    <th>Duration</th>
                    <th>Rate & Total</th>
                    <th>Billing Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bedStays.map((stay, idx) => {
                    const rate = getStayDailyRate(stay.ward, stay.bed_type);
                    const days = stay.stay_days || 1;
                    const estimatedTotal = days * rate;
                    const isBilled = stay.billing_status === 'Billed';

                    return (
                      <tr key={stay.id || idx}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{stay.patient_name || 'Inpatient'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>UHID: {stay.patient_uhid || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>Room {stay.room || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bed: {stay.bed_number || '—'}</div>
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: 11 }}>{stay.ward || 'General'}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {stay.admitted_at ? new Date(stay.admitted_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {stay.discharged_at ? new Date(stay.discharged_at).toLocaleDateString('en-IN') : (
                            <span className="badge badge-success" style={{ fontSize: 10 }}>Currently Admitted</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {days} day{days !== 1 ? 's' : ''}
                        </td>
                        <td>
                          <div>₹{rate}/day</div>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 11.5 }}>
                            Est. Total: ₹{estimatedTotal.toLocaleString('en-IN')}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isBilled ? 'badge-success' : 'badge-warning'}`}>
                            {isBilled ? 'Billed' : 'Unbilled'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={`btn btn-sm ${isBilled ? 'btn-ghost' : 'btn-primary'}`}
                            onClick={() => handleBillStay(stay)}
                          >
                            {isBilled ? 'Re-generate Bill' : 'Create Bed Invoice'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
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
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Hospital Invoice</div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBill}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '76vh', overflowY: 'auto' }}>
                
                {/* Datalist for preset service descriptions */}
                <datalist id="common-billing-services">
                  {PRESET_SERVICES.map(ps => (
                    <option key={ps.name} value={ps.name}>₹{ps.defaultPrice} ({ps.category})</option>
                  ))}
                  {doctorInfo && (doctorInfo.consultation_fee || doctorInfo.consultationFee) > 0 && (
                    <option value={`Consultation Fee — ${doctorInfo.name || 'Doctor'}`}>
                      ₹{doctorInfo.consultation_fee || doctorInfo.consultationFee} (Doctor Fee)
                    </option>
                  )}
                </datalist>

                {/* Patient Search & Autocomplete Dropdown */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Search & Select Patient *</span>
                    {selectedPatientObj && (
                      <span style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>Selected: {selectedPatientObj.name}</span>
                    )}
                  </label>

                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      placeholder="Type letters to search patient by name, UHID, or phone..."
                      value={patientSearchTerm}
                      onChange={e => {
                        setPatientSearchTerm(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      style={{ paddingLeft: 34, paddingRight: patientId ? 70 : 12, borderRadius: 8, height: 40, fontSize: 13.5 }}
                    />
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    </div>
                    {patientId && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setPatientId('');
                          setPatientSearchTerm('');
                          setShowPatientDropdown(true);
                        }}
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--danger)', padding: '2px 8px', fontSize: 11, fontWeight: 600 }}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {showPatientDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
                      maxHeight: 220,
                      overflowY: 'auto',
                      zIndex: 1050,
                    }}>
                      {filteredPatients.length === 0 ? (
                        <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                          No patients found matching "{patientSearchTerm}".
                        </div>
                      ) : (
                        filteredPatients.slice(0, 15).map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setPatientId(p.id);
                              setPatientSearchTerm(`${p.name} (${p.uhid || 'No UHID'})`);
                              setShowPatientDropdown(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderBottom: '1px solid var(--border-light)',
                              cursor: 'pointer',
                              background: p.id === patientId ? '#f0fdfa' : '#ffffff',
                              transition: 'background 0.12s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                            onMouseLeave={e => (e.currentTarget.style.background = p.id === patientId ? '#f0fdfa' : '#ffffff')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: '#ccfbf1', color: '#0f766e',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, flexShrink: 0
                              }}>
                                {p.name ? p.name.trim().charAt(0).toUpperCase() : 'P'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {p.phone ? `Phone: ${p.phone} • ` : ''}{p.age ? `${p.age}y / ${p.sex || 'M'}` : (p.sex || '')}
                                </div>
                              </div>
                            </div>
                            <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {p.uhid || 'NO-UHID'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Selected Patient Information Card */}
                  {selectedPatientObj && (
                    <div style={{
                      marginTop: 8,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      border: '1px solid var(--border-light)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{selectedPatientObj.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>UHID: <strong style={{ fontFamily: 'monospace' }}>{selectedPatientObj.uhid || '—'}</strong></span>
                        {selectedPatientObj.phone && <span style={{ color: 'var(--text-muted)' }}>Phone: {selectedPatientObj.phone}</span>}
                      </div>
                      {doctorInfo && (
                        <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>
                          Attending: {doctorInfo.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Add Preset Services & Saved Pricing Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Quick Preloaded Services & Saved Prices (Click to Add):
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {doctorInfo && (doctorInfo.consultation_fee || doctorInfo.consultationFee) > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => addReadyItem(`Consultation Fee — ${doctorInfo.name || 'Doctor'}`, doctorInfo.consultation_fee || doctorInfo.consultationFee)}
                        style={{ borderRadius: 16, fontSize: 11.5, padding: '4px 10px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', cursor: 'pointer' }}
                      >
                        + Dr. Consultation (₹{doctorInfo.consultation_fee || doctorInfo.consultationFee})
                      </button>
                    )}
                    {PRESET_SERVICES.map(ps => (
                      <button
                        key={ps.name}
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => addReadyItem(ps.name, ps.defaultPrice)}
                        style={{ borderRadius: 16, fontSize: 11.5, padding: '4px 10px', background: '#ffffff', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        + {ps.name} (₹{ps.defaultPrice})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items list */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Invoice Items & Charges</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Total: ₹{total}</span>
                  </label>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1.2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Service description (type or pick from list)"
                        list="common-billing-services"
                        value={item.description}
                        onChange={e => setItem(i, 'description', e.target.value)}
                        required
                        style={{ fontSize: 13 }}
                      />
                      <input
                        className="input"
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => setItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        required
                        style={{ fontSize: 13, textAlign: 'center' }}
                      />
                      <input
                        className="input"
                        type="number"
                        min="0"
                        placeholder="Unit Price (₹)"
                        value={item.unit_price}
                        onChange={e => setItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        required
                        style={{ fontSize: 13 }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right', paddingRight: 6 }}>
                        ₹{(Number(item.quantity) || 1) * (Number(item.unit_price) || 0)}
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', padding: '4px 8px' }}
                          onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { ...EMPTY_ITEM }])} style={{ marginTop: 4 }}>
                    + Add Another Item
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Discount (₹)</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Paid Amount (₹)</label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setIsManualPaid(false);
                          setPaid(net > 0 ? String(net) : '');
                        }}
                        style={{ padding: '0 6px', fontSize: 11, color: 'var(--primary)', fontWeight: 600, minHeight: 'auto' }}
                      >
                        Auto-Fill Total (₹{net})
                      </button>
                    </div>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={e => {
                        setIsManualPaid(true);
                        setPaid(e.target.value);
                      }}
                      placeholder={`Total: ₹${net}`}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Mode</label>
                  <select className="input" value={payMode} onChange={e => setPayMode(e.target.value)}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Notes & Observations</label>
                  <textarea className="input" rows={2} placeholder="Additional billing notes..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14 }}>
                  Net Total: <strong style={{ color: 'var(--primary)', fontSize: 16 }}>₹{net}</strong>
                  {paid > 0 && paid < net && (
                    <span style={{ fontSize: 12, color: 'var(--danger)', marginLeft: 8 }}>
                      (Due: ₹{Math.max(0, net - paid)})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Generating Invoice...' : `Create Invoice (Net: ₹${net})`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
