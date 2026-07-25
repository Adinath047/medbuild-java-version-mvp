import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { db } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';

interface DoctorDashboardProps {
  onNavigate: (page: string, data?: any) => void;
}

export default function DoctorDashboard({ onNavigate }: DoctorDashboardProps) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [loading, setLoading] = useState(true);

  // States
  const [stats, setStats] = useState({
    myPatients: 0,
    critical: 0,
    todayAppts: 0,
    myBeds: 0
  });

  const [todaysAppts, setTodaysAppts] = useState<any[]>([]);
  const [criticalList, setCriticalList] = useState<any[]>([]);
  const [upcomingList, setUpcomingList] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowHourMin = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });

      // 1. Load Beds to calculate myBeds and critical patients list
      let bedsList = [];
      try {
        const r = await apiClient.get('/beds');
        bedsList = r.data || [];
      } catch {
        bedsList = [];
      }

      // Filter beds belonging to this doctor
      const myDocBeds = bedsList.filter((b: any) => 
        b.doctor_id === user?.id || b.doctor_name?.toLowerCase().includes(user?.name?.toLowerCase() || '')
      );

      // Identify critical patients under this doctor
      const criticals = myDocBeds.filter((b: any) => {
        if (b.status !== 'Occupied' || !b.vitals) return false;
        const sys = b.vitals.bp_systolic;
        const hr = b.vitals.heart_rate;
        const o2 = b.vitals.spo2;
        const temp = b.vitals.temperature;
        return (
          (o2 && o2 < 94) || 
          (hr && (hr > 100 || hr < 60)) || 
          (sys && (sys > 140 || sys < 90)) ||
          (temp && (temp > 99.5 || temp < 96.0))
        );
      });

      // 2. Load Appointments to calculate today's appointments for this doctor
      let apptsList = [];
      try {
        const r = await apiClient.get('/appointments');
        apptsList = r.data || [];
      } catch {
        apptsList = await db.appointments.toArray();
      }

      const myAppts = apptsList.filter((a: any) => 
        (a.doctor_id === user?.id || a.doctor_name?.toLowerCase().includes(user?.name?.toLowerCase() || '')) &&
        a.date?.startsWith(todayStr)
      );

      const upcoming = apptsList.filter((a: any) => {
        const isMyDoc = a.doctor_id === user?.id || a.doctor_name?.toLowerCase().includes(user?.name?.toLowerCase() || '');
        if (!isMyDoc) return false;
        if (a.date > todayStr) return true;
        if (a.date === todayStr && a.time > nowHourMin) return true;
        return false;
      }).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      // Compute stats
      const uniquePatients = new Set([
        ...myDocBeds.map((b: any) => b.patient_id).filter(Boolean),
        ...myAppts.map((a: any) => a.patient_id).filter(Boolean)
      ]);

      setStats({
        myPatients: uniquePatients.size,
        critical: criticals.length,
        todayAppts: myAppts.length,
        myBeds: myDocBeds.length
      });

      setTodaysAppts(myAppts);
      setCriticalList(criticals);
      setUpcomingList(upcoming);

    } catch (err) {
      console.error('Failed to load doctor dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData, syncCount]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, display: 'block' }}>Loading Clinical Overview...</span>
      </div>
    );
  }

  const displayedCritical = criticalList.map(c => ({
    name: c.patient_name,
    uhid: c.uhid,
    ageSex: `${c.patient_age || '—'}/${c.patient_sex || '—'}`,
    id: c.patient_id
  }));

  const displayedQueue = todaysAppts;
  const displayedUpcoming = upcomingList.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Title Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px', color: 'var(--text)' }}>Home</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your daily clinical overview</span>
        </div>
      </div>

      {/* Doctor Greetings Banner Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #eff6ff 100%)',
        padding: '28px 32px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 24
      }}>
        {/* Doctor Photo Box */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--primary-light)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 700,
          border: '3px solid #fff',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            '👨‍⚕️'
          )}
        </div>
        <div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#0f766e',
            background: '#e6f4f1',
            padding: '3px 10px',
            borderRadius: '20px',
            display: 'inline-block',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}>
            Cardiology
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name ? (user.name.toLowerCase().startsWith('dr.') ? user.name : `Dr. ${user.name}`) : 'Dr. Aarav Mehta'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400, maxWidth: 640 }}>
            Here's a focused view of your patients, appointments, and critical alerts — updated live.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button 
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 12.5,
                background: 'var(--primary)',
                border: 'none'
              }}
              onClick={() => onNavigate('patients')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87M11 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/></svg>
              View my patients
            </button>
            <button 
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 12.5,
                background: '#fff',
                border: '1px solid var(--border)',
                color: 'var(--text-sec)'
              }}
              onClick={() => onNavigate('prescriptions')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Write prescription
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row (4 Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Card 1: MY PATIENTS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>My Patients</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.myPatients}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87M11 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/></svg>
          </div>
        </div>

        {/* Card 2: CRITICAL */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Critical</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', marginTop: 8 }}>{stats.critical}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        </div>

        {/* Card 3: TODAY'S APPT */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Today's Appts</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.todayAppts}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>

        {/* Card 4: MY BEDS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>My Beds</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.myBeds}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
          </div>
        </div>
      </div>

      {/* Critical Patients Row */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Critical Patients</h3>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('beds')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>View all</button>
        </div>
        <div className="card-body" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {displayedCritical.length > 0 ? (
              displayedCritical.map(p => (
                <div 
                  key={p.uhid}
                  onClick={() => onNavigate('patient_detail', { patientId: p.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    background: '#fff',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: '#fef2f2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13
                    }}>
                      {p.name ? p.name[0] : 'P'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.uhid} · {p.ageSex}</div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 16 }}>➔</div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No critical patients currently admitted.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom split row (Today's Patients Queue & Upcoming Schedule) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, flexWrap: 'wrap' }}>
        {/* Today's Patients queue */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Today's Patients</h3>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{displayedQueue.length} scheduled / {displayedQueue.filter(q => q.status === 'Checked-In').length} checked in</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('appointments')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Full schedule</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayedQueue.length > 0 ? (
              displayedQueue.map((a, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    background: '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{a.time}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{a.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.notes || 'General checkup'}</div>
                    </div>
                  </div>
                  <span className={`badge ${a.status === 'Checked-In' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>
                    {a.status}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No appointments scheduled for today.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming appointments tracker */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px' }}>
            <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Upcoming</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next scheduled visits</span>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayedUpcoming.length > 0 ? (
              displayedUpcoming.map((u, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-light)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{u.patient_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{u.notes || 'Routine consultation'}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sec)' }}>
                    {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {u.time}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No upcoming appointments.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
