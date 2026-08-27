import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

// ── Tour step definitions per role ──────────────────────────────────────────
// Each step targets a sidebar nav item by its `page` key from getNav()
interface TourStep {
  page: string;        // matches nav item page key — used to find DOM element
  title: string;
  description: string;
}

const DOCTOR_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Your Daily Dashboard',
    description: 'Start each day here. View your OPD queue, today\'s scheduled consultations, and real-time patient status updates all in one place.'
  },
  {
    page: 'patients',
    title: 'Patient Records',
    description: 'Access the complete patient directory. Register new patients, search by phone or ID, and open their full medical history with one click.'
  },
  {
    page: 'beds',
    title: 'Beds & Vitals',
    description: 'Monitor bed occupancy across wards, track admitted patients, and record or view vitals history for IPD cases.'
  },
  {
    page: 'appointments',
    title: 'Appointments',
    description: 'View and manage your scheduled appointments. Book new slots and track patient arrival status in real time.'
  },
  {
    page: 'prescriptions',
    title: 'Prescriptions',
    description: 'Compose digital prescriptions with autocomplete dosage instructions. Generate professional PDF printouts with your letterhead in one click.'
  },
  {
    page: 'billing',
    title: 'Billing & Invoices',
    description: 'Generate itemized hospital bills, apply discounts, and record payments across Cash, UPI, and Card — all synced to the patient record.'
  },
  {
    page: 'settings',
    title: 'Profile & Settings',
    description: 'Update your consultation fees, letterhead margins, print preferences, and personal profile details anytime from here.'
  }
];

const RECEPTION_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Front Desk Dashboard',
    description: 'Monitor live patient arrivals, OPD waiting rooms, and doctor availability across all departments from one command centre.'
  },
  {
    page: 'patients',
    title: 'Patient Registration',
    description: 'Quickly register new walk-in patients, search existing records by phone or ID, and update demographic information instantly.'
  },
  {
    page: 'beds',
    title: 'Beds & Vitals',
    description: 'Track bed occupancy in real time. Assign or discharge patients from wards and update vitals for nursing staff.'
  },
  {
    page: 'appointments',
    title: 'Appointment Booking',
    description: 'Book appointments for any doctor, assign consultation slots, and generate digital queue tokens for patients.'
  },
  {
    page: 'billing',
    title: 'Billing & Payments',
    description: 'Raise invoices, collect payments, and issue receipts. All billing entries are immediately linked to the patient\'s record.'
  },
  {
    page: 'settings',
    title: 'Profile & Settings',
    description: 'Manage your account details and notification preferences from the Settings page.'
  }
];

const PHARMACIST_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Pharmacy Dashboard',
    description: 'Get a quick overview of dispensing activity, pending prescriptions, and low-stock alerts for the day.'
  },
  {
    page: 'prescriptions',
    title: 'Prescription Queue',
    description: 'View all doctor-issued prescriptions. Verify, dispense, and mark prescriptions as fulfilled — with full audit trail.'
  },
  {
    page: 'billing',
    title: 'Pharmacy Sales & Billing',
    description: 'Record over-the-counter sales, manage the medicine formulary, and track batch expiry details to avoid dispensing errors.'
  },
  {
    page: 'settings',
    title: 'Profile & Settings',
    description: 'Update your staff details and pharmacy preferences here.'
  }
];

const ADMIN_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Admin Dashboard',
    description: 'Your hospital control centre. View system-wide activity, patient flow, staff usage, and key performance metrics at a glance.'
  },
  {
    page: 'patients',
    title: 'Patient Records',
    description: 'Access every patient in your hospital. Admins can view, audit, and manage all patient data across all departments.'
  },
  {
    page: 'appointments',
    title: 'Appointments',
    description: 'Oversee all appointment scheduling across doctors and departments. Identify bottlenecks and manage peak hours.'
  },
  {
    page: 'beds',
    title: 'Beds & Vitals',
    description: 'Manage bed allocation across all wards. Admins have full visibility into IPD occupancy and nursing workflow.'
  },
  {
    page: 'prescriptions',
    title: 'Prescriptions',
    description: 'View all prescriptions issued in your hospital for audit, compliance, and clinical quality reviews.'
  },
  {
    page: 'billing',
    title: 'Billing & Revenue',
    description: 'Track daily collections, outstanding invoices, and revenue breakdown by department or service type.'
  },
  {
    page: 'settings',
    title: 'Hospital Settings',
    description: 'Configure staff accounts, letterhead templates, print margins, subscription details, and system-wide preferences here.'
  }
];

