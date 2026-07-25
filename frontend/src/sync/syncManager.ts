// client/src/sync/syncManager.ts
// Handles bidirectional sync: IndexedDB pending records → server, server changes → IndexedDB

import { db, getPendingCount, getLastSync, setLastSync } from '../db/localDB';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (state: SyncState, pending: number) => void;
const listeners = new Set<SyncListener>();

let currentState: SyncState   = 'idle';
let pendingCount               = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isOnline                   = typeof navigator !== 'undefined' ? navigator.onLine : true;
let consecutiveErrors          = 0;
const MAX_BACKOFF_MS           = 5 * 60 * 1000; // 5 min

// ── Listener management ───────────────────────────────────────────────────
export function onSyncStateChange(fn: SyncListener) {
  listeners.add(fn);
  fn(currentState, pendingCount); // emit current state immediately to new subscriber
  return () => listeners.delete(fn);
}

function emit(state: SyncState, pending?: number) {
  currentState = state;
  if (pending !== undefined) pendingCount = pending;
  listeners.forEach(fn => fn(currentState, pendingCount));
}

// ── Online / offline detection & window focus trigger ────────────────────
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('emr-sync-channel') : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data === 'trigger-sync') {
      console.log('[sync] Sync trigger received from broadcast channel');
      syncNow();
    }
  };
}

export function triggerSyncBroadcast(): void {
  if (syncChannel) {
    syncChannel.postMessage('trigger-sync');
  }
  syncNow();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => {
    isOnline = true;
    consecutiveErrors = 0;
    scheduleSync(1000); // try immediately when we come back online
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    emit('offline', pendingCount);
  });
  window.addEventListener('focus', () => {
    syncNow();
  });
}

// ── Main sync function ────────────────────────────────────────────────────
export async function syncNow(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return; // not logged in — never sync

  if (!isOnline) {
    emit('offline', await getPendingCount());
    return;
  }

  if (currentState === 'syncing') return; // already in progress

  // FIX: Removed the encrypted-record detection + alert() block.
  // alert() is synchronous and blocks the main thread; bad for a background
  // task. If you need to surface conflicts use a toast/notification instead.
  // The clear-cache logic was also dangerous because it silently wiped local
  // data that may not yet have been pushed. Removed entirely.

  const pending = await getPendingCount();
  emit('syncing', pending);

  try {
    if (pending > 0) {
      await pushToServer();
      if (syncChannel) {
        syncChannel.postMessage('trigger-sync');
      }
    }
    await pullFromServer();

    const remaining = await getPendingCount();
    emit('idle', remaining);
    consecutiveErrors = 0;
  } catch (err: any) {
    consecutiveErrors++;
    const pending = await getPendingCount();

    // FIX: Distinguish network errors (server unreachable) from app errors
    if (!err?.response && err?.message === 'Network Error') {
      console.warn('[sync] Network unreachable during sync — will retry');
      emit('offline', pending);
    } else {
      console.error('[sync] Sync error:', err?.response?.data || err?.message);
      emit('error', pending);
    }

    // Exponential backoff: 30s → 60s → 120s … up to MAX_BACKOFF_MS
    const backoff = Math.min(30_000 * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS);
    scheduleSync(backoff);
  }
}

// ── Push pending records → server ─────────────────────────────────────────
async function pushToServer(): Promise<void> {
  const queue = await db.syncQueue.toArray();
  if (!queue.length) return;

  const clientId = getClientId();

  // FIX: Catch push errors separately so a bad push doesn't abort the pull.
  let results: any[] = [];
  try {
    const res = await apiClient.post('/sync/push', { records: queue, clientId });
    results = res.data.results ?? [];
  } catch (err: any) {
    console.error('[sync] Push failed:', err?.response?.data || err?.message);
    throw err; // re-throw so syncNow can handle it
  }

  const idsToDelete: number[] = [];

  results.forEach((result: any, idx: number) => {
    const qItem = queue[idx];
    if (!qItem || qItem.id === undefined) return;

    idsToDelete.push(qItem.id as number);

    if (result.status === 'inserted' || result.status === 'updated') {
      // Pass the authoritative server timestamp so the local record is stamped
      // with the exact value the server stored — eliminating clock-skew drift.
      markSynced(qItem.table, result.id, result.serverUpdatedAt ?? null).catch(err =>
        console.error(`[sync] Error marking ${qItem.table} ${result.id} as synced:`, err)
      );
    } else if (result.status === 'conflict_skipped') {
      // FIX: Was using alert() — replaced with a custom DOM event so the UI
      // layer can show a toast/notification without blocking the thread.
      console.warn(`[sync] Conflict: ${qItem.table} record ${result.id} overwritten by server version`);
      window.dispatchEvent(new CustomEvent('emr:sync-conflict', {
        detail: { table: qItem.table, id: result.id }
      }));
    } else if (result.status === 'rejected' || result.status === 'error') {
      console.warn(`[sync] Rejected ${qItem.table} ${result.id}: ${result.reason}`);
    }
  });

  if (idsToDelete.length) {
    await db.syncQueue.bulkDelete(idsToDelete);
  }
}

