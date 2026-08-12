import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function BillingDashboard({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const [allBills, setAllBills]         = useState<any[]>([]);
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [patientsMap, setPatientsMap]   = useState<Record<string, any>>({});
  const [loading, setLoading]           = useState(true);

  const loadBillingData = useCallback(async () => {
    try {
      const [billsRes, patRes] = await Promise.allSettled([
        apiClient.get('/billing'),
        apiClient.get('/patients?limit=200')
      ]);

      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
        const pMap: Record<string, any> = {};
        patRes.value.data.forEach((p: any) => { pMap[p.id] = p; });
        setPatientsMap(pMap);
      }

      if (billsRes.status === 'fulfilled' && Array.isArray(billsRes.value.data)) {
        const bills = billsRes.value.data;
        setAllBills(bills);
        setPendingBills(bills.filter((b: any) => b.payment_status === 'Pending' || b.payment_status === 'Partial'));
      }
    } catch (err) {
      console.error('Error loading billing dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /> Loading Finance & Billing Dashboard...</div>;

  const totalCollected = allBills.reduce((acc, b) => acc + (Number(b.paid_amount) || 0), 0);
  const totalOutstanding = pendingBills.reduce((acc, b) => acc + ((Number(b.net_amount) || 0) - (Number(b.paid_amount) || 0)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Welcome Banner */}
      <div className="card" style={{
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '1px solid #a7f3d0',
        padding: '24px 28px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#047857',
            background: '#d1fae5',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            marginBottom: 8
          }}>
            # Finance & Billing Dashboard
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name?.split(' ')[0] || 'Finance Officer'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400, maxWidth: 640 }}>
            Track hospital revenue, outstanding invoices, patient billings, and payment settlements – everything finance needs, one screen.
          </p>
        </div>

        {/* User Profile Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '3px solid #fff',
          boxShadow: 'var(--shadow-md)',
          background: '#d1fae5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: '#047857',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name ? user.name[0].toUpperCase() : 'F'
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Metric 1: TOTAL REVENUE COLLECTED */}
        <div 
          onClick={() => onNavigate('billing')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Revenue Collected</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)', marginTop: 8, lineHeight: 1 }}>₹{Math.round(totalCollected).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Payment settlements received</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>

        {/* Metric 2: TOTAL OUTSTANDING DUE */}
        <div 
          onClick={() => onNavigate('billing')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Outstanding Due</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)', marginTop: 8, lineHeight: 1 }}>₹{Math.round(totalOutstanding).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Across pending invoices</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>

        {/* Metric 3: PENDING INVOICES */}
        <div 
          onClick={() => onNavigate('billing')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pending Invoices</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{pendingBills.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Awaiting collection</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>

        {/* Metric 4: TOTAL INVOICES ISSUED */}
        <div 
          onClick={() => onNavigate('billing')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Invoices Issued</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{allBills.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Total billing records</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <h3 className="section-label" style={{ marginBottom: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Finance Quick Actions</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16
        }}>
          {/* Billing Action 1: Create Invoice */}
          <div 
            onClick={() => onNavigate('billing', { showAdd: true })}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Create Patient Invoice</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Bill OPD / consultation</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Billing Action 2: Record Payment */}
          <div 
            onClick={() => onNavigate('billing')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Record Payment</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Process pending dues</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Billing Action 3: Bed Stay Billing */}
          <div 
            onClick={() => onNavigate('billing', { tab: 'bed' })}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Bed Stay Settlements</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Discharge & IPD billing</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Billing Action 4: Pharmacy Billing */}
          <div 
            onClick={() => onNavigate('pharmacy')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Pharmacy Billing</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Medication sales</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>
        </div>
      </div>

      {/* Main Content Section: Invoices Table */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Outstanding & Recent Invoices</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {pendingBills.length} pending or partial payment invoice(s)
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ fontSize: 12.5, fontWeight: 600 }}
            onClick={() => onNavigate('billing')}
          >
            View All Invoices ↗
          </button>
        </div>
        <div style={{ padding: 0 }}>
          {pendingBills.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 8, color: 'var(--success)' }}>✓</div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>All Bills Settled</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>There are no outstanding invoices requiring payment collection.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice #</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Total</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBills.slice(0, 10).map((b: any) => {
                    const due = b.net_amount - (b.paid_amount || 0);
                    const patName = b.patient_name || patientsMap[b.patient_id]?.name || '—';
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700 }}>#{b.invoice_number || b.id.slice(0, 8)}</td>
                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>{patName}</td>
                        <td style={{ padding: '14px 20px' }}>₹{b.net_amount}</td>
                        <td style={{ padding: '14px 20px', color: 'var(--success)', fontWeight: 600 }}>₹{b.paid_amount || 0}</td>
                        <td style={{ padding: '14px 20px', color: 'var(--danger)', fontWeight: 700 }}>₹{due}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${b.payment_status === 'Partial' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                            {b.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 12px', fontSize: 12, minHeight: 28 }}
                            onClick={() => onNavigate('billing', { patientId: b.patient_id })}
                          >
                            Record Payment
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
      </div>

    </div>
  );
}