const NURSE_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Nursing Dashboard',
    description: 'View your assigned patients and pending nursing tasks for the shift — all in one streamlined view.'
  },
  {
    page: 'patients',
    title: 'Patients',
    description: 'Access patient records to update clinical notes, review doctor orders, and coordinate care across the ward.'
  },
  {
    page: 'beds',
    title: 'Beds & Vitals',
    description: 'Monitor bed assignments, record vitals readings, and flag any out-of-range values for immediate doctor attention.'
  },
  {
    page: 'billing',
    title: 'Billing',
    description: 'Assist in billing entry for nursing procedures and IPD charges directly linked to the patient\'s account.'
  },
  {
    page: 'settings',
    title: 'Profile',
    description: 'View and update your nursing profile and notification preferences.'
  }
];

// ── Card position: prefer right of sidebar, fallback to center ──────────────
function getCardPosition(anchorRect: DOMRect | null): React.CSSProperties {
  if (!anchorRect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const sidebarWidth = anchorRect.right; // right edge of anchor = sidebar width
  const margin = 20;
  return {
    top: Math.max(12, anchorRect.top + anchorRect.height / 2 - 120),
    left: sidebarWidth + margin,
  };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const { user, tourCompleted, completeTour } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const role = (user?.role || 'doctor').toLowerCase();
  let steps: TourStep[] = DOCTOR_STEPS;
  if (role === 'receptionist') steps = RECEPTION_STEPS;
  else if (role.includes('pharm')) steps = PHARMACIST_STEPS;
  else if (role === 'admin') steps = ADMIN_STEPS;
  else if (role.includes('nurse')) steps = NURSE_STEPS;

  const step = steps[currentStep] || steps[0];

  // Find and measure the target sidebar nav element by data-page attribute
  const measureTarget = useCallback(() => {
    // Nav items rendered with data-page attribute (added via portal injection below)
    const el = document.querySelector(`[data-tour-page="${step.page}"]`) as HTMLElement | null;
    if (el) {
      setAnchorRect(el.getBoundingClientRect());
    } else {
      // Fallback: look for any sidebar nav-item matching visible text
      setAnchorRect(null);
    }
  }, [step.page]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    return () => window.removeEventListener('resize', measureTarget);
  }, [measureTarget, currentStep]);

  if (!user || tourCompleted) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const cardPos = getCardPosition(anchorRect);

  return (
    <>
      {/* Highlight ring around the targeted sidebar nav item */}
      {anchorRect && (
        <div
          style={{
            position: 'fixed',
            top: anchorRect.top - 3,
            left: anchorRect.left - 3,
            width: anchorRect.width + 6,
            height: anchorRect.height + 6,
            borderRadius: 14,
            border: '2.5px solid #f59e0b',
            boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.18), 0 0 18px rgba(245, 158, 11, 0.30)',
            zIndex: 9998,
            pointerEvents: 'none',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      {/* Floating tour card */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed',
          zIndex: 9999,
          width: 320,
          backgroundColor: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          transition: 'top 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          ...cardPos
        }}
      >
        {/* Green progress bar */}
        <div style={{ height: 4, background: '#f1f5f9', position: 'relative' }}>
          <div
            style={{
              height: 4,
              background: 'linear-gradient(90deg, #059669, #34d399)',
              width: `${progress}%`,
              transition: 'width 0.4s ease',
              borderRadius: '4px 0 0 0'
            }}
          />
        </div>

        {/* Card header */}
        <div style={{ padding: '14px 16px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => completeTour()}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: '0.2px'
            }}
          >
            Skip Tour
          </button>
        </div>

        {/* Card body */}
        <div style={{ padding: '12px 16px 16px 16px' }}>
          <h3 style={{
            margin: '0 0 6px 0',
            fontSize: 15,
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.3
          }}>
            {step.title}
          </h3>
          <p style={{
            margin: '0 0 16px 0',
            fontSize: 13,
            color: '#64748b',
            lineHeight: 1.55
          }}>
            {step.description}
          </p>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  style={{
                    height: 5,
                    borderRadius: 4,
                    transition: 'all 0.3s ease',
                    width: idx === currentStep ? 18 : 5,
                    backgroundColor: idx === currentStep ? '#059669' : '#e2e8f0'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#64748b',
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
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
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                }}
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
