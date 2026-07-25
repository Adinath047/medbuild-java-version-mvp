// client/src/sync/useSync.ts
import { useState, useEffect } from 'react';
import { onSyncStateChange, syncNow, type SyncState } from './syncManager';

export function useSync() {
  const [state, setState]     = useState<SyncState>('idle');
  const [pending, setPending] = useState(0);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    const unsub = onSyncStateChange((s, p) => { setState(s); setPending(p); });

    const handleSyncComplete = () => {
      setSyncCount(c => c + 1);
    };
    window.addEventListener('emr:sync-complete', handleSyncComplete);

    return () => {
      unsub();
      window.removeEventListener('emr:sync-complete', handleSyncComplete);
    };
  }, []);

  return { syncState: state, pendingCount: pending, syncNow, syncCount };
}
