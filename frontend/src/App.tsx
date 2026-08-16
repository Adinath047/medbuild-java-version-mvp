// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useRealtimeStore } from './store/realtimeStore';

// Page components mapped to navigation keys
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
import PrintRequestModal, { PrintModalData } from './components/PrintRequestModal';
import { useNotificationStore } from './store/notificationStore';
import { EmergencyBanner, NotificationBell } from './components/NotificationUI';

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
  const role = user?.role?.toLowerCase() || '';

  if (role === 'admin') return [
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

  if (role.includes('lab') || role.includes('pathologist')) return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',                  page: 'dashboard' },
    { icon: 'patients',     label: 'Referred Patients',     page: 'patients' },
    { icon: 'profile',      label: 'Profile',               page: 'settings' },
  ];

  if (role.includes('billing') || role.includes('finance')) return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',           page: 'dashboard' },
    { icon: 'patients',     label: 'My Patients',    page: 'patients' },
    { icon: 'billing',      label: 'Billing',        page: 'billing' },
    { icon: 'profile',      label: 'Profile',        page: 'settings' },
  ];

  if (role.includes('nurse')) return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',           page: 'dashboard' },
    { icon: 'patients',     label: 'Patients',       page: 'patients' },
    { icon: 'beds',         label: 'Beds & Vitals',  page: 'beds' },
    { icon: 'profile',      label: 'Profile',        page: 'settings' },
  ];

  if (role.includes('pharm')) return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',           page: 'dashboard' },
    { icon: 'prescription', label: 'Prescriptions',  page: 'prescriptions' },
    { icon: 'billing',      label: 'Pharmacy Sales', page: 'billing' },
    { icon: 'profile',      label: 'Profile',        page: 'settings' },
  ];

  const isReception = role.includes('reception');

  return [
    { section: 'WORKSPACE' },
    { icon: 'home',         label: 'Home',           page: 'dashboard' },
    { icon: 'patients',     label: isReception ? 'Patients' : 'My Patients',    page: 'patients' },
    { icon: 'beds',         label: isReception ? 'Beds & Vitals' : 'My Beds & Vitals', page: 'beds' },
    { icon: 'appointments', label: 'Appointments',   page: 'appointments' },
    { icon: 'prescription', label: 'Prescriptions',  page: 'prescriptions' },
    { icon: 'billing',      label: 'Billing',        page: 'billing' },
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
  const { 
    fetchNotifications, 
    activePrintModalData, 
    setActivePrintModalData, 
    dismissPrintRequest 
  } = useNotificationStore();

  const [page, setPage]         = useState(() => sessionStorage.getItem('emr_current_page') || '');
  const [pageData, setPageData] = useState<any>(() => {
    try {
      const stored = sessionStorage.getItem('emr_current_page_data');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [sidebarOpen, setSidebar] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 🔔 Centralized Notification Store polling & real-time synchronization
  useEffect(() => {
    if (!user) return;
    fetchNotifications(user.role);
    const interval = setInterval(() => fetchNotifications(user.role), 4000);

    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('emr-print-channel') : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'PRINT_REQUEST' && event.data?.payload) {
          if (['receptionist', 'admin', 'staff', 'nurse', 'billing'].includes(user.role)) {
            setActivePrintModalData(event.data.payload);
          }
        }
      };
    }

    const handleCustomEvent = (e: any) => {
      if (e.detail && ['receptionist', 'admin', 'staff', 'nurse', 'billing'].includes(user.role)) {
        setActivePrintModalData(e.detail);
      }
    };
    window.addEventListener('emr:print-request', handleCustomEvent);

    return () => {
      clearInterval(interval);
      if (channel) channel.close();
      window.removeEventListener('emr:print-request', handleCustomEvent);
    };
  }, [user, fetchNotifications, setActivePrintModalData]);

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

  // ⏱️ Auto-Logout Inactivity Monitor (15 Minutes Wall-Clock Aware for Device Sleep/Wake)
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in ms
    const STORAGE_KEY = 'medicos_last_activity';

    function recordActivity() {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    function checkInactivity() {
      const lastActivityStr = localStorage.getItem(STORAGE_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_TIMEOUT) {
        console.warn(`[Security] Logging out due to inactivity (${Math.round(elapsed / 1000)}s wall-clock elapsed).`);
        localStorage.removeItem(STORAGE_KEY);
        setShowInactivityModal(true);
        logout();
      }
    }

    if (!localStorage.getItem(STORAGE_KEY)) {
      recordActivity();
    }

    const checkInterval = setInterval(checkInactivity, 5000);

    const handleUserActivity = () => {
      checkInactivity();
      recordActivity();
    };

    const userActivityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    userActivityEvents.forEach(event => window.addEventListener(event, handleUserActivity, { passive: true }));

    const handleWakeOrFocus = () => {
      checkInactivity();
    };

    document.addEventListener('visibilitychange', handleWakeOrFocus);
    window.addEventListener('focus', handleWakeOrFocus);
    window.addEventListener('online', handleWakeOrFocus);

    return () => {
      clearInterval(checkInterval);
      userActivityEvents.forEach(event => window.removeEventListener(event, handleUserActivity));
      document.removeEventListener('visibilitychange', handleWakeOrFocus);
      window.removeEventListener('focus', handleWakeOrFocus);
      window.removeEventListener('online', handleWakeOrFocus);
    };
  }, [user, logout]);

  // 🔌 Secure WebSocket connection for real-time changes
  useEffect(() => {
    if (!user) return;

    // Fetch initial shared state into filing cabinet
    useRealtimeStore.getState().fetchInitialData();

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isIntentionalClose = false;

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
      if (!url) return;

      console.log('[ws] Connecting to:', url);
      socket = new WebSocket(url);

      socket.onopen = () => {
        console.log('[ws] Connected to real-time events.');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'APPOINTMENT_UPDATE') {
            if (payload.appointment) {
              useRealtimeStore.getState().upsertAppointment(payload.appointment);
            } else {
              apiClient.get('/appointments/today')
                .then(r => useRealtimeStore.getState().upsertAppointmentsBatch(r.data || []))
                .catch(console.error);
            }
            window.dispatchEvent(new CustomEvent('emr:appointments-update', {
              detail: { date: payload.date }
            }));
          } else if (payload.type === 'BED_UPDATE') {
            if (payload.bed) {
              useRealtimeStore.getState().upsertBed(payload.bed);
            } else {
              apiClient.get('/beds')
                .then(r => useRealtimeStore.getState().upsertBedsBatch(r.data || []))
                .catch(console.error);
            }
            window.dispatchEvent(new CustomEvent('emr:beds-update'));
          }
          // Refresh notifications in notificationStore
          if (user) useNotificationStore.getState().fetchNotifications(user.role);
        } catch (e) {
          console.error('[ws] Failed to parse message:', e);
        }
      };

      socket.onclose = () => {
        console.log('[ws] Connection closed.');
        if (!isIntentionalClose) {
          reconnectTimeout = setTimeout(() => {
            console.log('[ws] Reconnecting...');
            connect();
          }, 6000);
        }
      };

      socket.onerror = (err) => {
        console.warn('[ws] WebSocket connection error:', err);
      };
    }

    connect();

    return () => {
      isIntentionalClose = true;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  // Listen for manual notification events
  useEffect(() => {
    function handleManualNotification(e: any) {
      if (e.detail && user) {
        useNotificationStore.getState().fetchNotifications(user.role);
      }
    }
    window.addEventListener('emr:new-notification', handleManualNotification);
    return () => window.removeEventListener('emr:new-notification', handleManualNotification);
  }, [user]);

  // Set default page per role on login if not already stored
  useEffect(() => {
    if (!user) return;
    const storedPage = sessionStorage.getItem('emr_current_page');
    if (!storedPage || storedPage === '') {
      const defaultPage = user.role === 'admin' ? 'settings' : 'dashboard';
      setPage(defaultPage);
      sessionStorage.setItem('emr_current_page', defaultPage);
    }
  }, [user?.role]);

  function navigate(p: string, data?: any) {
    setPage(p);
    setPageData(data ?? null);
    sessionStorage.setItem('emr_current_page', p);
    if (data) sessionStorage.setItem('emr_current_page_data', JSON.stringify(data));
    else sessionStorage.removeItem('emr_current_page_data');
  }

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
          <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowInactivityModal(false)} role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
            <div className="modal" style={{ maxWidth: 400, textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 id="session-expired-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Session Expired</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                You have been logged out due to 15 minutes of inactivity.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setShowInactivityModal(false)}
                aria-label="Acknowledge session expiration"
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
        <div style={{ padding:60, textAlign:'center' }} role="alert">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
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
      <main className="main-area" role="main" aria-label="EMR Application Workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-hamburger" onClick={() => setSidebar(o => !o)} aria-label="Toggle Navigation Sidebar">
              <span/><span/><span/>
            </button>
            <div className="topbar-title">{PAGE_TITLES[page] ?? 'EMR'}</div>
          </div>
          <div className="topbar-right">
            {/* Patient Search Bar */}
            {user && (
              <div style={{ position: 'relative', width: 280, margin: '0 8px' }} className="no-print">
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
                  <span style={{ marginRight: 6, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search patients..."
                    aria-label="Search patients across hospital"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text)', width: '100%' }}
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} aria-label="Clear patient search" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>
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
            {/* Notification Bell */}
            {user && <NotificationBell />}
          </div>
        </header>

        {/* Emergency Alerts Banner for Doctor Suite */}
        <EmergencyBanner />

        <div className="page-scroll">
          {renderPage()}
        </div>
      </main>

      {/* Large Print Request Modal Pop-Up for Receptionist */}
      <PrintRequestModal 
        data={activePrintModalData} 
        onClose={() => dismissPrintRequest(activePrintModalData?.notificationId)} 
      />
    </div>
  );
}
