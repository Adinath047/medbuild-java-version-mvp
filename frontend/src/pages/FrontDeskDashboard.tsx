import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { db } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';
import { triggerSyncBroadcast } from '../sync/syncManager';

export default function FrontDeskDashboard({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // Doctor Roster Calendar States
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<number>(12); // default July 12
  const [roster, setRoster] = useState<any[]>([
    { id: 1, name: 'Dr. Aarav Mehta', specialty: 'Cardiology', status: 'Active', completed: 8, note: 'Duty ends 4:00 PM' },
    { id: 2, name: 'Dr. Ananya Iyer', specialty: 'Pediatrics', status: 'Active', completed: 5, note: 'Normal hours' },
    { id: 3, name: 'Dr. Rohan Kapoor', specialty: 'General Med', status: 'On Leave', completed: 0, note: 'Medical leave' },
    { id: 4, name: 'Dr. Priya Sharma', specialty: 'Gynecology', status: 'Active', completed: 6, note: 'Morning shift only' }
  ]);
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [patientsMap, setPatientsMap]   = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [bedStats, setBedStats] = useState({ occupied: 0, total: 0 });

  const queueRef = useRef<HTMLDivElement>(null);
  const billsRef = useRef<HTMLDivElement>(null);

  // Emergency Alert state
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [alertDoctors, setAlertDoctors] = useState<any[]>([]);
  const [alertPatients, setAlertPatients] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedPatId, setSelectedPatId] = useState('');
  const [alertMessage, setAlertMessage] = useState('Emergency assistance required at front desk!');
  const [submittingAlert, setSubmittingAlert] = useState(false);

  useEffect(() => {
    if (showEmergencyModal) {
      setSelectedDocId('all');
      setSelectedPatId('');
      setAlertMessage('Emergency assistance required at front desk!');
    }
  }, [showEmergencyModal]);

  async function handleSendAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!alertMessage.trim()) return;
    
    setSubmittingAlert(true);
    try {
      await apiClient.post('/notifications', {
        doctor_id: 'all',
        message: alertMessage.trim(),
      });
      alert('Emergency alert broadcasted to all doctors.');
      setShowEmergencyModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to trigger emergency alert.');
    } finally {
      setSubmittingAlert(false);
    }
  }

  async function updateAppointmentStatus(id: string, status: string) {
    try {
      const r = await apiClient.put(`/appointments/${id}/status`, { status });
      await db.appointments.put({ ...r.data, _syncStatus: 'synced' });
      setAppointments(prev => prev.map(x => x.id === id ? r.data : x));
      triggerSyncBroadcast();
    } catch {
      const existing = appointments.find(x => x.id === id);
      if (existing) {
        const payload = { ...existing, status, _syncStatus: 'pending', updated_at: new Date().toISOString() };
        await db.appointments.put(payload);
        await db.syncQueue.add({
          table: 'appointments',
          operation: 'update',
          payload,
          clientUpdatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          attempts: 0
        });
      } else {
        await db.appointments.update(id, { status, _syncStatus: 'pending' });
      }
      setAppointments(prev => prev.map(x => x.id === id ? { ...x, status } : x));
      triggerSyncBroadcast();
    }
  }

  const loadDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Fetch Today's Appointments
      let apptsData = [];
      try {
        const r = await apiClient.get('/appointments'); // We'll filter on client to be safe
        apptsData = r.data;
      } catch {
        apptsData = await db.appointments.toArray();
      }
      let todaysAppts = apptsData.filter((a: any) => a.date?.startsWith(today));
      if (user?.role === 'doctor') {
        todaysAppts = todaysAppts.filter((a: any) => a.doctor_id === user.id);
      }
      
      // 2. Fetch Pending Bills
      let billsData = [];
      try {
        const r = await apiClient.get('/billing');
        billsData = r.data;
      } catch {
        billsData = await db.billing.toArray();
      }
      const pending = billsData.filter((b: any) => ['Pending', 'Partial'].includes(b.payment_status) && b.bill_type !== 'pharmacy');

      // 3. Fetch Patients for names
      let patsData = [];
      try {
        const r = await apiClient.get('/patients', { params: { limit: 1000 } });
        patsData = r.data.patients;
      } catch {
        patsData = await db.patients.toArray();
      }
      const pMap: Record<string, any> = {};
      patsData.forEach((p: any) => pMap[p.id] = p);

      // 4. Fetch Bed Allocation
      let occupied = 0;
      let totalBeds = 0;
      try {
        const r = await apiClient.get('/beds');
        const bedsData = r.data || [];
        occupied = bedsData.filter((b: any) => b.status === 'Occupied').length;
        totalBeds = bedsData.length;
      } catch (err) {
        console.error('Failed to load beds for dashboard:', err);
      }

      setAppointments(todaysAppts);
      setPendingBills(pending);
      setPatientsMap(pMap);
      setBedStats({ occupied, total: totalBeds });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, syncCount]);

  useEffect(() => {
    const handleUpdate = () => {
      console.log('[ws] Reloading dashboard data silently...');
      loadDashboardData();
    };
    window.addEventListener('emr:appointments-update', handleUpdate);
    return () => window.removeEventListener('emr:appointments-update', handleUpdate);
  }, [loadDashboardData]);

  
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /> Loading dashboard...</div>;

  const totalOutstanding = pendingBills.reduce((acc, b) => acc + (b.net_amount - (b.paid_amount || 0)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Welcome Banner */}
      <div className="card" style={{
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
        border: '1px solid #ccfbf1',
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
            color: user?.role === 'doctor' ? '#0f766e' : '#b45309',
            background: user?.role === 'doctor' ? '#e6f4f1' : '#fef3c7',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            marginBottom: 8
          }}>
            {user?.role === 'doctor' ? '# Clinical Dashboard' : '# Reception dashboard'}
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name?.split(' ')[0] || 'User'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400, maxWidth: 640 }}>
            {user?.role === 'doctor' 
              ? 'Monitor your patient schedule, appointments, active prescriptions, and admissions.'
              : 'Manage patient flow, check-ins, bed visibility, and billing – everything the front desk needs, one screen.'}
          </p>
        </div>

        {/* Receptionist Profile Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '3px solid #fff',
          boxShadow: 'var(--shadow-md)',
          background: 'var(--primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--primary)',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name ? user.name[0].toUpperCase() : 'R'
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Metric 1: TODAY'S APPOINTMENTS */}
        <div 
          onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth' })}
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
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Today's Appointments</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{appointments.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Scheduled today</div>
          </div>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fffbeb',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>

        {/* Metric 2: PATIENTS IN QUEUE */}
        <div 
          onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth' })}
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
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Patients in Queue</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{appointments.filter(a => a.status === 'Checked-In').length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Awaiting check-in</div>
          </div>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--info-bg)',
            color: 'var(--info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>

        {/* Metric 3: BEDS AVAILABLE */}
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
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Beds Available</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>
              {bedStats.total - bedStats.occupied} <span style={{ fontSize: 18, color: 'var(--text-light)', fontWeight: 500 }}>/ {bedStats.total}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Occupancy view</div>
          </div>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
          </div>
        </div>

        {/* Metric 4: UNPAID BILLS */}
        <div 
          onClick={() => onNavigate('billing')}
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
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Unpaid Bills</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1 }}>{pendingBills.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>₹{Math.round(totalOutstanding).toLocaleString('en-IN')} outstanding</div>
          </div>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fdf2f8',
            color: '#db2777',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <h3 className="section-label" style={{ marginBottom: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Quick Actions</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16
        }}>
          {/* Action 1: Register Patient */}
          <div 
            onClick={() => onNavigate('patients', { autoOpen: true })}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Register a New Patient</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Create patient record</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Action 2: Schedule visit */}
          <div 
            onClick={() => onNavigate('appointments')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Schedule a Visit</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Book new appointment</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Action 3: Create Invoice */}
          <div 
            onClick={() => onNavigate('billing')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-19.5 8.25h3m-3 0h3m-3 0h3m-3-12h19.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 21.75 18H2.25A2.25 2.25 0 0 1 0 15.75V5.25A2.25 2.25 0 0 1 2.25 3Z" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Create Invoice</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Bill patient services</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>
        </div>
      </div>

      {/* Today's Patient Appointments (Full-width Card) */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
          <div>
            <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Today's Patient Appointments</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {appointments.length} scheduled · {appointments.filter(a => a.status === 'Checked-In').length} checked in
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-ghost btn-sm" 
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}
            onClick={() => onNavigate('appointments')}
          >
            See all
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {appointments.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px' }}>
              <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-light)' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>No appointments today</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use the "Schedule a Visit" action to add an appointment.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Doctor</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => {
                    const p = patientsMap[a.patient_id];
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s ease' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#fffbeb',
                            color: '#d97706',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: 11.5,
                            fontWeight: 600
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {a.time || '10:00 AM'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              overflow: 'hidden'
                            }}>
                              {p?.photo_url ? (
                                <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                p?.name ? p.name[0].toUpperCase() : 'P'
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{p?.name || 'Unknown Patient'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.reason || 'General checkup'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>Dr. {a.doctor_name || 'Aarav Mehta'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Cardiology</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${
                            a.status === 'Completed' ? 'badge-success' :
                            a.status === 'Checked-In' ? 'badge-info' :
                            a.status === 'Confirmed' ? 'badge-purple' :
                            'badge-info'
                          }`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                            {a.status || 'Scheduled'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                            {['Scheduled', 'Confirmed', 'Pending'].includes(a.status || 'Scheduled') && (
                              <button 
                                className="btn btn-primary btn-sm" 
                                style={{ padding: '3px 12px', fontSize: 12, minHeight: 28, background: 'var(--primary)', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600 }}
                                onClick={() => updateAppointmentStatus(a.id, 'Checked-In')}
                              >
                                Checkin
                              </button>
                            )}
                            <button 
                              className="btn btn-ghost btn-sm" 
                              style={{ padding: '3px 8px', fontSize: 12, minHeight: 28, color: 'var(--text-muted)' }}
                              onClick={() => onNavigate('patient_detail', { patientId: a.patient_id })}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="modal-overlay" onClick={() => setShowEmergencyModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Trigger Emergency Alert</div>
              <button className="modal-close" onClick={() => setShowEmergencyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSendAlert}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', padding: '20px 20px 10px' }}>
                <div style={{ fontSize: 44, color: 'var(--danger)', marginBottom: 4 }}>🚨</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Broadcast Emergency Signal?</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                  This will instantly broadcast a high-priority emergency alert to **all active doctors** on duty in this hospital.
                </p>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Alert Message *</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Describe the emergency..."
                    value={alertMessage}
                    onChange={e => setAlertMessage(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmergencyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={submittingAlert}>
                  {submittingAlert ? 'Sending Alert...' : 'Send Emergency Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Roster & Daily Activity Calendar Panel */}
      <div className="card" style={{
        boxShadow: 'var(--shadow-sm)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '24px 28px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Roster & Activity Calendar</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Daily attendance, completed visits, and roster notes</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', background: 'var(--surface-alt)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              📅 July 2026
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 28, flexWrap: 'wrap' }}>
          {/* Mini Monthly Calendar Display */}
          <div style={{ borderRight: '1px solid var(--border-light)', paddingRight: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d}>{d}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {/* Empty days before Wednesday July 1st 2026 */}
              {Array.from({ length: 2 }).map((_, i) => <div key={`empty-${i}`} />)}
              
              {/* Days 1 to 31 */}
              {Array.from({ length: 31 }).map((_, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedCalendarDate === dayNum;
                const isToday = dayNum === 12; // July 12 is today
                
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setSelectedCalendarDate(dayNum)}
                    style={{
                      aspectRatio: '1',
                      background: isSelected ? 'var(--primary)' : isToday ? 'var(--primary-light)' : 'transparent',
                      color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text)',
                      fontWeight: isSelected || isToday ? 700 : 500,
                      fontSize: 12,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.1s ease',
                      border: isToday && !isSelected ? '1.5px solid var(--primary-mid)' : 'none'
                    }}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roster & Completed Visits list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-sec)' }}>
                Roster for July {selectedCalendarDate}, 2026
              </h4>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                * Click on a doctor's card to toggle leave
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roster.map(doc => {
                // If it's not today (July 12), show mock varying completed appts or status
                const isLeaveDay = doc.status === 'On Leave' || (selectedCalendarDate % 5 === doc.id);
                const mockCompleted = isLeaveDay ? 0 : (doc.completed + (selectedCalendarDate % 3));
                const mockNote = isLeaveDay ? 'On Leave (Roster Off)' : doc.note;

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      // Only allow toggling for today or editing note
                      setRoster(prev => prev.map(d => d.id === doc.id ? { 
                        ...d, 
                        status: d.status === 'Active' ? 'On Leave' : 'Active',
                        note: d.status === 'Active' ? 'On Leave (Applied)' : 'Duty ends 4:00 PM'
                      } : d));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      background: isLeaveDay ? '#fef2f2' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isLeaveDay ? '#fee2e2' : 'var(--primary-light)',
                        color: isLeaveDay ? '#ef4444' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 11.5
                      }}>
                        {doc.name.split(' ')[1][0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {doc.specialty} · <span style={{ fontStyle: 'italic' }}>{mockNote}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: isLeaveDay ? '#dc2626' : 'var(--primary)' }}>
                        {isLeaveDay ? '0 Completed' : `${mockCompleted} Completed`}
                      </span>
                      <span className={`badge ${isLeaveDay ? 'badge-danger' : 'badge-success'}`} style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        background: isLeaveDay ? '#fee2e2' : '#d1fae5',
                        color: isLeaveDay ? '#dc2626' : '#065f46'
                      }}>
                        {isLeaveDay ? 'On Leave' : 'On Duty'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
