import { create } from 'zustand';
import { apiClient, setAccessToken, getAccessToken } from '../api/client';
import { initializeSessionCrypto, purgeCryptoVault } from '../utils/cryptoVault';

export interface AuthUser {
  id:               string;
  name:             string;
  email:            string;
  role:             string;
  hospitalId?:      string;
  photoUrl?:        string;
  staff_type?:      string;
  specialization?:  string;
  licenseNumber?:   string;
  consultationFee?: number;
  followupFee?:     number;
  bedPerDayCharge?: number;
  letterhead?:      string;
  qualification?:   string;
  registrationNumber?: string;
  showDiagnosisOnPrint?:      boolean;
  showInvestigationsOnPrint?: boolean;
  showVitalsOnPrint?:         boolean;
  printMarginTop?:            number;
  printMarginBottom?:         number;
  printMarginLeftRight?:      number;
  printFontSize?:             number;
}

interface AuthState {
  user:           AuthUser | null;
  isLoading:      boolean;
  loginError:     string | null;
  login: (staffId: string, password: string, hospitalId?: string) => Promise<boolean>;
  logout:         () => void;
  restoreSession: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function normalizeAuthUser(raw: any): AuthUser {
  if (!raw) return raw;
  return {
    ...raw,
    id: raw.id,
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || 'doctor',
    hospitalId: raw.hospitalId || raw.hospital_id,
    photoUrl: raw.photoUrl || raw.photo_url || '',
    staff_type: raw.staff_type || raw.staffType,
    specialization: raw.specialization || '',
    licenseNumber: raw.licenseNumber || raw.license_number || '',
    qualification: raw.qualification || '',
    registrationNumber: raw.registrationNumber || raw.registration_number || '',
    consultationFee: raw.consultationFee !== undefined ? Number(raw.consultationFee) : (raw.consultation_fee !== undefined ? Number(raw.consultation_fee) : 0),
    followupFee: raw.followupFee !== undefined ? Number(raw.followupFee) : (raw.followup_fee !== undefined ? Number(raw.followup_fee) : 0),
    bedPerDayCharge: raw.bedPerDayCharge !== undefined ? Number(raw.bedPerDayCharge) : (raw.bed_per_day_charge !== undefined ? Number(raw.bed_per_day_charge) : 0),
    letterhead: raw.letterhead || '',
    showDiagnosisOnPrint: raw.showDiagnosisOnPrint !== undefined ? !!raw.showDiagnosisOnPrint : (raw.show_diagnosis_on_print !== undefined ? raw.show_diagnosis_on_print === 1 || raw.show_diagnosis_on_print === true || raw.show_diagnosis_on_print === 'true' : true),
    showInvestigationsOnPrint: raw.showInvestigationsOnPrint !== undefined ? !!raw.showInvestigationsOnPrint : (raw.show_investigations_on_print !== undefined ? raw.show_investigations_on_print === 1 || raw.show_investigations_on_print === true || raw.show_investigations_on_print === 'true' : true),
    showVitalsOnPrint: raw.showVitalsOnPrint !== undefined ? !!raw.showVitalsOnPrint : (raw.show_vitals_on_print !== undefined ? raw.show_vitals_on_print === 1 || raw.show_vitals_on_print === true || raw.show_vitals_on_print === 'true' : true),
    printMarginTop: raw.printMarginTop !== undefined ? Number(raw.printMarginTop) : (raw.print_margin_top !== undefined ? Number(raw.print_margin_top) : 35),
    printMarginBottom: raw.printMarginBottom !== undefined ? Number(raw.printMarginBottom) : (raw.print_margin_bottom !== undefined ? Number(raw.print_margin_bottom) : 15),
    printMarginLeftRight: raw.printMarginLeftRight !== undefined ? Number(raw.printMarginLeftRight) : (raw.print_margin_left_right !== undefined ? Number(raw.print_margin_left_right) : 18),
    printFontSize: raw.printFontSize !== undefined ? Number(raw.printFontSize) : (raw.print_font_size !== undefined ? Number(raw.print_font_size) : 11),
  };
}

function clearLocalAuth() {
  setAccessToken(null);
  purgeCryptoVault();
  localStorage.removeItem('emr_user');
  localStorage.removeItem('emr_token');
  localStorage.removeItem('medicos_last_activity');
}

function persistLocalAuth(user: AuthUser, token?: string) {
  const normalized = normalizeAuthUser(user);
  localStorage.setItem('emr_user', JSON.stringify(normalized));
  if (token) {
    localStorage.setItem('emr_token', token);
    setAccessToken(token);
  }
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  isLoading:  true,
  loginError: null,

  restoreSession: async () => {
    // 1. Immediately sync cached token & user for instant hydration
    const cachedToken = localStorage.getItem('emr_token');
    if (cachedToken) {
      setAccessToken(cachedToken);
    }

    const cachedUser = localStorage.getItem('emr_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser) as AuthUser;
        set({ user: parsed, isLoading: false });
      } catch {
        clearLocalAuth();
      }
    }

    try {
      // 2. Attempt token refresh from HttpOnly refresh cookie
      try {
        const refreshRes = await apiClient.post('/auth/refresh');
        const token = refreshRes.data?.token || refreshRes.data?.accessToken;
        if (token) {
          setAccessToken(token);
        }
      } catch (refreshErr) {
        // If refresh fails, fall back to validating existing token with /auth/me
      }

      const res = await apiClient.get('/auth/me');
      const rawUser = (res.data?.user || res.data) as AuthUser;
      const user = normalizeAuthUser(rawUser);

      // Initialize volatile Web Crypto session key in memory
      await initializeSessionCrypto(user.id + ":" + (user.hospitalId || 'medicos'));

      persistLocalAuth(user, getAccessToken() || cachedToken || undefined);
      set({ user, isLoading: false });

      import('../sync/syncManager').then(m => m.syncNow()).catch(console.error);
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        clearLocalAuth();
        set({ user: null, isLoading: false });
      } else {
        console.warn('[authStore] Could not reach server to verify session:', err?.message);
        set({ isLoading: false });
      }
    }
  },

  login: async (staffId, password, hospitalId) => {
    set({ loginError: null });
    try {
      const res = await apiClient.post('/auth/login', { staffId, password, hospitalId });
      const rawUser = res.data?.user as AuthUser;
      const token = res.data?.token || res.data?.accessToken;
      const user = normalizeAuthUser(rawUser);

      // Initialize volatile Web Crypto session key in memory
      await initializeSessionCrypto(user.id + ":" + (user.hospitalId || hospitalId || 'medicos'));

      persistLocalAuth(user, token);

      try {
        const { db } = await import('../db/localDB');
        await Promise.all([
          db.patients.clear(),
          db.encounters.clear(),
          db.vitals.clear(),
          db.prescriptions.clear(),
          db.appointments.clear(),
          db.billing.clear(),
          db.medicines.clear(),
          db.syncQueue.clear(),
          db.meta.clear()
        ]);
      } catch (err) {
        console.error('Failed to clear local EMR database on login:', err);
      }

      set({ user, loginError: null });

      import('../sync/syncManager').then(m => m.syncNow()).catch(console.error);

      return true;
    } catch (err: any) {
      const message: string =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.message === 'Network Error'
          ? 'Cannot reach Spring Boot server. Check your connection.'
          : 'Login failed. Please try again.');
      set({ loginError: message });
      return false;
    }
  },

  logout: () => {
    apiClient.post('/auth/logout').catch(() => {});
    clearLocalAuth();

    import('../db/localDB').then(async ({ db }) => {
      try {
        await Promise.all([
          db.patients.clear(),
          db.encounters.clear(),
          db.vitals.clear(),
          db.prescriptions.clear(),
          db.appointments.clear(),
          db.billing.clear(),
          db.medicines.clear(),
          db.syncQueue.clear(),
          db.meta.clear()
        ]);
      } catch (err) {
        console.error('Failed to clear local EMR database on logout:', err);
      }
    }).catch(console.error);

    set({ user: null, loginError: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('emr:logout', () => {
    useAuthStore.getState().logout();
  });
}