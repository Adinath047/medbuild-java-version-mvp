// frontend/src/store/toastStore.ts
import { create } from 'zustand';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string;
  duration?: number; // In milliseconds. Default: 4500ms (success/info), 6000ms (warning/error). 0 for permanent.
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  action?: ToastAction;
  createdAt: number;
  remainingTime: number;
  isPaused: boolean;
  timerId?: ReturnType<typeof setTimeout>;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, title: string, message: string, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4500,
  info: 4500,
  warning: 6000,
  error: 6500,
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (type, title, message, options = {}) => {
    const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const duration = options.duration !== undefined ? options.duration : DEFAULT_DURATIONS[type];

    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (duration > 0) {
      timerId = setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    const newToast: ToastItem = {
      id,
      type,
      title,
      message,
      duration,
      action: options.action,
      createdAt: Date.now(),
      remainingTime: duration,
      isPaused: false,
      timerId,
    };

    set(state => {
      // Limit to 5 visible toasts to avoid viewport clutter
      const filtered = state.toasts.filter(t => t.id !== id);
      const nextToasts = [...filtered, newToast].slice(-5);
      return { toasts: nextToasts };
    });

    return id;
  },

  removeToast: (id) => {
    set(state => {
      const toast = state.toasts.find(t => t.id === id);
      if (toast?.timerId) {
        clearTimeout(toast.timerId);
      }
      return { toasts: state.toasts.filter(t => t.id !== id) };
    });
  },

  clearToasts: () => {
    const { toasts } = get();
    toasts.forEach(t => {
      if (t.timerId) clearTimeout(t.timerId);
    });
    set({ toasts: [] });
  },

  pauseToast: (id) => {
    set(state => {
      const target = state.toasts.find(t => t.id === id);
      if (!target || target.duration <= 0 || target.isPaused) return state;

      if (target.timerId) {
        clearTimeout(target.timerId);
      }

      const elapsed = Date.now() - target.createdAt;
      const remainingTime = Math.max(1000, target.duration - elapsed);

      return {
        toasts: state.toasts.map(t =>
          t.id === id ? { ...t, isPaused: true, remainingTime, timerId: undefined } : t
        ),
      };
    });
  },

  resumeToast: (id) => {
    set(state => {
      const target = state.toasts.find(t => t.id === id);
      if (!target || target.duration <= 0 || !target.isPaused) return state;

      const timerId = setTimeout(() => {
        get().removeToast(id);
      }, target.remainingTime);

      return {
        toasts: state.toasts.map(t =>
          t.id === id
            ? {
                ...t,
                isPaused: false,
                createdAt: Date.now() - (t.duration - t.remainingTime),
                timerId,
              }
            : t
        ),
      };
    });
  },
}));

// Quick global toast dispatch helper functions
export const toast = {
  success: (title: string, message: string, options?: ToastOptions) =>
    useToastStore.getState().addToast('success', title, message, options),

  info: (title: string, message: string, options?: ToastOptions) =>
    useToastStore.getState().addToast('info', title, message, options),

  warning: (title: string, message: string, options?: ToastOptions) =>
    useToastStore.getState().addToast('warning', title, message, options),

  error: (title: string, message: string, options?: ToastOptions) =>
    useToastStore.getState().addToast('error', title, message, options),

  dismiss: (id: string) => useToastStore.getState().removeToast(id),

  clear: () => useToastStore.getState().clearToasts(),
};
