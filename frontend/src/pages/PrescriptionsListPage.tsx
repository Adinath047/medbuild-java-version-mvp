// client/src/pages/PrescriptionsListPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { printPrescriptionSlip } from '../utils/printTemplates';
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
  const [prePrinted, setPrePrinted] = useState(false);

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
    const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
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
      medicines: meds.map(m => ({
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
      prePrinted,
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
      printFontSize: (rx as any).doctor_print_font_size !== undefined ? (rx as any).doctor_print_font_size : user?.printFontSize
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Prescriptions</div>
          <div className="page-sub">{visible.length} prescription{visible.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('new_prescription')}>+ Write Prescription</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Search patient, UHID, doctor…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={prePrinted} onChange={e => setPrePrinted(e.target.checked)} />
            Print on pre-printed letterhead paper
          </label>
        </div>
      </div>

      <div className="card">
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
                <table>
                  <thead>
                    <tr><th>Slip #</th><th>Patient</th><th>Doctor</th><th>Medicines</th><th>Follow-up</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {visible.map(rx => {
                      const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
                      return (
                        <tr key={rx.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('patient_detail', { patientId: rx.id })}>
                          <td><code style={{ fontSize: 11, background: 'var(--surface-alt)', padding: '2px 6px', borderRadius: 4 }}>{rx.slip_token}</code></td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{rx.patient_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.uhid}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>{rx.doctor_name}</td>
                          <td style={{ fontSize: 12 }}>
                            {meds.slice(0, 2).map((m: any) => m.name).join(', ')}{meds.length > 2 ? ` +${meds.length - 2}` : ''}
                          </td>
                          <td style={{ fontSize: 12 }}>{rx.follow_up_date || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(rx.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={ev => { ev.stopPropagation(); printSlip(rx); }}>
                              🖨 Print
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
