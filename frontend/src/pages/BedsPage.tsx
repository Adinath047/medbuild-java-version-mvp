// client/src/pages/BedsPage.tsx
import React from 'react';
import { useAuthStore } from '../store/authStore';
import AdminDoctorBedsView from './beds/AdminDoctorBedsView';
import ReceptionistBedsView from './beds/ReceptionistBedsView';

export default function BedsPage({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase() || '';

  if (role.includes('reception')) {
    return <ReceptionistBedsView onNavigate={onNavigate} />;
  }

  return <AdminDoctorBedsView onNavigate={onNavigate} />;
}