async function markSynced(tableName: string, id: string, serverUpdatedAt?: string | null): Promise<void> {
  const tableMap: Record<string, any> = {
    patients:      db.patients,
    encounters:    db.encounters,
    vitals:        db.vitals,
    prescriptions: db.prescriptions,
    appointments:  db.appointments,
    billing:       db.billing,
    medicines:     db.medicines,
  };
  const table = tableMap[tableName];
  if (!table) return;

  // FIX Bug 2: Stamp the record's updated_at to match what the server stored.
  // Without this, the local record keeps its old timestamp. On the next pull
  // the server returns the record with a newer updated_at (set by `now()` in the
  // UPDATE statement), and pullFromServer overwrites the local copy — silently
  // reverting the user's edit.
  const ts = serverUpdatedAt || new Date().toISOString();
  await table.update(id, { _syncStatus: 'synced', updated_at: ts, _updatedAt: ts });
}


async function pullFromServer(): Promise<void> {
  const lastSync = await getLastSync();

  let data: any;
  let pulledAt: string;

  try {
    const res = await apiClient.get('/sync/pull', { params: { since: lastSync } });
    data      = res.data.data;
    pulledAt  = res.data.pulledAt;
  } catch (err: any) {
    console.error('[sync] Pull failed:', err?.response?.data || err?.message);
    throw err;
  }

  // FIX Bug 3: Collect all locally-pending record IDs before we write. We must
  // NOT overwrite pending records with the server version — those have unsaved
  // local edits that haven't been pushed yet. Overwriting them would silently
  // discard the user's work.
  const pendingIds: Record<string, Set<string>> = {};
  const tableDbMap: Record<string, any> = {
    patients:      db.patients,
    encounters:    db.encounters,
    vitals:        db.vitals,
    prescriptions: db.prescriptions,
    appointments:  db.appointments,
    billing:       db.billing,
    medicines:     db.medicines,
  };
  for (const tbl of Object.keys(tableDbMap)) {
    const pending = await tableDbMap[tbl]
      .where('_syncStatus').equals('pending')
      .primaryKeys();
    pendingIds[tbl] = new Set(pending.map(String));
  }

  // Helper: filter server rows so we never overwrite locally-pending records
  const safe = (tbl: string, rows: any[]) =>
    rows.filter((r: any) => !pendingIds[tbl]?.has(String(r.id)));

  await db.transaction('rw', [
    db.patients, db.encounters, db.vitals,
    db.prescriptions, db.appointments, db.billing, db.medicines,
  ], async () => {
    if (data.patients?.length)
      await db.patients.bulkPut(safe('patients', data.patients).map((r: any) => ({
        ...r, _syncStatus: 'synced',
        allergies:            safeParse(r.allergies),
        chronic_conditions:   safeParse(r.chronic_conditions),
        current_medications:  safeParse(r.current_medications),
      })));

    if (data.encounters?.length)
      await db.encounters.bulkPut(safe('encounters', data.encounters).map((r: any) => ({
        ...r, _syncStatus: 'synced',
        diagnosis: safeParse(r.diagnosis),
      })));

    if (data.vitals?.length)
      await db.vitals.bulkPut(safe('vitals', data.vitals).map((r: any) => ({ ...r, _syncStatus: 'synced' })));

    if (data.prescriptions?.length)
      await db.prescriptions.bulkPut(safe('prescriptions', data.prescriptions).map((r: any) => ({
        ...r, _syncStatus: 'synced',
        medicines: safeParse(r.medicines),
      })));

    if (data.appointments?.length)
      await db.appointments.bulkPut(safe('appointments', data.appointments).map((r: any) => ({ ...r, _syncStatus: 'synced' })));

    if (data.billing?.length)
      await db.billing.bulkPut(safe('billing', data.billing).map((r: any) => ({
        ...r, _syncStatus: 'synced',
        items: safeParse(r.items),
      })));

    if (data.medicines?.length)
      await db.medicines.bulkPut(safe('medicines', data.medicines).map((r: any) => ({
        ...r, _syncStatus: 'synced',
        generics:  safeParse(r.generics),
        strengths: safeParse(r.strengths),
      })));
  });

  await setLastSync(pulledAt);

  const hasChanges = !!(
    data.patients?.length ||
    data.encounters?.length ||
    data.vitals?.length ||
    data.prescriptions?.length ||
    data.appointments?.length ||
    data.billing?.length ||
    data.medicines?.length
  );

  if (hasChanges && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('emr:sync-complete'));
  }
}

function safeParse(val: any): any {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

// ── Periodic sync scheduler ────────────────────────────────────────────────
export function scheduleSync(delayMs = 3_000): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await syncNow();
    scheduleSync(3_000); // reset to normal interval after each run
  }, delayMs);
}

// ── Client device ID ──────────────────────────────────────────────────────
function getClientId(): string {
  const key = 'emr_client_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Init ──────────────────────────────────────────────────────────────────
export async function initSync(): Promise<void> {
  const pending = await getPendingCount();
  emit(isOnline ? 'idle' : 'offline', pending);

  if (isOnline) {
    await syncNow();
    scheduleSync(3_000);
  }
}