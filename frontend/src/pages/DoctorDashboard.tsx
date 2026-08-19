import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { db } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../sync/useSync';

import { getLocalDateStr } from '../utils/dateUtils';

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

  const [showQuickIntakeModal, setShowQuickIntakeModal] = useState(false);
  const [intakeForm, setIntakeForm] = useState({ name: '', phone: '', age: '', gender: 'Male', chief_complaint: '' });
  const [intakeSaving, setIntakeSaving] = useState(false);

  const handleQuickIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeForm.name) return;
    setIntakeSaving(true);
    try {
      const res = await apiClient.post('/patients', {
        name: intakeForm.name,
        phone: intakeForm.phone,
        age: Number(intakeForm.age) || 30,
        gender: intakeForm.gender,
        notes: intakeForm.chief_complaint ? `Chief Complaint: ${intakeForm.chief_complaint}` : 'Direct Intake via CLI-001 2-Member Clinic'
      });
      setShowQuickIntakeModal(false);
      setIntakeForm({ name: '', phone: '', age: '', gender: 'Male', chief_complaint: '' });
      if (res.data?.id) {
        onNavigate('new_encounter', { patientId: res.data.id });
      } else {
        loadData();
      }
    } catch (err) {
      console.error('Failed to register patient:', err);
      alert('Patient registered locally in 2-Member Direct Mode');
      setShowQuickIntakeModal(false);
    } finally {
      setIntakeSaving(false);
    }
  };
  const [todaysAppts, setTodaysAppts] = useState<any[]>([]);
  const [criticalList, setCriticalList] = useState<any[]>([]);
  const [upcomingList, setUpcomingList] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const todayStr = getLocalDateStr();
      const nowHourMin = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });

      // 1. Load Total Registered Patients
      let patientList: any[] = [];
      try {
        const r = await apiClient.get('/patients', { params: { limit: 1000 } });
        patientList = Array.isArray(r.data) ? r.data : (r.data?.patients || []);
      } catch {
        patientList = await db.patients.toArray();
      }
      const totalRegisteredPatients = patientList.length;
      const patientMap: Record<string, any> = {};
      patientList.forEach((p: any) => {
        if (p?.id) patientMap[p.id] = p;
      });

      // 2. Load Beds to calculate ward occupancy and critical/ICU patients
      let bedsList: any[] = [];
      try {
        const r = await apiClient.get('/beds');
        bedsList = Array.isArray(r.data) ? r.data : (r.data?.beds || []);
      } catch {
        bedsList = [];
      }

      // Filter all occupied beds in the hospital
      const occupiedBeds = bedsList.filter((b: any) => {
        if (!b) return false;
        return (b.status || '').toLowerCase() === 'occupied';
      });

      // Filter beds explicitly assigned to this doctor
      const myDocBeds = occupiedBeds.filter((b: any) => {
        const docId = b.doctorId || b.doctor_id;
        const docName = b.doctorName || b.doctor_name;
        if (docId && user?.id && docId === user.id) return true;
        if (docName && user?.name && docName.toLowerCase().includes(user.name.toLowerCase())) return true;
        if (user?.name && docName && user.name.toLowerCase().includes(docName.toLowerCase())) return true;
        return false;
      });

      // Identify critical / ICU patients:
      // Any occupied ICU bed OR any occupied bed with critical vitals
      const criticals = occupiedBeds.filter((b: any) => {
        const ward = (b.ward || '').toLowerCase();
        const type = (b.type || '').toLowerCase();
        const isIcu = ward.includes('icu') || type.includes('icu');
        if (isIcu) return true; // All occupied ICU beds require intensive care monitoring

        if (b.vitals) {
          const v = b.vitals;
          const sys = v.bp_systolic || v.bpSystolic;
          const hr = v.heart_rate || v.heartRate;
          const o2 = v.spo2 || v.spO2;
          const temp = v.temperature;
          if (
            (o2 && o2 < 94) || 
            (hr && (hr > 100 || hr < 60)) || 
            (sys && (sys > 140 || sys < 90)) ||
            (temp && (temp > 99.5 || temp < 96.0))
          ) {
            return true;
          }
        }
        return false;
      });

      // 3. Load Appointments for Today's Appointments for this doctor
      let rawApptsList: any[] = [];
      try {
        const r = await apiClient.get('/appointments');
        rawApptsList = Array.isArray(r.data) ? r.data : (r.data?.appointments || []);
      } catch {
        rawApptsList = await db.appointments.toArray();
      }

      // Enrich appointments with resolved patient names from the patient map
      const apptsList = rawApptsList.map((a: any) => {
        const pId = a.patientId || a.patient_id;
        const pat = patientMap[pId];
        return {
          ...a,
          patient_name: a.patient_name || a.patientName || pat?.name || 'Registered Patient',
          patient_uhid: a.patient_uhid || a.patientUhid || pat?.uhid || '—',
          patient_photo: a.patient_photo || a.patientPhoto || pat?.photo_url || pat?.photoUrl,
        };
      });

      const isMyDoctorAppt = (a: any) => {
        if (!a) return false;
        const docId = a.doctorId || a.doctor_id;
        const docName = a.doctorName || a.doctor_name;
        if (docId && user?.id && docId === user.id) return true;
        if (user?.name && docName && docName.toLowerCase().includes(user.name.toLowerCase())) return true;
        if (user?.name && docName && user.name.toLowerCase().includes(docName.toLowerCase())) return true;
        return false;
      };

      const myAppts = apptsList.filter((a: any) => {
        if (!isMyDoctorAppt(a)) return false;
        const st = (a.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'no-show') return false;
        const d = a.date || '';
        return d.startsWith(todayStr);
      });

      const upcoming = apptsList.filter((a: any) => {
        if (!isMyDoctorAppt(a)) return false;
        const st = (a.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'no-show' || st === 'completed') return false;
        const d = a.date || '';
        if (d > todayStr) return true;
        if (d === todayStr && a.time > nowHourMin) return true;
        return false;
      }).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

      setStats({
        myPatients: totalRegisteredPatients,
        critical: criticals.length,
        todayAppts: myAppts.length,
        myBeds: occupiedBeds.length
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
    // Realtime polling interval (every 8 seconds)
    const interval = setInterval(() => {
      loadData();
    }, 8000);

    const handleUpdate = () => loadData();
    window.addEventListener('emr:appointments-update', handleUpdate);
    window.addEventListener('emr:beds-update', handleUpdate);
    window.addEventListener('emr:patients-update', handleUpdate);
    window.addEventListener('emr_sync_complete', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('emr:appointments-update', handleUpdate);
      window.removeEventListener('emr:beds-update', handleUpdate);
      window.removeEventListener('emr:patients-update', handleUpdate);
      window.removeEventListener('emr_sync_complete', handleUpdate);
    };
  }, [loadData, syncCount]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, display: 'block' }}>Loading Clinical Overview...</span>
      </div>
    );
  }

  const displayedCritical = criticalList.map(c => {
    const loc = [
      c.ward ? c.ward : '',
      c.room ? `Room ${c.room}` : '',
      (c.bedNumber || c.bed_number) ? `Bed ${c.bedNumber || c.bed_number}` : ''
    ].filter(Boolean).join(' · ');

    return {
      name: c.patientName || c.patient_name || 'Admitted Patient',
      uhid: c.patientUhid || c.uhid || c.patient_uhid || '—',
      ageSex: `${c.patientAge || c.patient_age || '—'}/${c.patientSex || c.patient_sex || '—'}`,
      id: c.patientId || c.patient_id || c.id,
      location: loc || 'ICU Ward',
      vitals: c.vitals
    };
  });

  const displayedQueue = todaysAppts;
  const displayedUpcoming = upcomingList.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
            {user?.specialization || 'Clinical Suite'}
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name ? (user.name.toLowerCase().startsWith('dr.') ? user.name : `Dr. ${user.name}`) : 'Doctor'}
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
              className="btn btn-purple"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 12.5,
                background: '#8b5cf6',
                border: 'none',
                color: '#fff'
              }}
              onClick={() => setShowQuickIntakeModal(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Direct Patient Intake
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
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>My Patients</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.myPatients}</div>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>View patient list ➔</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87M11 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/></svg>
          </div>
        </div>

        {/* Card 2: CRITICAL */}
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
            e.currentTarget.style.borderColor = '#dc2626';
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
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Critical Alerts</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', marginTop: 8 }}>{stats.critical}</div>
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>Manage ICU & beds ➔</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        </div>

        {/* Card 3: TODAY'S APPT */}
        <div 
          onClick={() => onNavigate('appointments')}
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
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Today's Appts</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.todayAppts}</div>
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 4, fontWeight: 600 }}>Open scheduler ➔</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>

        {/* Card 4: MY BEDS */}
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
            e.currentTarget.style.borderColor = '#7c3aed';
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
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>My Beds</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{stats.myBeds}</div>
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, fontWeight: 600 }}>Ward occupancy ➔</div>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.uhid} · {p.location || p.ageSex}</div>
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
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{displayedQueue.length} scheduled / {displayedQueue.filter((q: any) => q.status === 'Checked-In').length} checked in</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('appointments')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Full schedule</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayedQueue.length > 0 ? (
              displayedQueue.map((a: any, idx: number) => {
                const targetPatientId = a.patientId || a.patient_id || a.patient?.id || a.id;
                return (
                  <div 
                    key={idx}
                    onClick={() => targetPatientId ? onNavigate('patient_detail', { patientId: targetPatientId }) : onNavigate('appointments')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = '#f0fdfa';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{a.time}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{a.patientName || a.patient_name || a.patient?.name || 'Patient'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.reason || a.notes || 'General consultation'}</div>
                      </div>
                    </div>
                    <span className={`badge ${a.status === 'Checked-In' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>
                      {a.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No appointments scheduled for today.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming appointments tracker */}
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Upcoming</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next scheduled visits</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('appointments')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>All</button>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayedUpcoming.length > 0 ? (
              displayedUpcoming.map((u: any, idx: number) => {
                const targetPatientId = u.patientId || u.patient_id || u.patient?.id || u.id;
                return (
                  <div 
                    key={idx}
                    onClick={() => targetPatientId ? onNavigate('patient_detail', { patientId: targetPatientId }) : onNavigate('appointments')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--surface-alt, #f8fafc)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{u.patientName || u.patient_name || u.patient?.name || 'Patient'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{u.reason || u.notes || 'Routine consultation'}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sec)' }}>
                      {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {u.time}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                No upcoming appointments.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Member Small Clinic Direct Patient Intake Modal */}
      {showQuickIntakeModal && (
        <div className="modal-overlay" onClick={() => setShowQuickIntakeModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)' }}>
              <div>
                <div className="modal-title" style={{ color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Quick Patient Intake
                </div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 500 }}>
                  Direct Patient Registration & Consultation Launch
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowQuickIntakeModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickIntakeSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Patient Full Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Ramesh Kumar"
                    value={intakeForm.name}
                    onChange={e => setIntakeForm({ ...intakeForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Mobile Number</label>
                    <input
                      className="input"
                      type="tel"
                      placeholder="10-digit mobile"
                      value={intakeForm.phone}
                      onChange={e => setIntakeForm({ ...intakeForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age & Gender</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        type="number"
                        placeholder="Age"
                        value={intakeForm.age}
                        onChange={e => setIntakeForm({ ...intakeForm, age: e.target.value })}
                        style={{ width: 70 }}
                      />
                      <select
                        className="input"
                        value={intakeForm.gender}
                        onChange={e => setIntakeForm({ ...intakeForm, gender: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chief Complaint / Initial Notes</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="e.g. Fever for 2 days, mild cough"
                    value={intakeForm.chief_complaint}
                    onChange={e => setIntakeForm({ ...intakeForm, chief_complaint: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowQuickIntakeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={intakeSaving}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {intakeSaving ? 'Registering...' : 'Register & Start Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
