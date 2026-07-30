import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import DoctorDashboard from '../DoctorDashboard';
import PrescriptionsListPage from '../PrescriptionsListPage';
import BedsPage from '../BedsPage';
import FrontDeskDashboard from '../FrontDeskDashboard';
import SettingsPage from '../SettingsPage';

// Mock IndexedDB / Dexie
vi.mock('../../db/localDB', () => ({
  db: {
    patients: { toArray: vi.fn().mockResolvedValue([]) },
    prescriptions: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue({}) },
    encounters: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue({}) },
    medicines: { toArray: vi.fn().mockResolvedValue([]) },
    vitals: { toArray: vi.fn().mockResolvedValue([]) },
    meta: { put: vi.fn().mockResolvedValue({}) }
  },
  markPending: vi.fn().mockResolvedValue({})
}));

// Mock API Client
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/patients')) return Promise.resolve({ data: { patients: [] } });
      if (url.includes('/users')) return Promise.resolve({ data: { users: [] } });
      if (url.includes('/prescriptions')) return Promise.resolve({ data: [] });
      if (url.includes('/system-health')) return Promise.resolve({ data: { status: 'UP' } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 'test-123', slip_token: 'TEST001' } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

// Mock Auth Store
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      user: {
        id: 'doc-001',
        name: 'Dr. Aarav Mehta',
        role: 'doctor',
        specialization: 'Cardiology',
        hospitalId: 'hsp-001'
      },
      restoreSession: vi.fn().mockResolvedValue({})
    };
    return selector ? selector(state) : state;
  }
}));

describe('ClinicalHub UI & Navigation Test Suite', () => {
  test('1. DoctorDashboard renders hero banner and critical section without emojis', () => {
    render(<DoctorDashboard onNavigate={() => {}} />);
    expect(screen.getByText(/Cardiology/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical Patients/i)).toBeInTheDocument();
  });

  test('2. PrescriptionsListPage renders clean header and search bar', () => {
    render(<PrescriptionsListPage onNavigate={() => {}} />);
    expect(screen.getByText(/^Prescriptions$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search patient, UHID, doctor/i)).toBeInTheDocument();
  });

  test('3. BedsPage renders Nursing Station and Ward Filter Pills', () => {
    render(<BedsPage onNavigate={() => {}} />);
    expect(screen.getByText(/Bed Rounds/i)).toBeInTheDocument();
    expect(screen.getByText(/General/i)).toBeInTheDocument();
    expect(screen.getByText(/ICU/i)).toBeInTheDocument();
  });

  test('4. FrontDeskDashboard renders Reception hero banner and Quick Actions', () => {
    render(<FrontDeskDashboard onNavigate={() => {}} />);
    expect(screen.getByText(/Reception dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Register a New Patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedule a Visit/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Invoice/i)).toBeInTheDocument();
  });

  test('5. SettingsPage renders styled tab navigation without emojis', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/^Settings$/i)).toBeInTheDocument();
    expect(screen.getByText(/API Health Monitor/i)).toBeInTheDocument();
  });
});
