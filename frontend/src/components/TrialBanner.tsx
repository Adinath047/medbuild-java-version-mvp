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

  // Determine styling based on remaining days
  let bannerBg = 'bg-emerald-600';
  let badgeBg = 'bg-emerald-800 text-emerald-100';
  let buttonStyle = 'bg-white text-emerald-800 hover:bg-emerald-50';

  if (isExpired) {
    bannerBg = 'bg-rose-700';
    badgeBg = 'bg-rose-900 text-rose-100';
    buttonStyle = 'bg-white text-rose-800 hover:bg-rose-50';
  } else if (daysRemaining <= 1) {
    bannerBg = 'bg-amber-600';
    badgeBg = 'bg-amber-800 text-amber-100';
    buttonStyle = 'bg-white text-amber-900 hover:bg-amber-50';
  } else if (daysRemaining <= 3) {
    bannerBg = 'bg-orange-600';
    badgeBg = 'bg-orange-800 text-orange-100';
    buttonStyle = 'bg-white text-orange-900 hover:bg-orange-50';
  }

  if (isDismissed && !isExpired && daysRemaining > 1) {
    return null;
  }

  return (
    <>
      <div className={`${bannerBg} text-white px-4 py-2 text-xs md:text-sm font-medium shadow-sm flex items-center justify-between transition-colors z-40 relative`}>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badgeBg}`}>
            {isExpired ? 'Trial Expired' : '7-Day Trial'}
          </span>
          <span>
            {isExpired ? (
              <span>Your hospital trial has ended. Read-only mode active.</span>
            ) : daysRemaining > 0 ? (
              <span>You have <strong>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong> ({hoursRemaining}h) remaining in your trial.</span>
            ) : (
              <span>Your trial expires today (<strong>{hoursRemaining} hours</strong> remaining).</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${buttonStyle}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Us to Upgrade
          </button>

          {!isExpired && daysRemaining > 1 && (
            <button
              onClick={() => setIsDismissed(true)}
              className="text-white/80 hover:text-white p-1 rounded hover:bg-black/10 transition-colors"
              title="Dismiss banner"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <TrialContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
