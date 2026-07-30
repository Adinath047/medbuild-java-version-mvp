// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/authStore';

// Pages
import AdminPortal from './pages/AdminPortal';
import PatientsPage from './pages/PatientsPage';
import PatientDetail from './pages/PatientDetail';
import NewEncounter from './pages/NewEncounter';
import EncountersListPage from './pages/EncountersListPage';
import PrescriptionPage from './pages/PrescriptionPage';
import PrescriptionsListPage from './pages/PrescriptionsListPage';
import VitalsPage from './pages/VitalsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BillingPage from './pages/BillingPage';
import PharmacyBillingPage from './pages/PharmacyBillingPage';
import SettingsPage from './pages/SettingsPage';
import FrontDeskDashboard from './pages/FrontDeskDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import LoginPage from './pages/LoginPage';
import BedsPage from './pages/BedsPage';
import { apiClient } from './api/client';
import { db } from './db/localDB';

// ── SVG Icons (Matching ClinicalHub Screenshots) ─────────────────────
const Icons: Record<string, JSX.Element> = {
  home:          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  dashboard:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  patients:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  beds:          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/><path d="M9 11h6"/></svg>,
  appointments:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  calendar:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="14.01"/></svg>,
  prescription:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
  billing:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  settings:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  profile:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>,
  staff:         <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  doctors:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 0 0 4.5 2h-1a.3.3 0 0 0-.3.3v15a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V2.3a.3.3 0 0 0-.3-.3h-1a.3.3 0 0 0-.3.3V5H4.8V2.3z"/></svg>
};

// NAV definition matching ClinicalHub layout
function getNav(user: any) {
  if (user?.role === 'admin') return [
    { section: 'WORKSPACE' },
    { icon: 'dashboard',    label: 'Dashboard',      page: 'dashboard' },
    { icon: 'patients',     label: 'Patients',       page: 'patients' },
    { icon: 'doctors',      label: 'Doctors',        page: 'settings' },
    { icon: 'appointments', label: 'Appointments',   page: 'appointments' },
    { icon: 'beds',         label: 'Beds & Vitals',  page: 'beds' },
    { icon: 'prescription', label: 'Prescriptions',  page: 'prescriptions' },
    { icon: 'billing',      label: 'Billing',        page: 'billing' },
    { icon: 'settings',     label: 'Settings',       page: 'settings' },
  ];

  return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',           page: 'dashboard' },
    { icon: 'patients',     label: 'My Patients',    page: 'patients' },
    { icon: 'beds',         label: 'My Beds & Vitals', page: 'beds' },
    { icon: 'appointments', label: 'Appointments',   page: 'appointments' },
    { icon: 'calendar',     label: 'Calendar',       page: 'appointments' },
    { icon: 'prescription', label: 'Prescriptions',  page: 'prescriptions' },
    { icon: 'profile',      label: 'Profile',        page: 'settings' },
  ];
}

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ page, onNav, user, sidebarOpen, onClose }: any) {
  const nav = getNav(user);
  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  const { logout } = useAuthStore();

  const roleInfo: Record<string, { label: string; sub: string }> = {
    admin:          { label: 'Administrator', sub: 'ADMIN CONSOLE' },
    doctor:         { label: 'Attending Doctor', sub: 'DOCTOR SUITE' },
    receptionist:   { label: 'Front-desk Executive', sub: 'FRONT DESK' },
    nurse:          { label: 'Nurse', sub: 'NURSING SUITE' },
    lab_technician: { label: 'Lab Technician', sub: 'DIAGNOSTICS' },
    pharmacist:     { label: 'Pharmacist', sub: 'PHARMACY' },
    billing:        { label: 'Billing Officer', sub: 'FINANCE' },
  };
  const { label: roleLabel, sub: roleSub } = roleInfo[user?.role] ?? { label: user?.role, sub: 'CLINICAL SUITE' };

  return (
    <>
      {sidebarOpen && <div style={{ display:'block', position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }} onClick={onClose} />}
      <nav className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 10px rgba(0, 150, 136, 0.25)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
              <path d="M8.5 12h7M12 8.5v7"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-brand-name" style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', letterSpacing: '-0.4px', lineHeight: 1.1 }}>ClinicalHub</div>
            <div className="sidebar-brand-sub" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', marginTop: 3 }}>{roleSub}</div>
          </div>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav" style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nav.map((item: any, i: number) =>
            item.section
              ? <div key={i} className="nav-section-label" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.2px', color: '#94a3b8', padding: '16px 8px 6px', textTransform: 'uppercase' }}>{item.section}</div>
              : (
                <div 
                  key={i} 
                  className={`nav-item${page === item.page ? ' active' : ''}`}
                  onClick={() => { onNav(item.page); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: page === item.page ? 600 : 500,
                    transition: 'all 0.15s ease',
                    background: page === item.page ? '#e6f7f5' : 'transparent',
                    color: page === item.page ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="nav-item-icon" style={{ display: 'flex', alignItems: 'center', color: page === item.page ? 'var(--primary)' : '#64748b' }}>
                      {Icons[item.icon]}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {page === item.page && (
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      marginRight: 4
                    }} />
                  )}
                </div>
              )
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
                fontSize: 13,
                fontWeight: 700,
                overflow: 'hidden'
              }}>
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="sidebar-user-name" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.2 }}>
                  {user?.name?.split(' ').slice(0, 2).join(' ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {roleLabel}
                </div>
              </div>
            </div>
            <button 
              className="sidebar-user"
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-light)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}
              title="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}


