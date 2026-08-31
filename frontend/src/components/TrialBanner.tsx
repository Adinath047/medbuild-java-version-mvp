import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import TrialContactModal from './TrialContactModal';

interface LicenseStatus {
  tenantId: string;
  planType: string;
  licenseState: 'TRIAL_ACTIVE' | 'TRIAL_ENDING_SOON' | 'GRACE_PERIOD' | 'LOCKED' | 'ARCHIVED' | 'PAID';
  daysRemaining: number;
  trialEndsAt: string;
  graceEndsAt?: string;
  dataExportDeadline?: string;
  isReadOnly: boolean;
  isArchived: boolean;
  isGracePeriod: boolean;
}

export default function TrialBanner() {
  const { user } = useAuthStore();
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient.get('/licensing/status');
      if (res.data) {
        setLicense(res.data);
      }
    } catch {
      // Fallback gracefully
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60_000); // refresh every 5 mins
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/licensing/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medbuilds-clinical-archive-${license?.tenantId || 'hospital'}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export data', e);
    } finally {
      setExporting(false);
    }
  };

  if (!user || !license || license.licenseState === 'PAID') {
    return null;
  }

  const { licenseState, daysRemaining } = license;

  if (isDismissed && licenseState === 'TRIAL_ACTIVE' && daysRemaining > 3) {
    return null;
  }

  let bgColor = '#059669';
  let badgeBg = 'rgba(0, 0, 0, 0.20)';
  let btnColor = '#065f46';
  let title = '30-Day Trial';
  let message = `You have ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining in your trial.`;

  if (licenseState === 'ARCHIVED') {
    bgColor = '#475569';
    badgeBg = 'rgba(0, 0, 0, 0.35)';
    btnColor = '#334155';
    title = 'Account Archived';
    message = 'Hospital account has reached data retention limits. Clinical data is preserved in cold storage.';
  } else if (licenseState === 'LOCKED') {
    bgColor = '#be123c';
    badgeBg = 'rgba(0, 0, 0, 0.25)';
    btnColor = '#9f1239';
    title = 'Read-Only Mode';
    message = `Trial expired. Patient records are viewable to preserve clinical care. New entries require an active subscription. Export window active (${daysRemaining} days remaining).`;
  } else if (licenseState === 'GRACE_PERIOD') {
    bgColor = '#d97706';
    badgeBg = 'rgba(0, 0, 0, 0.22)';
    btnColor = '#92400e';
    title = 'Grace Period';
    message = `Trial ended. You have ${daysRemaining} days of clinical grace. Patient care continues, but user management is locked.`;
  } else if (licenseState === 'TRIAL_ENDING_SOON') {
    bgColor = '#ea580c';
    badgeBg = 'rgba(0, 0, 0, 0.22)';
    btnColor = '#9a3412';
    title = 'Ending Soon';
    message = `Trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Upgrade now to retain seamless administrative access.`;
  }

  return (
    <>
      <div
        style={{
          backgroundColor: bgColor,
          color: '#ffffff',
          padding: '8px 16px',
          fontSize: 12.5,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              backgroundColor: badgeBg,
              padding: '3px 8px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase'
            }}
          >
            {title}
          </span>
          <span>{message}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(licenseState === 'LOCKED' || licenseState === 'GRACE_PERIOD') && (
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export Clinic Data'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              backgroundColor: '#ffffff',
              color: btnColor,
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Upgrade Plan
          </button>

          {licenseState === 'TRIAL_ACTIVE' && daysRemaining > 3 && (
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Dismiss trial banner"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isModalOpen && (
        <TrialContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
