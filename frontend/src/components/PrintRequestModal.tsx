import React from 'react';
import { printPrescriptionSlip } from '../utils/printTemplates';
import { apiClient } from '../api/client';

export interface PrintModalData {
  notificationId?: string;
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
  prePrinted?: boolean;
}

interface PrintRequestModalProps {
  data: PrintModalData | null;
  onClose: () => void;
}

export default function PrintRequestModal({ data, onClose }: PrintRequestModalProps) {
  if (!data) return null;

  async function handlePrintAndDismiss() {
    if (!data) return;
    // 1. Trigger window print using prescription template
    printPrescriptionSlip({
      doctor: {
        name: data.doctor_name || 'Doctor',
        role: data.doctor_role || 'Doctor',
        qualification: data.doctor_qualification || undefined,
        regNo: data.doctor_reg || undefined
      },
      patient: {
        name: data.patient_name || '—',
        uhid: data.uhid || '—',
        age: typeof data.age === 'number' ? data.age : (data.age ? parseInt(String(data.age)) : undefined),
        sex: data.sex,
        blood_group: data.blood_group
      },
      medicines: (data.medicines || []).map((m: any) => ({
        name: m.name || '',
        strength: m.strength || '',
        dose: m.dose || m.dosage || '1 tablet',
        frequency: m.frequency || 'Once daily',
        duration: m.duration || '5 days',
        instructions: m.instructions || ''
      })),
      advice: data.advice,
      followUp: data.follow_up,
      weight: data.weight,
      slipToken: data.slip_token || 'RX-PRINT',
      prePrinted: data.prePrinted ?? false,
      vitals: data.vitals,
      diagnosis: data.diagnosis
    });

    // 2. Mark notification as read if id exists
    if (data.notificationId) {
      try {
        await apiClient.post(`/notifications/${data.notificationId}/read`);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    onClose();
  }

  async function handleDismissOnly() {
    if (!data) return;
    if (data.notificationId) {
      try {
        await apiClient.post(`/notifications/${data.notificationId}/read`);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    onClose();
  }

  const medicinesList = Array.isArray(data.medicines) ? data.medicines : [];
  const timeFormatted = data.requested_at 
    ? new Date(data.requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="modal-overlay" onClick={handleDismissOnly} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div 
        className="modal" 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Large High-Visibility Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #0d9488'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
            }}>
              🖨️
            </div>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                background: 'rgba(255, 255, 255, 0.25)',
                padding: '2px 8px',
                borderRadius: 4,
                display: 'inline-block',
                marginBottom: 4
              }}>
                Print Alert • Front Desk
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: '#ffffff' }}>
                New Prescription Print Request
              </h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleDismissOnly}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Doctor Alert Banner */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>👨‍⚕️</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                  Requested by Dr. {data.doctor_name}
                </span>
                <span style={{ fontSize: 12, color: '#15803d', display: 'block', marginTop: 1 }}>
                  Doctor requested copy for patient printout
                </span>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: 20 }}>
              {timeFormatted}
            </span>
          </div>

          {/* Patient Details Large Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              PATIENT INFORMATION
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PATIENT NAME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {data.patient_name || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>UHID NUMBER</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e', fontFamily: 'monospace', marginTop: 2 }}>
                  {data.uhid || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>AGE / GENDER</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                  {data.age ? `${data.age} yrs` : '—'} / {data.sex || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>SLIP TOKEN</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#b45309', fontFamily: 'monospace', marginTop: 2 }}>
                  {data.slip_token || '—'}
                </div>
              </div>
            </div>

            {data.diagnosis && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>DIAGNOSIS: </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{data.diagnosis}</span>
              </div>
            )}
          </div>

          {/* Medicines Summary Preview */}
          {medicinesList.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>PRESCRIBED MEDICINES ({medicinesList.length})</span>
              </div>
              <div style={{
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#ffffff'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Medicine</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Dose</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Frequency</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicinesList.map((m: any, i: number) => (
                      <tr key={i} style={{ borderBottom: i < medicinesList.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {m.name} {m.strength && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>({m.strength})</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{m.dose || '1 tab'}</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{m.frequency || 'Once daily'}</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{m.duration || '5 days'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDismissOnly}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 600,
              color: '#64748b',
              background: '#ffffff',
              border: '1px solid #cbd5e1'
            }}
          >
            Close / Dismiss
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrintAndDismiss}
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: 16 }}>🖨️</span>
            Print Prescription Slip Now
          </button>
        </div>
      </div>
    </div>
  );
}
