// client/src/store/authStore.ts
import { create } from 'zustand';
import { apiClient } from '../api/client';

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
  login: (email: string, password: string, hospitalId?: string) => Promise<boolean>;
  logout:         () => void;
  restoreSession: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function clearLocalAuth() {
  localStorage.removeItem('emr_user');
  localStorage.removeItem('emr_token');
}

function persistLocalAuth(user: AuthUser, token?: string) {
  localStorage.setItem('emr_user', JSON.stringify(user));
  if (token) {
    localStorage.setItem('emr_token', token);
  }
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  isLoading:  true,
  loginError: null,

  restoreSession: async () => {
    const cachedUser = localStorage.getItem('emr_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser) as AuthUser;
        set({ user: parsed, isLoading: true });
      } catch {
        clearLocalAuth();
      }
    }

    try {
      const res = await apiClient.get('/auth/me');
      const { user } = res.data as { user: AuthUser };

      persistLocalAuth(user);
      set({ user, isLoading: false });

      import('../sync/syncManager').then(m => m.syncNow()).catch(console.error);
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        clearLocalAuth();
        set({ user: null, isLoading: false });
      } else {
        console.warn('[authStore] Could not reach server to verify session:', err?.message);
        const cached = localStorage.getItem('emr_user');
        if (cached) {
          try {
            set({ user: JSON.parse(cached), isLoading: false });
          } catch {
            set({ user: null, isLoading: false });
          }
        } else {
          set({ user: null, isLoading: false });
        }
      }
    }
  },

  login: async (email, password, hospitalId) => {
    set({ loginError: null });
    try {
      const res = await apiClient.post('/auth/login', { email, password, hospitalId });
      const { user, token } = res.data as { user: AuthUser; token?: string };

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