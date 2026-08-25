import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface TourStep {
  title: string;
  description: string;
  target?: string;
  icon: (props?: React.SVGProps<SVGSVGElement>) => JSX.Element;
}

const DOCTOR_STEPS: TourStep[] = [
  {
    title: 'OPD Queue & Consultation List',
    description: 'View assigned patients waiting in your daily outpatient queue with real-time status updates.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    title: 'Clinical Encounter & Diagnosis',
    description: 'Document chief complaints, clinical examination, ICD-10 diagnosis codes, and vitals history seamlessly.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    title: 'Fast Rx & Letterhead Print',
    description: 'Compose prescriptions with autocomplete dosage instructions and generate professional PDF printouts with one click.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    )
  }
];

const RECEPTION_STEPS: TourStep[] = [
  {
    title: 'Patient Directory & Registration',
    description: 'Quickly register new patients, search existing records by phone or ID, and update demographic info.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    )
  },
  {
    title: 'Appointment Booking & Tokens',
    description: 'Book appointments, assign doctor consultation slots, and generate digital queue tokens.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'Queue & Front Desk Tracking',
    description: 'Monitor live patient arrivals, OPD waiting rooms, and doctor availability across departments.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )
  }
];

const BILLING_STEPS: TourStep[] = [
  {
    title: 'Invoicing & OPD Billing',
    description: 'Generate itemized hospital bills, apply discounts, and record payments across Cash, UPI, and Card.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'Pharmacy & Stock Management',
    description: 'Search medicine formulary, monitor low stock alerts, and log batch expiry details.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  }
];

const ADMIN_STEPS: TourStep[] = [
  {
    title: 'Hospital Staff Onboarding',
    description: 'Create and manage credentials for Doctors, Nurses, Receptionists, and Pharmacists with role-based access.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    title: 'Letterhead & Print Margins',
    description: 'Upload custom clinic logos, configure top/bottom print margins, and customize prescription headers.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'Audit Logs & Security',
    description: 'Track HIPAA-compliant audit logs, active sessions, and multi-tenant security metrics.',
    icon: () => (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  }
];

export default function OnboardingTour() {
  const { user, tourCompleted, completeTour } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);

  if (!user || tourCompleted) {
    return null;
  }

  const role = (user.role || 'doctor').toLowerCase();
  let steps = DOCTOR_STEPS;
  if (role === 'receptionist') steps = RECEPTION_STEPS;
  else if (role === 'pharmacist') steps = BILLING_STEPS;
  else if (role === 'admin') steps = ADMIN_STEPS;

  const step = steps[currentStep] || steps[0];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) completeTour();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: 440,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid var(--border, #e2e8f0)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            backgroundColor: '#0f172a',
            padding: '14px 18px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#34d399',
                display: 'inline-block'
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#cbd5e1' }}>
              Welcome Tour ({role.replace('_', ' ')})
            </span>
          </div>
          <button
            type="button"
            onClick={() => completeTour()}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4
            }}
          >
            Skip Tour
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              backgroundColor: 'rgba(5, 150, 105, 0.12)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <Icon />
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: 17, fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
            {step.title}
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13.5, color: 'var(--text-sec, #64748b)', lineHeight: 1.5 }}>
            {step.description}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 14,
              borderTop: '1px solid var(--border, #f1f5f9)'
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  style={{
                    height: 6,
                    borderRadius: 4,
                    transition: 'all 0.3s ease',
                    width: idx === currentStep ? 22 : 6,
                    backgroundColor: idx === currentStep ? '#059669' : '#e2e8f0'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#64748b',
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  Previous
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '7px 16px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                }}
              >
                {currentStep === steps.length - 1 ? 'Finish Tour' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
