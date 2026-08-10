// client/src/pages/PrescriptionsListPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { printPrescriptionSlip } from '../utils/printTemplates';
import { sendPrintRequestToReceptionist } from '../utils/printRequest';
import { useAuthStore } from '../store/authStore';

interface Rx {
  id: string; patient_name: string; uhid: string; doctor_name: string;
  medicines: any[]; advice: string; follow_up_date: string;
  slip_token: string; created_at: string;
}

export default function PrescriptionsListPage({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const user = useAuthStore(s => s.user);
  const [rxList, setRxList]   = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
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

  const visible = rxList.filter(rx => {
    const q = search.toLowerCase();
    return !q || rx.patient_name?.toLowerCase().includes(q) || rx.uhid?.toLowerCase().includes(q) || rx.doctor_name?.toLowerCase().includes(q);
  });

  function printSlip(rx: Rx) {
    const meds = Array.isArray(rx.medicines)
      ? rx.medicines
      : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);
    printPrescriptionSlip({
      doctor: {
        name: rx.doctor_name,
        role: (rx as any).doctor_role || 'Doctor',
        letterhead: (rx as any).doctor_letterhead || undefined,
        signatureImage: (rx as any).doctor_signature || undefined,
        qualification: (rx as any).doctor_qualification || undefined,
        regNo: (rx as any).doctor_registration_number || undefined
      },
      patient: {
        name: rx.patient_name,
        uhid: rx.uhid,
        age: (rx as any).age,
        sex: (rx as any).sex,
        blood_group: (rx as any).blood_group,
        allergies: (rx as any).allergies
      },
      medicines: meds.map((m: any) => ({
        name: m.name,
        strength: m.strength || '',
        dose: m.dose || m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || (m.duration_days ? `${m.duration_days} days` : ''),
        instructions: m.instructions || '',
        composition: m.composition || ''
      })),
      advice: rx.advice,
      followUp: rx.follow_up_date,
      weight: (rx as any).weight,
      slipToken: rx.slip_token,
      vitals: ((rx as any).bp_systolic || (rx as any).heart_rate || (rx as any).vit_height || (rx as any).vit_weight || (rx as any).bmi) ? {
        bp: (rx as any).bp_systolic && (rx as any).bp_diastolic ? `${(rx as any).bp_systolic}/${(rx as any).bp_diastolic}` : undefined,
        pulse: (rx as any).heart_rate ? String((rx as any).heart_rate) : undefined,
        height: (rx as any).vit_height ? String((rx as any).vit_height) : undefined,
        weight: (rx as any).vit_weight ? String((rx as any).vit_weight) : undefined,
        bmi: (rx as any).bmi ? String((rx as any).bmi) : undefined
      } : undefined,
      complaints: (rx as any).chief_complaint ? (rx as any).chief_complaint.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
      history: (rx as any).history || undefined,
      investigations: (rx as any).recent_investigations || (rx as any).investigations || undefined,
      diagnosis: (() => {
        const diag = (rx as any).encounter_diagnosis;
        if (!diag) return undefined;
        try {
          const parsed = JSON.parse(diag);
          if (Array.isArray(parsed)) {
            return parsed.map((d: any) => d.name || d.code || d).join(', ');
          }
        } catch {}
        return String(diag);
      })(),
      examination: (rx as any).examination || undefined,
      showDiagnosisOnPrint: (rx as any).doctor_show_diagnosis_on_print !== undefined ? (rx as any).doctor_show_diagnosis_on_print : user?.showDiagnosisOnPrint,
      showInvestigationsOnPrint: (rx as any).doctor_show_investigations_on_print !== undefined ? (rx as any).doctor_show_investigations_on_print : user?.showInvestigationsOnPrint,
      showVitalsOnPrint: (rx as any).doctor_show_vitals_on_print !== undefined ? (rx as any).doctor_show_vitals_on_print : user?.showVitalsOnPrint,
      printMarginTop: (rx as any).doctor_print_margin_top !== undefined ? (rx as any).doctor_print_margin_top : user?.printMarginTop,
      printMarginBottom: (rx as any).doctor_print_margin_bottom !== undefined ? (rx as any).doctor_print_margin_bottom : user?.printMarginBottom,
      printMarginLeftRight: (rx as any).doctor_print_margin_left_right !== undefined ? (rx as any).doctor_print_margin_left_right : user?.printMarginLeftRight,
      printFontSize: (rx as any).doctor_print_font_size !== undefined ? (rx as any).doctor_print_font_size : user?.printFontSize,
      prePrinted: prePrintedLetterhead
    });
  }

  async function handleSendToReceptionist(rx: Rx) {
    const meds = Array.isArray(rx.medicines)
      ? rx.medicines
      : (typeof rx.medicines === 'string' ? (() => { try { return JSON.parse(rx.medicines); } catch { return []; } })() : []);

    await sendPrintRequestToReceptionist({
      patient_name: rx.patient_name || '—',
      uhid: rx.uhid || '—',
      age: (rx as any).age,
      sex: (rx as any).sex,
      blood_group: (rx as any).blood_group,
      doctor_name: rx.doctor_name || user?.name || 'Doctor',
      doctor_role: (rx as any).doctor_role || user?.role || 'Doctor',
      doctor_qualification: (rx as any).doctor_qualification || user?.qualification || undefined,
      doctor_reg: (rx as any).doctor_registration_number || user?.registrationNumber || undefined,
      slip_token: rx.slip_token || 'RX-SLIP',
      medicines: meds.map((m: any) => ({
        name: m.name,
        strength: m.strength || '',
        dose: m.dose || m.dosage || '1 tablet',
        frequency: m.frequency || 'Once daily',
        duration: m.duration || (m.duration_days ? `${m.duration_days} days` : ''),
        instructions: m.instructions || ''
      })),
      advice: rx.advice,
      follow_up: rx.follow_up_date,
      weight: (rx as any).weight
    });

    alert('🖨️ Print request sent to Receptionist desk successfully!');
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="form-input" placeholder="Search patient, UHID, doctor…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
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
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
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
                      <th style={{ width: 190, textAlign: 'right' }}>Actions</th>
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
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }} onClick={ev => { ev.stopPropagation(); printSlip(rx); }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                Print
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', fontWeight: 600, padding: '4px 10px', fontSize: 12 }} onClick={ev => { ev.stopPropagation(); handleSendToReceptionist(rx); }}>
                                🖨️ Receptionist
                              </button>
                            </div>
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
