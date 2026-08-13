// client/src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { db } from '../db/localDB';
import { useAuthStore } from '../store/authStore';

export default function Dashboard({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  
  // Stats state
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [bedsOccupied, setBedsOccupied] = useState(0);
  const [bedsTotal, setBedsTotal] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [criticalPatients, setCriticalPatients] = useState(0);
  const [totalBilled, setTotalBilled] = useState(0);
  const [collectedBilled, setCollectedBilled] = useState(0);
  const [outstandingBilled, setOutstandingBilled] = useState(0);
  const [pendingBillsCount, setPendingBillsCount] = useState(0);
  const [admittedCount, setAdmittedCount] = useState(0);
  const [criticalList, setCriticalList] = useState<any[]>([]);
  const [queueList, setQueueList] = useState<any[]>([]);
  const [recentAdmissions, setRecentAdmissions] = useState<any[]>([]);
  const [wardStats, setWardStats] = useState<Array<{ ward: string; occupied: number; total: number; color: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        // Query Staff for Doctor count
        try {
          const staffRes = await apiClient.get('/auth/hospital/hsp-001/staff');
          const staffData = staffRes.data || [];
          setTotalDoctors(staffData.filter((s: any) => s.role === 'Doctor' || s.role === 'doctor').length);
        } catch {
          setTotalDoctors(0);
        }

        // Query Beds
        const bedsRes = await apiClient.get('/beds');
        const bedsData: any[] = bedsRes.data || [];
        setBedsTotal(bedsData.length);
        const occupied = bedsData.filter((b: any) => b.status === 'Occupied' || b.is_occupied).length;
        setBedsOccupied(occupied);
        setAdmittedCount(occupied);
        
        // Dynamic Ward Occupancy breakdown
        const wardMap: Record<string, { occupied: number; total: number }> = {};
        bedsData.forEach((b: any) => {
          const w = b.ward_type || b.wardType || b.ward || 'General';
          if (!wardMap[w]) wardMap[w] = { occupied: 0, total: 0 };
          wardMap[w].total++;
          if (b.status === 'Occupied' || b.is_occupied) {
            wardMap[w].occupied++;
          }
        });
        const computedWards = Object.keys(wardMap).map(w => ({
          ward: w,
          occupied: wardMap[w].occupied,
          total: wardMap[w].total,
          color: wardMap[w].occupied > 0 ? '#0d9488' : '#cbd5e1'
        }));
        setWardStats(computedWards);

        // Count Critical Vitals on Beds
        let criticalCount = 0;
        const criticalBedsList: any[] = [];
        bedsData.forEach((b: any) => {
          if ((b.status === 'Occupied' || b.is_occupied) && b.vitals) {
            const sys = b.vitals.bp_systolic || b.vitals.bpSystolic;
            const hr = b.vitals.heart_rate || b.vitals.heartRate;
            const o2 = b.vitals.spo2 || b.vitals.spO2;
            const temp = b.vitals.temperature;
            if (
              (o2 && o2 < 94) || 
              (hr && (hr > 100 || hr < 60)) || 
              (sys && (sys > 140 || sys < 90)) ||
              (temp && (temp > 99.5 || temp < 96.0))
            ) {
              criticalCount++;
              criticalBedsList.push(b);
            }
          }
        });
        setCriticalPatients(criticalCount);
        setCriticalList(criticalBedsList);

        // Occupied beds as recent admissions
        const occupiedBeds = bedsData.filter((b: any) => b.status === 'Occupied' || b.is_occupied);
        setRecentAdmissions(occupiedBeds.slice(0, 5));

        // Query Patients
        const patientsRes = await apiClient.get('/patients');
        const patientsData = patientsRes.data || [];
        setTotalPatients(Array.isArray(patientsData) ? patientsData.length : (patientsData.patients?.length || 0));

        // Query Billing
        const billingRes = await apiClient.get('/billing');
        const billingData = billingRes.data || [];
        const billedSum = billingData.reduce((acc: number, b: any) => acc + (b.net_amount || 0), 0);
        const colSum = billingData.reduce((acc: number, b: any) => acc + (b.paid_amount || 0), 0);
        
        setTotalBilled(billedSum);
        setCollectedBilled(colSum);
        setOutstandingBilled(Math.max(0, billedSum - colSum));
        setPendingBillsCount(billingData.filter((b: any) => ['Pending', 'Partial'].includes(b.payment_status) && ((b.net_amount || 0) > (b.paid_amount || 0))).length);

        // Query Appointments
        const apptsRes = await apiClient.get('/appointments');
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysAppts = (apptsRes.data || []).filter((a: any) => a.date?.startsWith(todayStr));
        setTodayAppointments(todaysAppts.length);
        setQueueList(todaysAppts.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || '')));

      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="loading-screen" style={{ height: '60vh' }}><div className="spinner" /></div>;

  const occupancyPercent = bedsTotal > 0 ? Math.round((bedsOccupied / bedsTotal) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Welcome Banner + Bed Occupancy */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #eff6ff 100%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        padding: '28px 32px',
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 32,
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Left Side: Welcome */}
        <div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#0f766e',
            background: '#e6f4f1',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            marginBottom: 10,
            letterSpacing: '0.8px',
            textTransform: 'uppercase'
          }}>
            Live operations
          </span>
          <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Welcome back, {user?.name || 'Administrator'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, fontWeight: 400, lineHeight: 1.4, maxWidth: 520 }}>
            Monitor hospital operations, bed occupancy, appointments, and billing — all in one calm, elegant view.
          </p>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'var(--primary)', border: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => onNavigate('patients', { autoOpen: true })}
            >
              <span>+ Add patient</span>
            </button>
            <button 
              className="btn btn-ghost" 
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-sec)' }}
              onClick={() => onNavigate('beds')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
              <span>Beds & vitals</span>
            </button>
          </div>
        </div>

        {/* Right Side: Bed Occupancy Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bed Occupancy</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{occupancyPercent}%</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {bedsOccupied} of {bedsTotal} beds occupied
          </div>
          
          {/* Progress bar */}
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#0d9488', width: `${occupancyPercent}%`, borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Card 1: TOTAL DOCTORS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Doctors</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{totalDoctors}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active medical staff</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
          </div>
        </div>

        {/* Card 2: TOTAL PATIENTS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Patients</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{totalPatients}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{admittedCount} currently admitted</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>

        {/* Card 3: BEDS OCCUPIED */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Beds Occupied</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>
              {bedsOccupied} <span style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 500 }}>/ {bedsTotal}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{bedsTotal - bedsOccupied} available</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
          </div>
        </div>

        {/* Card 4: TODAY'S APPOINTMENTS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Today's Appointments</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{todayAppointments}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Scheduled today</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>

        {/* Card 5: CRITICAL PATIENTS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Critical Patients</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: criticalPatients > 0 ? 'var(--danger)' : 'var(--text)', marginTop: 8 }}>{criticalPatients}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Require vitals review</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        </div>

        {/* Card 6: TOTAL BILLED */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Billed</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 12 }}>₹{Math.round(totalBilled).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>₹{Math.round(collectedBilled).toLocaleString('en-IN')} collected</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
            ₹
          </div>
        </div>

        {/* Card 7: OUTSTANDING */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Outstanding</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: outstandingBilled > 0 ? '#dc2626' : 'var(--text-muted)', marginTop: 12 }}>₹{Math.round(outstandingBilled).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pendingBillsCount} pending invoices</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
          </div>
        </div>

        {/* Card 8: ADMITTED */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Admitted</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{admittedCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active inpatients</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </div>
        </div>
      </div>

      {/* Quick Actions (6 bento tiles) */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-header" style={{ padding: '16px 20px' }}>
          <h3 className="card-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Quick Actions</h3>
        </div>
        <div className="card-body" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Add Doctor', page: 'settings', data: null, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg> },
              { label: 'Add Patient', page: 'patients', data: { autoOpen: true }, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87M11 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { label: 'Record Vitals', page: 'beds', data: null, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
              { label: 'Allocate Bed', page: 'beds', data: null, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg> },
              { label: 'Create Bill', page: 'billing', data: null, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
              { label: 'Prescription', page: 'prescriptions', data: null, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
            ].map(a => (
              <button 
                key={a.label} 
                className="btn btn-secondary" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius)',
                  fontWeight: 600,
                  fontSize: 13,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-sec)',
                  justifyContent: 'flex-start',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => onNavigate(a.page, a.data)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = 'var(--primary-light)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Critical Patients & Today's Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, flexWrap: 'wrap' }}>
        {/* Critical Patients panel */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Critical Patients</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Require immediate care attention</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('beds')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>See all</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {criticalList.length > 0 ? (
              criticalList.slice(0, 5).map(p => (
                <div key={p.id || p.uhid} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  background: '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                      {p.patient_name ? p.patient_name[0] : 'P'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.patient_name}
                        <span className="badge badge-danger" style={{ fontSize: 9, padding: '1px 6px', background: '#fee2e2', color: '#dc2626' }}>Critical</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.uhid || '—'} · {p.patient_age || '—'}/{p.patient_sex || '—'} · {p.doctor_name || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                    {p.bed_code} (SpO2: {p.vitals?.spo2 || '—'}% / HR: {p.vitals?.heart_rate || '—'})
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No critical patients currently admitted.
              </div>
            )}
          </div>
        </div>

        {/* Today's Queue panel */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Today's Queue</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upcoming appointments</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('appointments')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>See all</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {queueList.length > 0 ? (
              queueList.slice(0, 5).map((a, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12.5 }}>
                      {a.time}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{a.patient_name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{a.doctor_name} · {a.department || 'Consultation'}</div>
                    </div>
                  </div>
                  <span className={`badge ${a.status === 'Checked-In' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>{a.status}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No appointments scheduled for today.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Recent Admissions & Bed Occupancy by Ward */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flexWrap: 'wrap' }}>
        {/* Recent Admissions panel */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Recent Admissions</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest inpatient records</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('beds')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>View all</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentAdmissions.length > 0 ? (
              recentAdmissions.map(p => (
                <div key={p.id || p.bed_code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                      {p.patient_name ? p.patient_name[0] : 'P'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.patient_name || 'Admitted Patient'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.bed_code} · {p.ward_type || 'Ward'} · {p.doctor_name || 'Dr. Assigned'}</div>
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: 9.5, padding: '2px 8px' }}>Admitted</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No active inpatient admissions.
              </div>
            )}
          </div>
        </div>

        {/* Bed Occupancy by Ward panel */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Bed Occupancy</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>By ward</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('beds')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Manage beds</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {wardStats.length > 0 ? (
              wardStats.map(w => {
                const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                return (
                  <div key={w.ward} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: 'var(--text-sec)' }}>
                      <span>{w.ward}</span>
                      <span>{w.occupied}/{w.total} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: w.color, width: `${pct}%`, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No ward data available.
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
