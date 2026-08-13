// client/src/pages/prescriptions/ReceptionistPrescriptionsView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { printPrescriptionSlip } from '../../utils/printTemplates';

export default function ReceptionistPrescriptionsView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const [rxList, setRxList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/prescriptions?limit=100');
        setRxList(res.data || []);
      } catch {
        const local = await db.prescriptions.toArray();
        setRxList(local);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = rxList.filter(rx => {
    const q = search.toLowerCase();
    return !q || rx.patient_name?.toLowerCase().includes(q) || rx.uhid?.toLowerCase().includes(q) || rx.doctor_name?.toLowerCase().includes(q);
  });

  function handlePrint(rx: any) {
    const meds = Array.isArray(rx.medicines)
      ? rx.medicines
      : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);
    
    printPrescriptionSlip({
      doctor: { name: rx.doctor_name || 'Attending Doctor', role: rx.doctor_role || 'Doctor', qualification: rx.doctor_qualification, regNo: rx.doctor_registration_number },
      patient: { name: rx.patient_name || 'Patient', uhid: rx.uhid || '—', age: rx.age, sex: rx.sex, blood_group: rx.blood_group },
      medicines: meds.map((m: any) => ({
        name: m.name,
        strength: m.strength || '',
        dose: m.dose || m.dosage || '1 tablet',
        frequency: m.frequency || 'Once daily',
        duration: m.duration || (m.duration_days ? `${m.duration_days} days` : ''),
        instructions: m.instructions || ''
      })),
      advice: rx.advice,
      followUp: rx.follow_up_date,
      slipToken: rx.slip_token || 'RX-SLIP',
      prePrinted: false
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Prescriptions Desk</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Patient Prescription Records</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>View issued prescriptions and print official prescription slips for patients.</p>
      </div>

      <div className="card" style={{ margin: 0, padding: 16 }}>
        <input
          className="input"
          placeholder="Search prescriptions by patient name, UHID, or doctor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No prescriptions found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Slip #</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Medicines</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(rx => {
                const meds = Array.isArray(rx.medicines)
                  ? rx.medicines
                  : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);
                return (
                  <tr key={rx.id}>
                    <td><code>{rx.slip_token || 'RX-SLIP'}</code></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{rx.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.uhid}</div>
                    </td>
                    <td>{rx.doctor_name}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-sec)' }}>
                      {meds.slice(0, 2).map((m: any) => m.name).join(', ')}{meds.length > 2 ? ` +${meds.length - 2}` : ''}
                    </td>
                    <td>{new Date(rx.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handlePrint(rx)}>
                        Print Slip
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
