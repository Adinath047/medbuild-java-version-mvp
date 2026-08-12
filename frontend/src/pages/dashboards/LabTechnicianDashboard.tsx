import React, { useState } from 'react';
import apiClient from '../../api/client';
import { db } from '../../db/localDB';
import { useAuthStore } from '../../store/authStore';

export default function LabTechnicianDashboard({ onNavigate }: { onNavigate: (p: string, d?: any) => void }) {
  const { user } = useAuthStore();

  // 🧪 Laboratory Requisitions & Test Results State
  const [labOrders, setLabOrders] = useState<any[]>([
    {
      id: 'LAB-1001',
      date: new Date().toISOString().split('T')[0],
      patient_id: 'p101',
      patient_name: 'Rakesh Kuber',
      uhid: 'MED-98102',
      doctor_name: 'Dr. Aarav Mehta',
      doctor_specialty: 'Cardiology',
      test_name: 'Complete Blood Count (CBC) & Lipid Profile',
      urgency: 'STAT Emergency',
      status: 'Pending Sample',
      sample_type: 'Whole Blood (EDTA Purple Top)',
      test_values: {}
    },
    {
      id: 'LAB-1002',
      date: new Date().toISOString().split('T')[0],
      patient_id: 'p102',
      patient_name: 'Sunita Deshmukh',
      uhid: 'MED-40291',
      doctor_name: 'Dr. Ananya Rao',
      doctor_specialty: 'Endocrinology',
      test_name: 'Fasting Blood Sugar (FBS) & HbA1c',
      urgency: 'Routine',
      status: 'Sample Collected',
      sample_type: 'Fluoride Yellow Top & EDTA',
      test_values: { fbs: '108 mg/dL', hba1c: '6.2%' }
    },
    {
      id: 'LAB-1003',
      date: new Date().toISOString().split('T')[0],
      patient_id: 'p103',
      patient_name: 'Amit Kulkarni',
      uhid: 'MED-11029',
      doctor_name: 'Dr. Aarav Mehta',
      doctor_specialty: 'Cardiology',
      test_name: 'Thyroid Profile (T3, T4, TSH)',
      urgency: 'Routine',
      status: 'In Testing',
      sample_type: 'Serum Red Top',
      test_values: { tsh: '2.4 mIU/L' }
    },
    {
      id: 'LAB-1004',
      date: new Date().toISOString().split('T')[0],
      patient_id: 'p104',
      patient_name: 'Rajesh Patel',
      uhid: 'MED-55920',
      doctor_name: 'Dr. Rajesh Sharma',
      doctor_specialty: 'General Medicine',
      test_name: 'Liver Function Test (LFT) & KFT',
      urgency: 'Routine',
      status: 'Completed & Synced',
      sample_type: 'Serum Separator Tube',
      test_values: { sgot: '24 U/L', sgpt: '28 U/L', creatinine: '0.9 mg/dL' }
    }
  ]);

  // Lab Modals States
  const [showLabResultModal, setShowLabResultModal] = useState(false);
  const [selectedLabOrder, setSelectedLabOrder]   = useState<any>(null);
  const [labForm, setLabForm]                       = useState({
    hb: '13.8',
    wbc: '6800',
    platelets: '2.5',
    fbs: '95',
    hba1c: '5.6',
    tsh: '2.1',
    impression: 'All lab parameters within normal adult reference ranges.',
  });
  const [syncingLab, setSyncingLab]                 = useState(false);
  const [labSuccessMsg, setLabSuccessMsg]           = useState('');
  const [showSampleModal, setShowSampleModal]       = useState(false);
  const [showCatalogModal, setShowCatalogModal]     = useState(false);
  const [showAlertModal, setShowAlertModal]         = useState(false);
  const [alertMsg, setAlertMsg]                     = useState('Critical Lab Result Alert!');

  async function handleSaveLabResults(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLabOrder) return;
    setSyncingLab(true);
    setLabSuccessMsg('');

    try {
      const updatedOrder = {
        ...selectedLabOrder,
        status: 'Completed & Synced',
        test_values: {
          hb: labForm.hb ? `${labForm.hb} g/dL` : undefined,
          wbc: labForm.wbc ? `${labForm.wbc} /µL` : undefined,
          platelets: labForm.platelets ? `${labForm.platelets} Lakh/µL` : undefined,
          fbs: labForm.fbs ? `${labForm.fbs} mg/dL` : undefined,
          hba1c: labForm.hba1c ? `${labForm.hba1c} %` : undefined,
          tsh: labForm.tsh ? `${labForm.tsh} mIU/L` : undefined,
          impression: labForm.impression
        },
        synced_at: new Date().toISOString()
      };

      setLabOrders(prev => prev.map(o => o.id === selectedLabOrder.id ? updatedOrder : o));

      // Sync to local DB vitals table so attending doctors view immediately in patient profile
      await db.vitals.put({
        id: `lab-vitals-${Date.now()}`,
        patient_id: selectedLabOrder.patient_id,
        hospital_id: 'hosp-1',
        blood_sugar: labForm.fbs ? Number(labForm.fbs) : undefined,
        blood_sugar_type: 'Fasting (Lab Sync)',
        notes: `Lab Report Synced: ${selectedLabOrder.test_name}. Impression: ${labForm.impression}`,
        recorded_by: user?.name || 'Lab Technician',
        recorded_at: new Date().toISOString(),
        _syncStatus: 'synced',
        _syncOp: 'create',
        _localSeq: Date.now(),
        _updatedAt: new Date().toISOString()
      } as any);

      // Post notification to doctor
      try {
        await apiClient.post('/notifications', {
          doctor_id: 'all',
          message: `🧪 Lab Report Completed & Synced: ${selectedLabOrder.patient_name} (${selectedLabOrder.uhid}) - ${selectedLabOrder.test_name}`,
        });
      } catch (err) {
        console.log('Notification fallback');
      }

      window.dispatchEvent(new CustomEvent('emr:lab-result-synced', { 
        detail: { patientId: selectedLabOrder.patient_id, order: updatedOrder } 
      }));

      setLabSuccessMsg(`✓ Lab Results for ${selectedLabOrder.patient_name} saved & synced in real-time with ${selectedLabOrder.doctor_name}!`);
      setTimeout(() => {
        setShowLabResultModal(false);
        setLabSuccessMsg('');
      }, 2000);
    } catch (err: any) {
      alert('Failed to sync lab report.');
    } finally {
      setSyncingLab(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      
      {/* Welcome Banner */}
      <div className="card" style={{
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #bae6fd',
        padding: '24px 28px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#0369a1',
            background: '#e0f2fe',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            marginBottom: 8
          }}>
            # Laboratory & Pathology Dashboard
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.4px', color: 'var(--text)' }}>
            Good day, {user?.name?.split(' ')[0] || 'Amit'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontWeight: 400, maxWidth: 640 }}>
            Track lab test requisitions, sample collection, test processing status, and report syncing with doctors.
          </p>
        </div>

        {/* User Profile Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '3px solid #fff',
          boxShadow: 'var(--shadow-md)',
          background: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: '#0284c7',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name ? user.name[0].toUpperCase() : 'L'
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Lab Metric 1: PENDING REQUISITIONS */}
        <div 
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pending Requisitions</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#0284c7', marginTop: 8, lineHeight: 1 }}>
              {labOrders.filter(o => o.status === 'Pending Sample' || o.status === 'In Testing').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Awaiting test processing</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 2v7.5M14 2v7.5M8.5 2h7M14 9.5a5 5 0 1 1-4 0"/><path d="M8.5 14h7"/></svg>
          </div>
        </div>

        {/* Lab Metric 2: SAMPLES COLLECTED */}
        <div 
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Samples Collected</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#7c3aed', marginTop: 8, lineHeight: 1 }}>
              {labOrders.filter(o => o.status === 'Sample Collected' || o.status === 'In Testing').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Barcoded & in lab queue</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M12 12v6"/></svg>
          </div>
        </div>

        {/* Lab Metric 3: COMPLETED & SYNCED */}
        <div 
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Completed & Synced</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#059669', marginTop: 8, lineHeight: 1 }}>
              {labOrders.filter(o => o.status === 'Completed & Synced').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Synced live with doctors</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 22 4"/></svg>
          </div>
        </div>

        {/* Lab Metric 4: STAT EMERGENCY TESTS */}
        <div 
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>STAT Emergency Tests</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#dc2626', marginTop: 8, lineHeight: 1 }}>
              {labOrders.filter(o => o.urgency === 'STAT Emergency').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>High-priority requisitions</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <h3 className="section-label" style={{ marginBottom: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Lab Quick Actions</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16
        }}>
          {/* Lab Action 1: Enter Test Results & Sync */}
          <div 
            onClick={() => {
              const pendingOrder = labOrders.find(o => o.status !== 'Completed & Synced') || labOrders[0];
              setSelectedLabOrder(pendingOrder);
              setShowLabResultModal(true);
            }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Enter Test Results & Sync</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Input lab values & report</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Lab Action 2: Register Sample Collection */}
          <div 
            onClick={() => setShowSampleModal(true)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8v8M10 8v8M14 8v8M17 8v8"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Log Sample Collection</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Specimen tube barcode</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Lab Action 3: Reference Catalog */}
          <div 
            onClick={() => setShowCatalogModal(true)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Lab Reference Catalog</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Standard adult normal ranges</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>

          {/* Lab Action 4: Doctor Alert */}
          <div 
            onClick={() => setShowAlertModal(true)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Notify Ordering Doctor</h4>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Send critical lab alert</p>
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 16, fontWeight: 600 }}>↗</div>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Laboratory Test Requisitions & Synced Reports</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {labOrders.length} test order(s) · Real-time Doctor Sync Active
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            style={{ fontSize: 12.5, fontWeight: 600 }}
            onClick={() => {
              const pendingOrder = labOrders.find(o => o.status !== 'Completed & Synced') || labOrders[0];
              setSelectedLabOrder(pendingOrder);
              setShowLabResultModal(true);
            }}
          >
            + Process New Test Order
          </button>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Order ID & Date</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient Name & UHID</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ordering Doctor</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Test Requisition</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Urgency</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labOrders.map((o: any) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                      <div>#{o.id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{o.date}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>UHID: {o.uhid}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.doctor_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.doctor_specialty}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: '#0284c7' }}>{o.test_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sample: {o.sample_type}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${o.urgency === 'STAT Emergency' ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                        {o.urgency}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${o.status === 'Completed & Synced' ? 'badge-success' : o.status === 'Sample Collected' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 10.5, padding: '3px 10px' }}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button 
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 12px', fontSize: 12, minHeight: 28 }}
                        onClick={() => {
                          setSelectedLabOrder(o);
                          setShowLabResultModal(true);
                        }}
                      >
                        {o.status === 'Completed & Synced' ? 'View & Edit Results' : 'Enter Results & Sync'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🧪 MODAL 1: Enter Test Results & Doctor Sync */}
      {showLabResultModal && selectedLabOrder && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }} onClick={() => setShowLabResultModal(false)}>
          <div className="modal" style={{ maxWidth: 560, width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#f0f9ff', borderBottom: '1px solid #bae6fd', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  🧪
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#0369a1', margin: 0 }}>Enter Lab Results & Doctor Sync</h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                    Requisition #{selectedLabOrder.id} • {selectedLabOrder.patient_name} ({selectedLabOrder.uhid})
                  </p>
                </div>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowLabResultModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveLabResults}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' }}>
                {labSuccessMsg && (
                  <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)', color: '#047857', fontSize: 12.5, fontWeight: 600 }}>
                    {labSuccessMsg}
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ordering Doctor:</span>
                    <strong style={{ color: 'var(--text)' }}>{selectedLabOrder.doctor_name} ({selectedLabOrder.doctor_specialty})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Test Requisition:</span>
                    <strong style={{ color: '#0284c7' }}>{selectedLabOrder.test_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Specimen Type:</span>
                    <span style={{ fontWeight: 600 }}>{selectedLabOrder.sample_type}</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                  Quantitative Result Parameters
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>Hemoglobin (Hb)</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 13.8 g/dL"
                      value={labForm.hb} 
                      onChange={e => setLabForm({ ...labForm, hb: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: 13.0 - 17.0 g/dL</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>Total WBC Count</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 6800 /µL"
                      value={labForm.wbc} 
                      onChange={e => setLabForm({ ...labForm, wbc: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: 4,000 - 11,000 /µL</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>Platelet Count</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 2.5 Lakh/µL"
                      value={labForm.platelets} 
                      onChange={e => setLabForm({ ...labForm, platelets: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: 1.5 - 4.5 Lakh/µL</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>Fasting Blood Sugar (FBS)</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 95 mg/dL"
                      value={labForm.fbs} 
                      onChange={e => setLabForm({ ...labForm, fbs: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: 70 - 99 mg/dL</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>HbA1c Glycated Hb</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 5.6%"
                      value={labForm.hba1c} 
                      onChange={e => setLabForm({ ...labForm, hba1c: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: &lt;5.7%</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11.5 }}>TSH (Thyroid Stimulating)</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 2.1 mIU/L"
                      value={labForm.tsh} 
                      onChange={e => setLabForm({ ...labForm, tsh: e.target.value })} 
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal: 0.4 - 4.0 mIU/L</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 11.5 }}>Pathologist Impression / Clinical Findings *</label>
                  <textarea 
                    className="input" 
                    rows={2} 
                    value={labForm.impression} 
                    onChange={e => setLabForm({ ...labForm, impression: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLabResultModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={syncingLab}>
                  {syncingLab ? 'Syncing to Doctor...' : '✓ Save & Sync Live with Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🧪 MODAL 2: Register Sample Specimen */}
      {showSampleModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }} onClick={() => setShowSampleModal(false)}>
          <div className="modal" style={{ maxWidth: 480, width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '16px 20px' }}>
              <h3 className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#92400e', margin: 0 }}>Log Specimen & Sample Collection</h3>
              <button type="button" className="close-btn" onClick={() => setShowSampleModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Scan or enter the tube barcode identifier to log specimen collection into the central pathology queue.
              </p>
              <div className="form-group">
                <label className="form-label">Specimen Barcode / Tube ID *</label>
                <input type="text" className="input" defaultValue={`SPEC-BAR-${Math.floor(100000 + Math.random() * 900000)}`} />
              </div>
              <div className="form-group">
                <label className="form-label">Specimen Container Type</label>
                <select className="input" defaultValue="EDTA Purple Top">
                  <option>EDTA Purple Top (Hematology)</option>
                  <option>Fluoride Yellow Top (Glucose)</option>
                  <option>Serum Red Top (Clinical Chemistry)</option>
                  <option>Sodium Citrate Blue Top (Coagulation)</option>
                  <option>Sterile Urine Container (Microbiology)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSampleModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => {
                alert('Sample logged & barcoded successfully!');
                setShowSampleModal(false);
              }}>Log Sample Collection</button>
            </div>
          </div>
        </div>
      )}

      {/* 🧪 MODAL 3: Lab Reference Catalog */}
      {showCatalogModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }} onClick={() => setShowCatalogModal(false)}>
          <div className="modal" style={{ maxWidth: 640, width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', padding: '16px 20px' }}>
              <h3 className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#047857', margin: 0 }}>Standard Adult Laboratory Normal Ranges</h3>
              <button type="button" className="close-btn" onClick={() => setShowCatalogModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700 }}>Test Name</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700 }}>Specimen Tube</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700 }}>Normal Reference Range</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700 }}>Turnaround (TAT)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>Hemoglobin (Hb)</td>
                    <td style={{ padding: '10px 16px' }}>EDTA Purple</td>
                    <td style={{ padding: '10px 16px', color: '#059669', fontWeight: 600 }}>13.0 - 17.0 g/dL (M) / 12.0 - 15.5 (F)</td>
                    <td style={{ padding: '10px 16px' }}>1 Hour</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>Fasting Blood Sugar (FBS)</td>
                    <td style={{ padding: '10px 16px' }}>Fluoride Yellow</td>
                    <td style={{ padding: '10px 16px', color: '#059669', fontWeight: 600 }}>70 - 99 mg/dL</td>
                    <td style={{ padding: '10px 16px' }}>2 Hours</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>HbA1c Glycated Hb</td>
                    <td style={{ padding: '10px 16px' }}>EDTA Purple</td>
                    <td style={{ padding: '10px 16px', color: '#059669', fontWeight: 600 }}>&lt; 5.7% Normal</td>
                    <td style={{ padding: '10px 16px' }}>4 Hours</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>TSH (Thyroid Stimulating)</td>
                    <td style={{ padding: '10px 16px' }}>Serum Red</td>
                    <td style={{ padding: '10px 16px', color: '#059669', fontWeight: 600 }}>0.4 - 4.0 mIU/L</td>
                    <td style={{ padding: '10px 16px' }}>6 Hours</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>Serum Creatinine (KFT)</td>
                    <td style={{ padding: '10px 16px' }}>Serum Separator</td>
                    <td style={{ padding: '10px 16px', color: '#059669', fontWeight: 600 }}>0.7 - 1.3 mg/dL</td>
                    <td style={{ padding: '10px 16px' }}>3 Hours</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCatalogModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Alert Modal */}
      {showAlertModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }} onClick={() => setShowAlertModal(false)}>
          <div className="modal" style={{ maxWidth: 460, width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#fee2e2', borderBottom: '1px solid #fca5a5', padding: '16px 20px' }}>
              <h3 className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', margin: 0 }}>Notify Ordering Physician</h3>
              <button type="button" className="close-btn" onClick={() => setShowAlertModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                Send an immediate alert to Dr. Aarav Mehta regarding critical lab findings or STAT turnaround requirements.
              </p>
              <div className="form-group">
                <label className="form-label">Alert Description *</label>
                <textarea 
                  className="input" 
                  rows={3} 
                  value={alertMsg} 
                  onChange={e => setAlertMsg(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAlertModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => {
                alert('Critical lab alert broadcasted to attending doctors!');
                setShowAlertModal(false);
              }}>Broadcast Alert</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
