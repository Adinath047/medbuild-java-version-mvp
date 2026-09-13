import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast, useToastStore } from '../../store/toastStore';
import ToastContainer from '../ToastContainer';

describe('Medbuilds EMR Toast Notification System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearToasts();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('1. Adds success toast with correct styling, vector icon, title and message', () => {
    render(<ToastContainer />);

    act(() => {
      toast.success('Patient Registered!', 'UHID-2026-0042 assigned to Rahul Sharma');
    });

    const titleEl = screen.getByText('Patient Registered!');
    const msgEl = screen.getByText('UHID-2026-0042 assigned to Rahul Sharma');

    expect(titleEl).toBeInTheDocument();
    expect(msgEl).toBeInTheDocument();

    const toastAlert = screen.getByRole('alert');
    expect(toastAlert).toBeInTheDocument();
    expect(toastAlert.style.background).toBe('rgb(240, 253, 244)'); // #f0fdf4
    expect(toastAlert.style.border).toContain('rgb(34, 197, 94)'); // #22c55e
  });

  it('2. Adds info toast with light blue theme for offline/sync events', () => {
    render(<ToastContainer />);

    act(() => {
      toast.info('Direct Intake Mode', 'Patient Rahul Sharma registered locally in 2-Member Mode');
    });

    const titleEl = screen.getByText('Direct Intake Mode');
    expect(titleEl).toBeInTheDocument();

    const toastAlert = screen.getByRole('alert');
    expect(toastAlert.style.background).toBe('rgb(239, 246, 255)'); // #eff6ff
    expect(toastAlert.style.border).toContain('rgb(59, 130, 246)'); // #3b82f6
  });

  it('3. Adds warning toast with amber theme and exclamation vector icon', () => {
    render(<ToastContainer />);

    act(() => {
      toast.warning('Drug Allergy Alert!', 'Patient is severely allergic to Penicillin.');
    });

    const titleEl = screen.getByText('Drug Allergy Alert!');
    expect(titleEl).toBeInTheDocument();

    const toastAlert = screen.getByRole('alert');
    expect(toastAlert.style.background).toBe('rgb(255, 251, 235)'); // #fffbeb
    expect(toastAlert.style.border).toContain('rgb(245, 158, 11)'); // #f59e0b
  });

  it('4. Adds error toast with red theme and optional action link', () => {
    const handleRetry = vi.fn();
    render(<ToastContainer />);

    act(() => {
      toast.error('Something went wrong!', 'The program has turned off unexpectedly.', {
        action: { label: 'Send report', onClick: handleRetry },
      });
    });

    const titleEl = screen.getByText('Something went wrong!');
    expect(titleEl).toBeInTheDocument();

    const toastAlert = screen.getByRole('alert');
    expect(toastAlert.style.background).toBe('rgb(254, 242, 242)'); // #fef2f2
    expect(toastAlert.style.border).toContain('rgb(239, 68, 68)'); // #ef4444

    const actionBtn = screen.getByRole('button', { name: /send report/i });
    expect(actionBtn).toBeInTheDocument();

    fireEvent.click(actionBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('5. Dismisses toast when clicking close button', () => {
    render(<ToastContainer />);

    act(() => {
      toast.success('Prescription Saved!', 'Rx token RX-8812 generated');
    });

    expect(screen.getByText('Prescription Saved!')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /dismiss notification/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText('Prescription Saved!')).not.toBeInTheDocument();
  });

  it('6. Automatically dismisses toast after designated timer duration', () => {
    render(<ToastContainer />);

    act(() => {
      toast.success('Vitals Saved!', 'Observations recorded for Rahul Sharma', { duration: 3000 });
    });

    expect(screen.getByText('Vitals Saved!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('Vitals Saved!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText('Vitals Saved!')).not.toBeInTheDocument();
  });

  it('7. Pauses timer on mouse enter and resumes on mouse leave', () => {
    render(<ToastContainer />);

    act(() => {
      toast.success('Patient Admitted to Bed!', 'Assigned to Room 102 (General)', { duration: 4000 });
    });

    const toastAlert = screen.getByRole('alert');

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Hover
    act(() => {
      fireEvent.mouseEnter(toastAlert);
    });

    // Advance another 5 seconds while hovered
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Toast should still be present because it was paused
    expect(screen.getByText('Patient Admitted to Bed!')).toBeInTheDocument();

    // Mouse leave
    act(() => {
      fireEvent.mouseLeave(toastAlert);
    });

    // Advance remaining duration
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Patient Admitted to Bed!')).not.toBeInTheDocument();
  });

  it('8. Strictly adheres to ZERO EMOJIS rule across rendered toast DOM', () => {
    const { container } = render(<ToastContainer />);

    act(() => {
      toast.success('Patient Registered!', 'Assigned UHID-2026-991');
      toast.info('Bed Allocated!', 'Admitted to ICU Bed 4');
      toast.warning('Vitals Critical!', 'SpO2 below 90%');
      toast.error('Sync Error!', 'Local offline queue active');
    });

    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.innerHTML)).toBe(false);
  });
});
