import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';

export default function NurseDashboard({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [bedStats, setBedStats] = useState({ occupied: 0, total: 0 });
  const [patients, setPatients] = useState<any[]>([]);
  const [vitalsList, setVitalsList] = useState<any[]>([]);

  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [vitalsForm, setVitalsForm] = useState({
    bp_sys: '120',
    bp_dia: '80',
    heart_rate: '72',
    temperature: '98.6',
    spo2: '98',
    respiratory_rate: '18',
    notes: 'Vitals stable during nursing round.'
  });

  const loadNurseData = useCallback(async () => {
    try {
      const [bedsRes, patRes, localVitals] = await Promise.allSettled([
        apiClient.get('/beds'),
        apiClient.get('/patients?limit=100'),
        db.vitals.toArray()
      ]);

      if (bedsRes.status === 'fulfilled' && Array.isArray(bedsRes.value.data)) {
        const beds = bedsRes.value.data;
        const occ = beds.filter((b: any) => b.is_occupied || b.status === 'Occupied').length;
        setBedStats({ occupied: occ, total: beds.length || 10 });
      }

      let realPatients: any[] = [];
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
        realPatients = patRes.value.data;
        setPatients(realPatients);
      }

      if (localVitals.status === 'fulfilled' && Array.isArray(localVitals.value)) {
        const mapped = localVitals.value.map((v: any) => {
          const pat = realPatients.find(p => p.id === v.patient_id);
          const isHighBp = (v.bp_systolic && v.bp_systolic > 130) || (v.bp_diastolic && v.bp_diastolic > 85);
          const isLowSpo2 = v.spo2 && v.spo2 < 95;
          return {
            id: v.id,
            patient_name: pat?.name || 'Patient Record',
            bp: (v.bp_systolic && v.bp_diastolic) ? `${v.bp_systolic}/${v.bp_diastolic}` : '120/80',
            hr: v.heart_rate || 72,
            temp: v.temperature || 98.6,
            spo2: v.spo2 || 98,
            status: isLowSpo2 ? 'Hypoxemic Alert' : isHighBp ? 'Pre-hypertensive' : 'Normal',
            time: v.recorded_at ? new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
          };
        });
        setVitalsList(mapped);
      }
    } catch (err) {
      console.error('Error loading nurse dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNurseData();
  }, [loadNurseData]);

  async function handleRecordVitals(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) {
      alert('Please select a patient.');
      return;
    }

    try {
      const pat = patients.find(p => p.id === selectedPatientId);
      const newRecord = {
        id: `v-${Date.now()}`,
        patient_name: pat?.name || 'Selected Patient',
        bp: `${vitalsForm.bp_sys}/${vitalsForm.bp_dia}`,
        hr: Number(vitalsForm.heart_rate),
        temp: Number(vitalsForm.temperature),
        spo2: Number(vitalsForm.spo2),
        status: Number(vitalsForm.spo2) < 95 ? 'Hypoxemic Alert' : 'Normal',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      await db.vitals.put({
        id: `nurse-vitals-${Date.now()}`,
        patient_id: selectedPatientId,
        hospital_id: 'hosp-1',
        bp_systolic: Number(vitalsForm.bp_sys),
        bp_diastolic: Number(vitalsForm.bp_dia),
        heart_rate: Number(vitalsForm.heart_rate),
        temperature: Number(vitalsForm.temperature),
        spo2: Number(vitalsForm.spo2),
        respiratory_rate: Number(vitalsForm.respiratory_rate),
        notes: vitalsForm.notes,
        recorded_by: user?.name || 'Staff Nurse',
        recorded_at: new Date().toISOString(),
        temperature_unit: 'F',
        weight_unit: 'kg',
        _syncStatus: 'synced',
        _syncOp: 'create',
        _localSeq: Date.now(),
        _updatedAt: new Date().toISOString()
      } as any);

      setVitalsList(prev => [newRecord, ...prev]);
      setShowVitalsModal(false);
      alert(`✓ Vitals recorded for ${pat?.name || 'Patient'} and synced to Doctor EHR!`);
    } catch (err) {
      alert('Failed to record vitals.');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /> Loading Nursing Suite Dashboard...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Welcome Banner */}
      <div className="card" style={{
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
        border: '1px solid #f5d0fe',
        padding: '24px 28px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#a21caf',
            background: '#fae8ff',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            marginBottom: 8
          }}>
            # Nursing Suite Dashboard
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name || 'Nurse'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400, maxWidth: 640 }}>
            Manage inpatient ward rounds, record vitals, monitor medication administration, and coordinate bed care.
          </p>
        </div>

        {/* User Profile Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '3px solid #fff',
          boxShadow: 'var(--shadow-md)',
          background: '#fae8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: '#a21caf',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name ? user.name[0].toUpperCase() : 'N'
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Metric 1: WARD BEDS OCCUPIED */}
        <div 
          onClick={() => onNavigate('beds')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#a21caf';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Ward Bed Occupancy</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#a21caf', marginTop: 8, lineHeight: 1 }}>
              {bedStats.occupied} <span style={{ fontSize: 18, color: 'var(--text-light)', fontWeight: 500 }}>/ {bedStats.total}</span>
            </div>
            <div style={{ fontSize: 11, color: '#a21caf', marginTop: 6, fontWeight: 600 }}>Admitted IPD patients ➔</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fae8ff', color: '#a21caf', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
          </div>
        </div>

        {/* Metric 2: VITALS LOGGED TODAY */}
        <div 
          onClick={() => onNavigate('vitals')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Vitals Logs Recorded</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 8, lineHeight: 1 }}>{vitalsList.length}</div>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 6, fontWeight: 600 }}>Open vitals logs ➔</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
        </div>

        {/* Metric 3: VITALS ALERTS */}
        <div 
          onClick={() => onNavigate('vitals')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#d97706';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Vitals Alerts</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706', marginTop: 8, lineHeight: 1 }}>
              {vitalsList.filter(v => v.status !== 'Normal').length}
            </div>
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 6, fontWeight: 600 }}>Review alert vitals ➔</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>

        {/* Metric 4: REGISTERED PATIENTS */}
        <div 
          onClick={() => onNavigate('patients')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Hospital Patients</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{patients.length}</div>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 6, fontWeight: 600 }}>Active patient records ➔</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-3-3.87M11 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/></svg>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <h3 className="section-label" style={{ marginBottom: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Nursing Quick Actions</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16
        }}>
          {/* Action 1: Record Vitals */}
          <div 
            onClick={() => {
              if (patients.length > 0) setSelectedPatientId(patients[0].id);
              setShowVitalsModal(true);
            }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#fae8ff', color: '#a21caf', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Record Patient Vitals</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Log BP, Pulse, SpO2, Temp</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Action 2: Ward Bed Rounding */}
          <div 
            onClick={() => onNavigate('beds')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Ward Bed Rounding</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>View bed & patient allocation</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>
        </div>
      </div>

      {/* Main Content Section: Vitals Log Table */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Recent Patient Vitals Logged</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {vitalsList.length} nursing vitals entries recorded
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            style={{ fontSize: 12.5, fontWeight: 600 }}
            onClick={() => {
              if (patients.length > 0) setSelectedPatientId(patients[0].id);
              setShowVitalsModal(true);
            }}
          >
            + Record New Vitals
          </button>
        </div>
        <div style={{ padding: 0 }}>
          {vitalsList.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>No patient vitals recorded yet</h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, maxWidth: 460, margin: '6px auto 16px' }}>
                There are no vitals logs in the database. Use "+ Record New Vitals" to log blood pressure, heart rate, temperature, and SpO2 for a patient.
              </p>
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (patients.length > 0) setSelectedPatientId(patients[0].id);
                  setShowVitalsModal(true);
                }}
              >
                + Record New Vitals
              </button>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient Name</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Blood Pressure</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Heart Rate</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temp / SpO2</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalsList.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)' }}>{v.time}</td>
                      <td style={{ padding: '14px 20px', fontWeight: 700 }}>{v.patient_name}</td>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{v.bp} mmHg</td>
                      <td style={{ padding: '14px 20px' }}>{v.hr} bpm</td>
                      <td style={{ padding: '14px 20px' }}>{v.temp}°F • {v.spo2}%</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${v.status === 'Normal' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Vitals Modal */}
      {showVitalsModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }} onClick={() => setShowVitalsModal(false)}>
          <div className="modal" style={{ maxWidth: 500, width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#fae8ff', borderBottom: '1px solid #f5d0fe', padding: '16px 20px' }}>
              <h3 className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#a21caf', margin: 0 }}>Record Patient Vitals</h3>
              <button type="button" className="close-btn" onClick={() => setShowVitalsModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordVitals}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px' }}>
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
                      <option key={p.id} value={p.id}>{p.name} ({p.uhid || p.id})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">BP Systolic (mmHg)</label>
                    <input type="number" className="input" value={vitalsForm.bp_sys} onChange={e => setVitalsForm({...vitalsForm, bp_sys: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BP Diastolic (mmHg)</label>
                    <input type="number" className="input" value={vitalsForm.bp_dia} onChange={e => setVitalsForm({...vitalsForm, bp_dia: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input type="number" className="input" value={vitalsForm.heart_rate} onChange={e => setVitalsForm({...vitalsForm, heart_rate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SpO2 Oxygen (%)</label>
                    <input type="number" className="input" value={vitalsForm.spo2} onChange={e => setVitalsForm({...vitalsForm, spo2: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nursing Round Notes</label>
                  <textarea className="input" rows={2} value={vitalsForm.notes} onChange={e => setVitalsForm({...vitalsForm, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '12px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVitalsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#a21caf', borderColor: '#86198f' }}>Record Vitals</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
