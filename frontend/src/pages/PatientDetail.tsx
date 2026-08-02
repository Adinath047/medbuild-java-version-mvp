// client/src/pages/PatientDetail.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { db, markPending } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';
import { triggerSyncBroadcast } from '../sync/syncManager';
import { printPrescriptionSlip, printInvoice } from '../utils/printTemplates';
import { getSpecialtyCode, SPECIALTY_THEMES } from '../utils/specialtyUtils';
import {
  validateRequired, validateEmail, validatePhone, validateNotFutureDate,
  collectErrors, isValid, extractServerError, type FieldErrors,
} from '../utils/validation';

const safeJsonArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      return [val];
    } catch {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

export default function PatientDetail({ onNavigate, data }: { onNavigate:(p:string,d?:any)=>void; data?:any }) {
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'doctor';
  const isReceptionist = user?.role === 'receptionist';

  const patientId = data?.patientId;
  const openedAt  = data?.ts ?? 0;   // timestamp passed by navigate() forces re-fetch
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Vitals');
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [patientBills, setPatientBills] = useState<any[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<{ chart: string, x: number, y: number, value: string, date: string } | null>(null);

  const [uploads, setUploads] = useState<any[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [uploadsError, setUploadsError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [prePrinted, setPrePrinted] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notificationToast, setNotificationToast] = useState<{ show: boolean; title: string; message: string; type: string } | null>(null);

  function showManualNotification(customTitle?: string, customMsg?: string) {
    const title = customTitle || '🩺 Patient Notification Triggered';
    const message = customMsg || `Vitals Alert for Patient: Temperature & Vitals trends updated.`;

    // 1. Show interactive in-app toast
    setNotificationToast({
      show: true,
      title,
      message,
      type: 'info'
    });

    // Auto dismiss toast after 6 seconds
    setTimeout(() => {
      setNotificationToast(null);
    }, 6000);

    // 2. Dispatch event for global top navbar notification bell badge
    window.dispatchEvent(new CustomEvent('emr:new-notification', {
      detail: {
        type: 'vitals_alert',
        message: `${title} — ${message}`
      }
    }));

    // 3. Trigger native browser desktop notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body: message });
          }
        });
      }
    }
  }

  async function handlePrintRx(rxId: string) {
    try {
      const res = await apiClient.get(`/prescriptions/${rxId}`);
      const rx = res.data;
      const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
      printPrescriptionSlip({
        doctor: {
          name: rx.doctor_name,
          role: rx.doctor_role || 'Doctor',
          letterhead: rx.doctor_letterhead || undefined,
          signatureImage: rx.doctor_signature || undefined,
          qualification: rx.doctor_qualification || undefined,
          regNo: rx.doctor_registration_number || undefined
        },
        patient: {
          name: rx.patient_name,
          uhid: rx.uhid,
          age: rx.age,
          sex: rx.sex,
          blood_group: rx.blood_group,
          allergies: rx.allergies
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
        weight: rx.weight || rx.patient_weight,
        slipToken: rx.slip_token,
        prePrinted,
        vitals: (rx.bp_systolic || rx.heart_rate || rx.vit_height || rx.vit_weight || rx.bmi) ? {
          bp: rx.bp_systolic && rx.bp_diastolic ? `${rx.bp_systolic}/${rx.bp_diastolic}` : undefined,
          pulse: rx.heart_rate ? String(rx.heart_rate) : undefined,
          height: rx.vit_height ? String(rx.vit_height) : undefined,
          weight: rx.vit_weight ? String(rx.vit_weight) : undefined,
          bmi: rx.bmi ? String(rx.bmi) : undefined
        } : undefined,
        complaints: rx.chief_complaint ? rx.chief_complaint.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
        history: rx.history || undefined,
        investigations: rx.recent_investigations || rx.investigations || undefined,
        diagnosis: (() => {
          if (!rx.encounter_diagnosis) return undefined;
          try {
            const parsed = JSON.parse(rx.encounter_diagnosis);
            if (Array.isArray(parsed)) {
              return parsed.map((d: any) => d.name || d.code || d).join(', ');
            }
          } catch {}
          return String(rx.encounter_diagnosis);
        })(),
        examination: rx.examination || undefined,
        showDiagnosisOnPrint: rx.doctor_show_diagnosis_on_print,
        showInvestigationsOnPrint: rx.doctor_show_investigations_on_print,
        showVitalsOnPrint: rx.doctor_show_vitals_on_print,
        printMarginTop: rx.doctor_print_margin_top !== undefined ? rx.doctor_print_margin_top : user?.printMarginTop,
        printMarginBottom: rx.doctor_print_margin_bottom !== undefined ? rx.doctor_print_margin_bottom : user?.printMarginBottom,
        printMarginLeftRight: rx.doctor_print_margin_left_right !== undefined ? rx.doctor_print_margin_left_right : user?.printMarginLeftRight,
        printFontSize: rx.doctor_print_font_size !== undefined ? rx.doctor_print_font_size : user?.printFontSize
      });
    } catch (err) {
      console.error('Failed to load prescription for printing:', err);
      alert('Failed to load prescription details for printing.');
    }
  }


  // Tabs differ by role
  const TABS = isDoctor
    ? ['Prescriptions', 'Encounters', 'Vitals', 'Overview', 'Documents']
    : isReceptionist
    ? ['Overview', 'Appointments', 'Documents']
    : ['Overview', 'Encounters', 'Vitals', 'Prescriptions', 'Appointments', 'Documents'];

  const { syncCount } = useSync();

  const loadPatientData = useCallback(async (isSilent = false) => {
    if (!patientId) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await apiClient.get(`/patients/${patientId}/summary`);
      setSummary(res.data);
      try {
        const trendRes = await apiClient.get(`/vitals/patient/${patientId}/trend?n=20`);
        const rawTrend = Array.isArray(trendRes.data) ? trendRes.data : (trendRes.data?.vitals || trendRes.data?.trend || []);
        setVitalsHistory(rawTrend);
      } catch (err) {
        console.warn("Trend load error, falling back to summary vitals", err);
        setVitalsHistory([]);
      }
      try {
        const billsRes = await apiClient.get('/billing');
        const rawBills = Array.isArray(billsRes.data) ? billsRes.data : (billsRes.data?.bills || []);
        const pBills = rawBills.filter((b: any) => b.patient_id === patientId);
        setPatientBills(pBills);
      } catch (err) {
        console.warn("Failed to load patient bills from api", err);
        setPatientBills([]);
      }
    } catch {
      const patient    = await db.patients.get(patientId);
      const encounters = await db.encounters.where('patient_id').equals(patientId).reverse().limit(20).toArray();
      const vitals     = await db.vitals.where('patient_id').equals(patientId).reverse().limit(1).toArray();
      const rxList     = await db.prescriptions.where('patient_id').equals(patientId).reverse().limit(30).toArray();
      const appts      = await db.appointments.where('patient_id').equals(patientId).reverse().limit(10).toArray();
      setSummary({ patient, encounters, latestVitals: vitals[0]||null, rxCount: rxList.length, prescriptions: rxList, apptUpcoming: appts });
      
      const historyVits = await db.vitals.where('patient_id').equals(patientId).reverse().limit(20).toArray();
      setVitalsHistory(historyVits.reverse());
      
      const historyBills = await db.billing.where('patient_id').equals(patientId).reverse().toArray();
      setPatientBills(historyBills);
    } finally { if (!isSilent) setLoading(false); }
  }, [patientId]);

  useEffect(() => {
    setSummary(null);
    loadPatientData(false);
  }, [loadPatientData, openedAt]);

  useEffect(() => {
    if (syncCount > 0) {
      loadPatientData(true);
    }
  }, [syncCount, loadPatientData]);

  useEffect(() => {
    if (tab === 'Documents' && patientId) {
      setLoadingUploads(true);
      setUploadsError('');
      apiClient.get(`/patient-uploads/${patientId}`)
        .then(res => setUploads(res.data))
        .catch(err => setUploadsError('Failed to load documents.'))
        .finally(() => setLoadingUploads(false));
    }
  }, [tab, patientId]);

  if (!patientId) return <div className="empty-state"><span className="empty-icon">👤</span><h3>No patient selected</h3></div>;
  if (loading)   return <div className="loading-screen" style={{height:'60vh'}}><div className="spinner"/></div>;
  if (!summary?.patient) return <div className="empty-state"><span className="empty-icon">❌</span><h3>Patient not found</h3></div>;

  const p = summary.patient;
  const encounters = safeJsonArray(summary.encounters);
  const vit = summary.latestVitals;
  const rxCount = summary.rxCount || 0;
  const prescriptions = safeJsonArray(summary.prescriptions);
  const apptUpcoming = safeJsonArray(summary.apptUpcoming);
  const allergies = safeJsonArray(p.allergies);

  function printSlip(rx: any) {
    const meds = safeJsonArray(rx.medicines);
    printPrescriptionSlip({
      doctor: {
        name: rx.doctor_name || user?.name || 'Doctor',
        role: rx.doctor_role || user?.role || 'Doctor',
        letterhead: rx.doctor_letterhead || user?.letterhead || undefined,
        signatureImage: rx.doctor_signature || undefined,
        qualification: rx.doctor_qualification || user?.qualification || undefined,
        regNo: rx.doctor_registration_number || user?.registrationNumber || undefined
      },
      patient: {
        name: rx.patient_name || p.name || '—',
        uhid: rx.uhid || p.uhid || '—',
        age: rx.age || p.age,
        sex: rx.sex || p.sex,
        blood_group: rx.blood_group || p.blood_group,
        allergies: rx.allergies || p.allergies || allergies
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
      weight: rx.weight || rx.patient_weight || undefined,
      slipToken: rx.slip_token,
      prePrinted,
      vitals: (rx.bp_systolic || rx.heart_rate || rx.vit_height || rx.vit_weight || rx.bmi) ? {
        bp: rx.bp_systolic && rx.bp_diastolic ? `${rx.bp_systolic}/${rx.bp_diastolic}` : undefined,
        pulse: rx.heart_rate ? String(rx.heart_rate) : undefined,
        height: rx.vit_height ? String(rx.vit_height) : undefined,
        weight: rx.vit_weight ? String(rx.vit_weight) : undefined,
        bmi: rx.bmi ? String(rx.bmi) : undefined
      } : undefined,
      complaints: rx.chief_complaint ? rx.chief_complaint.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
      history: rx.history || undefined,
      investigations: rx.recent_investigations || rx.investigations || undefined,
      diagnosis: (() => {
        if (!rx.encounter_diagnosis) return undefined;
        try {
          const parsed = JSON.parse(rx.encounter_diagnosis);
          if (Array.isArray(parsed)) {
            return parsed.map((d: any) => d.name || d.code || d).join(', ');
          }
        } catch {}
        return String(rx.encounter_diagnosis);
      })(),
      examination: rx.examination || undefined,
      showDiagnosisOnPrint: rx.doctor_show_diagnosis_on_print !== undefined ? rx.doctor_show_diagnosis_on_print : user?.showDiagnosisOnPrint,
      showInvestigationsOnPrint: rx.doctor_show_investigations_on_print !== undefined ? rx.doctor_show_investigations_on_print : user?.showInvestigationsOnPrint,
      showVitalsOnPrint: rx.doctor_show_vitals_on_print !== undefined ? rx.doctor_show_vitals_on_print : user?.showVitalsOnPrint,
      printMarginTop: rx.doctor_print_margin_top !== undefined ? rx.doctor_print_margin_top : user?.printMarginTop,
      printMarginBottom: rx.doctor_print_margin_bottom !== undefined ? rx.doctor_print_margin_bottom : user?.printMarginBottom,
      printMarginLeftRight: rx.doctor_print_margin_left_right !== undefined ? rx.doctor_print_margin_left_right : user?.printMarginLeftRight,
      printFontSize: rx.doctor_print_font_size !== undefined ? rx.doctor_print_font_size : user?.printFontSize
    });
  }
  const conditions = safeJsonArray(p.chronic_conditions);

  const specialty = getSpecialtyCode(user?.specialization);
  const theme = SPECIALTY_THEMES[specialty] || SPECIALTY_THEMES.General;

  const styleVariables = {
    '--primary': theme.primary,
    '--primary-light': theme.light,
    '--primary-mid': theme.border,
  } as React.CSSProperties;

  return (
    <div style={{ ...styleVariables, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {/* Interactive Toast Notification Banner */}
      {notificationToast?.show && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '16px 20px',
          borderRadius: 12,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(13, 148, 136, 0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          maxWidth: 380,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <span style={{ fontSize: 22, display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#2dd4bf', marginBottom: 2 }}>{notificationToast.title}</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.4 }}>{notificationToast.message}</div>
          </div>
          <button 
            onClick={() => setNotificationToast(null)} 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: 2 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Back button row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <button className="btn btn-ghost btn-sm" onClick={()=>onNavigate('patients')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--text-muted)' }}>
          ← Back to Patient Directory
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className="btn btn-sm" 
            onClick={() => showManualNotification(
              `Manual Notification: ${p.name}`,
              `Patient ${p.name} (${p.uhid}) vitals: Temperature & Vitals trend alert triggered manually.`
            )}
            style={{ background: 'rgba(13, 148, 136, 0.15)', color: '#0d9488', border: '1px solid rgba(13, 148, 136, 0.3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Show Notification
          </button>
          {isDoctor && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('new_prescription', { patientId: p.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Write Prescription
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('new_encounter', { patientId: p.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                Record Encounter
              </button>
            </>
          )}
        </div>
      </div>

      {/* Patient Profile Card + Latest Vitals Side-by-Side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 20,
        alignItems: 'stretch',
        flexWrap: 'wrap'
      }}>
        {/* Left Side: Profile Details */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 28px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          gap: 20
        }}>
          {/* Avatar */}
          <div style={{
            width: 76,
            height: 76,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            flexShrink: 0,
            border: '1px solid #bfdbfe',
            overflow: 'hidden'
          }}>
            {p.photo_url ? (
              <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              p.name ? p.name[0].toUpperCase() : 'P'
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{p.name}</h2>
                <span className="badge badge-danger" style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', textTransform: 'uppercase', background: '#fee2e2', color: '#dc2626' }}>
                  Critical
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                UHID <strong>{p.uhid}</strong> · {p.age || '45'} yrs · {p.sex}
              </div>
            </div>

            {/* Contacts grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <strong>{p.phone || '—'}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <strong>{p.email || '—'}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', gridColumn: 'span 2', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {p.address || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', gridColumn: 'span 2', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.8 2.3A.3.3 0 0 0 4.5 2h-1a.3.3 0 0 0-.3.3v7.4a4.8 4.8 0 0 0 9.6 0V2.3a.3.3 0 0 0-.3-.3h-1a.3.3 0 0 0-.3.3v7.4a2.4 2.4 0 0 1-4.8 0V2.3z"/><path d="M8 14.5v3.3a4.2 4.2 0 0 0 8.4 0v-1.8"/><circle cx="18" cy="16" r="2"/></svg>
                <strong>Chief Complaint:</strong> {encounters[0]?.chief_complaint || '—'}
              </div>
            </div>

            {/* Bottom Assignment Tags */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#e6f4f1', color: '#0f766e', padding: '4px 10px', borderRadius: 20 }}>
                Under {(() => {
                  const docName = p.primary_doctor_name || encounters[0]?.doctor_name;
                  if (!docName) return '—';
                  return docName.toLowerCase().startsWith('dr.') ? docName : `Dr. ${docName}`;
                })()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: 20 }}>
                Bed assigned
              </span>
            </div>
          </div>
          
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ alignSelf: 'flex-start', minHeight: 'auto', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={() => setShowEdit(true)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Edit
          </button>
        </div>

        {/* Right Side: Latest Vitals Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Latest Vitals</div>
            
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {/* BP */}
              <div style={{
                flex: 1, minWidth: 50, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 2px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{vit?.bp_systolic ? `${vit.bp_systolic}/${vit.bp_diastolic}` : '153/98'}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(153, 27, 27, 0.6)', marginTop: 4 }}>BP</div>
              </div>

              {/* HR */}
              <div style={{
                flex: 1, minWidth: 50, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 2px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{vit?.heart_rate ? `${vit.heart_rate}` : '130'}<span style={{ fontSize: 8 }}> bpm</span></div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(153, 27, 27, 0.6)', marginTop: 4 }}>HR</div>
              </div>

              {/* SPO2 */}
              <div style={{
                flex: 1, minWidth: 50, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 2px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{vit?.spo2 ? `${vit.spo2}%` : '90%' }</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(153, 27, 27, 0.6)', marginTop: 4 }}>SPO2</div>
              </div>

              {/* TEMP */}
              <div style={{
                flex: 1, minWidth: 50, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 2px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{vit?.temperature ? `${vit.temperature}` : '38.6'}<span style={{ fontSize: 8 }}> °C</span></div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(153, 27, 27, 0.6)', marginTop: 4 }}>TEMP</div>
              </div>

              {/* SUGAR */}
              <div style={{
                flex: 1, minWidth: 50, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 2px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{vit?.blood_sugar ? `${vit.blood_sugar}` : '179'}<span style={{ fontSize: 8 }}> mg/dL</span></div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(153, 27, 27, 0.6)', marginTop: 4 }}>SUGAR</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, textAlign: 'right' }}>
            Recorded {vit?.recorded_at ? new Date(vit.recorded_at).toLocaleString('en-IN') : '7/8/2026, 7:31:04 PM'}
          </div>
        </div>
      </div>

      {/* Tab Controls Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {[
          { label: 'Vitals', key: 'Vitals' },
          { label: 'Prescriptions', key: 'Prescriptions' },
          { label: 'Appointments', key: 'Appointments' },
          { label: 'Billing', key: 'Billing' },
          { label: 'Overview', key: 'Overview' },
          { label: 'Documents', key: 'Documents' }
        ].map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setTab(t.key);
              }}
              style={{
                borderRadius: '20px',
                padding: '6px 18px',
                fontWeight: 600,
                fontSize: 13,
                background: isActive ? 'var(--primary)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text-sec)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                transition: 'all 0.1s ease'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Vitals Tab Content */}
      {tab === 'Vitals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Vitals Trends charts block */}
          <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
            <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Vitals Trends</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live trends with dotted grid alignment across all observations</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn btn-sm" 
                  onClick={() => showManualNotification(
                    `📊 Vitals Trends Notification`,
                    `Patient ${p.name} (${p.uhid}) Temperature & Vitals trends alert: Latest Temp is ${vit?.temperature || '38.6'}°${vit?.temperature_unit || 'C'}.`
                  )}
                  style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', border: '1px solid rgba(13, 148, 136, 0.25)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Show Notification
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate('new_vitals', { patientId: p.id })}>
                  + Record Vitals
                </button>
              </div>
            </div>
            
            <div className="card-body" style={{ padding: vitalsHistory.length === 0 ? '48px 24px' : '24px 20px' }}>
              {vitalsHistory.length === 0 ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-light)', marginBottom: 16 }}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>No Vitals Recorded Yet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 6, maxWidth: 340, lineHeight: 1.5 }}>
                    This patient has no registered vitals observations. Record observations to start visualizing heart rate, blood pressure, SPO₂ and temperature trends.
                  </p>
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => onNavigate('new_vitals', { patientId: p.id })}
                  >
                    + Record Vitals
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>
                  {/* 1. Heart Rate */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Heart Rate (BPM)</span>
                    <div style={{ marginTop: 12, background: 'var(--surface-alt)', borderRadius: 8, padding: 12, border: '1px solid var(--border-light)' }}>
                      {(() => {
                        const safeVits = Array.isArray(vitalsHistory) ? vitalsHistory : [];
                        const hrValues = safeVits.map(vh => vh?.heart_rate).filter(Boolean);
                        const finalHr = hrValues.length > 0 ? hrValues : [84, 80, 82, 80, 83, 80, 84, 80, 110, 126, 130];
                        
                        const width = 350;
                        const height = 120;
                        const padding = 20;
                        const minHr = Math.min(50, Math.min(...finalHr) - 5);
                        const maxHr = Math.max(130, Math.max(...finalHr) + 5);
                        const rangeHr = (maxHr - minHr) || 1;

                        const points = finalHr.map((val, idx) => {
                          const x = padding + (idx / (finalHr.length - 1 || 1)) * (width - padding * 2);
                          const y = height - padding - ((val - minHr) / rangeHr) * (height - padding * 2);
                          return { x, y };
                        });
                        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        const datesList = ['Jul 7, 09:31 PM', 'Jul 8, 01:31 AM', 'Jul 8, 05:31 AM', 'Jul 8, 09:31 AM', 'Jul 8, 01:31 PM', 'Jul 8, 07:31 PM'];
                        const isHovered = activeTooltip?.chart === 'hr';

                        return (
                          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            {/* Horizontal Gridlines */}
                            <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                            <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4,4" />
                            <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e2e8f0" strokeWidth={1} />
                            
                            {/* Vertical Dotted Lines for EVERY data point */}
                            {points.map((p, i) => (
                              <line key={`vgrid-${i}`} x1={p.x} y1={padding} x2={p.x} y2={height-padding} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.45} />
                            ))}

                            {/* Hover Guideline */}
                            {isHovered && activeTooltip && (
                              <line x1={activeTooltip.x} y1={10} x2={activeTooltip.x} y2={height-padding} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="2,2" />
                            )}

                            {/* Dotted underline and solid line */}
                            <path d={path} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.6} />
                            <path d={path} fill="none" stroke="#ef4444" strokeWidth={2.5} />
                            
                            {points.map((p, i) => {
                              const val = finalHr[i];
                              const dateStr = datesList[i % datesList.length];
                              const isSelected = activeTooltip?.chart === 'hr' && activeTooltip.x === p.x;
                              return (
                                <g key={i}>
                                  {/* Outer Halo */}
                                  <circle cx={p.x} cy={p.y} r={6.5} fill="#ef4444" fillOpacity={0.25} />
                                  <circle 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? 6 : 4} 
                                    fill="#ef4444" 
                                    stroke="#fff" 
                                    strokeWidth={2} 
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setActiveTooltip({
                                      chart: 'hr',
                                      x: p.x,
                                      y: p.y,
                                      value: `${val} bpm`,
                                      date: dateStr
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* Hover Tooltip card */}
                            {isHovered && activeTooltip && (
                              <g transform={`translate(${Math.max(10, Math.min(width - 120, activeTooltip.x - 55))}, ${Math.max(5, activeTooltip.y - 65)})`}>
                                <rect width={110} height={46} rx={6} fill="#fff" stroke="#e2e8f0" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }} />
                                <text x={8} y={16} fontSize={8.5} fill="#64748b" fontWeight={700}>{activeTooltip.date}</text>
                                <text x={8} y={32} fontSize={9.5} fill="#ef4444" fontWeight={700}>value : {activeTooltip.value}</text>
                              </g>
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)', marginTop: 8 }}>
                      <span>Jul 7, 09:31 PM</span>
                      <span>Jul 8, 05:31 AM</span>
                      <span>Jul 8, 07:31 PM</span>
                    </div>
                  </div>

                  {/* 2. Blood Pressure */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Blood Pressure (MMHG)</span>
                    <div style={{ marginTop: 12, background: 'var(--surface-alt)', borderRadius: 8, padding: 12, border: '1px solid var(--border-light)' }}>
                      {(() => {
                        const safeVits = Array.isArray(vitalsHistory) ? vitalsHistory : [];
                        const sysValues = safeVits.map(vh => vh?.bp_systolic).filter(Boolean);
                        const diaValues = safeVits.map(vh => vh?.bp_diastolic).filter(Boolean);
                        
                        const finalSys = sysValues.length > 0 ? sysValues : [120, 116, 118, 115, 118, 120, 122, 118, 140, 150, 153];
                        const finalDia = diaValues.length > 0 ? diaValues : [80, 78, 80, 76, 78, 80, 82, 80, 90, 96, 98];
                        
                        const width = 350;
                        const height = 120;
                        const padding = 20;
                        
                        const minBp = Math.min(50, Math.min(...finalDia) - 5);
                        const maxBp = Math.max(160, Math.max(...finalSys) + 5);
                        const rangeBp = (maxBp - minBp) || 1;

                        const sysPoints = finalSys.map((val, idx) => {
                          const x = padding + (idx / (finalSys.length - 1 || 1)) * (width - padding * 2);
                          const y = height - padding - ((val - minBp) / rangeBp) * (height - padding * 2);
                          return { x, y };
                        });
                        const diaPoints = finalDia.map((val, idx) => {
                          const x = padding + (idx / (finalDia.length - 1 || 1)) * (width - padding * 2);
                          const y = height - padding - ((val - minBp) / rangeBp) * (height - padding * 2);
                          return { x, y };
                        });
                        
                        const sysPath = sysPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const diaPath = diaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        const datesList = ['Jul 7, 09:31 PM', 'Jul 8, 01:31 AM', 'Jul 8, 05:31 AM', 'Jul 8, 09:31 AM', 'Jul 8, 01:31 PM', 'Jul 8, 07:31 PM'];
                        const isHovered = activeTooltip?.chart === 'bp';

                        return (
                          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            {/* Horizontal Gridlines */}
                            <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                            <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4,4" />
                            <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e2e8f0" strokeWidth={1} />
                            
                            {/* Vertical Dotted Lines for EVERY data point */}
                            {sysPoints.map((p, i) => (
                              <line key={`vgrid-bp-${i}`} x1={p.x} y1={padding} x2={p.x} y2={height-padding} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.45} />
                            ))}

                            {/* Hover Guideline */}
                            {isHovered && activeTooltip && (
                              <line x1={activeTooltip.x} y1={10} x2={activeTooltip.x} y2={height-padding} stroke="#0f766e" strokeWidth={1.5} strokeDasharray="2,2" />
                            )}

                            <path d={sysPath} fill="none" stroke="#0f766e" strokeWidth={2.5} />
                            <path d={diaPath} fill="none" stroke="#0f766e" strokeWidth={2} strokeDasharray="4,4" />
                            
                            {sysPoints.map((p, i) => {
                              const valSys = finalSys[i];
                              const valDia = finalDia[i];
                              const dateStr = datesList[i % datesList.length];
                              const isSelected = activeTooltip?.chart === 'bp' && activeTooltip.x === p.x;
                              return (
                                <g key={`sys-${i}`}>
                                  <circle cx={p.x} cy={p.y} r={6.5} fill="#0f766e" fillOpacity={0.25} />
                                  <circle 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? 6 : 4} 
                                    fill="#0f766e" 
                                    stroke="#fff" 
                                    strokeWidth={2} 
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setActiveTooltip({
                                      chart: 'bp',
                                      x: p.x,
                                      y: p.y,
                                      value: `${valSys}/${valDia} mmHg`,
                                      date: dateStr
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}
                            {diaPoints.map((p, i) => {
                              const valSys = finalSys[i];
                              const valDia = finalDia[i];
                              const dateStr = datesList[i % datesList.length];
                              const isSelected = activeTooltip?.chart === 'bp' && activeTooltip.x === p.x;
                              return (
                                <g key={`dia-${i}`}>
                                  <circle cx={p.x} cy={p.y} r={6.5} fill="#0f766e" fillOpacity={0.25} />
                                  <circle 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? 6 : 4} 
                                    fill="#0f766e" 
                                    stroke="#fff" 
                                    strokeWidth={2} 
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setActiveTooltip({
                                      chart: 'bp',
                                      x: p.x,
                                      y: p.y,
                                      value: `${valSys}/${valDia} mmHg`,
                                      date: dateStr
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* Hover Tooltip card */}
                            {isHovered && activeTooltip && (
                              <g transform={`translate(${Math.max(10, Math.min(width - 120, activeTooltip.x - 55))}, ${Math.max(5, activeTooltip.y - 65)})`}>
                                <rect width={110} height={46} rx={6} fill="#fff" stroke="#e2e8f0" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }} />
                                <text x={8} y={16} fontSize={8.5} fill="#64748b" fontWeight={700}>{activeTooltip.date}</text>
                                <text x={8} y={32} fontSize={9.5} fill="#0f766e" fontWeight={700}>value : {activeTooltip.value}</text>
                              </g>
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)', marginTop: 8 }}>
                      <span>Jul 7, 09:31 PM</span>
                      <span>Jul 8, 05:31 AM</span>
                      <span>Jul 8, 07:31 PM</span>
                    </div>
                  </div>

                  {/* 3. SPO2 */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SPO₂ (%)</span>
                    <div style={{ marginTop: 12, background: 'var(--surface-alt)', borderRadius: 8, padding: 12, border: '1px solid var(--border-light)' }}>
                      {(() => {
                        const safeVits = Array.isArray(vitalsHistory) ? vitalsHistory : [];
                        const o2Values = safeVits.map(vh => vh?.spo2).filter(Boolean);
                        const finalO2 = o2Values.length > 0 ? o2Values : [98, 96, 97, 96, 97, 97, 98, 97, 95, 91, 90];
                        
                        const width = 350;
                        const height = 120;
                        const padding = 20;
                        const minO2 = Math.min(85, Math.min(...finalO2) - 2);
                        const maxO2 = Math.max(100, Math.max(...finalO2) + 1);
                        const rangeO2 = (maxO2 - minO2) || 1;

                        const points = finalO2.map((val, idx) => {
                          const x = padding + (idx / (finalO2.length - 1 || 1)) * (width - padding * 2);
                          const y = height - padding - ((val - minO2) / rangeO2) * (height - padding * 2);
                          return { x, y };
                        });
                        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        const datesList = ['Jul 7, 09:31 PM', 'Jul 8, 01:31 AM', 'Jul 8, 05:31 AM', 'Jul 8, 09:31 AM', 'Jul 8, 01:31 PM', 'Jul 8, 07:31 PM'];
                        const isHovered = activeTooltip?.chart === 'spo2';

                        return (
                          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            {/* Horizontal Gridlines */}
                            <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                            <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4,4" />
                            <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e2e8f0" strokeWidth={1} />
                            
                            {/* Vertical Dotted Lines for EVERY data point */}
                            {points.map((p, i) => (
                              <line key={`vgrid-spo2-${i}`} x1={p.x} y1={padding} x2={p.x} y2={height-padding} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.45} />
                            ))}

                            {/* Hover Guideline */}
                            {isHovered && activeTooltip && (
                              <line x1={activeTooltip.x} y1={10} x2={activeTooltip.x} y2={height-padding} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="2,2" />
                            )}

                            <path d={path} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.6} />
                            <path d={path} fill="none" stroke="#2563eb" strokeWidth={2.5} />
                            
                            {points.map((p, i) => {
                              const val = finalO2[i];
                              const dateStr = datesList[i % datesList.length];
                              const isSelected = activeTooltip?.chart === 'spo2' && activeTooltip.x === p.x;
                              return (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r={6.5} fill="#2563eb" fillOpacity={0.25} />
                                  <circle 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? 6 : 4} 
                                    fill="#2563eb" 
                                    stroke="#fff" 
                                    strokeWidth={2} 
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setActiveTooltip({
                                      chart: 'spo2',
                                      x: p.x,
                                      y: p.y,
                                      value: `${val}%`,
                                      date: dateStr
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* Hover Tooltip card */}
                            {isHovered && activeTooltip && (
                              <g transform={`translate(${Math.max(10, Math.min(width - 120, activeTooltip.x - 55))}, ${Math.max(5, activeTooltip.y - 65)})`}>
                                <rect width={110} height={46} rx={6} fill="#fff" stroke="#e2e8f0" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }} />
                                <text x={8} y={16} fontSize={8.5} fill="#64748b" fontWeight={700}>{activeTooltip.date}</text>
                                <text x={8} y={32} fontSize={9.5} fill="#2563eb" fontWeight={700}>value : {activeTooltip.value}</text>
                              </g>
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)', marginTop: 8 }}>
                      <span>Jul 7, 09:31 PM</span>
                      <span>Jul 8, 05:31 AM</span>
                      <span>Jul 8, 07:31 PM</span>
                    </div>
                  </div>

                  {/* 4. Temperature */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temperature (°C)</span>
                    <div style={{ marginTop: 12, background: 'var(--surface-alt)', borderRadius: 8, padding: 12, border: '1px solid var(--border-light)' }}>
                      {(() => {
                        const safeVits = Array.isArray(vitalsHistory) ? vitalsHistory : [];
                        const rawTempValues = safeVits.map(vh => vh?.temperature).filter((v): v is number => v !== undefined && v !== null && !isNaN(v));
                        // Normalize Fahrenheit (> 50) to Celsius for °C trend line
                        const tempValues = rawTempValues.map(v => v > 50 ? (v - 32) * 5 / 9 : v);
                        const finalTemp = tempValues.length > 0 ? tempValues : [36.9, 36.9, 36.9, 36.9, 36.9, 36.9, 36.9, 36.9, 37.8, 38.6, 38.6];
                        
                        const width = 350;
                        const height = 120;
                        const padding = 20;
                        
                        // Dynamic Y scaling so temperature NEVER disappears off chart!
                        const minTemp = Math.max(34.0, Math.floor(Math.min(...finalTemp)) - 0.5);
                        const maxTemp = Math.min(42.0, Math.ceil(Math.max(...finalTemp)) + 0.5);
                        const rangeTemp = (maxTemp - minTemp) || 2;

                        const points = finalTemp.map((val, idx) => {
                          const x = padding + (idx / (finalTemp.length - 1 || 1)) * (width - padding * 2);
                          const y = height - padding - ((val - minTemp) / rangeTemp) * (height - padding * 2);
                          return { x, y };
                        });
                        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        const datesList = ['Jul 7, 09:31 PM', 'Jul 8, 01:31 AM', 'Jul 8, 05:31 AM', 'Jul 8, 09:31 AM', 'Jul 8, 01:31 PM', 'Jul 8, 07:31 PM'];
                        const isHovered = activeTooltip?.chart === 'temp';

                        return (
                          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            {/* Horizontal Gridlines */}
                            <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                            <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4,4" />
                            <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e2e8f0" strokeWidth={1} />
                            
                            {/* Vertical Dotted Lines for EVERY data point */}
                            {points.map((p, i) => (
                              <line key={`vgrid-temp-${i}`} x1={p.x} y1={padding} x2={p.x} y2={height-padding} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.45} />
                            ))}

                            {/* Hover Guideline */}
                            {isHovered && activeTooltip && (
                              <line x1={activeTooltip.x} y1={10} x2={activeTooltip.x} y2={height-padding} stroke="#d97706" strokeWidth={1.5} strokeDasharray="2,2" />
                            )}

                            <path d={path} fill="none" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.6} />
                            <path d={path} fill="none" stroke="#d97706" strokeWidth={2.5} />
                            
                            {points.map((p, i) => {
                              const val = finalTemp[i];
                              const dateStr = datesList[i % datesList.length];
                              const isSelected = activeTooltip?.chart === 'temp' && activeTooltip.x === p.x;
                              return (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r={6.5} fill="#d97706" fillOpacity={0.25} />
                                  <circle 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? 6 : 4} 
                                    fill="#d97706" 
                                    stroke="#fff" 
                                    strokeWidth={2} 
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setActiveTooltip({
                                      chart: 'temp',
                                      x: p.x,
                                      y: p.y,
                                      value: `${val.toFixed(1)} °C`,
                                      date: dateStr
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* Hover Tooltip card */}
                            {isHovered && activeTooltip && (
                              <g transform={`translate(${Math.max(10, Math.min(width - 120, activeTooltip.x - 55))}, ${Math.max(5, activeTooltip.y - 65)})`}>
                                <rect width={110} height={46} rx={6} fill="#fff" stroke="#e2e8f0" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }} />
                                <text x={8} y={16} fontSize={8.5} fill="#64748b" fontWeight={700}>{activeTooltip.date}</text>
                                <text x={8} y={32} fontSize={9.5} fill="#d97706" fontWeight={700}>value : {activeTooltip.value}</text>
                              </g>
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)', marginTop: 8 }}>
                      <span>Jul 7, 09:31 PM</span>
                      <span>Jul 8, 05:31 AM</span>
                      <span>Jul 8, 07:31 PM</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vitals Timeline list */}
          <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
            <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Vitals Timeline</h3>
              <button 
                className="btn btn-sm" 
                onClick={() => showManualNotification(
                  `Vitals Timeline Notification`,
                  `Patient ${p.name} (${p.uhid}) Vitals History notification triggered.`
                )}
                style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', border: '1px solid rgba(13, 148, 136, 0.25)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Show Notification
              </button>
            </div>
            
            <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const safeVits = Array.isArray(vitalsHistory) ? vitalsHistory : [];
                const logs = safeVits.length > 0 ? safeVits : [
                  { recorded_at: '2026-07-08T19:31:04Z', bp_systolic: 153, bp_diastolic: 98, heart_rate: 130, spo2: 90, temperature: 38.6, blood_sugar: 179 },
                  { recorded_at: '2026-07-08T17:31:04Z', bp_systolic: 153, bp_diastolic: 98, heart_rate: 131, spo2: 90, temperature: 38.6, blood_sugar: 179 },
                  { recorded_at: '2026-07-08T15:31:04Z', bp_systolic: 146, bp_diastolic: 93, heart_rate: 124, spo2: 89, temperature: 38.6, blood_sugar: 170 },
                  { recorded_at: '2026-07-08T13:31:04Z', bp_systolic: 112, bp_diastolic: 74, heart_rate: 72, spo2: 95, temperature: 36.9, blood_sugar: 103 }
                ];
                
                return logs.map((log, idx) => {
                  const bpSys = log.bp_systolic;
                  const bpDia = log.bp_diastolic;
                  const hr = log.heart_rate;
                  const spo2 = log.spo2;
                  const temp = log.temperature;
                  const sugar = log.blood_sugar;
                  
                  const isFahrenheit = temp > 50 || log.temperature_unit === 'F';
                  const isBpAbnormal = bpSys && (bpSys > 140 || bpSys < 90 || bpDia > 90 || bpDia < 60);
                  const isHrAbnormal = hr && (hr > 100 || hr < 60);
                  const isSpo2Abnormal = spo2 && spo2 < 95;
                  const isTempAbnormal = temp && (isFahrenheit ? (temp > 99.5 || temp < 97.0) : (temp > 37.5 || temp < 36.0));
                  const isSugarAbnormal = sugar && (sugar > 140 || sugar < 70);
                  
                  const isCritical = isBpAbnormal || isHrAbnormal || isSpo2Abnormal || isTempAbnormal || isSugarAbnormal;

                  return (
                    <div key={idx} style={{
                      display: 'grid',
                      gridTemplateColumns: '240px 1fr',
                      gap: 16,
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-light)',
                      paddingBottom: 16
                    }}>
                      {/* Left Side: Date and alert badge */}
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-light)' }}>Recorded</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                          {new Date(log.recorded_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                        </div>
                        <span className={`badge ${isCritical ? 'badge-danger' : 'badge-neutral'}`} style={{ marginTop: 6, fontSize: 10, padding: '2px 8px' }}>
                          {isCritical ? 'Critical' : 'Normal'}
                        </span>
                      </div>

                      {/* Right Side: Vitals Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {/* BP */}
                        <div style={{
                          background: isBpAbnormal ? '#fee2e2' : '#f8fafc',
                          color: isBpAbnormal ? '#991b1b' : 'var(--text)',
                          border: isBpAbnormal ? '1px solid #fecaca' : '1px solid var(--border-light)',
                          borderRadius: 8, padding: '10px 4px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{bpSys ? `${bpSys}/${bpDia}` : '—'}</div>
                          <div style={{ fontSize: 9, color: isBpAbnormal ? 'rgba(153, 27, 27, 0.6)' : 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>BP</div>
                        </div>

                        {/* HR */}
                        <div style={{
                          background: isHrAbnormal ? '#fee2e2' : '#f8fafc',
                          color: isHrAbnormal ? '#991b1b' : 'var(--text)',
                          border: isHrAbnormal ? '1px solid #fecaca' : '1px solid var(--border-light)',
                          borderRadius: 8, padding: '10px 4px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{hr ? `${hr}` : '—'} <span style={{ fontSize: 8, fontWeight: 500 }}>bpm</span></div>
                          <div style={{ fontSize: 9, color: isHrAbnormal ? 'rgba(153, 27, 27, 0.6)' : 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>HR</div>
                        </div>

                        {/* SPO2 */}
                        <div style={{
                          background: isSpo2Abnormal ? '#fee2e2' : '#f8fafc',
                          color: isSpo2Abnormal ? '#991b1b' : 'var(--text)',
                          border: isSpo2Abnormal ? '1px solid #fecaca' : '1px solid var(--border-light)',
                          borderRadius: 8, padding: '10px 4px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{spo2 ? `${spo2}%` : '—'}</div>
                          <div style={{ fontSize: 9, color: isSpo2Abnormal ? 'rgba(153, 27, 27, 0.6)' : 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>SPO2</div>
                        </div>

                        {/* TEMP */}
                        <div style={{
                          background: isTempAbnormal ? '#fee2e2' : '#f8fafc',
                          color: isTempAbnormal ? '#991b1b' : 'var(--text)',
                          border: isTempAbnormal ? '1px solid #fecaca' : '1px solid var(--border-light)',
                          borderRadius: 8, padding: '10px 4px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {temp ? `${temp}` : '—'} <span style={{ fontSize: 8, fontWeight: 500 }}>°{isFahrenheit ? 'F' : 'C'}</span>
                          </div>
                          <div style={{ fontSize: 9, color: isTempAbnormal ? 'rgba(153, 27, 27, 0.6)' : 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>TEMP</div>
                        </div>

                        {/* SUGAR */}
                        <div style={{
                          background: isSugarAbnormal ? '#fee2e2' : '#f8fafc',
                          color: isSugarAbnormal ? '#991b1b' : 'var(--text)',
                          border: isSugarAbnormal ? '1px solid #fecaca' : '1px solid var(--border-light)',
                          borderRadius: 8, padding: '10px 4px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{sugar ? `${sugar}` : '—'} <span style={{ fontSize: 8, fontWeight: 500 }}>mg/dL</span></div>
                          <div style={{ fontSize: 9, color: isSugarAbnormal ? 'rgba(153, 27, 27, 0.6)' : 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>SUGAR</div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Prescriptions */}
      {/* Tab: Prescriptions */}
      {tab === 'Prescriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Prescription Records</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={prePrinted} onChange={e => setPrePrinted(e.target.checked)} />
                Print on pre-printed letterhead
              </label>
              {isDoctor && <button className="btn btn-primary btn-sm" onClick={()=>onNavigate('new_prescription',{patientId:p.id,patient:p})}>+ Write Prescription</button>}
            </div>
          </div>

          {prescriptions.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span className="empty-icon">💊</span>
              <h3>No prescriptions yet</h3>
              <p>Click "+ Write Prescription" to prescribe medicines.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {prescriptions.map((rx: any) => {
                const meds = safeJsonArray(rx.medicines);
                return (
                  <div key={rx.id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '24px 28px',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative'
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                          {rx.doctor_name ? (rx.doctor_name.toLowerCase().startsWith('dr.') ? rx.doctor_name : `Dr. ${rx.doctor_name}`) : '—'}
                        </h4>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(rx.created_at).toLocaleDateString('en-IN')}{rx.chief_complaint ? ` · ${rx.chief_complaint}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-light)' }}>
                          #{rx.slip_token || 'RX-TEMP'}
                        </span>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px 12px', minHeight: 28, fontSize: 12, fontWeight: 600 }}
                          onClick={ev => { ev.stopPropagation(); printSlip(rx); }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Print
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Medicines List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                      {meds.map((m: any, idx: number) => (
                        <div key={idx} style={{ fontSize: 13.5, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <strong style={{ fontSize: 14.5, color: 'var(--text)' }}>{m.name} {m.strength || ''}</strong>
                          <span style={{ color: 'var(--text-light)' }}>—</span>
                          <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>
                            {m.quantity || '1'} {m.form || 'tab'}, {m.frequency || m.dose || 'OD-HS'}, {m.duration || '30 days'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Advice */}
                    {rx.advice && (
                      <div style={{
                        marginTop: 16,
                        background: '#f8fafc',
                        border: '1px dashed var(--border)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 12.5,
                        color: 'var(--text-sec)',
                        fontStyle: 'italic'
                      }}>
                        <strong>Advice:</strong> {rx.advice}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Appointments */}
      {tab === 'Appointments' && (
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header">
            <div className="card-title">Appointments</div>
            <button className="btn btn-secondary btn-sm" onClick={()=>onNavigate('appointments')}>+ Book</button>
          </div>
          {apptUpcoming.length === 0
            ? <div className="empty-state"><span className="empty-icon">📅</span><h3>No appointments</h3></div>
            : <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {apptUpcoming.map((a:any)=>(
                  <div key={a.id} style={{padding:'12px 18px',borderBottom:'1px solid var(--border-light)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{a.date} · {a.time}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{a.reason||'General'} · Dr. {a.doctor_name||'—'}</div>
                    </div>
                    <span className={`badge ${a.status==='Completed'?'badge-success':a.status==='Scheduled'?'badge-info':'badge-neutral'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Tab: Billing */}
      {tab === 'Billing' && (
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title" style={{ margin: 0 }}>Billing &amp; Invoices</div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('billing', { patientId: p.id, showAdd: true })}
            >
              + Create Invoice
            </button>
          </div>
          
          {patientBills.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span className="empty-icon">🧾</span>
              <h3>No Billing History</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>This patient has no OPD or IPD invoices recorded.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Details</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount · Paid</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patientBills.map((b: any) => {
                    const handlePrintInvoice = () => {
                      const items = Array.isArray(b.items) ? b.items : [];
                      const total = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);
                      printInvoice({
                        invoice: { id: b.id, invoice_number: b.invoice_number, created_at: b.created_at, payment_mode: b.payment_mode, payment_status: b.payment_status },
                        patient: { name: p.name, uhid: p.uhid, phone: p.phone },
                        items,
                        totals: { total, discount: b.discount || 0, net: b.net_amount || total, paid: b.paid_amount || 0 },
                        billedBy: user?.name,
                        notes: b.notes,
                      });
                    };
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                          {b.invoice_number || b.id.slice(0, 8)}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                          {new Date(b.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                          {b.notes || (b.bill_type === 'bed_stay' ? 'Bed stay IPD accommodation' : 'OPD Consultation & Pharmacy')}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)' }}>
                          <div>Net: <strong>₹{b.net_amount?.toLocaleString('en-IN')}</strong></div>
                          <div style={{ color: 'var(--success)', marginTop: 2 }}>Paid: ₹{b.paid_amount?.toLocaleString('en-IN') || 0}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${
                            b.payment_status === 'Paid' ? 'badge-success' :
                            b.payment_status === 'Partial' ? 'badge-warning' :
                            'badge-neutral'
                          }`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                            {b.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 6, minHeight: 'auto', color: 'var(--text-muted)' }}
                            onClick={handlePrintInvoice}
                            title="Print Invoice"
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                              Print
                            </span>
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
      )}

      {/* Tab: Overview */}
      {tab === 'Overview' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Patient Details */}
          <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
            <div className="card-header"><div className="card-title">Patient Details</div></div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                ['Date of Birth', p.dob ? new Date(p.dob).toLocaleDateString('en-IN') : `~${p.age} yrs`],
                ['Gender', p.sex],
                ['Blood Group', p.blood_group||'Not recorded'],
                ['Phone', p.phone||'—'],
                ['Email', p.email||'—'],
                ['Address', p.address||'—'],
                ['Insurance', p.insurance_provider ? `${p.insurance_provider} · ${p.insurance_number}` : '—'],
                ...(p.abha_number ? [
                  ['ABHA Number', p.abha_number],
                  ['ABHA Address', p.abha_address],
                  ['ABDM Status', p.abha_status ? 'Verified ✓' : 'Unlinked']
                ] : [])
              ].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderBottom:'1px solid var(--border-light)',gap:12}}>
                  <span style={{color:'var(--text-muted)',fontSize:12,flexShrink:0}}>{l}</span>
                  <span style={{fontWeight:600,fontSize:12,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Summary info */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* ABDM / ABHA Health Card */}
            <div className="card" style={{
              overflow: 'hidden',
              background: p.abha_number 
                ? 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)' 
                : 'linear-gradient(135deg, #fff 0%, #fef2f2 100%)',
              border: p.abha_number ? '1px solid #bbf7d0' : '1px solid #fecaca',
              padding: 0,
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 'var(--radius-xl)'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, var(--primary) 0%, #16a34a 100%)',
                color: '#fff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🇮🇳</span> National Health Authority (NHA)
                </div>
                <div style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                  SANDBOX
                </div>
              </div>
              
              <div style={{ padding: 16 }}>
                {p.abha_number ? (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        ABHA Address
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                        {p.abha_address}
                      </div>
                      
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>
                        ABHA Number
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                        {p.abha_number}
                      </div>
                      
                      <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>✓</span> EMR Data Linkage Active (M1 Compliance)
                      </div>
                    </div>
                    
                    {/* Mock QR Code */}
                    <div style={{
                      width: 70, height: 70, background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                      display: 'flex', flexWrap: 'wrap', padding: 4, justifyContent: 'center', alignItems: 'center', flexShrink: 0
                    }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, width: '100%', height: '100%'
                      }}>
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div key={i} style={{
                            background: (i % 2 === 0 || i % 3 === 0) ? '#000' : 'transparent',
                            borderRadius: 1
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#991b1b' }}>ABHA Not Linked</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                      This patient's record is not registered with the Ayushman Bharat Digital Mission. Link an ABHA address to share records across the national network.
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-primary" 
                      style={{ marginTop: 12, background: '#dc2626', borderColor: '#b91c1c' }}
                      onClick={() => setShowEdit(true)}
                    >
                      Link ABHA Account
                    </button>
                  </div>
                )}
              </div>
            </div>

            {p.past_history && (
              <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
                <div className="card-header" style={{ borderBottomColor: '#fde68a' }}><div className="card-title" style={{ color: '#b45309' }}>Past Medical History (Diseases)</div></div>
                <div className="card-body" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#78350f' }}>
                  {p.past_history}
                </div>
              </div>
            )}
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
              <div className="card-header"><div className="card-title">Clinical Summary</div></div>
              <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  ['Encounters', encounters.length],
                  ['Prescriptions', rxCount],
                  ['Appointments', apptUpcoming.length],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border-light)'}}>
                    <span style={{color:'var(--text-muted)',fontSize:13}}>{l}</span>
                    <span style={{fontWeight:800,fontSize:18,color:'var(--primary)'}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── Tab: Documents ── */}
      {tab === 'Documents' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Patient Documents & History</div>
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              style={{ background: 'var(--primary)', borderColor: 'var(--primary-dark)', padding: '6px 14px', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowUploadModal(true)}
            >
              ➕ Upload Document/Photo
            </button>
          </div>
          <div className="card-body">
            {loadingUploads ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : uploadsError ? (
              <div className="alert alert-danger">{uploadsError}</div>
            ) : uploads.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📁</span>
                <h3>No documents uploaded</h3>
                <p>Saved prescriptions and other patient records will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {uploads.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="card"
                    style={{
                      margin: 0,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onClick={() => setPreviewDoc(doc)}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>
                          {doc.file_type?.includes('pdf') ? '📄' : '🖼️'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                      </div>
                      {doc.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 32 }}>
                          {doc.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal" style={{ maxWidth: 800, width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{previewDoc.title}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {previewDoc.file_url.startsWith('data:application/pdf') && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const printWindow = window.open();
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head><title>${previewDoc.title}</title></head>
                            <body style="margin:0;">
                              <embed width="100%" height="100%" src="${previewDoc.file_url}" type="application/pdf" />
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        setTimeout(() => {
                          printWindow.focus();
                          printWindow.print();
                        }, 500);
                      }
                    }}
                  >
                    🖨 Print
                  </button>
                )}
                <button className="modal-close" onClick={() => setPreviewDoc(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' }}>
              {previewDoc.file_url.startsWith('data:application/pdf') ? (
                <iframe
                  title="Document Preview"
                  src={previewDoc.file_url}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                />
              ) : previewDoc.file_url.startsWith('data:image') ? (
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <p>Preview not supported for this file type.</p>
                  <a href={previewDoc.file_url} download={previewDoc.title} className="btn btn-primary">Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <EditPatientModal
          patient={p}
          onClose={() => setShowEdit(false)}
          onDone={(updatedPatient) => {
            setSummary((prev: any) => ({ ...prev, patient: updatedPatient }));
            setShowEdit(false);
          }}
        />
      )}

      {showUploadModal && (
        <UploadDocModal
          patientId={patientId}
          onClose={() => setShowUploadModal(false)}
          onDone={(newDoc) => {
            setUploads(x => [newDoc, ...x]);
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── EditPatientModal Component ──
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const ALLERGIES_COMMON = ['Penicillin','Sulfa drugs','Aspirin','Ibuprofen','Peanuts','Latex','Shellfish','Eggs','Milk'];
const CONDITIONS_COMMON = ['Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','COPD','Heart Disease','Chronic Kidney Disease','Arthritis'];

function AbhaVerificationModal({ onClose, onLinked }: { onClose: () => void; onLinked: (p: any) => void }) {
  const [step, setStep] = useState(1); // 1: Aadhaar Input, 2: OTP Verification, 3: Profile Link
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [aadhaar, setAadhaar] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mockOtpVal, setMockOtpVal] = useState('');
  const [profile, setProfile] = useState<any>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (mode === 'create') {
      if (aadhaar.replace(/\D/g, '').length !== 12) {
        setError('Aadhaar must be a 12-digit number');
        return;
      }
    } else {
      if (!abhaAddress) {
        setError('Please enter a valid ABHA Address or ABHA Number');
        return;
      }
    }
    
    setLoading(true);
    try {
      const endpoint = mode === 'create' ? '/abdm/abha/generate-otp' : '/abdm/abha/search';
      const payload = mode === 'create' ? { aadhaar } : { abhaAddress };
      const res = await apiClient.post(endpoint, payload);
      
      if (mode === 'create') {
        setTxnId(res.data.txnId);
        setMockOtpVal(res.data.mockOtp);
        setStep(2);
      } else {
        setProfile(res.data.profile);
        setStep(3);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to communicate with NHA Sandbox APIs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    setLoading(true);
    try {
      const res = await apiClient.post('/abdm/abha/verify-otp', { txnId, otp });
      setProfile(res.data.profile);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🇮🇳</span> NHA Sandbox Verification
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {step === 1 && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 4px 18px 4px' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button 
                type="button" 
                className="tab" 
                style={{ flex: 1, padding: '10px 0', border: 'none', background: mode === 'create' ? 'var(--primary-light)' : 'none', color: mode === 'create' ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setMode('create')}
              >
                Create New ABHA
              </button>
              <button 
                type="button" 
                className="tab" 
                style={{ flex: 1, padding: '10px 0', border: 'none', background: mode === 'link' ? 'var(--primary-light)' : 'none', color: mode === 'link' ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setMode('link')}
              >
                Link Existing
              </button>
            </div>

            {error && <div className="alert alert-danger" style={{ fontSize: 12, padding: '8px 12px', margin: 0 }}>⚠️ {error}</div>}

            {mode === 'create' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Aadhaar Card Number *</label>
                <input 
                  className="input" 
                  placeholder="12-digit Aadhaar number" 
                  maxLength={12}
                  value={aadhaar} 
                  onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
                  required 
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                  NHA will send a 6-digit verification code to the Aadhaar-registered mobile number.
                </small>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">ABHA Number or ABHA Address *</label>
                <input 
                  className="input" 
                  placeholder="e.g. adinath@sbx or 91-8805-..." 
                  value={abhaAddress} 
                  onChange={e => setAbhaAddress(e.target.value)}
                  required 
                />
              </div>
            )}

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner spinner-sm" /> : mode === 'create' ? 'Send Aadhaar OTP' : 'Search Profile'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 4px 18px 4px' }}>
            <div style={{ background: 'var(--primary-light)', padding: 12, borderRadius: 8, border: '1px solid var(--primary-mid)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>Aadhaar Verification Code</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sent to registered mobile. Mock OTP: <strong>{mockOtpVal}</strong></div>
            </div>

            {error && <div className="alert alert-danger" style={{ fontSize: 12, padding: '8px 12px', margin: 0 }}>⚠️ {error}</div>}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Enter 6-Digit OTP *</label>
              <input 
                className="input" 
                placeholder="123456" 
                maxLength={6}
                value={otp} 
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                required 
              />
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6}>
                {loading ? <div className="spinner spinner-sm" /> : 'Verify Code'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 4px 18px 4px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✓ NHA Sandbox Verified Profile</div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-grad)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700
                }}>
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>{profile.name}</div>
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 1 }}>{profile.sex} · {profile.age} Years</div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 6, fontSize: 12, color: '#15803d' }}>
                <div><strong>ABHA Number:</strong> {profile.abhaNumber}</div>
                <div><strong>ABHA Address:</strong> {profile.abhaAddress}</div>
                {profile.address && <div><strong>Address:</strong> {profile.address}</div>}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  onLinked(profile);
                  onClose();
                }}
              >
                Auto-fill & Link EMR Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditPatientModal({ patient, onClose, onDone }: { patient: any; onClose: () => void; onDone: (p: any) => void }) {
  const [form, setForm] = useState({
    name: patient.name || '',
    dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '',
    sex: patient.sex || 'Male',
    blood_group: patient.blood_group || '',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    ec_name: patient.ec_name || '',
    ec_phone: patient.ec_phone || '',
    ec_relation: patient.ec_relation || '',
    past_history: patient.past_history || '',
    notes: patient.notes || '',
    abha_number: patient.abha_number || '',
    abha_address: patient.abha_address || '',
    abha_status: patient.abha_status || ''
  });
  const [photoUrl, setPhotoUrl] = useState(patient.photo_url || '');
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [allergies, setAllergies] = useState<string[]>(() => safeJsonArray(patient.allergies));
  const [conditions, setConditions] = useState<string[]>(() => safeJsonArray(patient.chronic_conditions));
  const [customAllergyInput, setCustomAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Patient photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setFieldErrors(fe => { const n = { ...fe }; delete n[k]; return n; });
  };

  const age = form.dob ? Math.floor((Date.now() - new Date(form.dob).getTime()) / (365.25*24*3600*1000)) : null;

  function validate(): boolean {
    const errs = collectErrors({
      name:     validateRequired(form.name, 'Full name'),
      phone:    validatePhone(form.phone),
      email:    validateEmail(form.email),
      dob:      validateNotFutureDate(form.dob, 'Date of birth'),
      ec_phone: validatePhone(form.ec_phone),
    });
    setFieldErrors(errs);
    return isValid(errs);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true); setError('');
    const now = new Date().toISOString();
    const payload = {
      ...patient,
      name: form.name.trim(), dob: form.dob || undefined, age: age ?? undefined,
      sex: form.sex as 'Male' | 'Female' | 'Other', blood_group: form.blood_group || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      address: form.address || undefined,
      allergies, chronic_conditions: conditions,
      ec_name: form.ec_name || undefined, ec_phone: form.ec_phone || undefined, ec_relation: form.ec_relation || undefined,
      past_history: form.past_history || undefined,
      notes: form.notes || undefined,
      abha_number: form.abha_number || undefined,
      abha_address: form.abha_address || undefined,
      abha_status: form.abha_status || undefined,
      photo_url: photoUrl || null,
      updated_at: now,
    };
    try {
      const res = await apiClient.put(`/patients/${patient.id}`, payload);
      await db.patients.put({ ...res.data, _syncStatus: 'synced' });
      onDone(res.data);
      triggerSyncBroadcast();
    } catch (err) {
      const msg = extractServerError(err);
      const status = (err as any)?.response?.status;
      if (status === 422 || status === 400) {
        setError(msg);
        setSaving(false);
        return;
      }
      await markPending(db.patients, 'update', payload);
      onDone(payload);
      triggerSyncBroadcast();
    } finally { setSaving(false); }
  }

  const fieldStyle = (k: string): React.CSSProperties =>
    fieldErrors[k] ? { borderColor: 'var(--danger)' } : {};

  function FieldErr({ k }: { k: string }) {
    return fieldErrors[k] ? <div style={{ color:'var(--danger)', fontSize:11, marginTop:3 }}>⚠ {fieldErrors[k]}</div> : null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:620, maxHeight: '90vh', overflowY: 'auto'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Patient Profile</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            {/* ABDM Integration Section */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary-light) 0%, #e0f2fe 100%)',
              border: '1px solid var(--primary-mid)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 18px',
              marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🇮🇳</span> Ayushman Bharat Digital Mission (ABDM)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Link EMR profile to ABHA ID for government sandbox EMR data sharing.
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary" 
                  style={{ background: 'var(--primary)', borderColor: 'var(--primary-dark)' }}
                  onClick={() => setShowAbhaModal(true)}
                >
                  {form.abha_number ? 'Update / Re-verify ABHA' : 'Link ABHA Account'}
                </button>
              </div>
              
              {form.abha_number && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, background: '#166534', color: '#fff', padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ✓ Linked
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <strong>ABHA No:</strong> <span style={{ color: 'var(--text)' }}>{form.abha_number}</span> | <strong>ABHA Address:</strong> <span style={{ color: 'var(--text)' }}>{form.abha_address}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Photo Uploader */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px'
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                flexShrink: 0,
                border: '1px solid #bfdbfe',
                overflow: 'hidden'
              }}>
                {photoUrl ? (
                  <img src={photoUrl} alt="Patient Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  form.name ? form.name[0].toUpperCase() : 'P'
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Patient Profile Photo</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label className="btn btn-ghost btn-sm" style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    fontSize: 11,
                    minHeight: 'auto',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    margin: 0
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Select Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoChange}
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        minHeight: 'auto',
                        color: 'var(--danger)',
                        border: '1px solid var(--border)',
                        background: '#fff'
                      }}
                      onClick={() => setPhotoUrl('')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>JPG, PNG under 2MB</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="input" placeholder="Patient full name" value={form.name}
                  onChange={e=>set('name',e.target.value)}
                  style={fieldStyle('name')} />
                <FieldErr k="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input className="input" type="date" value={form.dob}
                  onChange={e=>set('dob',e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={fieldStyle('dob')} />
                {age !== null && <span style={{fontSize:11,color:'var(--text-muted)'}}>Age: {age} years</span>}
                <FieldErr k="dob" />
              </div>
              <div className="form-group">
                <label className="form-label">Sex *</label>
                <select className="input" value={form.sex} onChange={e=>set('sex',e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="input" value={form.blood_group} onChange={e=>set('blood_group',e.target.value)}>
                  <option value="">— Select —</option>
                  {BLOOD_GROUPS.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone}
                  onChange={e=>set('phone',e.target.value)} style={fieldStyle('phone')} />
                <FieldErr k="phone" />
              </div>
              <div style={{gridColumn:'1/-1'}} className="form-group">
                <label className="form-label">Address</label>
                <input className="input" placeholder="Street, City, State" value={form.address} onChange={e=>set('address',e.target.value)} />
              </div>
            </div>

            {/* Allergies */}
            <div className="form-group" style={{marginTop:14}}>
              <label className="form-label">Allergies</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                {ALLERGIES_COMMON.map(a=>(
                  <button type="button" key={a} className={`btn btn-sm ${allergies.includes(a)?'btn-danger':'btn-secondary'}`}
                    onClick={()=>setAllergies(x=>x.includes(a)?x.filter(i=>i!==a):[...x,a])}>
                    {a}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input className="input" placeholder="Custom allergy…" value={customAllergyInput} onChange={e=>setCustomAllergyInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&customAllergyInput.trim()){ setAllergies(x=>[...x,customAllergyInput.trim()]); setCustomAllergyInput(''); e.preventDefault(); }}} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{ if(customAllergyInput.trim()){ setAllergies(x=>[...x,customAllergyInput.trim()]); setCustomAllergyInput(''); }}}>Add</button>
              </div>
              {allergies.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>{allergies.map(a=><span key={a} className="tag tag-red">{a} <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:0,marginLeft:3,color:'inherit'}} onClick={()=>setAllergies(x=>x.filter(i=>i!==a))}>✕</button></span>)}</div>}
            </div>

            {/* Chronic conditions */}
            <div className="form-group" style={{marginTop:14}}>
              <label className="form-label">Chronic Conditions</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {CONDITIONS_COMMON.map(c=>(
                  <button type="button" key={c} className={`btn btn-sm ${conditions.includes(c)?'btn-primary':'btn-secondary'}`}
                    onClick={()=>setConditions(x=>x.includes(c)?x.filter(i=>i!==c):[...x,c])}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Past Medical History (Diseases) */}
            <div className="form-group" style={{marginTop:14}}>
              <label className="form-label">Past Medical History (Diseases)</label>
              <textarea
                className="input"
                rows={3}
                style={{ resize: 'vertical' }}
                placeholder="Previous illnesses, chronic diseases, major operations, etc."
                value={form.past_history}
                onChange={e => set('past_history', e.target.value)}
              />
            </div>

            {/* Emergency contact */}
            <div style={{background:'var(--surface-alt)',borderRadius:'var(--radius)',padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}>
              <div style={{gridColumn:'1/-1',fontSize:12,fontWeight:700,color:'var(--text-muted)',marginBottom:2}}>Emergency Contact</div>
              <div className="form-group"><label className="form-label">Name</label><input className="input" placeholder="Contact name" value={form.ec_name} onChange={e=>set('ec_name',e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" placeholder="+91 …" value={form.ec_phone}
                  onChange={e=>set('ec_phone',e.target.value)}
                  style={fieldStyle('ec_phone')} />
                <FieldErr k="ec_phone" />
              </div>
              <div className="form-group"><label className="form-label">Relation</label><input className="input" placeholder="e.g. Spouse" value={form.ec_relation} onChange={e=>set('ec_relation',e.target.value)} /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Saving…</> : '✓ Save Changes'}
            </button>
          </div>
        </form>
      </div>
      {showAbhaModal && (
        <AbhaVerificationModal
          onClose={() => setShowAbhaModal(false)}
          onLinked={(profile) => {
            setForm(f => ({
              ...f,
              name: profile.name,
              dob: profile.dob,
              sex: profile.sex,
              phone: profile.phone,
              address: profile.address || '',
              abha_number: profile.abhaNumber,
              abha_address: profile.abhaAddress,
              abha_status: profile.abhaStatus
            }));
          }}
        />
      )}
    </div>
  );
}

// ── UploadDocModal Component ──
function UploadDocModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: (doc: any) => void }) {
  const [title, setTitle] = useState('');
  const [fileData, setFileData] = useState('');
  const [fileType, setFileType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileType(file.type);
      if (!title) {
        setTitle(file.name.split('.')[0]); // autofill title with filename
      }
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileData) {
      setError('Title and File are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post('/patient-uploads', {
        patient_id: patientId,
        title: title.trim(),
        file_url: fileData,
        file_type: fileType,
        notes: notes.trim() || undefined
      });
      onDone(res.data);
    } catch (err) {
      setError(extractServerError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📁 Upload Document or Photo</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger">⚠️ {error}</div>}

            <div className="form-group">
              <label className="form-label">File / Photo *</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="input"
                onChange={handleFileChange}
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supports Images (PNG, JPG) or PDF under 5MB</span>
            </div>

            <div className="form-group">
              <label className="form-label">Document Title *</label>
              <input
                className="input"
                placeholder="e.g. Lab Report, Chest X-Ray"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes / Description</label>
              <textarea
                className="input"
                rows={3}
                style={{ resize: 'vertical' }}
                placeholder="Optional notes about this document..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !fileData}>
              {saving ? <div className="spinner spinner-sm" /> : '✓ Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
