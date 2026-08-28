import React from 'react';
import { useAuthStore } from '../store/authStore';
import ReceptionDashboard from './dashboards/ReceptionDashboard';
import BillingDashboard from './dashboards/BillingDashboard';
import LabTechnicianDashboard from './dashboards/LabTechnicianDashboard';
import NurseDashboard from './dashboards/NurseDashboard';
import PharmacyBillingView from './billing/PharmacyBillingView';

interface FrontDeskDashboardProps {
  onNavigate: (page: string, data?: any) => void;
}

/**
 * Clean Role-Based Dashboard Router
 * Renders the appropriate role-specific dashboard based on user.role
 */
export default function FrontDeskDashboard({ onNavigate }: FrontDeskDashboardProps) {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase() || '';

  if (role === 'lab_technician' || role === 'pathologist' || role === 'lab') {
    return <LabTechnicianDashboard onNavigate={onNavigate} />;
  }

  if (role === 'billing' || role === 'finance') {
    return <BillingDashboard onNavigate={onNavigate} />;
  }

  if (role === 'nurse') {
    return <NurseDashboard onNavigate={onNavigate} />;
  }

  if (role.includes('pharm')) {
    return <PharmacyBillingView onNavigate={onNavigate} />;
  }

  // Default Front Desk / Receptionist Dashboard
  return <ReceptionDashboard onNavigate={onNavigate} />;
}