// ── Page titles ───────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', patients: 'Patients', prescriptions: 'Prescriptions', encounters: 'Encounters',
  vitals: 'Vitals', appointments: 'Appointments', billing: 'Billing',
  settings: 'Settings', patient_detail: 'Patient Record',
  new_encounter: 'New Encounter', new_prescription: 'Write Prescription', new_vitals: 'Record Vitals',
  beds: 'Bed Allocation',
};

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const { user, isLoading, logout } = useAuthStore();
  const [page, setPage]         = useState('');
  const [pageData, setPageData] = useState<any>(null);
  const [sidebarOpen, setSidebar] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [usePolling, setUsePolling] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  async function handleSearchChange(query: string) {
    setSearchQuery(query);
    const queryText = query.toLowerCase().trim();
    if (!queryText) {
      setSearchResults([]);
      return;
    }
    try {
      const filtered = await db.patients
        .filter((p: any) => 
          (p.name && p.name.toLowerCase().includes(queryText)) || 
          (p.uhid && p.uhid.toLowerCase().includes(queryText)) ||
          (p.phone && p.phone.includes(queryText))
        )
        .limit(5)
        .toArray();
      setSearchResults(filtered);
    } catch (err) {
      console.error('Failed to query local patients database:', err);
    }
  }

  // ⏱️ Auto-Logout Inactivity Monitor (15 Minutes)
  useEffect(() => {
    if (!user) return;

    let timeoutId: any;
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in ms

    function resetTimer() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('[Security] Logging out due to 15 minutes of inactivity.');
        setShowInactivityModal(true);
        logout();
      }, INACTIVITY_TIMEOUT);
    }

    resetTimer();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, logout]);

  useEffect(() => {
    if (!user || user.role !== 'doctor') return;
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);

    async function checkAlerts() {
      try {
        const res = await apiClient.get('/notifications/active');
        setAlerts(res.data);
      } catch (err) {
        console.error('Failed to check alerts:', err);
      }
    }
  }, [user]);

  // 🔌 Secure WebSocket connection for real-time changes
  useEffect(() => {
    if (!user) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isIntentionalClose = false;
    let hasConnectedOnce = false;

    // Vercel serverless deployments do not support long-lived WebSocket connections.
    // If we detect the app is deployed on vercel.app, we bypass WebSocket attempt
    // entirely to avoid error spam in browser console.
    const isVercel = window.location.hostname.endsWith('.vercel.app');

    if (isVercel) {
      console.log('[ws] Vercel serverless environment detected. Enabling real-time polling fallback.');
      setUsePolling(true);
      return;
    }

    function connect() {
      const getWsURL = (): string | null => {
        const _env = (import.meta as any).env ?? {};
        const override = _env.VITE_WS_URL;
        if (override) {
          return override.replace(/^http/, 'ws');
        }
        return null;
      };

      const url = getWsURL();
      if (!url) {
        setUsePolling(true);
        return;
      }
      console.log('[ws] Connecting to:', url);
      socket = new WebSocket(url);

      socket.onopen = () => {
        console.log('[ws] Connected to real-time events.');
        hasConnectedOnce = true;
        setUsePolling(false);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'APPOINTMENT_UPDATE') {
            console.log('[ws] Appointment update received for date:', payload.date);
            window.dispatchEvent(new CustomEvent('emr:appointments-update', {
              detail: { date: payload.date }
            }));

            if (payload.action === 'CHECK_IN') {
              const newNotif = {
                id: Math.random().toString(),
                type: 'check_in',
                message: `Patient ${payload.patientName} (${payload.uhid}) checked in for Dr. ${payload.doctorName}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: false
              };
              setLiveNotifications(prev => [newNotif, ...prev]);
            }
          } else if (payload.type === 'BED_UPDATE') {
            window.dispatchEvent(new CustomEvent('emr:beds-update'));
            let msg = '';
            if (payload.action === 'ALLOCATE') {
              msg = `Bed ${payload.bedName} allocated to patient ${payload.patientName} (${payload.uhid})`;
            } else if (payload.action === 'RELEASE') {
              msg = `Bed ${payload.bedName} released (patient discharged)`;
            }
            if (msg) {
              const newNotif = {
                id: Math.random().toString(),
                type: 'bed',
                message: msg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: false
              };
              setLiveNotifications(prev => [newNotif, ...prev]);
            }
          }
        } catch (e) {
          console.error('[ws] Failed to parse message:', e);
        }
      };

      socket.onclose = () => {
        console.log('[ws] Connection closed.');
        if (!isIntentionalClose) {
          if (!hasConnectedOnce) {
            console.log('[ws] Initial connection failed. Falling back to HTTP polling.');
            setUsePolling(true);
          } else {
            reconnectTimeout = setTimeout(() => {
              console.log('[ws] Reconnecting...');
              connect();
            }, 6000);
          }
        }
      };

      socket.onerror = (err) => {
        // Log as a warning instead of error to keep the console cleaner on serverless/offline environments
        console.warn('[ws] WebSocket connection error (likely serverless host or offline):', err);
      };
    }

    connect();

    return () => {
      isIntentionalClose = true;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  // 🕒 Polling fallback for real-time changes when WebSocket is not available
  const seenCheckedInAppts = React.useRef<Set<string>>(new Set());
  const seenBedsState = React.useRef<Record<string, { status: string; patient_name?: string; bed_number: string }>>({});
  const isFirstPoll = React.useRef(true);

  useEffect(() => {
    if (!user || !usePolling) return;

    async function pollData() {
      try {
        // Poll appointments
        const apptsRes = await apiClient.get('/appointments/today');
        const currentAppts = apptsRes.data || [];
        
        // Poll beds
        const bedsRes = await apiClient.get('/beds');
        const currentBeds = bedsRes.data || [];

        // Check for new Checked-In appointments
        currentAppts.forEach((a: any) => {
          if (a.status === 'Checked-In') {
            if (!seenCheckedInAppts.current.has(a.id)) {
              seenCheckedInAppts.current.add(a.id);
              if (!isFirstPoll.current) {
                const newNotif = {
                  id: Math.random().toString(),
                  type: 'check_in',
                  message: `Patient ${a.patient_name || 'Patient'} (${a.uhid || '—'}) checked in for Dr. ${a.doctor_name || 'Doctor'}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: false
                };
                setLiveNotifications(prev => [newNotif, ...prev]);
              }
            }
          }
        });

        // Check for bed updates
        currentBeds.forEach((b: any) => {
          const prev = seenBedsState.current[b.id];
          if (prev) {
            if (prev.status !== b.status) {
              let msg = '';
              if (b.status === 'Occupied') {
                msg = `Bed ${b.bed_number} allocated to patient ${b.patient_name || 'Patient'} (${b.uhid || '—'})`;
              } else if (b.status === 'Available' && prev.status === 'Occupied') {
                msg = `Bed ${b.bed_number} released (patient discharged)`;
              }
              if (msg && !isFirstPoll.current) {
                const newNotif = {
                  id: Math.random().toString(),
                  type: 'bed',
                  message: msg,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: false
                };
                setLiveNotifications(prev => [newNotif, ...prev]);
              }
            }
          }
          seenBedsState.current[b.id] = { status: b.status, patient_name: b.patient_name, bed_number: b.bed_number };
        });

        if (isFirstPoll.current) {
          isFirstPoll.current = false;
        }

        // Trigger updates in components
        window.dispatchEvent(new CustomEvent('emr:appointments-update'));
        window.dispatchEvent(new CustomEvent('emr:beds-update'));
      } catch (err) {
        console.error('[ws] Polling error:', err);
      }
    }

    // Run first poll immediately
    pollData();

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    console.log(`[ws] Starting background polling fallback (every ${isLocal ? '3s' : '20s'})...`);
    const interval = setInterval(pollData, isLocal ? 3000 : 20000);

    return () => clearInterval(interval);
  }, [user, usePolling]);

  // Listen for manual notification events
  useEffect(() => {
    function handleManualNotification(e: any) {
      if (e.detail) {
        const newNotif = {
          id: Math.random().toString(),
          type: e.detail.type || 'vitals',
          message: e.detail.message || 'Manual Notification Triggered: Vitals Alert',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        };
        setLiveNotifications(prev => [newNotif, ...prev]);
      }
    }
    window.addEventListener('emr:new-notification', handleManualNotification);
    return () => window.removeEventListener('emr:new-notification', handleManualNotification);
  }, []);

  async function handleDismissAlert(id: string) {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  }

  // Set default page per role on login
  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin')        setPage('settings');
    else                              setPage('dashboard');
  }, [user?.role]);

  function navigate(p: string, data?: any) { setPage(p); setPageData(data ?? null); }

  if (isLoading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading MedBuilds…</div>
    </div>
  );

  if (!user) {
    return (
      <>
        <LoginPage />
        {showInactivityModal && (
          <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowInactivityModal(false)}>
            <div className="modal" style={{ maxWidth: 400, textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏱️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Session Expired</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                You have been logged out due to 15 minutes of inactivity.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setShowInactivityModal(false)}
              >
                Okay
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Admin: full-page portal, no sidebar ─────────────────────────────
  if (user?.role === 'admin') {
    return <AdminPortal />;
  }

  // ── Doctor & Receptionist: sidebar layout ────────────────────────────
  // Access control per role
  const ACCESS: Record<string, string[]> = {
    dashboard:        ['receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'billing'],
    patients:         ['doctor', 'receptionist', 'nurse', 'lab_technician', 'pharmacist', 'billing'],
    patient_detail:   ['doctor', 'receptionist', 'nurse', 'lab_technician', 'pharmacist', 'billing'],
    prescriptions:    ['doctor', 'pharmacist', 'receptionist', 'nurse', 'lab_technician', 'billing'],
    new_prescription: ['doctor', 'pharmacist', 'receptionist', 'nurse', 'lab_technician', 'billing'],
    encounters:       ['doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'billing'],
    new_encounter:    ['doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'billing'],
    vitals:           ['doctor', 'nurse', 'lab_technician', 'receptionist', 'pharmacist', 'billing'],
    new_vitals:       ['doctor', 'nurse', 'lab_technician', 'receptionist', 'pharmacist', 'billing'],
    appointments:     ['doctor', 'receptionist', 'nurse', 'lab_technician', 'pharmacist', 'billing'],
    billing:          ['receptionist', 'billing', 'doctor', 'nurse', 'lab_technician', 'pharmacist'],
    pharmacy:         ['receptionist', 'pharmacist', 'doctor', 'nurse', 'lab_technician', 'billing'],
    beds:             ['receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'billing'],
    settings:         ['doctor', 'nurse', 'lab_technician', 'pharmacist', 'billing', 'receptionist'],
  };

  function renderPage() {
    const allowed = ACCESS[page];
    if (allowed && !allowed.includes(user!.role)) {
      return (
        <div style={{ padding:60, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🔒</div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Access Restricted</div>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>You don't have permission to view this page.</p>
        </div>
      );
    }

    switch (page) {
      case 'dashboard':       return user?.role === 'doctor' ? <DoctorDashboard onNavigate={navigate} /> : <FrontDeskDashboard onNavigate={navigate} />;
      case 'patients':        return <PatientsPage onNavigate={navigate} autoOpen={pageData?.autoOpen} />;
      case 'prescriptions':   return <PrescriptionsListPage onNavigate={navigate} />;
      case 'encounters':      return <EncountersListPage onNavigate={navigate} />;
      case 'vitals':          return <VitalsPage onNavigate={navigate} />;
      case 'appointments':    return <AppointmentsPage onNavigate={navigate} />;
      case 'billing':         return <BillingPage onNavigate={navigate} data={pageData} />;
      case 'pharmacy':        return <PharmacyBillingPage onNavigate={navigate} />;
      case 'patient_detail':  return <PatientDetail onNavigate={navigate} data={pageData} />;
      case 'new_encounter':   return <NewEncounter onNavigate={navigate} data={pageData} />;
      case 'new_prescription':return <PrescriptionPage onNavigate={navigate} data={pageData} />;
      case 'new_vitals':      return <VitalsPage onNavigate={navigate} data={pageData} mode="record" />;
      case 'beds':            return <BedsPage />;
      case 'settings':        return <SettingsPage />;
      default:                return <PatientsPage onNavigate={navigate} />;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNav={navigate} user={user} sidebarOpen={sidebarOpen} onClose={() => setSidebar(false)} />
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-hamburger" onClick={() => setSidebar(o => !o)}>
              <span/><span/><span/>
            </button>
            <div className="topbar-title">{PAGE_TITLES[page] ?? 'EMR'}</div>
          </div>
          
          {/* Patient Search Bar */}
          {user && (
            <div style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '0 16px' }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ marginRight: 6, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>
                    ✕
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '105%',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  maxHeight: 250,
                  overflowY: 'auto',
                  padding: '4px 0'
                }}>
                  {searchResults.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        navigate('patient_detail', { patientId: p.id });
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: hoveredId === p.id ? 'var(--border-light)' : 'transparent',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        transition: 'background 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
                        <span>{p.uhid}</span>
                        <span>•</span>
                        <span>{p.sex || 'Male'}, {p.age || '—'}y</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="topbar-right">
            {/* Notification Bell */}
            {user && (
              <div style={{ position: 'relative', marginRight: 8 }} className="no-print">
                <button
                  onClick={() => setShowNotificationPanel(o => !o)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 18,
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 6,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {(liveNotifications.length > 0 || alerts.length > 0) && (
                    <span style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 14,
                      height: 14,
                      fontSize: 8,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {liveNotifications.length + alerts.length}
                    </span>
                  )}
                </button>

                {showNotificationPanel && (
                  <div style={{
                    position: 'absolute',
                    top: '125%',
                    right: 0,
                    width: 320,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>Notifications</span>
                      <button
                        onClick={() => {
                          setLiveNotifications([]);
                          // Dismiss all DB alerts
                          Promise.all(alerts.map(a => apiClient.post(`/notifications/${a.id}/read`)))
                            .then(() => setAlerts([]))
                            .catch(err => console.error(err));
                        }}
                        style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Clear all
                      </button>
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {alerts.length === 0 && liveNotifications.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                          No new notifications
                        </div>
                      ) : (
                        <>
                          {/* Render active emergency alerts first */}
                          {alerts.map(a => (
                            <div
                              key={a.id}
                              style={{
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border-light)',
                                background: '#fef2f2',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>🚨 Emergency Alert</span>
                                <button
                                  onClick={() => handleDismissAlert(a.id)}
                                  style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                                >
                                  Dismiss
                                </button>
                              </div>
                              <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>{a.message}</div>
                              {a.patient_name && (
                                <div style={{ fontSize: 10.5, color: '#b91c1c' }}>
                                  Patient: <strong>{a.patient_name}</strong> ({a.patient_uhid})
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Render live real-time notifications */}
                          {liveNotifications.map(n => (
                            <div
                              key={n.id}
                              style={{
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                position: 'relative'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: n.type === 'check_in' ? 'var(--primary)' : '#10b981',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5
                                }}>
                                  {n.type === 'check_in' ? 'Patient Flow' : 'Bed Update'}
                                </span>
                                <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{n.timestamp}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{n.message}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              width:32,
              height:32,
              borderRadius:'50%',
              background:'var(--primary-grad)',
              color:'#fff',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              fontWeight:700,
              fontSize:12,
              flexShrink:0,
              overflow: 'hidden'
            }}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.name?.split(' ').map(w => w[0]).join('').slice(0,2) ?? ''
              )}
            </div>
          </div>
        </header>

        {/* Emergency alerts section */}
        {alerts.length > 0 && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            margin: '16px',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#dc2626',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <style>{`
                @keyframes shake {
                  0% { transform: rotate(0); }
                  25% { transform: rotate(15deg); }
                  50% { transform: rotate(0); }
                  75% { transform: rotate(-15deg); }
                  100% { transform: rotate(0); }
                }
              `}</style>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#991b1b', fontSize: 14 }}>EMERGENCY ALERTS ({alerts.length})</div>
                <div style={{ color: '#7f1d1d', fontSize: 13, marginTop: 4 }}>
                  {alerts.map((alert, i) => (
                    <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < alerts.length - 1 ? '1px solid #fca5a5' : 'none' }}>
                      <div>
                        <strong>{alert.message}</strong>
                        {alert.patient_name && <span> (Patient: <strong>{alert.patient_name}</strong> - UHID: {alert.patient_uhid})</span>}
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11, minHeight: 'auto', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => handleDismissAlert(alert.id)}
                      >
                        Acknowledge & Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="page-scroll">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
