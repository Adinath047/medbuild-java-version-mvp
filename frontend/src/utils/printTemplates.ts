// client/src/utils/printTemplates.ts
// Shared print helpers — open a styled popup window and trigger browser print
import { useAuthStore } from '../store/authStore';
import { jsPDF } from 'jspdf';

const BRAND = {
  name:    'Medicos Hospital',
  address: 'LAN Ward, Main Building',
  phone:   '+91-XXXX-XXXXXX',
  tagline: 'Compassionate Care · Advanced Medicine',
};

function openPrintWindow(html: string) {
  // Remove any stale print frame from a previous call
  const stale = document.getElementById('__medicos_print_frame__');
  if (stale) stale.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__medicos_print_frame__';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { alert('Could not open print view. Please try again.'); return; }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for iframe content (fonts, images) to load before printing
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Clean up after print dialog closes (generous timeout for slow dialogs)
      setTimeout(() => iframe.remove(), 2000);
    }, 150);
  };
}

// ─────────────────────────────────────────────────────────────
// PRESCRIPTION SLIP
// ─────────────────────────────────────────────────────────────
export function printPrescriptionSlip(opts: {
  doctor:    { name: string; role: string; qualification?: string; regNo?: string; letterhead?: string; signatureImage?: string };
  patient:   { name: string; uhid: string; age?: number; sex?: string; blood_group?: string; allergies?: string[] | string };
  medicines: Array<{ name: string; strength?: string; dose: string; frequency: string; duration: string; instructions?: string; composition?: string }>;
  advice?:   string;
  followUp?: string;
  weight?:   string;
  slipToken: string;
  prePrinted?: boolean;

  // Clinical / SOAP parameters (matching the uploaded image)
  vitals?: { bp?: string; pulse?: string; height?: string; weight?: string; bmi?: string };
  complaints?: string[];
  history?: string;
  investigations?: string;
  diagnosis?: string;
  examination?: string;

  // Print settings
  showDiagnosisOnPrint?: boolean;
  showInvestigationsOnPrint?: boolean;
  showVitalsOnPrint?: boolean;

  // Layout calibration parameters
  printMarginTop?: number;
  printMarginBottom?: number;
  printMarginLeftRight?: number;
  printFontSize?: number;
  printLetterheadFullBleed?: boolean;
  isCalibrationTest?: boolean;
}) {
  const {
    doctor, patient, medicines, advice, followUp, weight, slipToken, prePrinted,
    vitals, complaints, history, investigations, diagnosis, examination
  } = opts;

  // Safe boolean coercion function
  const toBool = (val: any): boolean => {
    if (val === null || val === undefined) return true;
    return val === true || val === 1 || val === '1' || val === 'true';
  };

  const showDiagnosisOnPrint = toBool(opts.showDiagnosisOnPrint);
  const showInvestigationsOnPrint = toBool(opts.showInvestigationsOnPrint);
  const showVitalsOnPrint = toBool(opts.showVitalsOnPrint);

  const user = useAuthStore.getState().user;
  const printLetterheadFullBleed = opts.printLetterheadFullBleed !== undefined ? opts.printLetterheadFullBleed : (localStorage.getItem('print_letterhead_full_bleed_' + user?.id) === 'true');
  const printMarginTop = opts.printMarginTop !== undefined ? Number(opts.printMarginTop) : 35;
  const printMarginBottom = opts.printMarginBottom !== undefined ? Math.max(15, Number(opts.printMarginBottom)) : 15;
  const printMarginLeftRight = opts.printMarginLeftRight !== undefined ? Number(opts.printMarginLeftRight) : 18;
  const printFontSize = opts.printFontSize !== undefined ? Number(opts.printFontSize) : 11;
  const isCalibrationTest = !!opts.isCalibrationTest;

  const headerHeight = Math.max(0, printMarginTop - 5); // 5mm top page safety margin buffer

  // ── Calibration Sheet Print Output ──
  if (isCalibrationTest) {
    openPrintWindow(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Rx Layout Calibration Page</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family: 'Inter', 'Noto Sans', sans-serif; color:#0f172a; background:#fff; font-size:${printFontSize}pt; }
  @page {
    size: A4;
    margin-top: 5mm;
    margin-bottom: ${printMarginBottom}mm;
    margin-left: ${printLetterheadFullBleed ? '0mm' : `${printMarginLeftRight}mm`};
    margin-right: ${printLetterheadFullBleed ? '0mm' : `${printMarginLeftRight}mm`};
  }
  .page {
    width: 100%;
    height: ${297 - 5 - printMarginBottom}mm;
    display: flex;
    flex-direction: column;
    border: 1.5px dashed #ef4444; /* Dotted red boundary line matches margins exactly */
    box-sizing: border-box;
  }
  .header-zone {
    height: ${headerHeight}mm;
    width: 100%;
    background: #fef2f2;
    border-bottom: 1.5px dashed #ef4444; /* Exactly printMarginTop mm from top edge of page */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #b91c1c;
    font-weight: 700;
    font-size: ${printFontSize}pt;
    padding: 10px;
    text-align: center;
  }
  .content-zone {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .info-title {
    font-size: ${printFontSize + 2}pt;
    font-weight: bold;
    color: #ef4444;
    text-transform: uppercase;
    margin-bottom: 12px;
    border-bottom: 2px solid #ef4444;
    padding-bottom: 6px;
  }
  .metric-row {
    margin-bottom: 8px;
    font-size: ${printFontSize + 1}pt;
  }
  .metric-row strong {
    color: #0f172a;
  }
  .ruler-text {
    margin-top: 20px;
    line-height: 1.6;
    color: #334155;
    font-size: ${printFontSize}pt;
  }
</style>
</head><body>
<div class="page">
  <div class="header-zone">
    <div>TOP HEADER SPACE / BLANK ZONE: ${printMarginTop} mm</div>
    <div style="font-weight: 500; font-size: ${printFontSize - 1.5}pt; margin-top: 4px;">
      (${headerHeight} mm inside printable area + 5 mm page margin)
    </div>
  </div>
  
  <div class="content-zone">
    <div class="info-title">Layout Calibration Sheet</div>
    
    <div class="metric-row"><strong>Target Margins:</strong></div>
    <div class="metric-row">• Top Margin (Blank Space): <strong>${printMarginTop} mm</strong> (from top paper edge to content boundary line)</div>
    <div class="metric-row">• Left/Right Margin: <strong>${printMarginLeftRight} mm</strong> (from side paper edges to dashed border)</div>
    <div class="metric-row">• Bottom Margin: <strong>${printMarginBottom} mm</strong> (from bottom paper edge to dashed border)</div>
    <div class="metric-row">• Body Font Size: <strong>${printFontSize} pt</strong></div>
    
    <div class="ruler-text">
      <p><strong>Instructions for Calibration:</strong></p>
      <p>1. Take a physical ruler and measure the printed margins on this paper.</p>
      <p>2. Verify if the distance from the top of the paper to the line below the red header zone matches your configured <strong>${printMarginTop} mm</strong>.</p>
      <p>3. Verify if the side margins (distance from the paper edges to the dashed border) match your configured <strong>${printMarginLeftRight} mm</strong>.</p>
      <p>4. Verify if the distance from the bottom of the paper to the bottom dashed border matches your configured <strong>${printMarginBottom} mm</strong>.</p>
      <p>5. If any boundary does not align, adjust the corresponding settings slider in Settings page and print another sheet.</p>
    </div>
    
    <div style="margin-top: auto; padding-top: 15px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: ${printFontSize - 1}pt; color: #64748b;">
      <span>Calibration test print — Medbuild Records</span>
      <span>A4 Baseline (210mm × 297mm)</span>
    </div>
  </div>
</div>
</body></html>`);
    return;
  }

  const rawAllergies = patient.allergies;
  let allergiesArray: string[] = [];
  if (Array.isArray(rawAllergies)) {
    allergiesArray = rawAllergies;
  } else if (typeof rawAllergies === 'string') {
    try {
      const parsed = JSON.parse(rawAllergies);
      if (Array.isArray(parsed)) {
        allergiesArray = parsed;
      } else if (parsed) {
        allergiesArray = [parsed];
      }
    } catch {
      allergiesArray = rawAllergies ? [rawAllergies] : [];
    }
  }

  function getDosagePattern(dose: string, freq: string, inst: string): string {
    const f = (freq || '').toLowerCase();
    const d = (dose || '').toLowerCase();
    const i = (inst || '').toLowerCase();
    
    let unit = 'tab';
    if (d.includes('cap')) unit = 'cap';
    else if (d.includes('tsp') || d.includes('spoon') || d.includes('susp') || d.includes('ml')) unit = 'ml';
    else if (d.includes('syr') || d.includes('liquid')) unit = 'ml';
    
    if (dose.includes('-')) return dose;
    
    if (f.includes('twice') || f.includes('twice a day') || f === 'twice' || f.includes('bd') || f.includes('b.i.d.')) {
      return `1 - 0 - 1 (${unit})`;
    }
    if (f.includes('thrice') || f.includes('thrice a day') || f === 'thrice' || f.includes('tds') || f.includes('t.i.d.')) {
      return `1 - 1 - 1 (${unit})`;
    }
    if (f.includes('four times') || f.includes('qid') || f.includes('q.i.d.')) {
      return `1 - 1 - 1 - 1 (${unit})`;
    }
    if (f.includes('once') || f.includes('once daily') || f.includes('once a day') || f === 'once' || f.includes('od') || f.includes('o.d.')) {
      if (i.includes('morning') || i.includes('sakal') || i.includes('सकाळी') || i.includes('empty stomach') || i.includes('breakfast')) {
        return `1 - 0 - 0 (${unit})`;
      }
      if (i.includes('afternoon') || i.includes('dupari') || i.includes('दुपारी') || i.includes('lunch')) {
        return `0 - 1 - 0 (${unit})`;
      }
      if (i.includes('night') || i.includes('ratri') || i.includes('रात्री') || i.includes('bedtime') || i.includes('dinner')) {
        return `0 - 0 - 1 (${unit})`;
      }
      return `1 - 0 - 0 (${unit})`;
    }
    
    if (i.includes('morning') || i.includes('sakal') || i.includes('सकाळी')) {
      return `1 - 0 - 0 (${unit})`;
    }
    if (i.includes('afternoon') || i.includes('dupari') || i.includes('दुपारी')) {
      return `0 - 1 - 0 (${unit})`;
    }
    if (i.includes('night') || i.includes('ratri') || i.includes('रात्री') || i.includes('bedtime')) {
      return `0 - 0 - 1 (${unit})`;
    }
    
    const doseNum = d.match(/([\d.]+)/)?.[1] || '1';
    return `${doseNum} (${unit})`;
  }

  // Helper inside printer logic to calculate quantities
  function _calculateTotalQty(dose: string, freq: string, dur: string): number | string {
    function _dDays(du: string): number | null {
      const d = du.toLowerCase();
      if (d === 'ongoing') return null;
      const mm = d.match(/(\d+)\s*month/); if (mm) return parseInt(mm[1]) * 30;
      const dm = d.match(/(\d+)\s*day/);   if (dm) return parseInt(dm[1]);
      const wm = d.match(/(\d+)\s*week/);  if (wm) return parseInt(wm[1]) * 7;
      return null;
    }
    
    const d = _dDays(dur);
    if (d === null) return '—';

    // Check if dose has a pattern like 1-0-1 or 1 - 0 - 1
    const cleanedDose = dose.replace(/\s+/g, '');
    if (cleanedDose.includes('-')) {
      const parts = cleanedDose.split(/[^\d.]+/).map(parseFloat).filter(n => !isNaN(n));
      const dailySum = parts.reduce((sum, val) => sum + val, 0);
      return Math.ceil(dailySum * d);
    }
    
    // Fallback to legacy calculation
    function _fDay(fr: string): number | null {
      const f = fr.toLowerCase();
      if (f.includes('once') || f === 'at bedtime' || f.includes('morning')) return 1;
      if (f.includes('twice'))  return 2;
      if (f.includes('thrice') || f.includes('three') || f.includes('every 8h')) return 3;
      if (f.includes('every 6h'))  return 4;
      if (f.includes('weekly'))    return 1 / 7;
      if (f.includes('as needed') || f.includes('sos')) return null;
      if (f.includes('meals'))     return 3;
      return null;
    }
    function _dQty(doz: string): number | null {
      const frac = doz.toLowerCase().replace('½', '.5').replace('¼', '.25').replace('¾', '.75');
      const m = frac.match(/([\d.]+)/); if (!m) return null;
      const n = parseFloat(m[1]); return (isNaN(n) || n <= 0) ? null : n;
    }
    
    const u = _dQty(dose), f = _fDay(freq);
    if (u === null || f === null) return '—';
    return Math.ceil(u * f * d);
  }

  const date = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const time = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  const medRows = medicines.map((m, i) => {
    const formattedDose = getDosagePattern(m.dose, m.frequency, m.instructions || '');
    return `
    <tr>
      <td style="padding: 12px 6px; border-bottom: 1px solid #cbd5e1; vertical-align: top;">
        <strong style="font-size: ${printFontSize}pt; color: #0f172a;">${i + 1}) ${m.name}</strong>
        ${m.composition ? `<div style="font-size: ${printFontSize - 1.5}pt; color: #475569; margin-top: 4px; font-weight: 500;">Composition : ${m.composition}</div>` : ''}
        ${m.instructions ? `<div style="font-size: ${printFontSize - 1}pt; color: #0f172a; margin-top: 3px; font-weight: 700;">Timing : ${m.instructions}</div>` : ''}
      </td>
      <td style="padding: 12px 6px; border-bottom: 1px solid #cbd5e1; vertical-align: top; text-align: center; font-weight: 700; color: #334155; font-size: ${printFontSize - 0.5}pt;">
        ${formattedDose}
      </td>
      <td style="padding: 12px 6px; border-bottom: 1px solid #cbd5e1; vertical-align: top; text-align: center; font-weight: 600; color: #475569; font-size: ${printFontSize - 0.5}pt;">
        - ${m.frequency} ${m.duration ? `- ${m.duration}` : ''}
      </td>
      <td style="padding: 12px 6px; border-bottom: 1px solid #cbd5e1; vertical-align: top; text-align: right; font-weight: 700; color: #1e293b; font-size: ${printFontSize - 0.5}pt;">
        ${formattedDose && m.duration ? _calculateTotalQty(formattedDose, m.frequency, m.duration) : '—'}
      </td>
    </tr>`;
  }).join('');

  // Construct Vitals Row
  let vitalsHtml = '';
  if (showVitalsOnPrint && vitals && (vitals.bp || vitals.pulse || vitals.height || vitals.weight || vitals.bmi)) {
    const parts = [];
    if (vitals.bp) parts.push(`<strong>BP</strong> ${vitals.bp} mmHg`);
    if (vitals.pulse) parts.push(`<strong>Pulse</strong> ${vitals.pulse} bpm`);
    if (vitals.height) parts.push(`<strong>Height</strong> ${vitals.height} cm`);
    if (vitals.weight) parts.push(`<strong>Weight</strong> ${vitals.weight} kg`);
    if (vitals.bmi) parts.push(`<strong>BMI</strong> ${vitals.bmi} Kg/m2`);
    vitalsHtml = `<div class="vitals-row">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
  }

  const cleanDocName = (doctor.name || '').trim().replace(/^(dr\.?\s*)+/i, '');
  const doctorDisplayName = cleanDocName ? `Dr. ${cleanDocName}` : 'Doctor';

  // Clinic brand letterhead
  let headerHtml = '';
  if (prePrinted) {
    headerHtml = `<div style="height: ${headerHeight}mm; width: 100%; margin-bottom: 15px;"></div>`;
  } else if (doctor.letterhead) {
    if (doctor.letterhead.startsWith('data:image/')) {
      headerHtml = `<div style="width: 100%; height: ${headerHeight}mm; margin-bottom: 15px; border-bottom: 2px solid #0f172a; display: flex; align-items: center; overflow: hidden;">
                      <img src="${doctor.letterhead}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Letterhead" />
                    </div>`;
    } else {
      headerHtml = `<div style="width: 100%; height: ${headerHeight}mm; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; overflow: hidden; padding-left: ${printMarginLeftRight}mm; padding-right: ${printMarginLeftRight}mm;">
                      <div style="font-size: ${printFontSize}pt; font-weight: 600; line-height: 1.5; color: #0f172a; white-space: pre-wrap;">${doctor.letterhead}</div>
                      <div style="text-align: right; font-size: ${printFontSize - 1.5}pt; color: #334155; line-height: 1.4;">
                        <strong style="font-size: ${printFontSize}pt; color: #0f172a;">${doctorDisplayName}</strong><br/>
                        ${doctor.qualification || doctor.role}${doctor.regNo ? `<br/>Reg. No: ${doctor.regNo}` : ''}
                      </div>
                    </div>`;
    }
  } else {
    headerHtml = `<div class="header" style="height: ${headerHeight}mm; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; overflow: hidden; border-bottom: 2px solid #0f172a; padding-bottom: 10px; padding-left: ${printMarginLeftRight}mm; padding-right: ${printMarginLeftRight}mm;">
        <div>
          <div class="brand-name">${BRAND.name}</div>
          <div class="brand-sub">${BRAND.tagline}</div>
          <div class="brand-addr">${BRAND.address} &nbsp;|&nbsp; Tel: ${BRAND.phone}</div>
        </div>
        <div class="doctor-block">
          <div class="doctor-name">${doctorDisplayName}</div>
          <div class="doctor-sub">${doctor.qualification || doctor.role}${doctor.regNo ? `<br/>Reg. No: ${doctor.regNo}` : ''}</div>
        </div>
      </div>`;
  }

  openPrintWindow(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Rx — ${patient.name}</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family: 'Inter', 'Noto Sans', sans-serif; color:#0f172a; background:#fff; font-size:${printFontSize}pt; }
  .page { width:100%; display:block; }
  
  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:14px; border-bottom:2px solid #0f172a; }
  .brand-name { font-size:${printFontSize + 6}pt; font-weight:900; color:#0f172a; letter-spacing:-0.5px; }
  .brand-sub  { font-size:${printFontSize - 2}pt; color:#475569; margin-top:2px; }
  .brand-addr { font-size:${printFontSize - 2}pt; color:#475569; margin-top:4px; line-height:1.5; }
  .doctor-block { text-align:right; line-height:1.4; }
  .doctor-name  { font-size:${printFontSize + 2}pt; font-weight:800; color:#0f172a; }
  .doctor-sub   { font-size:${printFontSize - 1.5}pt; color:#475569; margin-top:2px; }
 
  /* Patient plain black & white print friendly header row */
  .pt-pill-row { margin:12px 0 16px; }
  .pt-pill { 
    background:transparent; 
    color:#0f172a; 
    padding:6px 0; 
    border-bottom:1.5px solid #0f172a; 
    border-top:1.5px solid #0f172a; 
    font-size:${printFontSize}pt; 
    font-weight:700; 
    display:flex; 
    justify-content:space-between; 
    align-items:center; 
    white-space:nowrap; 
    overflow:hidden; 
    width:100%; 
  }
 
  /* Vitals */
  .vitals-row { font-size:${printFontSize}pt; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:12px; margin-bottom:18px; word-spacing:1px; }
 
  /* SOAP notes styling */
  .soap-container { margin-bottom:22px; display:flex; flex-direction:column; gap:12px; }
  .soap-section { font-size:${printFontSize}pt; line-height:1.45; color:#1e293b; }
  .soap-title { font-family: 'Inter', sans-serif; font-weight:700; color:#0f172a; text-transform:uppercase; font-size:${printFontSize + 1.5}pt; }
  .soap-list { list-style:none; padding-left:2px; margin-top:2px; }
  .soap-list li { font-weight:600; color:#334155; }
  .soap-text { font-weight:600; color:#334155; white-space:pre-wrap; margin-top:2px; }
  .diag-val { text-decoration: underline; font-weight:800; color:#0f172a; }
  .exam-val { font-weight:600; color:#334155; }
 
  /* Rx symbol */
  .rx-line { display:flex; align-items:center; gap:10px; margin:20px 0 8px; }
  .rx-sym  { font-size:32px; font-style:italic; font-family:Georgia,serif; color:#0f172a; font-weight:700; line-height:1; }
 
  /* Rx Medicines table */
  .rx-table { width:100%; border-collapse:collapse; margin-top:10px; margin-bottom:25px; font-size:${printFontSize}pt; }
  .rx-table th { border-bottom:1.5px solid #475569; border-top:1.5px solid #475569; padding:10px 6px; font-size:${printFontSize - 1}pt; text-transform:uppercase; font-weight:800; color:#334155; }
  .rx-table td { padding:12px 6px; border-bottom:1px solid #cbd5e1; vertical-align:top; }
 
  /* Bottom instructions / follow-up */
  .advice-block { margin-top:24px; font-size:${printFontSize}pt; line-height:1.5; color:#0f172a; }
  .advice-item { margin-bottom:6px; font-weight:700; }
  .advice-lbl { font-family: 'Inter', sans-serif; font-weight:700; color:#0f172a; font-size:${printFontSize + 1.5}pt; }
  .advice-val { font-weight:600; color:#334155; }
 
  /* Signature & Footer */
  .sig-section { display:flex; justify-content:flex-end; margin-top:40px; padding-top:10px; }
  .sig-block { text-align:center; min-width:180px; }
  .sig-line { border-bottom:1.5px solid #475569; width:100%; margin-bottom:6px; height:10px; }
  .sig-name { font-size:${Math.max(printFontSize, 11)}pt; font-weight:bold; color:#0f172a; }
  .sig-sub { font-size:${printFontSize - 2}pt; color:#475569; font-weight:600; }
 
  .bottom-footer { margin-top:24px; border-top:1.5px solid #cbd5e1; padding-top:8px; display:flex; justify-content:space-between; align-items:center; }
  .powered { font-size:${printFontSize - 3}pt; color:#64748b; font-weight:600; }
 
  .print-content { padding-left: ${printMarginLeftRight}mm; padding-right: ${printMarginLeftRight}mm; display:block; }

  @page {
    size: A4;
    margin-top: 5mm;
    margin-bottom: ${printMarginBottom}mm;
    margin-left: 0mm;
    margin-right: 0mm;
  }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    .soap-container, .rx-table, .advice-block, .sig-section { page-break-inside: avoid !important; break-inside: avoid !important; }
  }
</style>
</head><body>
<div class="page">
  ${headerHtml}
 
  <div class="print-content">
    <div class="pt-pill-row">
      <div class="pt-pill">
        <span><strong>${patient.name}</strong> &nbsp;|&nbsp; UHID: ${patient.uhid || '—'} &nbsp;|&nbsp; ${patient.age ? `${patient.age}y` : ''} ${patient.sex ? ` / ${patient.sex}` : ''}</span>
        <span>Date & Time: ${date} &nbsp; ${time}</span>
      </div>
    </div>
 
  ${allergiesArray.length > 0 ? `
  <div style="margin: -10px 0 15px; padding: 8px 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; color: #b91c1c; font-weight: bold; font-size: ${printFontSize - 0.5}pt; display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif;">
    Allergies: ${allergiesArray.join(', ')}
  </div>
  ` : ''}
 
  ${vitalsHtml}
 
  <div class="soap-container">
    ${complaints && complaints.length > 0 ? `
    <div class="soap-section">
      <span class="soap-title">Complaints:</span>
      <ul class="soap-list">
        ${complaints.map(c => `<li>• ${c}</li>`).join('')}
      </ul>
    </div>` : ''}
 
    ${showDiagnosisOnPrint && diagnosis ? `
    <div class="soap-section">
      <span class="soap-title">Diagnosis:</span>
      <span class="soap-text diag-val"> ${diagnosis}</span>
    </div>` : ''}
 
    ${examination ? `
    <div class="soap-section">
      <span class="soap-title">Systemic Examination:</span>
      <span class="soap-text exam-val"> ${examination}</span>
    </div>` : ''}
  </div>
 
  <div class="rx-line"><div class="rx-sym">℞</div></div>
 
  <table class="rx-table">
    <thead>
      <tr>
        <th style="width: 50%; text-align: left;">Medicine</th>
        <th style="width: 18%; text-align: center;">Dosage</th>
        <th style="width: 22%; text-align: center;">Freq. - Duration</th>
        <th style="width: 10%; text-align: right;">Qty</th>
      </tr>
    </thead>
    <tbody>${medRows}</tbody>
  </table>
 
  <div class="advice-block">
    ${advice ? `
    <div class="advice-item">
      <span class="advice-lbl">Advice:</span>
      <span class="advice-val"> ${advice}</span>
    </div>` : ''}
 
    ${showInvestigationsOnPrint && investigations && investigations.length > 0 ? `
    <div class="advice-item" style="margin-top: 6px;">
      <span class="advice-lbl">Investigations / Tests:</span>
      <span class="advice-val"> ${investigations}</span>
    </div>` : ''}
 
    ${followUp ? `
    <div class="advice-item" style="margin-top: 6px;">
      <span class="advice-lbl">Follow-up Date:</span>
      <span class="advice-val"> ${new Date(followUp).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })} (${new Date(followUp).toLocaleDateString('en-IN', { weekday: 'long' })})</span>
    </div>` : ''}
  </div>
 
  <div class="sig-section">
    <div class="sig-block">
      <div style="height: 48px; display: flex; align-items: center; justify-content: center;">
        ${doctor.signatureImage ? `<img src="${doctor.signatureImage}" style="max-height: 44px;" alt="Signature" />` : ''}
      </div>
      <div class="sig-line"></div>
      <div class="sig-name">${doctorDisplayName}</div>
      ${doctor.qualification ? `<div class="sig-sub">${doctor.qualification}</div>` : ''}
      ${doctor.regNo ? `<div class="sig-sub">Reg. No: ${doctor.regNo}</div>` : ''}
    </div>
  </div>
 
  <div class="bottom-footer">
    <div style="font-size: ${printFontSize - 3}pt; color: #475569; line-height: 1.3;">
      <span>DPDP Act 2023 & ABDM Compliant EMR</span>
    </div>
    <div class="powered" style="text-align: right;">
      <span>Powered by Medicos EMR</span><br/>
      <span style="font-size: ${printFontSize - 3.5}pt; color: #94a3b8;">Rotstruck Pvt Ltd</span>
    </div>
  </div>
</div>
</body></html>`);
}


// ─────────────────────────────────────────────────────────────
// BILLING INVOICE
// ─────────────────────────────────────────────────────────────
export function printInvoice(opts: {
  invoice:   { id: string; invoice_number?: string; created_at: string; payment_mode: string; payment_status: string };
  patient:   { name: string; uhid?: string; phone?: string };
  items:     Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
  totals:    { total: number; discount: number; net: number; paid: number };
  billedBy?: string;
  notes?:    string;
}) {
  const { invoice, patient, items, totals, billedBy, notes } = opts;
  const date = new Date(invoice.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const invoiceNo = invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const outstanding = Math.max(0, totals.net - totals.paid);

  const statusColors: Record<string, string> = {
    Paid: '#10b981', Partial: '#f59e0b', Pending: '#ef4444', Waived: '#64748b',
  };
  const statusColor = statusColors[invoice.payment_status] || '#64748b';

  const itemRows = items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : ''}">
      <td class="num">${i + 1}</td>
      <td>${item.description}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">₹${item.unit_price.toFixed(2)}</td>
      <td class="right amount">₹${(item.quantity * item.unit_price).toFixed(2)}</td>
    </tr>`).join('');

  openPrintWindow(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice ${invoiceNo}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#0f172a; background:#fff; font-size:13px; }
  .page { padding:14mm 16mm 10mm; max-width:210mm; margin:0 auto; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:3px solid #1d4ed8; margin-bottom:18px; }
  .brand-name { font-size:22px; font-weight:900; color:#1d4ed8; }
  .brand-sub  { font-size:10px; color:#64748b; margin-top:2px; }
  .brand-addr { font-size:10.5px; color:#475569; margin-top:4px; line-height:1.7; }
  .inv-block  { text-align:right; }
  .inv-title  { font-size:24px; font-weight:900; text-transform:uppercase; color:#0f172a; letter-spacing:1px; }
  .inv-no     { font-size:13px; font-weight:700; color:#1d4ed8; margin-top:4px; font-family:monospace; }
  .inv-date   { font-size:11px; color:#64748b; margin-top:3px; }
  .inv-status { display:inline-block; margin-top:6px; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:700; color:#fff; background:${statusColor}; }

  /* Bill to */
  .bill-section { display:flex; gap:0; margin-bottom:18px; }
  .bill-to    { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px 0 0 8px; padding:12px 16px; }
  .pay-info   { width:200px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:0 8px 8px 0; border-left:none; padding:12px 16px; }
  .section-lbl { font-size:9.5px; font-weight:700; text-transform:uppercase; color:#94a3b8; letter-spacing:.7px; margin-bottom:6px; }
  .patient-name { font-size:15px; font-weight:800; }
  .patient-sub  { font-size:11px; color:#64748b; margin-top:2px; line-height:1.6; }
  .pay-row { display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px; }
  .pay-val { font-weight:700; }

  /* Items table */
  table { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:16px; }
  thead th { background:#1d4ed8; color:#fff; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.5px; font-weight:700; }
  thead th.right  { text-align:right; }
  thead th.center { text-align:center; }
  thead th.num    { width:28px; text-align:center; }
  tbody td { padding:8px 10px; border-bottom:1px solid #f1f5f9; }
  .row-even td { background:#fafafa; }
  .num    { text-align:center; color:#94a3b8; font-weight:600; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .amount { font-weight:700; }

  /* Totals */
  .totals { display:flex; justify-content:flex-end; margin-bottom:18px; }
  .totals-box { width:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .tot-row { display:flex; justify-content:space-between; padding:7px 14px; font-size:12.5px; border-bottom:1px solid #f1f5f9; }
  .tot-row:last-child { border-bottom:none; }
  .tot-row.net { background:#1d4ed8; color:#fff; font-weight:800; font-size:14px; }
  .tot-row.outstanding { background:#fef2f2; color:#ef4444; font-weight:700; }
  .tot-row.paid-row { background:#ecfdf5; color:#10b981; font-weight:700; }

  /* Footer */
  .footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed #cbd5e1; padding-top:14px; }
  .notes-box { flex:1; font-size:11.5px; color:#475569; }
  .notes-lbl { font-size:9.5px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:3px; }
  .sig-wrap { text-align:center; }
  .sig-line { border-bottom:1.5px solid #0f172a; width:150px; margin-bottom:5px; height:28px; }
  .sig-name { font-size:10.5px; color:#475569; font-weight:600; }
  .disclaimer { text-align:center; margin-top:16px; font-size:9.5px; color:#94a3b8; font-style:italic; }

  @page { size:A4; margin:0; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">${BRAND.name}</div>
      <div class="brand-sub">${BRAND.tagline}</div>
      <div class="brand-addr">${BRAND.address} &nbsp;|&nbsp; ${BRAND.phone}</div>
    </div>
    <div class="inv-block">
      <div class="inv-title">Invoice</div>
      <div class="inv-no">${invoiceNo}</div>
      <div class="inv-date">${date}</div>
      <div class="inv-status">${invoice.payment_status}</div>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-to">
      <div class="section-lbl">Bill To</div>
      <div class="patient-name">${patient.name}</div>
      <div class="patient-sub">
        ${patient.uhid ? `UHID: <strong>${patient.uhid}</strong>` : ''}
        ${patient.phone ? `&nbsp;|&nbsp; ${patient.phone}` : ''}
      </div>
    </div>
    <div class="pay-info">
      <div class="section-lbl">Payment</div>
      <div class="pay-row"><span>Mode</span><span class="pay-val">${invoice.payment_mode}</span></div>
      <div class="pay-row"><span>Status</span><span class="pay-val" style="color:${statusColor}">${invoice.payment_status}</span></div>
      ${billedBy ? `<div class="pay-row"><span>Billed by</span><span class="pay-val">${billedBy}</span></div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="num">#</th>
      <th>Description</th>
      <th class="center">Qty</th>
      <th class="right">Rate</th>
      <th class="right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="tot-row"><span>Subtotal</span><span>₹${totals.total.toFixed(2)}</span></div>
      ${totals.discount > 0 ? `<div class="tot-row"><span>Discount</span><span style="color:#10b981">− ₹${totals.discount.toFixed(2)}</span></div>` : ''}
      <div class="tot-row net"><span>Net Total</span><span>₹${totals.net.toFixed(2)}</span></div>
      <div class="tot-row paid-row"><span>Paid</span><span>₹${totals.paid.toFixed(2)}</span></div>
      ${outstanding > 0 ? `<div class="tot-row outstanding"><span>Outstanding</span><span>₹${outstanding.toFixed(2)}</span></div>` : ''}
    </div>
  </div>

  <div class="footer">
    <div class="notes-box">
      ${notes ? `<div class="notes-lbl">Notes</div><div>${notes}</div>` : ''}
    </div>
    <div class="sig-wrap">
      <div class="sig-line"></div>
      <div class="sig-name">Authorised Signatory</div>
    </div>
  </div>

  <div class="disclaimer">This is a computer-generated invoice. Thank you for choosing ${BRAND.name}.<br/>Powered by Rotstruck Pvt Ltd</div>
</div>
</body></html>`);
}

// ───────────────────────────────────────────────────────────────
// PHARMACY BILL (PHR-)
// ───────────────────────────────────────────────────────────────
export function printPharmacyBill(opts: {
  invoice:       { id: string; invoice_number?: string; created_at: string; payment_mode: string; payment_status: string };
  patient:       { name: string; uhid?: string };
  medicines:     Array<{ name: string; quantity: number; unit_price: number; amount?: number }>;
  totals:        { total: number; discount: number; net: number; paid: number };
  pharmacistName?: string;
  notes?:        string;
}) {
  const { invoice, patient, medicines, totals, pharmacistName, notes } = opts;
  const date = new Date(invoice.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const invoiceNo = invoice.invoice_number || `PHR-${invoice.id.slice(0,8).toUpperCase()}`;
  const outstanding = Math.max(0, totals.net - totals.paid);

  const statusColors: Record<string,string> = { Paid:'#10b981', Partial:'#f59e0b', Pending:'#ef4444' };
  const statusColor = statusColors[invoice.payment_status] || '#64748b';

  const medRows = medicines.map((m, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : ''}">
      <td class="num">${i + 1}</td>
      <td><strong>${m.name}</strong></td>
      <td class="center">${m.quantity}</td>
      <td class="right">₹${m.unit_price.toFixed(2)}</td>
      <td class="right amount">₹${(m.quantity * m.unit_price).toFixed(2)}</td>
    </tr>`).join('');

  openPrintWindow(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Pharmacy Bill ${invoiceNo}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#0f172a; background:#fff; font-size:13px; }
  .page { padding:12mm 16mm 10mm; max-width:210mm; margin:0 auto; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:3px solid #059669; margin-bottom:16px; }
  .brand-name { font-size:22px; font-weight:900; color:#059669; }
  .brand-sub  { font-size:10px; color:#64748b; margin-top:2px; }
  .brand-addr { font-size:10.5px; color:#475569; margin-top:4px; line-height:1.6; }
  .inv-block  { text-align:right; }
  .inv-title  { font-size:18px; font-weight:900; text-transform:uppercase; color:#0f172a; letter-spacing:1px; }
  .inv-no     { font-size:13px; font-weight:700; color:#059669; margin-top:4px; font-family:monospace; }
  .inv-date   { font-size:11px; color:#64748b; margin-top:3px; }
  .inv-status { display:inline-block; margin-top:6px; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:700; color:#fff; background:${statusColor}; }

  .pt-box { display:flex; gap:0; margin:0 0 16px; border:1px solid #a7f3d0; border-radius:6px; overflow:hidden; }
  .pt-cell { flex:1; padding:8px 12px; background:#ecfdf5; border-right:1px solid #a7f3d0; }
  .pt-cell:last-child { border-right:none; }
  .pt-lbl { font-size:9px; font-weight:700; text-transform:uppercase; color:#059669; letter-spacing:.6px; }
  .pt-val { font-size:13.5px; font-weight:700; color:#0f172a; margin-top:2px; }

  .phr-badge { display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 12px; font-size:11px; font-weight:700; color:#059669; margin-bottom:14px; }

  table { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:16px; }
  thead th { background:#059669; color:#fff; padding:7px 10px; text-align:left; font-size:10px; text-transform:uppercase; font-weight:700; letter-spacing:.5px; }
  thead th.right  { text-align:right; }
  thead th.center { text-align:center; }
  thead th.num    { width:28px; text-align:center; }
  tbody td { padding:7px 10px; border-bottom:1px solid #f1f5f9; }
  .row-even td { background:#f8fffe; }
  .num    { text-align:center; color:#94a3b8; font-weight:600; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .amount { font-weight:700; }

  .totals { display:flex; justify-content:flex-end; margin-bottom:16px; }
  .totals-box { width:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .tot-row { display:flex; justify-content:space-between; padding:7px 14px; font-size:12.5px; border-bottom:1px solid #f1f5f9; }
  .tot-row:last-child { border-bottom:none; }
  .tot-row.net  { background:#059669; color:#fff; font-weight:800; font-size:14px; }
  .tot-row.paid { background:#ecfdf5; color:#10b981; font-weight:700; }
  .tot-row.outs { background:#fef2f2; color:#ef4444; font-weight:700; }

  .footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed #cbd5e1; padding-top:14px; margin-top:4px; }
  .notes-box { flex:1; font-size:11.5px; color:#475569; }
  .notes-lbl { font-size:9.5px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:3px; }
  .sig-wrap { text-align:center; }
  .sig-line { border-bottom:1.5px solid #0f172a; width:150px; margin-bottom:5px; height:28px; }
  .sig-name { font-size:10.5px; color:#475569; font-weight:600; }
  .disclaimer { text-align:center; margin-top:16px; font-size:9.5px; color:#94a3b8; font-style:italic; }

  @page { size:A4; margin:0; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">${BRAND.name}</div>
      <div class="brand-sub">${BRAND.tagline}</div>
      <div class="brand-addr">${BRAND.address} &nbsp;|&nbsp; ${BRAND.phone}</div>
    </div>
    <div class="inv-block">
      <div class="inv-title">Pharmacy Bill</div>
      <div class="inv-no">${invoiceNo}</div>
      <div class="inv-date">${date}</div>
      <div class="inv-status">${invoice.payment_status}</div>
    </div>
  </div>

  <div class="pt-box">
    <div class="pt-cell"><div class="pt-lbl">Patient</div><div class="pt-val">${patient.name}</div></div>
    ${patient.uhid ? `<div class="pt-cell"><div class="pt-lbl">UHID</div><div class="pt-val">${patient.uhid}</div></div>` : ''}
    <div class="pt-cell"><div class="pt-lbl">Payment Mode</div><div class="pt-val">${invoice.payment_mode}</div></div>
    ${pharmacistName ? `<div class="pt-cell"><div class="pt-lbl">Dispensed By</div><div class="pt-val">${pharmacistName}</div></div>` : ''}
  </div>

  <div class="phr-badge">Pharmacy Dispensing Bill</div>

  <table>
    <thead><tr>
      <th class="num">#</th>
      <th>Medicine</th>
      <th class="center">Qty</th>
      <th class="right">Rate</th>
      <th class="right">Amount</th>
    </tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="tot-row"><span>Subtotal</span><span>₹${totals.total.toFixed(2)}</span></div>
      ${totals.discount > 0 ? `<div class="tot-row"><span>Discount</span><span style="color:#10b981">− ₹${totals.discount.toFixed(2)}</span></div>` : ''}
      <div class="tot-row net"><span>Net Total</span><span>₹${totals.net.toFixed(2)}</span></div>
      <div class="tot-row paid"><span>Paid</span><span>₹${totals.paid.toFixed(2)}</span></div>
      ${outstanding > 0 ? `<div class="tot-row outs"><span>Outstanding</span><span>₹${outstanding.toFixed(2)}</span></div>` : ''}
    </div>
  </div>

  <div class="footer">
    <div class="notes-box">
      ${notes ? `<div class="notes-lbl">Notes</div><div>${notes}</div>` : ''}
    </div>
    <div class="sig-wrap">
      <div class="sig-line"></div>
      <div class="sig-name">Pharmacist Signature</div>
    </div>
  </div>

  <div class="disclaimer">This is a computer-generated pharmacy bill — ${BRAND.name}. Keep for your records.<br/>Powered by Rotstruck Pvt Ltd</div>
</div>
</body></html>`);
}

// ───────────────────────────────────────────────────────────────
// VECTOR PDF INVOICE DOWNLOAD (A4)
// ───────────────────────────────────────────────────────────────
export function downloadInvoicePDF(opts: {
  invoice: {
    id: string;
    invoice_number?: string;
    created_at: string;
    bill_type?: string;
    payment_mode: string;
    payment_status: string;
    gross_amount?: number;
    total_amount?: number;
    discount?: number;
    tax?: number;
    net_amount: number;
    paid_amount: number;
    balance_due?: number;
    notes?: string;
    doctor_name?: string;
    payment_history?: Array<{
      id?: string;
      date?: string;
      amount?: number;
      payment_mode?: string;
      received_by?: string;
      notes?: string;
    }>;
  };
  patient: {
    name: string;
    uhid?: string;
    phone?: string;
  };
  items: Array<{
    category?: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount?: number;
  }>;
  billedBy?: string;
  notes?: string;
}) {
  const { invoice, patient, items, billedBy, notes } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const invoiceNo = invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(invoice.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const grossTotal = invoice.gross_amount ?? invoice.total_amount ?? items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discount = invoice.discount || 0;
  const netAmount = invoice.net_amount ?? Math.max(0, grossTotal - discount);
  const paidAmount = invoice.paid_amount || 0;
  const balanceDue = invoice.balance_due ?? Math.max(0, netAmount - paidAmount);

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(BRAND.name.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${BRAND.address}  |  ${BRAND.phone}`, 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', 196, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`# ${invoiceNo}`, 196, 18, { align: 'right' });

  // Invoice & Patient Metadata Box
  let y = 33;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 28, 2, 2, 'FD');

  // Left column: Patient
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLED TO (PATIENT)', 18, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(patient.name || 'Patient', 18, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`UHID: ${patient.uhid || '—'}   |   Phone: ${patient.phone || '—'}`, 18, y + 19);
  if (invoice.doctor_name) {
    doc.text(`Doctor: Dr. ${invoice.doctor_name.replace(/^Dr\.\s*/i, '')}`, 18, y + 24);
  }

  // Right column: Invoice meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INVOICE DETAILS', 120, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${dateStr}`, 120, y + 12);
  doc.text(`Type: ${invoice.bill_type === 'bed_stay' ? 'IPD Bed Stay' : (invoice.bill_type === 'pharmacy' ? 'Pharmacy' : 'OPD Services')}`, 120, y + 17);
  doc.text(`Payment Mode: ${invoice.payment_mode || 'Cash'}`, 120, y + 22);

  const statusColor = invoice.payment_status === 'Paid' ? [16, 185, 129] : (invoice.payment_status === 'Partial' ? [245, 158, 11] : [239, 68, 68]);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(`Status: ${invoice.payment_status.toUpperCase()}`, 120, y + 27);

  // Items Table Header
  y += 34;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 5.5);
  doc.text('CATEGORY / SERVICE DESCRIPTION', 30, y + 5.5);
  doc.text('QTY', 128, y + 5.5, { align: 'center' });
  doc.text('RATE (INR)', 155, y + 5.5, { align: 'right' });
  doc.text('AMOUNT (INR)', 192, y + 5.5, { align: 'right' });

  // Table Rows
  y += 8;
  const safeItems = items && items.length > 0 ? items : [
    { category: 'Services', description: invoice.notes || 'Hospital Consultation & Medical Care', quantity: 1, unit_price: netAmount, amount: netAmount }
  ];

  safeItems.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 8, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 8, 196, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), 18, y + 5.5);

    doc.setTextColor(15, 23, 42);
    const desc = item.description || 'Hospital Service';
    const truncatedDesc = desc.length > 46 ? desc.slice(0, 46) + '...' : desc;
    doc.text(truncatedDesc, 30, y + 5.5);

    doc.setTextColor(71, 85, 105);
    doc.text(String(item.quantity || 1), 128, y + 5.5, { align: 'center' });
    doc.text(Number(item.unit_price || 0).toFixed(2), 155, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const lineAmt = (item.amount ?? ((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)));
    doc.text(Number(lineAmt).toFixed(2), 192, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Financial Summary Box
  y += 4;
  const sumBoxX = 114;
  const sumBoxW = 82;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(sumBoxX, y, sumBoxW, 36, 1.5, 1.5, 'FD');

  let sy = y + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Gross Subtotal:', sumBoxX + 4, sy);
  doc.text(`INR ${Number(grossTotal).toFixed(2)}`, sumBoxX + sumBoxW - 4, sy, { align: 'right' });

  if (discount > 0) {
    sy += 5.5;
    doc.setTextColor(16, 185, 129);
    doc.text('Discount:', sumBoxX + 4, sy);
    doc.text(`- INR ${Number(discount).toFixed(2)}`, sumBoxX + sumBoxW - 4, sy, { align: 'right' });
  }

  sy += 6;
  doc.setFillColor(15, 23, 42);
  doc.rect(sumBoxX, sy - 4, sumBoxW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Net Total Payable:', sumBoxX + 4, sy + 1);
  doc.text(`INR ${Number(netAmount).toFixed(2)}`, sumBoxX + sumBoxW - 4, sy + 1, { align: 'right' });

  sy += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text('Amount Paid:', sumBoxX + 4, sy);
  doc.text(`INR ${Number(paidAmount).toFixed(2)}`, sumBoxX + sumBoxW - 4, sy, { align: 'right' });

  if (balanceDue > 0) {
    sy += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Outstanding Balance:', sumBoxX + 4, sy);
    doc.text(`INR ${Number(balanceDue).toFixed(2)}`, sumBoxX + sumBoxW - 4, sy, { align: 'right' });
  }

  // Notes & Remarks
  const notesText = notes || invoice.notes;
  if (notesText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTES & REMARKS:', 14, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(notesText, 92);
    doc.text(splitNotes, 14, y + 11);
  }

  // Payment History / Installments Table if present
  if (Array.isArray(invoice.payment_history) && invoice.payment_history.length > 1) {
    y = Math.max(y + 44, sy + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PAYMENT SETTLEMENT AUDIT TRAIL', 14, y);

    y += 4;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 6, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Date & Time', 18, y + 4.2);
    doc.text('Amount', 75, y + 4.2);
    doc.text('Mode', 110, y + 4.2);
    doc.text('Received By', 145, y + 4.2);

    y += 6;
    invoice.payment_history.forEach(txn => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const tDate = txn.date ? new Date(txn.date).toLocaleString('en-IN') : '—';
      doc.text(tDate, 18, y + 4);
      doc.text(`INR ${txn.amount}`, 75, y + 4);
      doc.text(txn.payment_mode || 'Cash', 110, y + 4);
      doc.text(txn.received_by || 'Cashier', 145, y + 4);
      y += 5;
    });
  }

  // Footer & Signature
  const footerY = 270;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, footerY, 196, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`This is a computer-generated official invoice from ${BRAND.name}. Powered by Rotstruck Pvt Ltd.`, 14, footerY + 6);
  if (billedBy) {
    doc.text(`Prepared By: ${billedBy}`, 14, footerY + 11);
  }

  doc.line(150, footerY + 14, 196, footerY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Authorised Signatory', 173, footerY + 18, { align: 'center' });

  // Save the document to client filesystem
  const filename = `Invoice_${invoiceNo}.pdf`;
  doc.save(filename);
}

// ───────────────────────────────────────────────────────────────
// CSV BILLING REPORT EXPORT
// ───────────────────────────────────────────────────────────────
export function exportBillingToCSV(bills: any[], patients: any[] = []) {
  if (!bills || bills.length === 0) {
    alert('No billing records available to export.');
    return;
  }

  const pMap = new Map<string, any>();
  patients.forEach(p => pMap.set(p.id, p));

  const headers = [
    'Invoice Number',
    'Date',
    'Patient Name',
    'UHID',
    'Phone',
    'Doctor Name',
    'Bill Type',
    'Gross Subtotal (INR)',
    'Discount (INR)',
    'Net Amount (INR)',
    'Paid Amount (INR)',
    'Balance Due (INR)',
    'Payment Mode',
    'Payment Status',
    'Particulars / Notes',
    'Billed By'
  ];

  const escapeCSV = (str: any) => {
    if (str == null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = bills.map(b => {
    const pat = pMap.get(b.patient_id);
    const pName = b.patient_name || pat?.name || 'Patient';
    const uhid = b.uhid || pat?.uhid || '—';
    const phone = b.patient_phone || pat?.phone || '—';
    const docName = b.doctor_name || '—';
    const date = b.created_at ? new Date(b.created_at).toISOString().split('T')[0] : '';
    const gross = b.gross_amount ?? b.total_amount ?? b.net_amount ?? 0;
    const disc = b.discount ?? 0;
    const net = b.net_amount ?? 0;
    const paid = b.paid_amount ?? 0;
    const due = b.balance_due ?? Math.max(0, net - paid);

    return [
      escapeCSV(b.invoice_number || b.id),
      escapeCSV(date),
      escapeCSV(pName),
      escapeCSV(uhid),
      escapeCSV(phone),
      escapeCSV(docName),
      escapeCSV(b.bill_type || 'OPD'),
      gross,
      disc,
      net,
      paid,
      due,
      escapeCSV(b.payment_mode || 'Cash'),
      escapeCSV(b.payment_status || 'Pending'),
      escapeCSV(b.notes || ''),
      escapeCSV(b.billed_by || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Medicos_Hospital_Billing_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

