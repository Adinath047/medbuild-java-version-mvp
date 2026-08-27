import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

// ── Tour step definitions ──────────────────────────────────────────────────
// targetSelector: CSS selector for the element to highlight.
// placement: where to put the card relative to the highlighted element.
interface TourStep {
  title: string;
  description: string;
  targetSelector?: string; // optional — if absent, card floats centered
}

// ── Role step sets ─────────────────────────────────────────────────────────

const DOCTOR_STEPS: TourStep[] = [
  {
    title: 'Your Daily Dashboard',
    description: 'Start each day here. View your OPD queue, today\'s consultations, and real-time patient status all in one place.',
    targetSelector: '[data-tour-page="dashboard"]',
  },
  {
    title: 'Patient Records',
    description: 'Access the complete patient directory. Register new patients, search by phone or ID, and open their full medical history.',
    targetSelector: '[data-tour-page="patients"]',
  },
  {
    title: 'Beds & Vitals',
    description: 'Monitor bed occupancy across wards, track admitted patients, and record or view vitals for IPD cases.',
    targetSelector: '[data-tour-page="beds"]',
  },
  {
    title: 'Appointments',
    description: 'View and manage your scheduled appointments. Book new slots and track patient arrival status in real time.',
    targetSelector: '[data-tour-page="appointments"]',
  },
  {
    title: 'Prescriptions',
    description: 'Compose digital prescriptions with autocomplete dosage. Generate professional PDF printouts with your letterhead in one click.',
    targetSelector: '[data-tour-page="prescriptions"]',
  },
  {
    title: 'Billing & Invoices',
    description: 'Generate itemised hospital bills, apply discounts, and record payments across Cash, UPI, and Card.',
    targetSelector: '[data-tour-page="billing"]',
  },
  {
    title: 'Profile & Settings',
    description: 'Update consultation fees, letterhead margins, print preferences, and personal profile details anytime.',
    targetSelector: '[data-tour-page="settings"]',
  },
];

const RECEPTION_STEPS: TourStep[] = [
  {
    title: 'Front Desk Dashboard',
    description: 'Monitor live patient arrivals, OPD waiting rooms, and doctor availability across all departments.',
    targetSelector: '[data-tour-page="dashboard"]',
  },
  {
    title: 'Patient Registration',
    description: 'Quickly register walk-in patients, search by phone or ID, and update demographic information instantly.',
    targetSelector: '[data-tour-page="patients"]',
  },
  {
    title: 'Beds & Vitals',
    description: 'Track bed occupancy in real time. Assign or discharge patients from wards and monitor nursing workflow.',
    targetSelector: '[data-tour-page="beds"]',
  },
  {
    title: 'Appointment Booking',
    description: 'Book appointments for any doctor, assign consultation slots, and generate digital queue tokens for patients.',
    targetSelector: '[data-tour-page="appointments"]',
  },
  {
    title: 'Billing & Payments',
    description: 'Raise invoices, collect payments, and issue receipts. All billing entries link instantly to the patient\'s record.',
    targetSelector: '[data-tour-page="billing"]',
  },
  {
    title: 'Profile & Settings',
    description: 'Manage your account details and notification preferences here.',
    targetSelector: '[data-tour-page="settings"]',
  },
];

const PHARMACIST_STEPS: TourStep[] = [
  {
    title: 'Pharmacy Dashboard',
    description: 'Get a quick overview of dispensing activity, pending prescriptions, and low-stock alerts for the day.',
    targetSelector: '[data-tour-page="dashboard"]',
  },
  {
    title: 'Prescription Queue',
    description: 'View all doctor-issued prescriptions. Verify, dispense, and mark them as fulfilled — with a full audit trail.',
    targetSelector: '[data-tour-page="prescriptions"]',
  },
  {
    title: 'Pharmacy Sales & Billing',
    description: 'Record OTC sales, manage the medicine formulary, and track batch expiry details to avoid dispensing errors.',
    targetSelector: '[data-tour-page="billing"]',
  },
  {
    title: 'Profile & Settings',
    description: 'Update your staff details and pharmacy preferences here.',
    targetSelector: '[data-tour-page="settings"]',
  },
];

