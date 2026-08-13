// client/src/pages/beds/AdminDoctorBedsView.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';
import { useSync } from '../../sync/useSync';

interface Bed {
  id: string;
  bed_number: string;
  room: string;
  ward: string;
  type: string;
  status: string;
  patient_id?: string;
  patient_name?: string;
  patient_photo?: string;
  doctor_name?: string;
  admitted_at?: string;
  vitals?: any;
}

export default function AdminDoctorBedsView({ onNavigate, isReceptionistOnly }: { onNavigate?: (p: string, d?: any) => void; isReceptionistOnly?: boolean } = {}) {
  const { user } = useAuthStore();
  const isReceptionist = isReceptionistOnly || user?.role?.toLowerCase().includes('reception');
  const { syncCount } = useSync();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState('');

  // Vitals Log Modal State
  const [vitalsLogBed, setVitalsLogBed] = useState<Bed | null>(null);
  const [vitalsLogList, setVitalsLogList] = useState<any[]>([]);
  const [loadingVitalsLog, setLoadingVitalsLog] = useState(false);
  
  const [allocateBed, setAllocateBed] = useState<Bed | null>(null);
  const [recordVitalsBed, setRecordVitalsBed] = useState<Bed | null>(null);

  const fetchBeds = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/beds');
      setBeds(res.data || []);
    } catch {
      setBeds([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds(true);
  }, []);

  useEffect(() => {
    if (syncCount > 0) {
      fetchBeds(false);
    }
  }, [syncCount]);

  const handleOpenVitalsLog = async (bed: Bed) => {
    if (!bed.patient_id) return;
    setVitalsLogBed(bed);
    setLoadingVitalsLog(true);
    try {
      const res = await apiClient.get('/vitals', { params: { patient_id: bed.patient_id, limit: 20 } });
      setVitalsLogList(res.data || []);
    } catch {
      setVitalsLogList([]);
    } finally {
      setLoadingVitalsLog(false);
    }
  };

  const handleRelease = async (bed: Bed) => {
    if (!window.confirm(`Are you sure you want to vacate Room ${bed.room} (${bed.bed_number})?`)) return;
    try {
      await apiClient.post(`/beds/${bed.id}/release`);
      await fetchBeds(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to vacate bed.');
    }
  };

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <div className="page-title" style={{ fontSize: 24, fontWeight: 700 }}>Bed Allocation Management</div>
          <div className="page-sub" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live view of every bed and vital sign</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchBeds(false)} disabled={loading}>
            Refresh Status
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Main Stats Block */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Wards</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>Beds & Vitals Board</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Track occupancy, record vitals in seconds, and spot overdue observations at a glance.
        </p>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTop: '1px solid var(--border-light)', paddingTop: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Occupancy</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {occupiedBeds} <span style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 500 }}>/ {totalBeds}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Bed Cards */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {beds.map(bed => {
            const isOccupied = bed.status === 'Occupied';
            return (
              <div key={bed.id} className="card" style={{ padding: 20, margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Room {bed.room} ({bed.bed_number})</div>
                  <span className={`badge ${isOccupied ? 'badge-info' : 'badge-success'}`}>{bed.status}</span>
                </div>

                {isOccupied ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{bed.patient_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dr. {bed.doctor_name || 'Assigned Doctor'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleOpenVitalsLog(bed)}>
                        Vitals Log
                      </button>
                      {!isReceptionist && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRelease(bed)}>
                          Vacate
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Bed is clean & vacant</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
