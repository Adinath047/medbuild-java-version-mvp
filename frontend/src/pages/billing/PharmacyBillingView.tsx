// client/src/pages/billing/PharmacyBillingView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';
import { printInvoice, downloadInvoicePDF, exportBillingToCSV } from '../../utils/printTemplates';

export default function PharmacyBillingView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/billing');
        const pharmBills = (res.data || []).filter((b: any) => b.bill_type === 'pharmacy' || b.notes?.toLowerCase().includes('pharmacy') || b.notes?.toLowerCase().includes('medicine'));
        setBills(pharmBills);
      } catch {
        const local = await db.billing.toArray();
        setBills(local.filter((b: any) => b.bill_type === 'pharmacy'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleBills = bills.filter(b => {
    const q = search.toLowerCase();
    return !q || b.patient_name?.toLowerCase().includes(q) || b.uhid?.toLowerCase().includes(q) || b.invoice_number?.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Pharmacy Counter</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Pharmacy Sales & Prescription Billing</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Dispense medication, track OTC sales, and issue receipt slips for patient prescriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => exportBillingToCSV(visibleBills)}
              style={{ fontWeight: 600, padding: '10px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Download pharmacy sales CSV"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => onNavigate?.('prescriptions')} style={{ fontWeight: 600, padding: '10px 18px', borderRadius: 8 }}>
              View Prescription Queue
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ margin: 0, padding: 16 }}>
        <input
          className="input"
          placeholder="Search pharmacy sales by patient name, UHID, or invoice #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : visibleBills.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No pharmacy sales records found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Medicines / Items</th>
                <th>Net Total</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBills.map(b => (
                <tr key={b.id}>
                  <td><code>#{b.invoice_number || b.id.slice(0, 8)}</code></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.patient_name || 'Patient'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>UHID: {b.uhid || '—'}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{b.notes || 'Medication Dispensed'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{b.net_amount}</td>
                  <td>{b.payment_mode || 'Cash'}</td>
                  <td><span className="badge badge-success">{b.payment_status || 'Paid'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadInvoicePDF({
                          invoice: b,
                          patient: { name: b.patient_name || 'Patient', uhid: b.uhid || '—' },
                          items: b.items && b.items.length > 0 ? b.items : [{ description: b.notes || 'Medication Dispensed', quantity: 1, unit_price: b.net_amount || 0, amount: b.net_amount || 0 }],
                          billedBy: user?.name,
                          notes: b.notes
                        })}
                        title="Download Vector PDF"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        PDF
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => printInvoice({
                        invoice: b,
                        patient: { name: b.patient_name || 'Patient', uhid: b.uhid || '—' },
                        items: b.items && b.items.length > 0 ? b.items : [{ description: b.notes || 'Medication Dispensed', quantity: 1, unit_price: b.net_amount || 0, amount: b.net_amount || 0 }],
                        totals: { total: b.gross_amount || b.net_amount || 0, discount: b.discount || 0, net: b.net_amount || 0, paid: b.paid_amount || 0 },
                        billedBy: user?.name,
                        notes: b.notes
                      })}>Print Receipt</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
