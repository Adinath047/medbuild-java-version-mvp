// client/src/pages/PatientsPage.tsx
import React from 'react';
import { useAuthStore } from '../store/authStore';
import LabReferredPatientsView from './patients/LabReferredPatientsView';
import GeneralPatientsView from './patients/GeneralPatientsView';

export default function PatientsPage({ onNavigate, data, autoOpen }: { onNavigate?: (p: string, d?: any) => void; data?: any; autoOpen?: boolean }) {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase() || '';

  if (role.includes('lab') || role.includes('pathologist')) {
    return <LabReferredPatientsView onNavigate={onNavigate} />;
  }

  return <GeneralPatientsView onNavigate={onNavigate} />;
}
