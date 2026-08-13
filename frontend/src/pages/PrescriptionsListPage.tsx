// client/src/pages/PrescriptionsListPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { printPrescriptionSlip } from '../utils/printTemplates';
import ReceptionistPrescriptionsView from './prescriptions/ReceptionistPrescriptionsView';

interface Rx {
  id: string;
  patient_name?: string;
  uhid?: string;
  doctor_name?: string;
  medicines: any;
  advice?: string;
  follow_up_date?: string;
  created_at: string;
  slip_token?: string;
}

export default function PrescriptionsListPage({ onNavigate }: { onNavigate: (page: string, data?: any) => void }) {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase() || '';
  const isDoctorOrAdmin = role === 'admin' || role.includes('doctor');

  const [rxList, setRxList] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [prePrintedLetterhead, setPrePrintedLetterhead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/prescriptions?limit=100');
      setRxList(res.data ?? []);
    } catch { setRxList([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!isDoctorOrAdmin) {
    return <ReceptionistPrescriptionsView onNavigate={onNavigate} />;
  }

  const visible = rxList.filter(rx => {
    const q = search.toLowerCase();
    return !q || rx.patient_name?.toLowerCase().includes(q) || rx.uhid?.toLowerCase().includes(q) || rx.doctor_name?.toLowerCase().includes(q);
  });

  function printSlip(rx: Rx) {
    const meds = Array.isArray(rx.medicines)
      ? rx.medicines
      : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);

    printPrescriptionSlip({
      doctor: { name: rx.doctor_name || user?.name || 'Doctor', role: (rx as any).doctor_role || user?.role || 'Doctor', qualification: (rx as any).doctor_qualification || user?.qualification, regNo: (rx as any).doctor_registration_number || user?.registrationNumber },
      patient: { name: rx.patient_name || '—', uhid: rx.uhid || '—', age: (rx as any).age, sex: (rx as any).sex, blood_group: (rx as any).blood_group },
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
      weight: (rx as any).weight,
      slipToken: rx.slip_token || 'RX-SLIP',
      prePrinted: prePrintedLetterhead
    });
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Prescriptions</div>
          <div className="page-sub" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{visible.length} prescription{visible.length !== 1 ? 's' : ''} total</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('new_prescription')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Write Prescription
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <input className="form-input" placeholder="Search patient, UHID, doctor…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={prePrintedLetterhead} onChange={e => setPrePrintedLetterhead(e.target.checked)} />
            <span>Print on pre-printed letterhead</span>
          </label>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading
          ? <div className="loading-screen" style={{ height: 200 }}><div className="spinner" /></div>
          : visible.length === 0
            ? (
              <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 500 }}>No prescriptions found</p>
              </div>
            )
            : <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Slip #</th>
                      <th style={{ minWidth: 160 }}>Patient</th>
                      <th style={{ minWidth: 140 }}>Doctor</th>
                      <th style={{ minWidth: 160 }}>Medicines</th>
                      <th style={{ width: 110 }}>Follow-up</th>
                      <th style={{ width: 140 }}>Date</th>
                      <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(rx => {
                      const meds = Array.isArray(rx.medicines)
                        ? rx.medicines
                        : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);
                      return (
                        <tr key={rx.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('patient_detail', { patientId: rx.id })}>
                          <td><code style={{ fontSize: 11, background: 'var(--surface-alt)', padding: '3px 8px', borderRadius: 6, fontWeight: 600, color: 'var(--primary)' }}>{rx.slip_token}</code></td>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{rx.patient_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.uhid}</div>
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 500 }}>{rx.doctor_name}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                            {meds.slice(0, 2).map((m: any) => m.name).join(', ')}{meds.length > 2 ? ` +${meds.length - 2}` : ''}
                          </td>
                          <td style={{ fontSize: 12.5 }}>{rx.follow_up_date || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(rx.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }} onClick={ev => { ev.stopPropagation(); printSlip(rx); }}>
                              Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </>
  );
}
