// client/src/pages/BillingPage.tsx
import React from 'react';
import { useAuthStore } from '../store/authStore';
import FinanceBillingView from './billing/FinanceBillingView';
import PharmacyBillingView from './billing/PharmacyBillingView';

export default function BillingPage({ onNavigate, data }: { onNavigate: (p: string, d?: any) => void; data?: any }) {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase() || '';

  if (role.includes('pharm')) {
    return <PharmacyBillingView onNavigate={onNavigate} />;
  }

  return <FinanceBillingView onNavigate={onNavigate} data={data} />;
}
