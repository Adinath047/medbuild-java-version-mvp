import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock Patient Onboarding Component test
const PatientFormMock = ({ onSubmit }: { onSubmit: (data: any) => void }) => {
  const [name, setName] = React.useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name }); }}>
      <label htmlFor="patient-name">Patient Name</label>
      <input
        id="patient-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={!name}>Save Patient</button>
    </form>
  );
};

describe('Component Testing — PatientForm', () => {
  it('disables save button when patient name is empty', () => {
    render(<PatientFormMock onSubmit={() => {}} />);
    const submitBtn = screen.getByRole('button', { name: /save patient/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables save button and submits form when patient name is provided', () => {
    const handleSubmit = vi.fn();
    render(<PatientFormMock onSubmit={handleSubmit} />);
    
    const input = screen.getByLabelText(/patient name/i);
    const submitBtn = screen.getByRole('button', { name: /save patient/i });

    fireEvent.change(input, { target: { value: 'John Doe' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(handleSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
  });
});
