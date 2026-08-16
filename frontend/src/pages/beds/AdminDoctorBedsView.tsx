// client/src/pages/beds/AdminDoctorBedsView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';
import { useSync } from '../../sync/useSync';

// ── SVG Icon Components (Strictly NO Emojis) ───────────────────────────
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function EditPencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function formatDoctorName(name?: string): string {
  if (!name || !name.trim()) return '';
  const cleaned = name.trim();
  if (cleaned.toLowerCase().startsWith('dr.') || cleaned.toLowerCase().startsWith('dr ')) {
    return cleaned;
  }
  return `Dr. ${cleaned}`;
}

export interface VitalStatusItem {
  key: string;
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  statusText: string;
}

export function getVitalsStatusList(vitals: any): VitalStatusItem[] {
  if (!vitals) return [];
  const list: VitalStatusItem[] = [];

  // Blood Pressure
  const sys = vitals.bp_systolic ?? vitals.bpSystolic;
  const dia = vitals.bp_diastolic ?? vitals.bpDiastolic;
  if (sys != null && dia != null && (Number(sys) > 0 || Number(dia) > 0)) {
    const s = Number(sys);
    const d = Number(dia);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (s >= 140 || d >= 90) {
      status = 'critical';
      statusText = 'High';
    } else if (s >= 120 || d >= 80) {
      status = 'warning';
      statusText = 'Pre-HTN';
    } else if (s < 90 || d < 60) {
      status = 'warning';
      statusText = 'Low';
    }
    list.push({
      key: 'bp',
      label: 'BP',
      value: `${s}/${d}`,
      unit: 'mmHg',
      status,
      statusText
    });
  }

  // Heart Rate
  const hr = vitals.heart_rate ?? vitals.heartRate;
  if (hr != null && Number(hr) > 0) {
    const h = Number(hr);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (h > 120) {
      status = 'critical';
      statusText = 'High';
    } else if (h > 100) {
      status = 'warning';
      statusText = 'Elevated';
    } else if (h < 60) {
      status = 'warning';
      statusText = 'Low';
    }
    list.push({
      key: 'hr',
      label: 'HR',
      value: h,
      unit: 'bpm',
      status,
      statusText
    });
  }

  // SpO2
  const spo2 = vitals.spo2;
  if (spo2 != null && Number(spo2) > 0) {
    const sp = Number(spo2);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (sp < 90) {
      status = 'critical';
      statusText = 'Critical';
    } else if (sp < 95) {
      status = 'warning';
      statusText = 'Low';
    }
    list.push({
      key: 'spo2',
      label: 'SpO2',
      value: `${sp}%`,
      unit: '',
      status,
      statusText
    });
  }

  // Temperature
  const temp = vitals.temperature;
  if (temp != null && Number(temp) > 0) {
    const t = Number(temp);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (t > 100.4) {
      status = 'critical';
      statusText = 'Fever';
    } else if (t > 99.0) {
      status = 'warning';
      statusText = 'Elevated';
    } else if (t < 96.0) {
      status = 'warning';
      statusText = 'Low';
    }
    list.push({
      key: 'temp',
      label: 'Temp',
      value: `${t}°F`,
      unit: '',
      status,
      statusText
    });
  }

  // Respiratory Rate
  const rr = vitals.respiratory_rate ?? vitals.respiratoryRate;
  if (rr != null && Number(rr) > 0) {
    const r = Number(rr);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (r > 24 || r < 10) {
      status = 'critical';
      statusText = 'Abnormal';
    } else if (r > 20 || r < 12) {
      status = 'warning';
      statusText = 'Elevated';
    }
    list.push({
      key: 'rr',
      label: 'RR',
      value: r,
      unit: 'bpm',
      status,
      statusText
    });
  }

  // Blood Sugar
  const bs = vitals.blood_sugar ?? vitals.bloodSugar;
  if (bs != null && Number(bs) > 0) {
    const b = Number(bs);
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let statusText = 'Normal';
    if (b > 200 || b < 70) {
      status = 'critical';
      statusText = b > 200 ? 'High' : 'Low';
    } else if (b > 140) {
      status = 'warning';
      statusText = 'Elevated';
    }
    list.push({
      key: 'bs',
      label: 'Sugar',
      value: b,
      unit: 'mg/dL',
      status,
      statusText
    });
  }

  return list;
}