const NURSE_STEPS: TourStep[] = [
  {
    title: 'Nursing Dashboard',
    description: 'View assigned patients and pending nursing tasks for your shift — all in one streamlined view.',
    targetSelector: '[data-tour-page="dashboard"]',
  },
  {
    title: 'Patients',
    description: 'Access patient records to update clinical notes, review doctor orders, and coordinate care across the ward.',
    targetSelector: '[data-tour-page="patients"]',
  },
  {
    title: 'Beds & Vitals',
    description: 'Monitor bed assignments, record vitals readings, and flag any out-of-range values for immediate doctor attention.',
    targetSelector: '[data-tour-page="beds"]',
  },
  {
    title: 'Billing',
    description: 'Assist in billing entry for nursing procedures and IPD charges directly linked to the patient\'s account.',
    targetSelector: '[data-tour-page="billing"]',
  },
  {
    title: 'Profile',
    description: 'View and update your nursing profile and notification preferences.',
    targetSelector: '[data-tour-page="settings"]',
  },
];

const LAB_STEPS: TourStep[] = [
  {
    title: 'Lab Dashboard',
    description: 'See an at-a-glance view of pending lab requests and recent results for the day.',
    targetSelector: '[data-tour-page="dashboard"]',
  },
  {
    title: 'Referred Patients',
    description: 'Access all patients referred for lab investigation. Record results and update the doctor in real time.',
    targetSelector: '[data-tour-page="patients"]',
  },
  {
    title: 'Profile',
    description: 'Manage your technician profile and preferences here.',
    targetSelector: '[data-tour-page="settings"]',
  },
];

const ADMIN_STEPS: TourStep[] = [
  {
    title: 'Welcome to Your Admin Console',
    description: 'This is your hospital\'s control centre. You manage staff accounts, hospital settings, audit logs, and DPDP compliance from here.',
    // No selector — center the card for the intro
  },
  {
    title: 'Staff Directory & Access',
    description: 'Create and manage credentials for Doctors, Nurses, Receptionists, and Pharmacists. Assign roles and reset passwords from the Staff Directory tab.',
    targetSelector: '[data-tour-tab="staff"]',
  },
  {
    title: 'Patient Erasure (DPDP)',
    description: 'Comply with India\'s Digital Personal Data Protection Act. Permanently erase a patient\'s data on verified request from the Erasure tab.',
    targetSelector: '[data-tour-tab="erasure"]',
  },
  {
    title: 'Hospital Profile',
    description: 'Configure your hospital\'s name, contact details, letterhead logo, and subscription plan under the Hospital Profile tab.',
    targetSelector: '[data-tour-tab="config"]',
  },
  {
    title: 'Audit & Security Logs',
    description: 'Track every action taken on the platform — who logged in, what they changed, and when. HIPAA-compliant and tamper-evident.',
    targetSelector: '[data-tour-tab="audit"]',
  },
];

// ── Card positioning ───────────────────────────────────────────────────────
function getCardStyle(anchorRect: DOMRect | null): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    width: 316,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1)',
  };

  if (!anchorRect) {
    // Center of screen
    return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = 316;
  const cardH = 200; // approximate
  const gap = 14;

  // Try right of element
  if (anchorRect.right + gap + cardW < vw) {
    return {
      ...base,
      top: Math.min(Math.max(12, anchorRect.top + anchorRect.height / 2 - cardH / 2), vh - cardH - 12),
      left: anchorRect.right + gap,
    };
  }

  // Try left of element
  if (anchorRect.left - gap - cardW > 0) {
    return {
      ...base,
      top: Math.min(Math.max(12, anchorRect.top + anchorRect.height / 2 - cardH / 2), vh - cardH - 12),
      left: anchorRect.left - gap - cardW,
    };
  }

  // Try below element
  if (anchorRect.bottom + gap + cardH < vh) {
    return {
      ...base,
      top: anchorRect.bottom + gap,
      left: Math.min(Math.max(12, anchorRect.left), vw - cardW - 12),
    };
  }

  // Fallback: above element
  return {
    ...base,
    top: Math.max(12, anchorRect.top - gap - cardH),
    left: Math.min(Math.max(12, anchorRect.left), vw - cardW - 12),
  };
}

