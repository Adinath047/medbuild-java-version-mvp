// client/src/pages/patients/LabReferredPatientsView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';

export default function LabReferredPatientsView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [labReferredIds, setLabReferredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const vitalsRes = await apiClient.get('/vitals');
        const ids = new Set<string>();
        (vitalsRes.data || []).forEach((v: any) => {
          if (v.patient_id && (v.notes?.toLowerCase().includes('lab') || v.notes?.toLowerCase().includes('test') || v.blood_sugar)) {
            ids.add(v.patient_id);
          }
        });
        setLabReferredIds(ids);

        const patRes = await apiClient.get('/patients', { params: { limit: 200 } });
        const list = Array.isArray(patRes.data) ? patRes.data : (patRes.data?.patients || []);
        setPatients(list);
      } catch {
        const local = await db.patients.toArray();
        setPatients(local);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const referredList = patients.filter(p => 
    labReferredIds.has(p.id) || p.notes?.toLowerCase().includes('lab') || p.notes?.toLowerCase().includes('test')
  ).filter(p => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.uhid?.toLowerCase().includes(q) || p.phone?.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Diagnostics & Pathology</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Doctor-Referred Lab Patients</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Patients recommended for lab tests, blood work, and pathology investigations by attending doctors.</p>
      </div>

      <div className="card" style={{ margin: 0, padding: 16 }}>
        <input
          className="input"
          placeholder="Search doctor-referred lab patients by name, UHID, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : referredList.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No doctor-referred lab patients pending.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UHID</th>
                <th>Patient Name</th>
                <th>Age / Gender</th>
                <th>Phone</th>
                <th>Referral Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {referredList.map(p => (
                <tr key={p.id}>
                  <td><code>{p.uhid}</code></td>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td>{p.age || '—'} yrs / {p.gender || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-sec)' }}>{p.notes || 'Doctor Lab Requisition'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => onNavigate?.('patient_detail', { patientId: p.id })}>
                      Open Lab Sheet
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
