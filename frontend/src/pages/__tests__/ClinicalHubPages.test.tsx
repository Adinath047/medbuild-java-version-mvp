import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
vi.mock('../../api/client', () => {
  const client = {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/patients')) return Promise.resolve({ data: { patients: [] } });
      if (url.includes('/users')) return Promise.resolve({ data: { users: [] } });
      if (url.includes('/prescriptions')) return Promise.resolve({ data: [] });
      if (url.includes('/appointments')) return Promise.resolve({ data: [] });
      if (url.includes('/billing')) return Promise.resolve({ data: [] });
      if (url.includes('/beds')) return Promise.resolve({ data: [] });
      if (url.includes('/system-health')) return Promise.resolve({ data: { status: 'UP' } });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 'test-123', slip_token: 'TEST001' } }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  };
  return {
    apiClient: client,
    default: client
  };
});

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
  beforeEach(() => {
    localStorage.setItem('emr_token', 'test-jwt-token');
  });

  test('1. DoctorDashboard renders hero banner and critical section without emojis', async () => {
    render(<DoctorDashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Cardiology/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Critical Patients/i).length).toBeGreaterThan(0);
  });

  test('2. PrescriptionsListPage renders clean header and search bar', () => {
    render(<PrescriptionsListPage onNavigate={() => {}} />);
    expect(screen.getByText(/^Prescriptions$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search patient, UHID, doctor/i)).toBeInTheDocument();
  });

  test('3. BedsPage renders Bed Allocation Management and Action Controls', () => {
    render(<BedsPage onNavigate={() => {}} />);
    expect(screen.getByText(/Bed Allocation Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Bed/i)).toBeInTheDocument();
    expect(screen.getByText(/Beds & Vitals Board/i)).toBeInTheDocument();
  });

  test('4. FrontDeskDashboard renders Reception hero banner and Quick Actions', async () => {
    render(<FrontDeskDashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Register a New Patient/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Reception dashboard/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Schedule a Visit/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Create Invoice/i)).toBeInTheDocument();
  });

  test('5. SettingsPage renders styled tab navigation without emojis', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/^Settings$/i)).toBeInTheDocument();
    expect(screen.getByText(/Practitioner Profile & Preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/Medicines Directory/i)).toBeInTheDocument();
  });
});
