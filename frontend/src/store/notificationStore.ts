import { create } from 'zustand';
import { apiClient } from '../api/client';
import { PrintModalData } from '../components/PrintRequestModal';

export interface EMRNotification {
  id: string;
  hospitalId?: string;
  type: string; // 'emergency' | 'print_request' | 'general' | 'alert'
  message: string;
  patientId?: string;
  patientName?: string;
  patientUhid?: string;
  isRead?: boolean;
  createdAt?: string;
  parsedPayload?: any;
}

interface NotificationState {
  notifications: EMRNotification[];
  emergencyAlerts: EMRNotification[];
  printRequests: EMRNotification[];
  unreadCount: number;
  isLoading: boolean;
  activePrintModalData: PrintModalData | null;

  fetchNotifications: (userRole?: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setActivePrintModalData: (data: PrintModalData | null) => void;
  dismissPrintRequest: (notificationId?: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  emergencyAlerts: [],
  printRequests: [],
  unreadCount: 0,
  isLoading: false,
  activePrintModalData: null,

  fetchNotifications: async (userRole?: string) => {
    try {
      set({ isLoading: true });
      const res = await apiClient.get('/notifications/active');
      const rawList: any[] = Array.isArray(res.data) ? res.data : (res.data?.notifications || res.data?.alerts || []);

      const processed: EMRNotification[] = rawList.map((n: any) => {
        let parsedPayload: any = null;
        let cleanMessage = n.message || '';

        if (typeof cleanMessage === 'string' && cleanMessage.trim().startsWith('{')) {
          try {
            parsedPayload = JSON.parse(cleanMessage);
            if (parsedPayload.patient_name) {
              cleanMessage = `Prescription Print Request: ${parsedPayload.patient_name} (${parsedPayload.uhid || 'UHID'})`;
            } else if (parsedPayload.message) {
              cleanMessage = parsedPayload.message;
            }
          } catch (e) {
            cleanMessage = 'Notification alert';
          }
        }

        return {
          id: n.id || `notif-${Math.random()}`,
          hospitalId: n.hospitalId || n.hospital_id,
          type: n.type || 'general',
          message: cleanMessage,
          patientId: n.patientId || n.patient_id,
          patientName: n.patient_name || parsedPayload?.patient_name,
          patientUhid: n.patient_uhid || parsedPayload?.uhid,
          isRead: Boolean(n.isRead || n.is_read),
          createdAt: n.createdAt || n.created_at,
          parsedPayload
        };
      });

      // Role-specific filtering
      const emergencyOnly = processed.filter(n => 
        n.type === 'emergency' || n.type === 'alert' || n.type === 'clinical'
      );

      const printRequestsOnly = processed.filter(n => n.type === 'print_request');

      set({
        notifications: processed,
        emergencyAlerts: userRole === 'doctor' ? emergencyOnly : [],
        printRequests: printRequestsOnly,
        unreadCount: processed.length,
        isLoading: false
      });

      // Auto-trigger active print modal for Receptionist/Staff if new print_request arrives
      if (['receptionist', 'admin', 'staff', 'nurse', 'billing'].includes(userRole || '')) {
        const firstUnreadPrint = printRequestsOnly[0];
        if (firstUnreadPrint && firstUnreadPrint.parsedPayload) {
          const currentModal = get().activePrintModalData;
          if (!currentModal || currentModal.notificationId !== firstUnreadPrint.id) {
            set({
              activePrintModalData: {
                notificationId: firstUnreadPrint.id,
                ...firstUnreadPrint.parsedPayload
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[NotificationStore] Fetch failed:', err);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
    } catch (err) {
      // Fallback PUT
      try {
        await apiClient.put(`/notifications/${id}/read`);
      } catch (e) {
        console.error('Failed to mark notification read:', e);
      }
    }

    const updated = get().notifications.filter(n => n.id !== id);
    const updatedEmergency = get().emergencyAlerts.filter(n => n.id !== id);
    const updatedPrint = get().printRequests.filter(n => n.id !== id);

    set({
      notifications: updated,
      emergencyAlerts: updatedEmergency,
      printRequests: updatedPrint,
      unreadCount: updated.length,
      activePrintModalData: get().activePrintModalData?.notificationId === id ? null : get().activePrintModalData
    });
  },

  markAllAsRead: async () => {
    const list = get().notifications;
    await Promise.all(
      list.map(n => apiClient.post(`/notifications/${n.id}/read`).catch(() => {}))
    );
    set({
      notifications: [],
      emergencyAlerts: [],
      printRequests: [],
      unreadCount: 0,
      activePrintModalData: null
    });
  },

  setActivePrintModalData: (data: PrintModalData | null) => {
    set({ activePrintModalData: data });
  },

  dismissPrintRequest: async (notificationId?: string) => {
    if (notificationId) {
      await get().markAsRead(notificationId);
    } else {
      set({ activePrintModalData: null });
    }
  }
}));