// ── Main Tour Component ────────────────────────────────────────────────────
export default function OnboardingTour() {
  const { user, tourCompleted, completeTour } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const role = (user?.role || 'doctor').toLowerCase();

  let steps: TourStep[];
  if (role === 'admin')                          steps = ADMIN_STEPS;
  else if (role === 'receptionist')              steps = RECEPTION_STEPS;
  else if (role.includes('pharm'))               steps = PHARMACIST_STEPS;
  else if (role.includes('nurse'))               steps = NURSE_STEPS;
  else if (role.includes('lab') || role.includes('path')) steps = LAB_STEPS;
  else                                           steps = DOCTOR_STEPS;

  const step = steps[currentStep] ?? steps[0];

  // Measure target element, retry up to 10 times with 100ms interval (handles delayed renders)
  const measureTarget = useCallback(() => {
    const sel = step.targetSelector;
    if (!sel) { setAnchorRect(null); return; }

    let attempts = 0;
    const tryFind = () => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        setAnchorRect(el.getBoundingClientRect());
        return;
      }
      attempts++;
      if (attempts < 10) {
        rafRef.current = window.setTimeout(tryFind, 100) as unknown as number;
      } else {
        setAnchorRect(null); // give up — center the card
      }
    };
    tryFind();
  }, [step.targetSelector]);

  useEffect(() => {
    if (rafRef.current) clearTimeout(rafRef.current);
    measureTarget();
    window.addEventListener('resize', measureTarget);
    return () => {
      window.removeEventListener('resize', measureTarget);
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [measureTarget, currentStep]);

  if (!user || tourCompleted) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
    else completeTour();
  };
  const handlePrev = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const cardStyle = getCardStyle(anchorRect);

  return (
    <>
      {/* Gold highlight ring around targeted element */}
      {anchorRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: anchorRect.top - 3,
            left: anchorRect.left - 3,
            width: anchorRect.width + 6,
            height: anchorRect.height + 6,
            borderRadius: 12,
            border: '2.5px solid #f59e0b',
            boxShadow: '0 0 0 4px rgba(245,158,11,0.16), 0 0 20px rgba(245,158,11,0.28)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      )}

      {/* Floating card */}
      <div role="dialog" aria-modal="false" aria-label="Application Tour" style={cardStyle}>
        {/* Green progress bar */}
        <div style={{ height: 4, background: '#f1f5f9' }}>
          <div style={{
            height: 4,
            background: 'linear-gradient(90deg,#059669,#34d399)',
            width: `${progress}%`,
            transition: 'width 0.4s ease',
            borderRadius: '4px 0 0 0',
          }} />
        </div>

        {/* Header row */}
        <div style={{ padding: '13px 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#059669', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => completeTour()}
            style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, color: '#94a3b8', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
          >
            Skip Tour
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 15px 15px' }}>
          <h3 style={{ margin: '0 0 5px', fontSize: 14.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
            {step.title}
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>
            {step.description}
          </p>

          {/* Footer row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {steps.map((_, idx) => (
                <span key={idx} style={{
                  height: 5,
                  borderRadius: 4,
                  transition: 'all 0.3s ease',
                  width: idx === currentStep ? 16 : 5,
                  backgroundColor: idx === currentStep ? '#059669' : '#e2e8f0',
                  display: 'inline-block',
                }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{ padding: '6px 12px', fontSize: 11.5, fontWeight: 600, color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
                >
                  Previous
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                style={{ padding: '6px 15px', fontSize: 11.5, fontWeight: 700, backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
