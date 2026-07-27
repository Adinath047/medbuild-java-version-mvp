import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  userName: string;
  patientId: string;
  patientUhid: string;
  actionType: string;
  details: string;
  ipAddress: string;
  endpoint: string;
  httpMethod: string;
  status: string;
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/audit-logs');
      setLogs(res.data || []);
    } catch (err) {
      console.error('[AuditLog] Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'All' && log.actionType !== actionFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (log.userName || '').toLowerCase().includes(q) ||
      (log.actionType || '').toLowerCase().includes(q) ||
      (log.patientUhid || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.ipAddress || '').toLowerCase().includes(q)
    );
  });

  const exportCSV = () => {
    if (!filteredLogs.length) return;
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Action', 'UHID', 'Details', 'IP Address', 'Status'];
    const rows = filteredLogs.map(l => [
      l.id,
      new Date(l.timestamp).toLocaleString('en-IN'),
      `"${l.userName || l.userId || '—'}"`,
      l.userRole || '—',
      l.actionType || '—',
      l.patientUhid || '—',
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ipAddress || '127.0.0.1',
      l.status || 'SUCCESS'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medbuild_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {/* Header Banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#0f766e', background: '#e6f4f1', padding: '3px 8px', borderRadius: 4 }}>
            HIPAA & DPDP ACT 2023 COMPLIANT
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 6, letterSpacing: '-0.3px', color: 'var(--text)' }}>
            Immutable Audit Trail
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
            Every patient record access, modification, and clinical transaction is logged asynchronously with timestamp and IP address.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
            🔄 Refresh Logs
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV} disabled={!filteredLogs.length}>
            📥 Export CSV Audit Report
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          maxWidth: 360
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
          <input
            placeholder="Search by user, action, UHID, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 13, color: 'var(--text)' }}
          />
        </div>

        <select
          className="input"
          style={{ width: 180, fontSize: 13 }}
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="All">All Actions</option>
          <option value="VIEW_PATIENT">VIEW_PATIENT</option>
          <option value="CREATE_PATIENT">CREATE_PATIENT</option>
          <option value="UPDATE_PATIENT">UPDATE_PATIENT</option>
          <option value="CHECK_IN">CHECK_IN</option>
          <option value="GENERATE_BILL">GENERATE_BILL</option>
          <option value="RECORD_VITALS">RECORD_VITALS</option>
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          <span className="empty-icon">🛡️</span>
          <h3>No audit records found</h3>
          <p>Clinical interactions and patient record updates will automatically populate this append-only trail.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Operator</th>
                <th>Role</th>
                <th>Action</th>
                <th>UHID</th>
                <th>Details</th>
                <th>IP Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {new Date(l.timestamp).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {l.userName || l.userId || 'System'}
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{l.userRole || 'STAFF'}</span>
                  </td>
                  <td>
                    <span className={`badge ${l.actionType.startsWith('CREATE') ? 'badge-success' : l.actionType.startsWith('UPDATE') ? 'badge-info' : 'badge-purple'}`} style={{ fontSize: 10 }}>
                      {l.actionType}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                    {l.patientUhid || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-sec)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.details || '—'}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {l.ipAddress || '127.0.0.1'}
                  </td>
                  <td>
                    <span className={`badge ${l.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
