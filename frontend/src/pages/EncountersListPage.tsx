// client/src/pages/EncountersListPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';

interface Encounter {
  id: string; patient_id: string; patient_name: string; uhid: string; doctor_name: string;
  encounter_type: string; chief_complaint: string; status: string;
  token_number: number; created_at: string;
}

const TYPE_BADGE: Record<string, string> = {
  OPD: 'badge-info', IPD: 'badge-success', Emergency: 'badge-danger', Follow_Up: 'badge-warning',
};

export default function EncountersListPage({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [dateFilter, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [typeFilter, setType]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (dateFilter) params.set('date', dateFilter);
      const res = await apiClient.get(`/encounters?${params}`);
      setEncounters(res.data ?? []);
    } catch { setEncounters([]); }
    finally { setLoading(false); }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const visible = encounters.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.patient_name?.toLowerCase().includes(q) || e.uhid?.toLowerCase().includes(q) || e.doctor_name?.toLowerCase().includes(q);
    const matchT = !typeFilter || e.encounter_type === typeFilter;
    return matchQ && matchT;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Encounters</div>
          <div className="page-sub">{visible.length} record{visible.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('new_encounter')}>+ New Encounter</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" placeholder="Search patient, UHID, doctor…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <input type="date" className="form-input" value={dateFilter}
            onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <select className="form-input" value={typeFilter} onChange={e => setType(e.target.value)} style={{ width: 150 }}>
            <option value="">All types</option>
            <option value="OPD">OPD</option>
            <option value="IPD">IPD</option>
            <option value="Emergency">Emergency</option>
            <option value="Follow_Up">Follow-Up</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setDate('')}>Clear date</button>
        </div>
      </div>

      <div className="card">
        {loading
          ? <div className="loading-screen" style={{ height: 200 }}><div className="spinner" /></div>
          : visible.length === 0
            ? <div className="empty-state"><span className="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span><p>No encounters found</p></div>
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Complaint</th><th>Status</th><th>Date</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(e => (
                      <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('patient_detail', { patientId: e.patient_id, fromEncounter: true })}>
                        <td><div className="encounter-token">{e.token_number}</div></td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{e.patient_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.uhid}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{e.doctor_name}</td>
                        <td><span className={`badge ${TYPE_BADGE[e.encounter_type] ?? 'badge-neutral'}`}>{e.encounter_type}</span></td>
                        <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.chief_complaint || '—'}
                        </td>
                        <td><span className={`badge ${e.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{e.status}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(e.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={ev => { ev.stopPropagation(); onNavigate('new_encounter', { encounterId: e.id }); }}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </>
  );
}
