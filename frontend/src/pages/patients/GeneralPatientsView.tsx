// client/src/pages/patients/GeneralPatientsView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';

export default function GeneralPatientsView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isDoctor = user?.role === 'doctor';
  const isBilling = user?.role?.toLowerCase().includes('billing') || user?.role?.toLowerCase().includes('finance');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/patients', { params: { limit: 200 } });
        setPatients(Array.isArray(res.data) ? res.data : (res.data?.patients || []));
      } catch {
        const local = await db.patients.toArray();
        setPatients(local);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = patients.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.uhid?.toLowerCase().includes(q) || p.phone?.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
              {isBilling ? 'Finance & Revenue' : 'Care Management'}
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>
              {isBilling ? 'Billing & Invoice Patient Directory' : 'Patient Directory'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {isBilling ? 'Access patient billing details, outstanding invoices, and payment histories.' : 'Manage records, filter by status, and take action on each patient.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ margin: 0, padding: 16 }}>
        <input
          className="input"
          placeholder="Search patients by name, UHID, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No patients found matching filter.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UHID</th>
                <th>Patient Name</th>
                <th>Age / Sex</th>
                <th>Phone</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id}>
                  <td><code>{p.uhid}</code></td>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td>{p.age || '—'} yrs / {p.gender || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : 'Recently'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onNavigate?.('patient_detail', { patientId: p.id })}>
                      {isBilling ? 'Billing Details' : 'View Record'}
                    </button>
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