export function formatAdmissionDate(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    return `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function getVitalsUpdatedText(vitals?: any): string {
  if (!vitals) return 'Vitals updated recently (1m ago)';
  const recAt = vitals.recorded_at || vitals.recordedAt || vitals.updated_at || vitals.created_at;
  if (!recAt) return 'Vitals updated recently (1m ago)';
  try {
    const d = new Date(recAt);
    if (isNaN(d.getTime())) return 'Vitals updated recently (1m ago)';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMin < 60) return `Vitals updated recently (${diffMin}m ago)`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Vitals recorded (${diffHr}h ago)`;
    const diffDays = Math.floor(diffHr / 24);
    return `Vitals recorded (${diffDays}d ago)`;
  } catch {
    return 'Vitals updated recently (1m ago)';
  }
}

export function BedVitalsGrid({ vitals }: { vitals: any }) {
  const sys = vitals?.bp_systolic ?? vitals?.bpSystolic;
  const dia = vitals?.bp_diastolic ?? vitals?.bpDiastolic;
  const hasBp = sys != null && dia != null && (Number(sys) > 0 || Number(dia) > 0);
  const bpVal = hasBp ? `${sys}/${dia}` : '—';

  const hr = vitals?.heart_rate ?? vitals?.heartRate ?? vitals?.pulse ?? vitals?.pulse_rate;
  const hasHr = hr != null && Number(hr) > 0;

  const spo2 = vitals?.spo2 ?? vitals?.oxygen_saturation;
  const hasSpo2 = spo2 != null && Number(spo2) > 0;

  const temp = vitals?.temperature ?? vitals?.temp;
  const hasTemp = temp != null && Number(temp) > 0;

  const sugar = vitals?.blood_sugar ?? vitals?.bloodSugar;
  const hasSugar = sugar != null && Number(sugar) > 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 6,
      marginBottom: 12
    }}>
      {/* 1. BP */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '8px 2px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {bpVal}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          BP
        </div>
      </div>

      {/* 2. HR */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '8px 2px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {hasHr ? (
            <>{hr}<span style={{ fontSize: 9.5, fontWeight: 500, color: '#64748b', marginLeft: 1 }}>bpm</span></>
          ) : '—'}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          HR
        </div>
      </div>

      {/* 3. SPO2 */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '8px 2px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {hasSpo2 ? (
            <>{spo2}<span style={{ fontSize: 9.5, fontWeight: 500, color: '#64748b' }}>%</span></>
          ) : '—'}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          SPO2
        </div>
      </div>

      {/* 4. TEMP */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '8px 2px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {hasTemp ? (
            <>{temp}<span style={{ fontSize: 9.5, fontWeight: 500, color: '#64748b', marginLeft: 1 }}>°F</span></>
          ) : '—'}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          TEMP
        </div>
      </div>

      {/* 5. SUGAR */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '8px 2px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {hasSugar ? sugar : '—'}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          SUGAR
        </div>
      </div>
    </div>
  );
}

export function BedVitalsBadges({ vitals }: { vitals: any }) {
  return <BedVitalsGrid vitals={vitals} />;
}

export interface Bed {
  id: string;
  bed_number: string;
  room: string;
  ward: string;
  type: string;
  status: string;
  patient_id?: string;
  patient_name?: string;
  patient_uhid?: string;
  patient_photo?: string;
  doctor_name?: string;
  admitted_at?: string;
  vitals?: any;
}

export interface BedAdmissionHistory {
  id: string;
  bed_id: string;
  patient_id: string;
  patient_name?: string;
  patient_uhid?: string;
  room?: string;
  bed_number?: string;
  ward?: string;
  bed_type?: string;
  doctor_id?: string;
  doctor_name?: string;
  admitted_at: string;
  discharged_at?: string;
  stay_days?: number;
  status: string;
  billing_status?: string;
}

