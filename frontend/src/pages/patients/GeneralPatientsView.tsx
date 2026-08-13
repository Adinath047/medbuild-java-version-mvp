// client/src/pages/patients/GeneralPatientsView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';
import { useSync } from '../../sync/useSync';

export default function GeneralPatientsView({ onNavigate }: { onNavigate?: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();
  const { syncCount } = useSync();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPatients = async () => {
    try {
      const res = await apiClient.get('/patients', { params: { limit: 200 } });
      setPatients(Array.isArray(res.data) ? res.data : (res.data?.patients || []));
    } catch {
      const local = await db.patients.toArray();
      setPatients(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (syncCount > 0) {
      fetchPatients();
    }
  }, [syncCount]);

  const visible = patients.filter(p => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.uhid && p.uhid.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner — Care Management / Patient Directory */}
      <div className="card" style={{ margin: 0, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
            CARE MANAGEMENT
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>
            Patient Directory
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Manage records, filter by status, and take action on each patient.
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="card" style={{ margin: 0, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
        <input
          className="input"
          placeholder="Search patients by name, UHID, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', height: 42, fontSize: 13.5 }}
        />
      </div>

      {/* Patients Table Card */}
      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No patients found matching your search.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>UHID</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PATIENT NAME</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AGE / SEX</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PHONE</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REGISTERED</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p, idx) => {
                  const regDate = p.created_at ? new Date(p.created_at) : null;
                  const formattedDate = regDate && !isNaN(regDate.getTime()) 
                    ? `${regDate.getDate()}/${regDate.getMonth() + 1}/${regDate.getFullYear()}` 
                    : '—';

                  const ageDisplay = p.age !== undefined && p.age !== null && p.age !== '' 
                    ? `${p.age} yrs` 
                    : '— yrs';
                  const sexDisplay = p.gender || p.sex || '—';

                  return (
                    <tr 
                      key={p.id || idx}
                      style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)', transition: 'background 0.15s ease' }}
                    >
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit' }}>
                        {p.uhid || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text)' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {ageDisplay} / {sexDisplay}
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {p.phone || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '5px 14px', fontSize: 12.5, fontWeight: 500, borderRadius: 6 }}
                            onClick={() => onNavigate?.('patient_detail', { patientId: p.id, patient: p })}
                          >
                            View Record
                          </button>
                          
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', padding: '5px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 6 }}
                            onClick={() => onNavigate?.('new_prescription', { patientId: p.id, patient: p, selectedPatient: p })}
                          >
                            Prescribe
                          </button>

                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '5px 14px', fontSize: 12.5, fontWeight: 500, borderRadius: 6 }}
                            onClick={() => onNavigate?.('billing', { patientId: p.id, patient: p, showAdd: true })}
                          >
                            Bill
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
