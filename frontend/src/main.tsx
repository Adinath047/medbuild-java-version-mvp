import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initSync } from './sync/syncManager';
import { useAuthStore } from './store/authStore';

// Global dynamic import & module script failure auto-recovery
window.addEventListener('error', (event) => {
  const src = (event.target as any)?.src || '';
  if (src.includes('/_vercel/')) return; // Ignore Vercel analytics missing on local server

  const isScript = event.target && ((event.target as any).tagName === 'SCRIPT' || (event.target as any).src);
  const isMimeError = event.message && (
    event.message.includes('Mime type') ||
    event.message.includes('MIME type') ||
    event.message.includes('dynamically imported module') ||
    event.message.includes('Failed to fetch')
  );
  
  if ((isScript || isMimeError) && !src.includes('/_vercel/')) {
    console.error('[AutoRecover] Resource loading failed. Performing auto-update reload...');
    const lastReload = sessionStorage.getItem('medbuild-last-recover-reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem('medbuild-last-recover-reload', String(now));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
}, true);

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const isVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

// Restore JWT session before rendering
useAuthStore.getState().restoreSession();

// Start sync engine
initSync().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {isVercel && <Analytics />}
    {isVercel && <SpeedInsights />}
  </React.StrictMode>
);