export default function AdminDoctorBedsView({ onNavigate, isReceptionistOnly }: { onNavigate?: (p: string, d?: any) => void; isReceptionistOnly?: boolean } = {}) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWardFilter, setSelectedWardFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [error, setError] = useState('');

  // Modals state
  const [addBedOpen, setAddBedOpen] = useState(false);
  const [editBed, setEditBed] = useState<Bed | null>(null);
  const [allocateBed, setAllocateBed] = useState<Bed | null>(null);
  const [recordVitalsBed, setRecordVitalsBed] = useState<Bed | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vitalsLogBed, setVitalsLogBed] = useState<Bed | null>(null);
  const [vitalsLogList, setVitalsLogList] = useState<any[]>([]);
  const [loadingVitalsLog, setLoadingVitalsLog] = useState(false);

  const fetchBeds = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/beds');
      setBeds(res.data || []);
    } catch {
      setBeds([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds(true);
  }, []);

  useEffect(() => {
    if (syncCount > 0) {
      fetchBeds(false);
    }
  }, [syncCount]);

  const handleOpenVitalsLog = async (bed: Bed) => {
    if (!bed.patient_id) return;
    setVitalsLogBed(bed);
    setLoadingVitalsLog(true);
    try {
      const res = await apiClient.get('/vitals', { params: { patient_id: bed.patient_id, limit: 20 } });
      setVitalsLogList(res.data || []);
    } catch {
      setVitalsLogList([]);
    } finally {
      setLoadingVitalsLog(false);
    }
  };

  const handleRelease = async (bed: Bed) => {
    if (!window.confirm(`Are you sure you want to vacate Room ${bed.room} (${bed.bed_number})?`)) return;
    try {
      await apiClient.post(`/beds/${bed.id}/release`);
      await fetchBeds(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to vacate bed.');
    }
  };

  // Dynamically compute stats from actual data
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;

  const wardStats = useMemo(() => {
    const defaultWards = ['General', 'ICU', 'Emergency', 'Maternity'];
    const dynamicWards = Array.from(new Set(beds.map(b => b.ward).filter(Boolean)));
    const allWards = Array.from(new Set([...defaultWards, ...dynamicWards]));

    return allWards.map(w => {
      const wardBeds = beds.filter(b => (b.ward || '').toLowerCase() === w.toLowerCase());
      const occ = wardBeds.filter(b => b.status === 'Occupied').length;
      return {
        ward: w,
        total: wardBeds.length,
        occupied: occ
      };
    });
  }, [beds]);

  const availableWardsList = useMemo(() => {
    return ['All', 'ICU', 'General', 'Emergency', 'Maternity'];
  }, []);

  // Filtered beds list based on search, ward, and status
  const filteredBeds = useMemo(() => {
    return beds.filter(bed => {
      const matchesWard = selectedWardFilter === 'All' || (bed.ward || '').toLowerCase() === selectedWardFilter.toLowerCase();
      const matchesStatus = selectedStatusFilter === 'All' || (bed.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (bed.room || '').toLowerCase().includes(q) ||
        (bed.bed_number || '').toLowerCase().includes(q) ||
        (bed.patient_name || '').toLowerCase().includes(q) ||
        (bed.patient_uhid || '').toLowerCase().includes(q) ||
        (bed.doctor_name || '').toLowerCase().includes(q);

      return matchesWard && matchesStatus && matchesSearch;
    });
  }, [beds, selectedWardFilter, selectedStatusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ fontSize: 24, fontWeight: 700 }}>Bed Allocation Management</div>
          <div className="page-sub" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live view of every bed and vital sign</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            onClick={() => setAddBedOpen(true)}
          >
            <PlusIcon /> Add Bed
          </button>
          
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}
            onClick={() => setHistoryOpen(true)}
          >
            <DocumentIcon /> View Admission History
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}
            onClick={() => fetchBeds(false)}
            disabled={loading}
          >
            <RefreshIcon /> Refresh Status
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Main Stats Block — Beds & Vitals Board */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Wards</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Beds & Vitals Board</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Track occupancy, record vitals in seconds, and spot overdue observations at a glance.
        </p>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTop: '1px solid var(--border-light)', paddingTop: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Occupancy</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                {occupiedBeds} <span style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 500 }}>/ {totalBeds}</span>
              </div>
            </div>
            {/* Occupancy Progress Bar */}
            <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', maxWidth: 300 }}>
              <div style={{ height: '100%', width: `${totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {wardStats.map((ws, idx) => (
              <React.Fragment key={ws.ward}>
                <span>{ws.occupied}/{ws.total} {ws.ward}</span>
                {idx < wardStats.length - 1 && <span>•</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Row Pills & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Ward Category Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {availableWardsList.map(w => (
            <button
              key={w}
              onClick={() => setSelectedWardFilter(w)}
              className="btn btn-sm"
              style={{
                borderRadius: 20,
                padding: '5px 18px',
                fontSize: 12.5,
                minHeight: 30,
                fontWeight: selectedWardFilter === w ? 700 : 500,
                background: selectedWardFilter === w ? '#0d9488' : '#f1f5f9',
                color: selectedWardFilter === w ? '#fff' : '#334155',
                border: selectedWardFilter === w ? 'none' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['All', 'Available', 'Occupied'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className="btn btn-sm"
              style={{
                borderRadius: 20,
                padding: '5px 18px',
                fontSize: 12.5,
                minHeight: 30,
                fontWeight: selectedStatusFilter === st ? 700 : 500,
                background: selectedStatusFilter === st ? '#1e293b' : '#f8fafc',
                color: selectedStatusFilter === st ? '#fff' : '#475569',
                border: selectedStatusFilter === st ? 'none' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Bed Cards */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
      ) : filteredBeds.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          No beds found matching selected filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {filteredBeds.map(bed => {
            const isOccupied = bed.status === 'Occupied';
            return (
              <div 
                key={bed.id} 
                className="card" 
                style={{ 
                  padding: '20px 22px', 
                  margin: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  borderRadius: 'var(--radius-xl)',
                  background: '#fff',
                  border: isOccupied ? '1px solid #fee2e2' : '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                }}
              >
                <div>
                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOccupied ? 12 : 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a' }}>Room {bed.room}</div>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>({bed.bed_number} · {bed.ward})</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px', fontSize: 11, minHeight: 'auto', color: '#94a3b8', background: 'none', border: 'none' }}
                        title="Edit Bed Details"
                        onClick={() => setEditBed(bed)}
                      >
                        <EditPencilIcon />
                      </button>
                    </div>
                    <span style={{ 
                      background: isOccupied ? '#e0f2fe' : '#ecfdf5', 
                      color: isOccupied ? '#0284c7' : '#059669', 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: '3px 12px', 
                      borderRadius: 14 
                    }}>
                      {isOccupied ? 'Occupied' : 'Available'}
                    </span>
                  </div>

                  {/* Occupied State vs Available State */}
                  {isOccupied ? (
                    <div>
                      {/* Patient Info with Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 14 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#dcfce7',
                          color: '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0
                        }}>
                          {bed.patient_name ? bed.patient_name.trim().charAt(0).toUpperCase() : 'A'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', lineHeight: 1.2 }}>
                            {bed.patient_name || 'Occupied Patient'}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                            {formatDoctorName(bed.doctor_name) || 'Attending Physician'} • admitted {formatAdmissionDate(bed.admitted_at || (bed as any).created_at)}
                          </div>
                        </div>
                      </div>

                      {/* 5-Metric Vitals Mini-Grid */}
                      <BedVitalsGrid vitals={bed.vitals} />

                      {/* Vitals Updated Status Banner */}
                      <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#15803d',
                        marginBottom: 16,
                        textAlign: 'left'
                      }}>
                        {getVitalsUpdatedText(bed.vitals)}
                      </div>
                    </div>
                  ) : (
                    /* Available / Vacant Box */
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      borderRadius: 12,
                      padding: '40px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color: '#94a3b8',
                      fontSize: 13,
                      fontWeight: 500,
                      margin: '10px 0 16px'
                    }}>
                      <BedIcon />
                      <span>Bed is clean & vacant</span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isOccupied ? (
                    <>
                      <button 
                        className="btn btn-primary btn-sm" 
                        style={{ 
                          flex: 1.3, 
                          minHeight: 36, 
                          background: '#0d9488', 
                          border: 'none', 
                          borderRadius: 8, 
                          color: '#fff', 
                          fontWeight: 600, 
                          fontSize: 12.5 
                        }} 
                        onClick={() => setRecordVitalsBed(bed)}
                      >
                        Record Vitals
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ 
                          flex: 1, 
                          minHeight: 36, 
                          background: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: 8, 
                          color: '#334155', 
                          fontWeight: 600, 
                          fontSize: 12.5 
                        }} 
                        onClick={() => handleOpenVitalsLog(bed)}
                      >
                        Vitals Log
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ 
                          minHeight: 36, 
                          background: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: 8, 
                          color: '#334155', 
                          fontWeight: 600, 
                          fontSize: 12.5, 
                          padding: '0 14px' 
                        }} 
                        onClick={() => handleRelease(bed)}
                      >
                        Vacate
                      </button>
                    </>
                  ) : (
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ 
                        width: '100%', 
                        minHeight: 38, 
                        background: '#0d9488', 
                        border: 'none', 
                        borderRadius: 8, 
                        color: '#fff', 
                        fontWeight: 700, 
                        fontSize: 13 
                      }} 
                      onClick={() => setAllocateBed(bed)}
                    >
                      Allocate Bed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {addBedOpen && (
        <AddBedModal
          onClose={() => setAddBedOpen(false)}
          onDone={() => { setAddBedOpen(false); fetchBeds(false); }}
        />
      )}

      {editBed && (
        <EditBedModal
          bed={editBed}
          onClose={() => setEditBed(null)}
          onDone={() => { setEditBed(null); fetchBeds(false); }}
        />
      )}

      {allocateBed && (
        <AllocateBedModal
          bed={allocateBed}
          onClose={() => setAllocateBed(null)}
          onDone={() => { setAllocateBed(null); fetchBeds(false); }}
        />
      )}

      {recordVitalsBed && (
        <RecordVitalsModal
          bed={recordVitalsBed}
          onClose={() => setRecordVitalsBed(null)}
          onDone={() => { setRecordVitalsBed(null); fetchBeds(false); }}
        />
      )}

      {historyOpen && (
        <AdmissionHistoryModal
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {vitalsLogBed && (
        <VitalsLogModal
          bed={vitalsLogBed}
          list={vitalsLogList}
          loading={loadingVitalsLog}
          onClose={() => setVitalsLogBed(null)}
        />
      )}
    </div>
  );
}

// ── Add Bed Modal ───────────────────────────────────────────────────────
function AddBedModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    room: 'Room 1',
    bed_number: '',
    ward: 'General',
    type: 'Standard'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bed_number.trim()) {
      setError('Bed number is required.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      await apiClient.post('/beds', {
        room: form.room.trim(),
        bedNumber: form.bed_number.trim(),
        bed_number: form.bed_number.trim(),
        ward: form.ward.trim(),
        type: form.type.trim(),
        status: 'Available'
      });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create bed.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add New Bed</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-group">
              <label className="form-label">Room Identifier *</label>
              <input
                className="input"
                placeholder="e.g. Room 1, ICU Bay 2, Ward 3"
                value={form.room}
                onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bed Number / Code *</label>
              <input
                className="input"
                placeholder="e.g. 101, B-02, ICU-4"
                value={form.bed_number}
                onChange={e => setForm(f => ({ ...f, bed_number: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Ward Department *</label>
                <select
                  className="input"
                  value={form.ward}
                  onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
                >
                  <option value="General">General</option>
                  <option value="ICU">ICU</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Maternity">Maternity</option>
                  <option value="Pediatric">Pediatric</option>
                  <option value="Post-Op">Post-Op</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bed Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="Standard">Standard</option>
                  <option value="Semi-Private">Semi-Private</option>
                  <option value="ICU">ICU</option>
                  <option value="Ventilator">Ventilator</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Bed...' : 'Add Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Bed Modal ──────────────────────────────────────────────────────
function EditBedModal({ bed, onClose, onDone }: { bed: Bed; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    room: bed.room || '',
    bed_number: bed.bed_number || '',
    ward: bed.ward || 'General',
    type: bed.type || 'Standard',
    status: bed.status || 'Available'
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bed_number.trim()) {
      setError('Bed number is required.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      await apiClient.put(`/beds/${bed.id}`, {
        room: form.room.trim(),
        bedNumber: form.bed_number.trim(),
        bed_number: form.bed_number.trim(),
        ward: form.ward.trim(),
        type: form.type.trim(),
        status: form.status
      });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update bed details.');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to permanently delete Room ${bed.room} (${bed.bed_number})?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/beds/${bed.id}`);
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete bed.');
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Room {bed.room} ({bed.bed_number})</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-group">
              <label className="form-label">Room Identifier *</label>
              <input
                className="input"
                value={form.room}
                onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bed Number / Code *</label>
              <input
                className="input"
                value={form.bed_number}
                onChange={e => setForm(f => ({ ...f, bed_number: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Ward Department *</label>
                <select
                  className="input"
                  value={form.ward}
                  onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
                >
                  <option value="General">General</option>
                  <option value="ICU">ICU</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Maternity">Maternity</option>
                  <option value="Pediatric">Pediatric</option>
                  <option value="Post-Op">Post-Op</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bed Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="Standard">Standard</option>
                  <option value="Semi-Private">Semi-Private</option>
                  <option value="ICU">ICU</option>
                  <option value="Ventilator">Ventilator</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              <TrashIcon /> Delete Bed
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Allocate Bed Modal ──────────────────────────────────────────────────
function AllocateBedModal({ bed, onClose, onDone }: { bed: Bed; onClose: () => void; onDone: () => void }) {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(user?.role === 'doctor' ? user.id : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [patRes, docRes] = await Promise.allSettled([
          apiClient.get('/patients?limit=200'),
          apiClient.get('/users?role=doctor')
        ]);
        if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
          setPatients(patRes.value.data);
        } else {
          setPatients(await db.patients.toArray());
        }
        if (docRes.status === 'fulfilled' && Array.isArray(docRes.value.data)) {
          setDoctors(docRes.value.data);
        }
      } catch {
        setPatients(await db.patients.toArray());
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) { setError('Please select a patient to allocate the bed'); return; }
    setSubmitting(true);
    setError('');

    try {
      await apiClient.post(`/beds/${bed.id}/allocate`, {
        patient_id: selectedPatientId,
        doctor_id: selectedDoctorId || user?.id
      });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to allocate bed.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Allocate Room {bed.room} ({bed.bed_number})</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger">{error}</div>}
            
            <div className="form-group">
              <label className="form-label">Select Patient *</label>
              <select
                className="input"
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                required
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.uhid || p.phone || 'No UHID'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Attending Doctor</label>
              <select
                className="input"
                value={selectedDoctorId}
                onChange={e => setSelectedDoctorId(e.target.value)}
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} ({d.specialization || d.department || 'Medicine'})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Allocating Bed...' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record Vitals Modal ─────────────────────────────────────────────────
function RecordVitalsModal({ bed, onClose, onDone }: { bed: Bed; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    heartRate: '72',
    spo2: '98',
    temperature: '98.6',
    respiratoryRate: '16',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bed.patient_id) { setError('Bed has no assigned patient'); return; }
    setSubmitting(true);
    setError('');

    const payload = {
      patientId: bed.patient_id,
      patient_id: bed.patient_id,
      bpSystolic: Number(form.bpSystolic) || 120,
      bpDiastolic: Number(form.bpDiastolic) || 80,
      heartRate: Number(form.heartRate) || 72,
      spo2: Number(form.spo2) || 98,
      temperature: Number(form.temperature) || 98.6,
      respiratoryRate: Number(form.respiratoryRate) || 16,
      notes: form.notes.trim()
    };

    try {
      const res = await apiClient.post('/vitals', payload);
      await db.vitals.put(res.data);
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to record vitals.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Record Vitals for {bed.patient_name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger">{error}</div>}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">BP Systolic (mmHg)</label>
                <input className="input" type="number" value={form.bpSystolic} onChange={e => setForm(f => ({ ...f, bpSystolic: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">BP Diastolic (mmHg)</label>
                <input className="input" type="number" value={form.bpDiastolic} onChange={e => setForm(f => ({ ...f, bpDiastolic: e.target.value }))} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Heart Rate (bpm)</label>
                <input className="input" type="number" value={form.heartRate} onChange={e => setForm(f => ({ ...f, heartRate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">SpO2 Saturation (%)</label>
                <input className="input" type="number" value={form.spo2} onChange={e => setForm(f => ({ ...f, spo2: e.target.value }))} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Temperature (°F)</label>
                <input className="input" type="number" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Respiratory Rate (bpm)</label>
                <input className="input" type="number" value={form.respiratoryRate} onChange={e => setForm(f => ({ ...f, respiratoryRate: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Observations & Notes</label>
              <textarea className="input" style={{ minHeight: 60 }} placeholder="e.g. Patient resting comfortably, O2 normal..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording Vitals...' : 'Save Vitals Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Admission History Modal ─────────────────────────────────────────────
function AdmissionHistoryModal({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<BedAdmissionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/beds/history');
        setHistory(res.data || []);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Dynamically extract distinct months available in admission records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    history.forEach(h => {
      const dateStr = h.admitted_at || h.discharged_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const q = filter.toLowerCase().trim();
      const matchesSearch = !q || (
        (h.patient_name || '').toLowerCase().includes(q) ||
        (h.patient_uhid || '').toLowerCase().includes(q) ||
        (h.room || '').toLowerCase().includes(q) ||
        (h.bed_number || '').toLowerCase().includes(q) ||
        (h.ward || '').toLowerCase().includes(q) ||
        (h.doctor_name || '').toLowerCase().includes(q) ||
        (h.status || '').toLowerCase().includes(q)
      );

      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        const dateStr = h.admitted_at || h.discharged_at;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            matchesMonth = key === selectedMonth;
          } else {
            matchesMonth = false;
          }
        } else {
          matchesMonth = false;
        }
      }

      return matchesSearch && matchesMonth;
    });
  }, [history, filter, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, currentPage]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, width: '92%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="modal-title" style={{ fontSize: 18, fontWeight: 700 }}>Bed Admission & Occupancy History</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete audit trail of inpatient bed admissions and discharges</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filter Bar: Search + Months Filter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <input
                className="input"
                style={{ paddingLeft: 36, width: '100%' }}
                placeholder="Search by patient name, UHID, room, ward, or doctor..."
                value={filter}
                onChange={e => {
                  setFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <div style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}>
                <SearchIcon />
              </div>
            </div>

            {/* Months Filter Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                <CalendarIcon /> Month:
              </div>
              <select
                className="select"
                style={{ minWidth: 155, height: 38, fontSize: 13 }}
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Months</option>
                {availableMonths.map(m => {
                  const [y, mon] = m.split('-');
                  const label = new Date(parseInt(y), parseInt(mon) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No admission history records found.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', minHeight: 280 }}>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 42, textAlign: 'center' }}>#</th>
                      <th>Patient</th>
                      <th>Bed / Room</th>
                      <th>Ward</th>
                      <th>Admitted</th>
                      <th>Discharged</th>
                      <th>Duration</th>
                      <th>Doctor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((h, idx) => (
                      <tr key={h.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {(currentPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {h.patient_name || 'Patient'}
                          {h.patient_uhid && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h.patient_uhid}</div>}
                        </td>
                        <td>Room {h.room || '-'} ({h.bed_number || '-'})</td>
                        <td><span className="badge badge-secondary" style={{ fontSize: 11 }}>{h.ward || 'General'}</span></td>
                        <td style={{ fontSize: 11 }}>{h.admitted_at ? new Date(h.admitted_at).toLocaleString() : '-'}</td>
                        <td style={{ fontSize: 11 }}>{h.discharged_at ? new Date(h.discharged_at).toLocaleString() : 'Currently Admitted'}</td>
                        <td>{h.stay_days ? `${h.stay_days} d` : '-'}</td>
                        <td style={{ fontSize: 11 }}>{formatDoctorName(h.doctor_name) || '-'}</td>
                        <td>
                          <span className={`badge ${h.status === 'Admitted' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 10 Patients per Block Pagination Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTop: '1px solid var(--border-light)',
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text)' }}>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to <strong style={{ color: 'var(--text)' }}>{Math.min(currentPage * PAGE_SIZE, filteredHistory.length)}</strong> of <strong style={{ color: 'var(--text)' }}>{filteredHistory.length}</strong> patients (10 per page)
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                  >
                    <ChevronLeftIcon /> Previous
                  </button>

                  <div style={{ display: 'flex', gap: 4, margin: '0 4px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${pageNum === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ minWidth: 32, padding: '3px 8px', fontWeight: pageNum === currentPage ? 700 : 500 }}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                  >
                    Next <ChevronRightIcon />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Vitals Log Modal ────────────────────────────────────────────────────
function VitalsLogModal({ bed, list, loading, onClose }: { bed: Bed; list: any[]; loading: boolean; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 660, width: '90%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ fontSize: 17, fontWeight: 700 }}>Vitals History: {bed.patient_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Room {bed.room} ({bed.bed_number}) · {bed.ward} Ward</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : list.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No vitals entries recorded yet for this patient.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
              {list.map((v, i) => (
                <div key={v.id || i} style={{ background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {v.recorded_at ? new Date(v.recorded_at).toLocaleString() : 'Recent observation'}
                    </span>
                    <span>By: {v.recorded_by || 'Nurse / Doctor'}</span>
                  </div>
                  <BedVitalsBadges vitals={v} />
                  {v.notes && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                      <em>"{v.notes}"</em>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
