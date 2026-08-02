import { apiClient } from '../api/client';
import { db } from '../db/localDB';

export interface PrintRequestPayload {
  patient_name: string;
  uhid: string;
  age?: number | string;
  sex?: string;
  blood_group?: string;
  doctor_name: string;
  doctor_role?: string;
  doctor_qualification?: string;
  doctor_reg?: string;
  slip_token: string;
  medicines: any[];
  advice?: string;
  follow_up?: string;
  weight?: string;
  vitals?: any;
  diagnosis?: string;
  requested_at?: string;
}

const printChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('emr-print-channel') : null;

export async function sendPrintRequestToReceptionist(payload: PrintRequestPayload): Promise<boolean> {
  const formattedPayload = {
    ...payload,
    requested_at: payload.requested_at || new Date().toISOString()
  };

  const messageStr = JSON.stringify(formattedPayload);

  try {
    // Post notification to backend
    await apiClient.post('/notifications', {
      type: 'print_request',
      message: messageStr,
      patient_id: payload.uhid || undefined
    });
  } catch (err) {
    console.warn('[PrintRequest] Backend notification post failed:', err);
  }

  // 2. Broadcast event across open tabs
  if (printChannel) {
    printChannel.postMessage({ type: 'PRINT_REQUEST', payload: formattedPayload });
  }

  // 3. Dispatch custom window event locally
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('emr:print-request', { detail: formattedPayload }));
  }

  return true;
}
