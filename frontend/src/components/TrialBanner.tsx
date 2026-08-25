import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import TrialContactModal from './TrialContactModal';

export default function TrialBanner() {
  const { trialStatus, subscriptionPlan, daysRemaining, hoursRemaining, user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If activated or not in trial, don't display trial ribbon
  if (!user || subscriptionPlan === 'STANDARD' || subscriptionPlan === 'PREMIUM' || trialStatus === 'ACTIVATED') {
    return null;
  }

  const isExpired = trialStatus === 'EXPIRED';

  if (isDismissed && !isExpired && daysRemaining > 1) {
    return null;
  }

  let bgColor = '#059669'; // emerald-600
  let badgeBg = 'rgba(0, 0, 0, 0.2)';
  let btnColor = '#065f46';

  if (isExpired) {
    bgColor = '#be123c'; // rose-700
    badgeBg = 'rgba(0, 0, 0, 0.25)';
    btnColor = '#9f1239';
  } else if (daysRemaining <= 1) {
    bgColor = '#d97706'; // amber-600
    btnColor = '#92400e';
  } else if (daysRemaining <= 3) {
    bgColor = '#ea580c'; // orange-600
    btnColor = '#9a3412';
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
            {isExpired ? 'Trial Expired' : '7-Day Trial'}
          </span>
          <span>
            {isExpired ? (
              <span>Your hospital trial period has ended. Read-only mode active.</span>
            ) : daysRemaining > 0 ? (
              <span>You have <strong>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong> ({hoursRemaining}h) remaining in your trial.</span>
            ) : (
              <span>Your trial expires today (<strong>{hoursRemaining} hours</strong> remaining).</span>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            Contact Us to Upgrade
          </button>

          {!isExpired && daysRemaining > 1 && (
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
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <TrialContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
