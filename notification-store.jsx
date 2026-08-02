// notification-store.jsx
//
// One shared source of truth for toast alerts + the unread badge count.
// Both UI surfaces read from here instead of each managing their own
// listener/state — the same pattern as the EMRRealtimeProvider built
// earlier for appointments/beds.
//
// WIRING: wherever your WebSocket handler AND your polling fallback loop
// currently detect a new event, have BOTH of them dispatch the same
// window event, tagged with which transport delivered it:
//
//   window.dispatchEvent(new CustomEvent('emr:notification', {
//     detail: { id: event.id, message: 'Patient checked in', type: 'info', transport: 'ws' }
//   }));
//
//   // and, in the polling loop, the same shape but transport: 'poll'
//
// The `id` MUST be a stable, unique identifier for the underlying event
// (e.g. the appointment/check-in id) — that's what lets this store dedupe
// if WS and polling both end up delivering the same event.

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

const MAX_TOASTS = 4;              // cap how many stack on screen at once
const TOAST_AUTO_DISMISS_MS = 6000;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIds = useRef(new Set()); // dedupe guard across WS + polling

  const pushNotification = useCallback((notification, meta = {}) => {
    const { id, message, type = 'info' } = notification || {};
    if (!id) {
      console.warn('[notification] dropped — missing id', notification);
      return;
    }

    // Diagnostic logging: makes the delay visible instead of guessed at.
    // Check this in the console to confirm which transport delivered an
    // event and how long after the action it actually arrived.
    const receivedAt = performance.now();
    console.log(
      `[notification] id=${id} via=${meta.transport ?? 'unknown'} receivedAt=${receivedAt.toFixed(1)}ms`
    );

    if (seenIds.current.has(id)) {
      console.log(`[notification] id=${id} skipped — duplicate delivery (WS + polling both fired)`);
      return;
    }
    seenIds.current.add(id);

    setUnreadCount(prev => prev + 1);
    setToasts(prev => [...prev, { id, message, type, receivedAt }].slice(-MAX_TOASTS));

    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_AUTO_DISMISS_MS);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  // ONE listener for the whole app. Both your WS handler and your polling
  // fallback loop should dispatch this same event name — this provider
  // doesn't need to know or care which transport delivered it.
  useEffect(() => {
    const handler = (e) => pushNotification(e.detail, { transport: e.detail?.transport });
    window.addEventListener('emr:notification', handler);
    return () => window.removeEventListener('emr:notification', handler);
  }, [pushNotification]);

  return (
    <NotificationContext.Provider value={{ toasts, unreadCount, dismissToast, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
