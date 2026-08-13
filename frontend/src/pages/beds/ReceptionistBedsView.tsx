// client/src/pages/beds/ReceptionistBedsView.tsx
import React from 'react';
import AdminDoctorBedsView from './AdminDoctorBedsView';

export default function ReceptionistBedsView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  return <AdminDoctorBedsView onNavigate={onNavigate} />;
}
