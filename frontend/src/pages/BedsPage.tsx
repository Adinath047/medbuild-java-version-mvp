import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';
import { triggerSyncBroadcast } from '../sync/syncManager';

interface Bed {
  id: string;
  bed_number: string;
  room: string;
  ward: string;
  type: string;
  status: 'Available' | 'Occupied';
  patient_id: string | null;
  patient_name: string | null;
  patient_uhid: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  admitted_at: string | null;
  vitals: any | null;
  patient_photo?: string | null;
}

const getLocalDatetimeString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - offset * 60 * 1000);
  return localNow.toISOString().slice(0, 16);
};

function sortBedsList(list: Bed[]) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const aIcu = a.ward === 'ICU' ? 0 : 1;
    const bIcu = b.ward === 'ICU' ? 0 : 1;
    if (aIcu !== bIcu) return aIcu - bIcu;
    const wardComp = (a.ward || '').localeCompare(b.ward || '');
    if (wardComp !== 0) return wardComp;
    const roomComp = (a.room || '').localeCompare(b.room || '');
    if (roomComp !== 0) return roomComp;
    return (a.bed_number || '').localeCompare(b.bed_number || '');
  });
}

export default function BedsPage({ onNavigate }: { onNavigate?: (p: string, d?: any) => void } = {}) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  
  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  // Vitals Log Modal State
  const [vitalsLogBed, setVitalsLogBed] = useState<Bed | null>(null);
  const [vitalsLogList, setVitalsLogList] = useState<any[]>([]);
  const [loadingVitalsLog, setLoadingVitalsLog] = useState(false);
  
  // Filtering
  const [selectedWard, setSelectedWard] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Occupied'>('All');
  
  // Modals state
  const [allocateBed, setAllocateBed] = useState<Bed | null>(null);
  const [recordVitalsBed, setRecordVitalsBed] = useState<Bed | null>(null);
  
  // Allocation Form State
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [submittingAlloc, setSubmittingAlloc] = useState(false);
  
  // Vitals Form State
  const [vitalsForm, setVitalsForm] = useState({
    bp_systolic: '',
    bp_diastolic: '',
    heart_rate: '',
    temperature: '',
    spo2: '',
    respiratory_rate: '',
    blood_sugar: '',
    blood_sugar_type: 'Random',
    notes: '',
    medicines_given: '',
    recorded_at: '',
  });
  const [submittingVitals, setSubmittingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState('');

  // Add Bed State
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [newBedForm, setNewBedForm] = useState({ bed_number: '', room: '', ward: '', type: 'General' });
  const [submittingNewBed, setSubmittingNewBed] = useState(false);
  const [newBedError, setNewBedError] = useState('');

  // Edit Bed State
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [editBedForm, setEditBedForm] = useState({ bed_number: '', room: '', ward: '', type: 'General' });
  const [submittingEditBed, setSubmittingEditBed] = useState(false);
  const [editBedError, setEditBedError] = useState('');

  // Fetch beds on mount
  useEffect(() => {
    fetchBeds(false);
  }, []);

  // Fetch beds silently on sync
  useEffect(() => {
    if (syncCount > 0) {
      fetchBeds(true);
    }
  }, [syncCount]);

  // Fetch beds on real-time update event
  useEffect(() => {
    const handleBedsUpdate = () => {
      fetchBeds(true);
    };
    window.addEventListener('emr:beds-update', handleBedsUpdate);
    return () => {
      window.removeEventListener('emr:beds-update', handleBedsUpdate);
    };
  }, []);

  // Fetch history list when modal is shown
  useEffect(() => {
    if (showHistory) {
      setLoadingHistory(true);
      apiClient.get('/beds/history')
        .then(res => setHistoryList(res.data || []))
        .catch(err => alert(err?.response?.data?.error || 'Failed to load admission history.'))
        .finally(() => setLoadingHistory(false));
    }
  }, [showHistory]);

  // Fetch patients/doctors only when allocation modal opens
  useEffect(() => {
    if (allocateBed) {
      setPatientSearch('');
      setSelectedPatientId('');
      setSelectedDoctorId('');
      
      apiClient.get('/patients?limit=500')
        .then(res => setPatients(res.data.patients || []))
        .catch(() => {});
        
      apiClient.get('/users/doctors')
        .then(res => setDoctors(res.data || []))
        .catch(() => {});
    }
  }, [allocateBed]);

  // Load vitals form when vitals modal opens
  useEffect(() => {
    if (recordVitalsBed) {
      setVitalsForm({
        bp_systolic: recordVitalsBed.vitals?.bp_systolic || '',
        bp_diastolic: recordVitalsBed.vitals?.bp_diastolic || '',
        heart_rate: recordVitalsBed.vitals?.heart_rate || '',
        temperature: recordVitalsBed.vitals?.temperature || '',
        spo2: recordVitalsBed.vitals?.spo2 || '',
        respiratory_rate: recordVitalsBed.vitals?.respiratory_rate || '',
        blood_sugar: recordVitalsBed.vitals?.blood_sugar || '',
        blood_sugar_type: recordVitalsBed.vitals?.blood_sugar_type || 'Random',
        notes: '',
        medicines_given: '',
        recorded_at: getLocalDatetimeString(),
      });
      setVitalsError('');
    }
  }, [recordVitalsBed]);

  async function fetchBeds(isSilent = false) {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/beds');
      setBeds(sortBedsList(res.data));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load beds.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  // Handle Allocation Submit
  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!allocateBed) return;
    if (!selectedPatientId) {
      alert('Please select a patient.');
      return;
    }
    
    setSubmittingAlloc(true);
    try {
      await apiClient.put(`/beds/${allocateBed.id}/allocate`, {
        patient_id: selectedPatientId,
        doctor_id: selectedDoctorId || undefined,
      });
      setAllocateBed(null);
      await fetchBeds();
      triggerSyncBroadcast();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Allocation failed.');
    } finally {
      setSubmittingAlloc(false);
    }
  }

  // Handle Release Bed
  async function handleRelease(bedId: string) {
    if (!confirm('Are you sure you want to release / vacate this bed?')) return;
    try {
      await apiClient.put(`/beds/${bedId}/release`);
      await fetchBeds();
      triggerSyncBroadcast();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to release bed.');
    }
  }

  // Handle Vitals Submit
  async function handleSaveVitals(e: React.FormEvent) {
    e.preventDefault();
    if (!recordVitalsBed || !recordVitalsBed.patient_id) return;
    
    setSubmittingVitals(true);
    setVitalsError('');
    try {
      const payload: any = {
        patient_id: recordVitalsBed.patient_id,
        temperature_unit: 'F',
        weight_unit: 'kg',
        height_unit: 'cm',
      };
      
      // Parse values or send null
      if (vitalsForm.bp_systolic) payload.bp_systolic = parseInt(vitalsForm.bp_systolic);
      if (vitalsForm.bp_diastolic) payload.bp_diastolic = parseInt(vitalsForm.bp_diastolic);
      if (vitalsForm.heart_rate) payload.heart_rate = parseInt(vitalsForm.heart_rate);
      if (vitalsForm.temperature) payload.temperature = parseFloat(vitalsForm.temperature);
      if (vitalsForm.spo2) payload.spo2 = parseInt(vitalsForm.spo2);
      if (vitalsForm.respiratory_rate) payload.respiratory_rate = parseInt(vitalsForm.respiratory_rate);
      if (vitalsForm.blood_sugar) payload.blood_sugar = parseInt(vitalsForm.blood_sugar);
      if (vitalsForm.blood_sugar_type) payload.blood_sugar_type = vitalsForm.blood_sugar_type;
      if (vitalsForm.notes) payload.notes = vitalsForm.notes;
      if (vitalsForm.medicines_given) payload.medicines_given = vitalsForm.medicines_given;
      if (vitalsForm.recorded_at) payload.recorded_at = new Date(vitalsForm.recorded_at).toISOString();
      
      await apiClient.post('/vitals', payload);
      setRecordVitalsBed(null);
      await fetchBeds();
      triggerSyncBroadcast();
    } catch (err: any) {
      setVitalsError(err?.response?.data?.error || err?.response?.data?.details?.join(', ') || 'Failed to save vitals.');
    } finally {
      setSubmittingVitals(false);
    }
  }

  async function handleOpenVitalsLog(bed: Bed) {
    if (!bed.patient_id) return;
    setVitalsLogBed(bed);
    setLoadingVitalsLog(true);
    try {
      const res = await apiClient.get(`/vitals?patient_id=${bed.patient_id}&limit=100`);
      const admittedTime = bed.admitted_at ? new Date(bed.admitted_at).getTime() : 0;
      const filtered = (res.data || []).filter((v: any) => {
        const recordedTime = new Date(v.recorded_at).getTime();
        return recordedTime >= admittedTime;
      });
      setVitalsLogList(filtered);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to fetch vitals logs.');
    } finally {
      setLoadingVitalsLog(false);
    }
  }

  async function handleAddBed(e: React.FormEvent) {
    e.preventDefault();
    if (!newBedForm.bed_number.trim() || !newBedForm.room.trim() || !newBedForm.ward.trim()) {
      setNewBedError('Bed number, room, and ward are required.');
      return;
    }
    setSubmittingNewBed(true);
    setNewBedError('');
    try {
      await apiClient.post('/beds', { ...newBedForm, type: newBedForm.ward });
      setShowAddBedModal(false);
      setNewBedForm({ bed_number: '', room: '', ward: '', type: 'General' });
      await fetchBeds();
      triggerSyncBroadcast();
    } catch (err: any) {
      setNewBedError(err?.response?.data?.error || 'Failed to add bed.');
    } finally {
      setSubmittingNewBed(false);
    }
  }

  async function handleEditBed(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBed) return;
    if (!editBedForm.bed_number.trim() || !editBedForm.room.trim() || !editBedForm.ward.trim()) {
      setEditBedError('Bed number, room, and ward are required.');
      return;
    }
    setSubmittingEditBed(true);
    setEditBedError('');
    try {
      await apiClient.patch(`/beds/${editingBed.id}`, { ...editBedForm, type: editBedForm.ward });
      setEditingBed(null);
      await fetchBeds();
      triggerSyncBroadcast();
    } catch (err: any) {
      setEditBedError(err?.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSubmittingEditBed(false);
    }
  }

  // Grouping list of Wards
  const wardsList = ['All', ...Array.from(new Set(beds.map(b => b.ward)))];

  // Filtering Logic
  const filteredBeds = beds.filter(bed => {
    const wardMatch = selectedWard === 'All' || bed.ward === selectedWard;
    const statusMatch = statusFilter === 'All' || bed.status === statusFilter;
    return wardMatch && statusMatch;
  });

  const filteredPatientsForSelect = patientSearch
    ? patients.filter(p => p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || p.uhid?.includes(patientSearch))
    : patients;

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;
  
  const getWardOccupancyStr = (wardName: string) => {
    const wBeds = beds.filter(b => b.ward?.toLowerCase().trim() === wardName.toLowerCase().trim());
    const wOccupied = wBeds.filter(b => b.status === 'Occupied').length;
    return `${wOccupied}/${wBeds.length} ${wardName}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <div className="page-title" style={{ fontSize: 24, fontWeight: 700 }}>Bed Allocation Management</div>
          <div className="page-sub" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live view of every bed and vital sign</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddBedModal(true); setNewBedError(''); }}>
            ➕ Add Bed
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowHistory(true)}>
            📋 View Admission History
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchBeds(false)} disabled={loading}>
            {loading ? <div className="spinner spinner-sm" /> : '🔄 Refresh Status'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Main Stats Block */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Wards</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: '-0.3px', color: 'var(--text)' }}>Beds & Vitals Board</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
          Track occupancy, record vitals in seconds, and spot overdue observations at a glance.
        </p>

        {/* Occupancy stats details */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTop: '1px solid var(--border-light)', paddingTop: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Occupancy</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {occupiedBeds} <span style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 500 }}>/ {totalBeds}</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200, maxWidth: 400, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#0d9488', width: `${totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0}%`, borderRadius: 4 }} />
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600, color: 'var(--text-sec)' }}>
            <span>{getWardOccupancyStr('General')}</span>
            <span>•</span>
            <span>{getWardOccupancyStr('ICU')}</span>
            <span>•</span>
            <span>{getWardOccupancyStr('Emergency')}</span>
            <span>•</span>
            <span>{getWardOccupancyStr('Maternity')}</span>
          </div>
        </div>
      </div>

      {/* Filters (Double Row) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: Wards */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {wardsList.map(ward => {
            const isActive = selectedWard === ward;
            return (
              <button
                key={ward}
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedWard(ward)}
                style={{
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontWeight: 600,
                  fontSize: 12.5,
                  background: isActive ? 'var(--primary)' : 'var(--surface)',
                  color: isActive ? '#fff' : 'var(--text-sec)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.1s ease'
                }}
              >
                {ward}
              </button>
            );
          })}
        </div>

        {/* Row 2: Status */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['All', 'Available', 'Occupied'] as const).map(status => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                className="btn btn-sm"
                onClick={() => setStatusFilter(status)}
                style={{
                  borderRadius: '20px',
                  padding: '5px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  background: isActive ? '#1e293b' : 'var(--surface)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  border: isActive ? '1px solid #1e293b' : '1px solid var(--border)',
                  transition: 'all 0.1s ease'
                }}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredBeds.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 24px' }}>
          <span className="empty-icon">🛏️</span>
          <h3>No beds found</h3>
          <p>No beds match the current filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {filteredBeds.map(bed => {
            const isOccupied = bed.status === 'Occupied';
            const vitals = bed.vitals || {};
            
            // Check abnormal thresholds
            const isBpAbnormal = vitals.bp_systolic && (vitals.bp_systolic > 140 || vitals.bp_systolic < 90 || vitals.bp_diastolic > 90 || vitals.bp_diastolic < 60);
            const isHrAbnormal = vitals.heart_rate && (vitals.heart_rate > 100 || vitals.heart_rate < 60);
            const isSpo2Abnormal = vitals.spo2 && vitals.spo2 < 95;
            
            // Temp check (handles F and C scales)
            let isTempAbnormal = false;
            if (vitals.temperature) {
              const tempVal = parseFloat(vitals.temperature);
              if (tempVal > 35 && tempVal < 45) { // Celsius
                isTempAbnormal = tempVal > 37.5 || tempVal < 36.0;
              } else { // Fahrenheit
                isTempAbnormal = tempVal > 99.5 || tempVal < 96.8;
              }
            }
            
            const isSugarAbnormal = vitals.blood_sugar && (vitals.blood_sugar > 140 || vitals.blood_sugar < 70);
            const isCritical = isBpAbnormal || isHrAbnormal || isSpo2Abnormal || isTempAbnormal || isSugarAbnormal;

            // Compute last updated time display banner properties
            let bannerText = '';
            let bannerBg = '';
            let bannerBorder = '';
            let bannerColor = '';

            if (!vitals.recorded_at) {
              bannerText = 'No vitals recorded yet';
              bannerBg = '#fffbeb';
              bannerBorder = '1px solid #fde68a';
              bannerColor = '#b45309';
            } else {
              const recordedTime = new Date(vitals.recorded_at).getTime();
              const diffMs = Date.now() - recordedTime;
              const diffMins = Math.max(0, Math.floor(diffMs / (60 * 1000)));
              const diffHours = Math.floor(diffMs / (3600 * 1000));

              let timeStr = '';
              if (diffMins < 1) {
                timeStr = 'just now';
              } else if (diffMins < 60) {
                timeStr = `${diffMins}m ago`;
              } else {
                timeStr = `${diffHours}h ago`;
              }

              // Overdue threshold is 4 hours
              if (diffMs >= 4 * 3600 * 1000) {
                bannerText = `Vitals overdue – last recorded ${timeStr}`;
                bannerBg = '#fffbeb';
                bannerBorder = '1px solid #fde68a';
                bannerColor = '#b45309';
              } else {
                bannerText = `Vitals updated recently (${timeStr})`;
                bannerBg = '#f0fdf4';
                bannerBorder = '1px solid #bbf7d0';
                bannerColor = '#15803d';
              }
            }

            return (
              <div
                key={bed.id}
                className="card"
                style={{
                  margin: 0,
                  border: isCritical ? '1px solid #fecaca' : `1px solid ${isOccupied ? '#bfdbfe' : 'var(--border)'}`,
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  padding: 18,
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative'
                }}
              >
                {/* Bed Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Room {bed.room}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({bed.bed_number} · {bed.ward})</span>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: '2px 4px', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Edit Bed Configurations"
                      onClick={() => {
                        setEditingBed(bed);
                        setEditBedForm({
                          bed_number: bed.bed_number,
                          room: bed.room,
                          ward: bed.ward,
                          type: bed.type
                        });
                        setEditBedError('');
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                  
                  <span
                    className={`badge ${isOccupied ? 'badge-info' : 'badge-success'}`}
                    style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px' }}
                  >
                    {isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>

                {/* Occupant Detail */}
                {isOccupied ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12.5,
                          fontWeight: 700,
                          overflow: 'hidden'
                        }}>
                          {bed.patient_photo ? (
                            <img src={bed.patient_photo} alt={bed.patient_name || 'Patient'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            bed.patient_name ? bed.patient_name[0].toUpperCase() : 'P'
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                            {bed.patient_name}
                            {isCritical && <span className="blinking-dot" title="Critical/Abnormal Vitals" />}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {bed.doctor_name ? (bed.doctor_name.toLowerCase().startsWith('dr.') ? bed.doctor_name : `Dr. ${bed.doctor_name}`) : '—'} · admitted {bed.admitted_at ? new Date(bed.admitted_at).toLocaleDateString('en-IN') : 'recently'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vitals Blocks Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {/* 1. BP */}
                      <div className={`vital-tile ${isBpAbnormal ? 'vital-tile-danger' : ''}`} style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '10px 4px',
                        textAlign: 'center'
                      }}>
                        <div className="vital-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : '—'}
                        </div>
                        <div className="vital-label" style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>BP</div>
                      </div>

                      {/* 2. HR */}
                      <div className={`vital-tile ${isHrAbnormal ? 'vital-tile-danger' : ''}`} style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '10px 4px',
                        textAlign: 'center'
                      }}>
                        <div className="vital-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {vitals.heart_rate ? `${vitals.heart_rate}` : '—'}
                          {vitals.heart_rate && <span style={{ fontSize: 8, fontWeight: 500, marginLeft: 1 }}>bpm</span>}
                        </div>
                        <div className="vital-label" style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>HR</div>
                      </div>

                      {/* 3. SPO2 */}
                      <div className={`vital-tile ${isSpo2Abnormal ? 'vital-tile-danger' : ''}`} style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '10px 4px',
                        textAlign: 'center'
                      }}>
                        <div className="vital-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {vitals.spo2 ? `${vitals.spo2}%` : '—'}
                        </div>
                        <div className="vital-label" style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>SPO2</div>
                      </div>

                      {/* 4. TEMP */}
                      <div className={`vital-tile ${isTempAbnormal ? 'vital-tile-danger' : ''}`} style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '10px 4px',
                        textAlign: 'center'
                      }}>
                        <div className="vital-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {vitals.temperature ? `${vitals.temperature}` : '—'}
                          {vitals.temperature && <span style={{ fontSize: 8, fontWeight: 500, marginLeft: 1 }}>°F</span>}
                        </div>
                        <div className="vital-label" style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>TEMP</div>
                      </div>

                      {/* 5. SUGAR */}
                      <div className={`vital-tile ${isSugarAbnormal ? 'vital-tile-danger' : ''}`} style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '10px 4px',
                        textAlign: 'center'
                      }}>
                        <div className="vital-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {vitals.blood_sugar ? `${vitals.blood_sugar}` : '—'}
                          {vitals.blood_sugar && <span style={{ fontSize: 7, fontWeight: 500, marginLeft: 1 }}>mg/dL</span>}
                        </div>
                        <div className="vital-label" style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 4, fontWeight: 700 }}>SUGAR</div>
                      </div>
                    </div>

                    {/* Vitals Warning Banner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: bannerBg,
                      border: bannerBorder,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: 12,
                      color: bannerColor,
                      fontWeight: 500
                    }}>
                      <span>{bannerText}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1.5, background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12.5, minHeight: 30 }}
                        onClick={() => setRecordVitalsBed(bed)}
                      >
                        Record Vitals
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, fontWeight: 600, fontSize: 12.5, minHeight: 30 }}
                        onClick={() => handleOpenVitalsLog(bed)}
                      >
                        Vitals Log
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-muted)', fontSize: 12, minHeight: 30 }}
                        onClick={() => handleRelease(bed.id)}
                      >
                        Vacate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', justifyContent: 'space-between' }}>
                    <div style={{
                      height: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px dashed var(--border)',
                      borderRadius: 12,
                      color: 'var(--text-light)',
                      fontSize: 12.5,
                      background: '#f8fafc'
                    }}>
                      🛏️ Bed is clean & vacant
                    </div>
                    
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 12.5, minHeight: 32 }}
                      onClick={() => setAllocateBed(bed)}
                    >
                      Allocate Bed
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* Allocation Modal */}
      {allocateBed && (
        <div className="modal-overlay" onClick={() => setAllocateBed(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Allocate {allocateBed.room} ({allocateBed.bed_number})</div>
              <button className="modal-close" onClick={() => setAllocateBed(null)}>✕</button>
            </div>
            <form onSubmit={handleAllocate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Search Patient *</label>
                  <input
                    className="input"
                    placeholder="Search patient by name or UHID..."
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Select Patient *</label>
                  <select
                    className="input"
                    value={selectedPatientId}
                    onChange={e => setSelectedPatientId(e.target.value)}
                    required
                  >
                    <option value="">— Select Patient —</option>
                    {filteredPatientsForSelect.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.uhid})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Attending Doctor (Optional)</label>
                  <select
                    className="input"
                    value={selectedDoctorId}
                    onChange={e => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">— Select Attending Doctor —</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization || 'General'})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setAllocateBed(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingAlloc}>
                  {submittingAlloc ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Vitals Modal */}
      {recordVitalsBed && (
        <div className="modal-overlay" onClick={() => setRecordVitalsBed(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Record Vitals - {recordVitalsBed.patient_name}</div>
              <button className="modal-close" onClick={() => setRecordVitalsBed(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveVitals}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {vitalsError && <div className="alert alert-danger">{vitalsError}</div>}

                <div className="form-group">
                  <label className="form-label">Date & Time of Record *</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={vitalsForm.recorded_at}
                    onChange={e => setVitalsForm(f => ({ ...f, recorded_at: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">BP (Systolic)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 120"
                      value={vitalsForm.bp_systolic}
                      onChange={e => setVitalsForm(f => ({ ...f, bp_systolic: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BP (Diastolic)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 80"
                      value={vitalsForm.bp_diastolic}
                      onChange={e => setVitalsForm(f => ({ ...f, bp_diastolic: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 72"
                      value={vitalsForm.heart_rate}
                      onChange={e => setVitalsForm(f => ({ ...f, heart_rate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SpO₂ (%)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 98"
                      value={vitalsForm.spo2}
                      onChange={e => setVitalsForm(f => ({ ...f, spo2: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temperature (°F)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 98.6"
                      value={vitalsForm.temperature}
                      onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resp. Rate (/min)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 16"
                      value={vitalsForm.respiratory_rate}
                      onChange={e => setVitalsForm(f => ({ ...f, respiratory_rate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Sugar (mg/dL)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 110"
                      value={vitalsForm.blood_sugar}
                      onChange={e => setVitalsForm(f => ({ ...f, blood_sugar: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sugar Type</label>
                    <select
                      className="input"
                      value={vitalsForm.blood_sugar_type}
                      onChange={e => setVitalsForm(f => ({ ...f, blood_sugar_type: e.target.value }))}
                    >
                      <option value="Random">Random</option>
                      <option value="Fasting">Fasting</option>
                      <option value="Post-meal">Post-meal</option>
                      <option value="HbA1c">HbA1c</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Clinical Notes</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="General status, complaints, notes..."
                    value={vitalsForm.notes}
                    onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Medicines Given during Stay (Free Text)</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Enter medicines administered to the patient..."
                    value={vitalsForm.medicines_given}
                    onChange={e => setVitalsForm(f => ({ ...f, medicines_given: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setRecordVitalsBed(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingVitals}>
                  {submittingVitals ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admission History Modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal" style={{ maxWidth: 800, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📋 Bed Admission & Visit History</div>
              <button className="modal-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : historyList.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <span className="empty-icon">📋</span>
                  <h3>No history records</h3>
                  <p>No patients have used bed services yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historyList.map((adm: any) => {
                    const isActive = adm.status === 'Admitted';
                    return (
                      <div
                        key={adm.id}
                        className="card"
                        style={{
                          margin: 0,
                          border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                          background: isActive ? 'rgba(14, 165, 233, 0.03)' : 'var(--surface)',
                          padding: 14,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>
                              {adm.patient_name} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>({adm.patient_uhid})</span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                              🛏️ {adm.room} ({adm.bed_number}) · {adm.ward} ({adm.bed_type} Bed)
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                              Admitted: <strong>{new Date(adm.admitted_at).toLocaleString('en-IN')}</strong>
                              {adm.discharged_at ? (
                                <> · Vacated: <strong>{new Date(adm.discharged_at).toLocaleString('en-IN')}</strong></>
                              ) : (
                                <span style={{ marginLeft: 6 }} className="badge badge-success">Currently Admitted</span>
                              )}
                            </div>
                            {adm.doctor_name && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                Attending: <strong>Dr. {adm.doctor_name}</strong>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
                              Stay: {adm.stay_days} {adm.stay_days === 1 ? 'Day' : 'Days'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Status: <strong style={{ color: adm.billing_status === 'Billed' ? 'var(--success)' : 'var(--danger)' }}>{adm.billing_status}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Log Modal */}
      {vitalsLogBed && (
        <div className="modal-overlay" onClick={() => setVitalsLogBed(null)}>
          <div className="modal" style={{ maxWidth: 640, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📋 Vitals & Medicines Log - {vitalsLogBed.patient_name}</div>
              <button className="modal-close" onClick={() => setVitalsLogBed(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Showing daily logs for current stay (Admitted: <strong>{vitalsLogBed.admitted_at ? new Date(vitalsLogBed.admitted_at).toLocaleString('en-IN') : ''}</strong>)
              </div>
              {loadingVitalsLog ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : vitalsLogList.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <span className="empty-icon">📋</span>
                  <h3>No vitals recorded</h3>
                  <p>No vitals or medicines have been recorded during this stay yet.</p>
                </div>
              ) : (
                <div style={{ borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 12, marginLeft: 6 }}>
                  {vitalsLogList.map((v: any) => (
                    <div key={v.id} style={{ position: 'relative' }}>
                      {/* Timeline bullet */}
                      <div style={{
                        position: 'absolute',
                        left: -17,
                        top: 3,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                      }} />
                      
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                        📅 {new Date(v.recorded_at).toLocaleString('en-IN')} · Attended by: <span style={{ color: 'var(--text)' }}>{v.recorded_by_name || 'Staff'}</span>
                      </div>

                      {/* Vitals grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '6px 12px',
                        marginTop: 6,
                        fontSize: 12,
                        background: 'var(--surface-alt)',
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid var(--border-light)'
                      }}>
                        {v.bp_systolic && <div>BP: <strong>{v.bp_systolic}/{v.bp_diastolic}</strong> mmHg</div>}
                        {v.heart_rate && <div>HR: <strong>{v.heart_rate}</strong> bpm</div>}
                        {v.temperature && <div>Temp: <strong>{v.temperature}</strong>°{v.temperature_unit || 'F'}</div>}
                        {v.spo2 && <div>SpO₂: <strong>{v.spo2}</strong>%</div>}
                        {v.respiratory_rate && <div>Resp: <strong>{v.respiratory_rate}</strong>/min</div>}
                        {v.blood_sugar && <div>Sugar: <strong>{v.blood_sugar}</strong> ({v.blood_sugar_type})</div>}
                      </div>

                      {/* Medicines text */}
                      {v.medicines_given && (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12 }}>
                          💊 <strong>Medicines Administered:</strong>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: 3, color: '#92400e' }}>{v.medicines_given}</div>
                        </div>
                      )}

                      {v.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                          Notes: {v.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setVitalsLogBed(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bed Modal */}
      {showAddBedModal && (
        <div className="modal-overlay" onClick={() => setShowAddBedModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">➕ Register New Hospital Bed</div>
              <button className="modal-close" onClick={() => setShowAddBedModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBed}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {newBedError && <div className="alert alert-danger">⚠️ {newBedError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Ward Name *</label>
                  <input 
                    className="input" 
                    placeholder="e.g. General Ward, ICU, Private Room" 
                    value={newBedForm.ward} 
                    onChange={e => setNewBedForm(f => ({ ...f, ward: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input 
                    className="input" 
                    placeholder="e.g. Room 101, ICU Bed-01" 
                    value={newBedForm.room} 
                    onChange={e => setNewBedForm(f => ({ ...f, room: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bed Name / Number *</label>
                  <input 
                    className="input" 
                    placeholder="e.g. Bed A, Bed 1" 
                    value={newBedForm.bed_number} 
                    onChange={e => setNewBedForm(f => ({ ...f, bed_number: e.target.value }))}
                    required
                  />
                </div>


              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBedModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingNewBed}>
                  {submittingNewBed ? 'Adding…' : '✓ Add Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bed Modal */}
      {editingBed && (
        <div className="modal-overlay" onClick={() => setEditingBed(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Bed Configurations</div>
              <button className="modal-close" onClick={() => setEditingBed(null)}>✕</button>
            </div>
            <form onSubmit={handleEditBed}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {editBedError && <div className="alert alert-danger">⚠️ {editBedError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Ward Name *</label>
                  <input 
                    className="input" 
                    value={editBedForm.ward} 
                    onChange={e => setEditBedForm(f => ({ ...f, ward: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input 
                    className="input" 
                    value={editBedForm.room} 
                    onChange={e => setEditBedForm(f => ({ ...f, room: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bed Name / Number *</label>
                  <input 
                    className="input" 
                    value={editBedForm.bed_number} 
                    onChange={e => setEditBedForm(f => ({ ...f, bed_number: e.target.value }))}
                    required
                  />
                </div>


              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingBed(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingEditBed}>
                  {submittingEditBed ? 'Saving…' : '✓ Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
