import { create } from 'zustand';
import apiClient from '../api/client';

export interface AppointmentItem {
  id: string;
  patient_id?: string;
  patient_name?: string;
  doctor_id?: string;
  doctor_name?: string;
  date?: string;
  time?: string;
  type?: string;
  status?: string;
  token_number?: number;
  notes?: string;
  vitals?: any;
  [key: string]: any;
}

export interface BedItem {
  id: string;
  bed_number: string;
  ward: string;
  type?: string;
  status: string;
  daily_rate?: number;
  patient_id?: string;
  patient_name?: string;
  patient_uhid?: string;
  doctor_id?: string;
  doctor_name?: string;
  admitted_at?: string;
  notes?: string;
  [key: string]: any;
}

export interface LiveNotification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface RealtimeState {
  // Keyed lookup tables ("Filing Cabinet") for single-source of truth
  appointmentsById: Record<string, AppointmentItem>;
  bedsById: Record<string, BedItem>;
  liveNotifications: LiveNotification[];
  isLoading: boolean;
  usePolling: boolean;

  // Actions
  fetchInitialData: () => Promise<void>;
  upsertAppointment: (appt: AppointmentItem) => void;
  upsertAppointmentsBatch: (appts: AppointmentItem[]) => void;
  removeAppointment: (id: string) => void;
  upsertBed: (bed: BedItem) => void;
  upsertBedsBatch: (beds: BedItem[]) => void;
  setLiveNotifications: (notifs: LiveNotification[] | ((prev: LiveNotification[]) => LiveNotification[])) => void;
  dismissLiveNotification: (id: string) => void;
  clearAllNotifications: () => void;
  setUsePolling: (val: boolean) => void;

  // Selectors / Helpers
  getAppointmentsList: () => AppointmentItem[];
  getBedsList: () => BedItem[];
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  appointmentsById: {},
  bedsById: {},
  liveNotifications: [],
  isLoading: false,
  usePolling: false,

  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      const [apptsRes, bedsRes] = await Promise.allSettled([
        apiClient.get('/appointments/today'),
        apiClient.get('/beds')
      ]);

      const newApptsMap: Record<string, AppointmentItem> = {};
      if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data)) {
        apptsRes.value.data.forEach((a: AppointmentItem) => {
          if (a && a.id) newApptsMap[a.id] = a;
        });
      }

      const newBedsMap: Record<string, BedItem> = {};
      if (bedsRes.status === 'fulfilled' && Array.isArray(bedsRes.value.data)) {
        bedsRes.value.data.forEach((b: BedItem) => {
          if (b && b.id) newBedsMap[b.id] = b;
        });
      }

      set(state => ({
        appointmentsById: { ...state.appointmentsById, ...newApptsMap },
        bedsById: { ...state.bedsById, ...newBedsMap },
        isLoading: false
      }));
    } catch (err) {
      console.error('[RealtimeStore] Failed to fetch initial data:', err);
      set({ isLoading: false });
    }
  },

  upsertAppointment: (appt) => {
    if (!appt || !appt.id) return;
    set(state => ({
      appointmentsById: {
        ...state.appointmentsById,
        [appt.id]: { ...(state.appointmentsById[appt.id] || {}), ...appt }
      }
    }));
  },

  upsertAppointmentsBatch: (appts) => {
    if (!Array.isArray(appts)) return;
    set(state => {
      const nextMap = { ...state.appointmentsById };
      appts.forEach(a => {
        if (a && a.id) nextMap[a.id] = { ...(nextMap[a.id] || {}), ...a };
      });
      return { appointmentsById: nextMap };
    });
  },

  removeAppointment: (id) => {
    if (!id) return;
    set(state => {
      const nextMap = { ...state.appointmentsById };
      delete nextMap[id];
      return { appointmentsById: nextMap };
    });
  },

  upsertBed: (bed) => {
    if (!bed || !bed.id) return;
    set(state => ({
      bedsById: {
        ...state.bedsById,
        [bed.id]: { ...(state.bedsById[bed.id] || {}), ...bed }
      }
    }));
  },

  upsertBedsBatch: (beds) => {
    if (!Array.isArray(beds)) return;
    set(state => {
      const nextMap = { ...state.bedsById };
      beds.forEach(b => {
        if (b && b.id) nextMap[b.id] = { ...(nextMap[b.id] || {}), ...b };
      });
      return { bedsById: nextMap };
    });
  },

  setLiveNotifications: (updater) => {
    set(state => ({
      liveNotifications: typeof updater === 'function' ? updater(state.liveNotifications) : updater
    }));
  },

  dismissLiveNotification: (id) => {
    set(state => ({
      liveNotifications: state.liveNotifications.filter(n => n.id !== id)
    }));
  },

  clearAllNotifications: () => set({ liveNotifications: [] }),

  setUsePolling: (usePolling) => set({ usePolling }),

  getAppointmentsList: () => Object.values(get().appointmentsById),
  getBedsList: () => Object.values(get().bedsById)
}));
