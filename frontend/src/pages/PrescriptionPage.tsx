// client/src/pages/PrescriptionPage.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '../api/client';
import { db, markPending } from '../db/localDB';
import { useAuthStore } from '../store/authStore';
import { triggerSyncBroadcast } from '../sync/syncManager';
import { v4 as uuid } from 'uuid';
import { printPrescriptionSlip } from '../utils/printTemplates';
import { searchMedicines, findMedicineByName, MEDICINES, type Medicine } from '../utils/medicines';
import { jsPDF } from 'jspdf';
import { getSpecialtyCode, SPECIALTY_THEMES, SPECIALTY_TEMPLATES, getMedicineSpecialty } from '../utils/specialtyUtils';

// ── Allergy cross-check ───────────────────────────────────────────────
/**
 * Returns the matched allergy term if the drug (name + generics) conflicts
 * with any of the patient's known allergies, otherwise null.
 * Matching is case-insensitive and uses substring detection so
 * "Penicillin" allergy catches "Amoxicillin" (a penicillin antibiotic).
 */
function checkAllergyConflict(medName: string, allergies: string[], medicinesList: Medicine[]): string | null {
  if (!medName.trim() || allergies.length === 0) return null;

  // Gather all search terms: the drug name itself + all its brand/generic names
  const drug = medicinesList.find(m =>
    m.name.toLowerCase() === medName.toLowerCase() ||
    m.generics.some(g => g.toLowerCase() === medName.toLowerCase())
  );
  const terms = drug
    ? [drug.name, ...drug.generics, drug.category]
    : [medName];

  const termsLower = terms.map(t => t.toLowerCase());

  for (const allergy of allergies) {
    const a = allergy.toLowerCase().trim();
    if (!a) continue;
    // Check if any drug term contains the allergy keyword OR allergy keyword contains a drug term
    for (const t of termsLower) {
      if (t.includes(a) || a.includes(t.split(' ')[0])) {
        return allergy; // return original casing
      }
    }
  }
  return null;
}

const FREQ = ['Once daily','Twice daily','Thrice daily','Every 8h','Every 6h','At bedtime','Before meals','After meals','As needed','Weekly'];
const DUR  = ['1 day','3 days','5 days','7 days','10 days','14 days','1 month','2 months','3 months','Ongoing'];
const INST = ['After meals','Before meals','With meals','Empty stomach','At bedtime','In the morning','With warm water','With milk','Dissolve in water','As directed','Avoid in pregnancy','Avoid alcohol'];
const EMPTY_MED = { name:'', strength:'', dose:'1 tablet', frequency:'Once daily', duration:'7 days', instructions:'After meals', isFlagged: false };

// ── Tablet quantity calculator ─────────────────────────────────────────
/** How many times per day is a given frequency? */
function freqPerDay(freq: string): number | null {
  const f = freq.toLowerCase();
  if (f.includes('once') || f === 'at bedtime' || f.includes('morning')) return 1;
  if (f.includes('twice'))  return 2;
  if (f.includes('thrice') || f.includes('three')) return 3;
  if (f.includes('every 8h'))  return 3;
  if (f.includes('every 6h'))  return 4;
  if (f.includes('weekly'))    return 1 / 7;
  if (f.includes('as needed')) return null; // can't compute
  if (f.includes('before meals') || f.includes('after meals') || f.includes('with meals')) return 3; // assume 3 meals
  return null;
}

/** How many days does a duration string represent? */
function durationDays(dur: string): number | null {
  const d = dur.toLowerCase();
  if (d === 'ongoing') return null;
  const monthMatch = d.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1]) * 30;
  const dayMatch = d.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1]);
  return null;
}


// ── Shorthand Parser ───────────────────────────────────────────────────
function parseShorthand(text: string) {
  let remaining = text.trim();
  
  // 1. Extract Strength (e.g. 500mg, 500 mg, 1g, 2.5ml)
  let strength = '';
  const strengthRegex = /\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|%))\b/i;
  const strengthMatch = remaining.match(strengthRegex);
  if (strengthMatch) {
    strength = strengthMatch[1];
    remaining = remaining.replace(strengthMatch[0], '');
  }
  
  // 2. Extract Frequency abbreviation (od, bd, bid, tds, tid, qid, hs, sos, prn, pc, ac)
  let frequency = '';
  const freqRegex = /\b(od|bd|bid|tds|tid|qid|hs|sos|prn|pc|ac)\b/i;
  const freqMatch = remaining.match(freqRegex);
  if (freqMatch) {
    const abbreviation = freqMatch[1].toLowerCase();
    const mapping: Record<string, string> = {
      od: 'Once daily',
      bd: 'Twice daily',
      bid: 'Twice daily',
      tds: 'Thrice daily',
      tid: 'Thrice daily',
      qid: 'Every 6h',
      hs: 'At bedtime',
      sos: 'As needed',
      prn: 'As needed',
      pc: 'After meals',
      ac: 'Before meals'
    };
    frequency = mapping[abbreviation] || 'Once daily';
    remaining = remaining.replace(freqMatch[0], '');
  }
  
  // 3. Extract Duration (e.g. 5 days, 5d, 7 days, 1 month, 1m)
  let duration = '';
  const durRegex = /\b(\d+)\s*(day|days|d|wk|wks|week|weeks|month|months|m)\b/i;
  const durMatch = remaining.match(durRegex);
  if (durMatch) {
    const num = durMatch[1];
    const unit = durMatch[2].toLowerCase();
    if (unit.startsWith('d')) {
      duration = `${num} day${num !== '1' ? 's' : ''}`;
    } else if (unit.startsWith('w')) {
      const days = parseInt(num) * 7;
      duration = `${days} days`;
    } else if (unit.startsWith('m')) {
      duration = `${num} month${num !== '1' ? 's' : ''}`;
    }
    remaining = remaining.replace(durMatch[0], '');
  }
  
  // What is left is clean name
  let name = remaining.replace(/[,;.\-+]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  return { name, strength, frequency, duration };
}

/** Parse default dose from drug type to prevent 3500 quantity calculation bug */
function cleanDefaultDose(dose: string): string {
  if (!dose) return '1 tablet';
  const d = dose.trim().toLowerCase();
  
  // If it already starts with a digit or fraction (like "1", "1/2", "0.5", "1½", "½"), keep it
  if (/^[0-9½¼¾.]/.test(d)) {
    return dose;
  }
  
  // Special non-numeric defaults
  if (d === 'as directed' || d === 'as licensed') {
    return dose;
  }
  
  if (d.includes('tablet')) return '1 tablet';
  if (d.includes('capsule')) return '1 capsule';
  if (d.includes('injection') || d.includes('vial') || d.includes('ampoule') || d.includes('powder for')) return '1 injection';
  if (d.includes('drop')) return '2 drops';
  if (d.includes('syrup') || d.includes('suspension') || d.includes('liquid') || d.includes('ml')) return '5 ml';
  if (d.includes('cream') || d.includes('ointment') || d.includes('gel') || d.includes('topical')) return '1 application';
  if (d.includes('inhalation') || d.includes('spray') || d.includes('pessary') || d.includes('sachet')) return '1 unit';
  
  return '1 tablet'; // fallback
}

/** How many units per dose (e.g. "1 tablet" → 1, "1½" → 1.5, "2 tablets" → 2) */
function doseUnits(dose: string): number | null {
  const d = dose.toLowerCase();
  // fractions like 1½, ½
  const frac = d.replace('½', '.5').replace('¼', '.25').replace('¾', '.75');
  const match = frac.match(/([\d.]+)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Returns a display string for total tablets/units, or null if not computable */
function calcTotalQty(dose: string, freq: string, dur: string): { qty: number; label: string } | null {
  const units = doseUnits(dose);
  const fpd   = freqPerDay(freq);
  const days  = durationDays(dur);
  if (units === null || fpd === null || days === null) return null;
  const qty = Math.ceil(units * fpd * days);
  // Detect unit type from dose string
  const d = dose.toLowerCase();
  const unit = d.includes('capsule') ? 'capsule' : d.includes('ml') ? 'ml' : d.includes('drop') ? 'drops' : 'tablet';
  const plural = qty !== 1 ? `${unit}s` : unit;
  return { qty, label: `${qty} ${plural}` };
}

// Popular drugs shown when field is focused but empty
const POPULAR = ['Paracetamol','Amoxicillin','Azithromycin','Pantoprazole','Metformin','Amlodipine','Cetirizine','Ibuprofen','Atorvastatin','Omeprazole'];

// ── Highlight matched text ─────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background:'#fef08a', borderRadius:2, fontWeight:700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Drug search autocomplete ──────────────────────────────────────────
function MedAutocomplete({ value, onChange, onSelect, medicinesList }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (m: Medicine) => void;
  medicinesList: Medicine[];
}) {
  const [results, setResults]   = useState<Medicine[]>([]);
  const [popular, setPopular]   = useState<Medicine[]>([]);
  const [open, setOpen]         = useState(false);
  const [focused, setFocused]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const searchCache = useRef<Record<string, Medicine[]>>({});

  // Load popular/frequently-prescribed drugs dynamically
  useEffect(() => {
    async function loadFrequent() {
      try {
        const res = await apiClient.get('/medicines/frequent');
        if (res.data && res.data.length > 0) {
          setPopular(res.data);
        } else {
          // Fallback to static POPULAR suggestions
          const p = POPULAR.map(n => {
            const q = n.toLowerCase();
            return medicinesList.find(m =>
              m.name.toLowerCase() === q ||
              m.generics.some(g => g.toLowerCase() === q)
            );
          }).filter(Boolean) as Medicine[];
          setPopular(p);
        }
      } catch (err) {
        // Fallback to static POPULAR suggestions
        const p = POPULAR.map(n => {
          const q = n.toLowerCase();
          return medicinesList.find(m =>
            m.name.toLowerCase() === q ||
            m.generics.some(g => g.toLowerCase() === q)
          );
        }).filter(Boolean) as Medicine[];
        setPopular(p);
      }
    }

    if (medicinesList.length > 0) {
      loadFrequent();
    }
  }, [medicinesList]);

  // Update search results whenever value changes using backend search or offline fallback
  useEffect(() => {
    const qTrim = value.trim();
    if (qTrim.length < 2) {
      setResults([]);
      return;
    }

    // Check client-side query cache first
    const cached = searchCache.current[qTrim.toLowerCase()];
    if (cached) {
      setResults(cached);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await apiClient.get('/medicines/search', {
          params: { q: qTrim }
        });
        searchCache.current[qTrim.toLowerCase()] = res.data;
        setResults(res.data);
      } catch (err) {
        // Fallback to local filter if network fails or offline
        const q = qTrim.toLowerCase();
        const filtered = medicinesList.filter(m =>
          m.name.toLowerCase().includes(q) ||
          m.generics.some(g => g.toLowerCase().includes(q)) ||
          m.category.toLowerCase().includes(q)
        ).slice(0, 12);
        setResults(filtered);
      }
    }, 200);

    setFocused(0);
    return () => clearTimeout(handler);
  }, [value, medicinesList]);

  // Close on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${focused}"]`) as HTMLElement;
    if (el) el.scrollIntoView({ block:'nearest' });
  }, [focused]);

  const displayed = value.trim().length === 0 ? popular : results;
  const isPopular = value.trim().length === 0;

  function pick(m: Medicine) {
    onSelect(m);
    onChange(m.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open || displayed.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, displayed.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === 'Enter' && displayed[focused]) { e.preventDefault(); pick(displayed[focused]); }
    if (e.key === 'Escape')    { setOpen(false); }
    if (e.key === 'Tab' && displayed[focused]) { pick(displayed[focused]); }
  }

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input
        ref={inputRef}
        className="input"
        placeholder="Type drug name or brand… (e.g. Amox, Pan, Cetirizine)"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        autoComplete="off"
        spellCheck={false}
        style={{ borderRadius: '8px', border: '1px solid var(--border)', paddingRight: value ? 32 : undefined }}
      />
      {/* Clear button */}
      {value && (
        <button type="button"
          onClick={() => { onChange(''); setOpen(true); inputRef.current?.focus(); }}
          style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:14, lineHeight:1, padding:2 }}
        >✕</button>
      )}

      {/* Dropdown */}
      {open && (
        <div ref={listRef} style={{
          position:'absolute', top:'calc(100% + 3px)', left:0, right:0,
          background:'#fff', border:'1px solid #d1d5db',
          borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
          zIndex:300, maxHeight:300, overflowY:'auto',
          animation:'fadeIn 0.08s ease',
        }}>
          {/* Section header */}
          <div style={{ padding:'6px 12px 4px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #f3f4f6', background:'#fafafa', borderRadius:'10px 10px 0 0' }}>
            {isPopular ? '⭐ Common drugs — or type to search' : `${displayed.length} result${displayed.length !== 1 ? 's' : ''} for "${value}"`}
          </div>

          {displayed.length === 0 && value.length > 0 ? (
            <div style={{ padding:'16px 12px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              No drugs found for "<strong>{value}</strong>"<br/>
              <span style={{ fontSize:11 }}>You can still type the name manually.</span>
            </div>
          ) : (
            displayed.map((m, i) => (
              <div key={m.name}
                data-idx={i}
                onMouseDown={e => { e.preventDefault(); pick(m); }}
                onMouseEnter={() => setFocused(i)}
                style={{
                  padding:'9px 12px', cursor:'pointer',
                  background: i === focused ? '#f0fdf4' : '#fff',
                  borderBottom: i < displayed.length - 1 ? '1px solid #f3f4f6' : 'none',
                  transition:'background 0.08s',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontWeight:600, fontSize:13, color: i === focused ? '#0d9488' : '#111827' }}>
                      <Highlight text={m.name} query={isPopular ? '' : value} />
                    </span>
                    <span style={{ fontSize:10, background: i===focused?'#d1fae5':'#f3f4f6', color: i===focused?'#065f46':'#6b7280', padding:'1px 7px', borderRadius:20, fontWeight:600, border: i===focused?'1px solid #a7f3d0':'1px solid #e5e7eb' }}>{m.category}</span>
                  </div>
                  <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0 }}>{m.strengths[0]}</span>
                </div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
                  {m.generics.slice(0, 4).map((g, gi) => (
                    <span key={g}>
                      {gi > 0 && <span style={{ margin:'0 3px', color:'#d1d5db' }}>·</span>}
                      <Highlight text={g} query={isPopular ? '' : value} />
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


// ── Medicine row ──────────────────────────────────────────────────────
function MedRow({ med, index, onUpdate, onDelete, canDelete, patientAllergies, medicinesList }: {
  med: any; index: number;
  onUpdate: (k: string, v: string) => void;
  onDelete: () => void; canDelete: boolean;
  patientAllergies: string[];
  medicinesList: Medicine[];
}) {
  const drugInfo = medicinesList.find(m =>
    m.name.toLowerCase() === med.name.toLowerCase() ||
    m.generics.some(g => g.toLowerCase() === med.name.toLowerCase())
  );
  const allergyMatch = checkAllergyConflict(med.name, patientAllergies, medicinesList);

  function handleSelect(m: Medicine) {
    onUpdate('name', m.name);
    if (m.strengths.length > 0) onUpdate('strength', m.strengths[0]);
    onUpdate('dose', m.defaultDose);
  }

  return (
    <div style={{
      background: allergyMatch ? '#fff5f5' : 'var(--surface)',
      border: `1px solid ${allergyMatch ? '#fca5a5' : 'var(--border)'}`,
      borderRadius:'var(--radius-lg)', padding:'14px 16px',
      display:'flex', flexDirection:'column', gap:10,
      transition:'border-color 0.2s, background 0.2s',
    }}>
      {/* Row header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
          Drug {index + 1}
        </span>
        {canDelete && (
          <button type="button" onClick={onDelete} style={{
            background:'none', border:'none', cursor:'pointer', color:'var(--danger)',
            fontSize:13, padding:'2px 6px', borderRadius:4
          }}>✕ Remove</button>
        )}
      </div>

      {/* Name + Strength + Dose */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
        <div className="form-group">
          <label className="form-label">Medicine Name *</label>
          <MedAutocomplete
            value={med.name}
            onChange={v => onUpdate('name', v)}
            onSelect={handleSelect}
            medicinesList={medicinesList}
          />
          {allergyMatch && (
            <div style={{
              marginTop:6, padding:'8px 12px',
              background:'#fee2e2', border:'1px solid #fca5a5',
              borderRadius:8, display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:'#991b1b' }}>
                  Allergy Conflict Detected
                </div>
                <div style={{ fontSize:11, color:'#7f1d1d', marginTop:2 }}>
                  Patient is allergic to <strong>{allergyMatch}</strong>.
                  This drug may cause an adverse reaction. Verify before prescribing.
                </div>
              </div>
            </div>
          )}
          
          {med.isFlagged && (
            <div style={{
              marginTop:6, padding:'8px 12px',
              background:'#fffbeb', border:'1px solid #fde68a',
              borderRadius:8, display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:'#b45309' }}>
                  Shorthand Parsing Unclear
                </div>
                <div style={{ fontSize:11, color:'#78350f', marginTop:2 }}>
                  Could not fully parse this line. Please review, select/type the name and fill details manually.
                </div>
              </div>
            </div>
          )}
          {!allergyMatch && drugInfo && (
            <div style={{ fontSize:10, color:'var(--primary)', marginTop:2 }}>
              ✓ {drugInfo.category} · Brands: {drugInfo.generics.slice(0,3).join(', ')}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Strength</label>
          {drugInfo && drugInfo.strengths.length > 1 ? (
            <select className="input" value={med.strength} onChange={e => onUpdate('strength', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}>
              <option value="">— select —</option>
              {drugInfo.strengths.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <input className="input" placeholder="e.g. 500mg" value={med.strength} onChange={e => onUpdate('strength', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
          )}
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Dose</label>
          <input className="input" placeholder="1 tablet" value={med.dose} onChange={e => onUpdate('dose', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
        </div>
      </div>

      {/* Frequency + Duration + Instructions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Frequency</label>
          <select className="input" value={med.frequency} onChange={e => onUpdate('frequency', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}>
            {FREQ.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Duration</label>
          <select className="input" value={med.duration} onChange={e => onUpdate('duration', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}>
            {DUR.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Instructions</label>
          <select className="input" value={med.instructions||''} onChange={e => onUpdate('instructions', e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}>
            <option value="">— select —</option>
            {INST.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* Total quantity calculation */}
      {(() => {
        const result = calcTotalQty(med.dose, med.frequency, med.duration);
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 12px', borderRadius: 8,
            background: result ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${result ? '#86efac' : '#e2e8f0'}`,
          }}>
            <span style={{ fontSize: 13 }}>🧮</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total quantity to dispense:
            </span>
            {result ? (
              <strong style={{ fontSize: 13, color: '#15803d', fontFamily: 'monospace' }}>
                {result.label}
              </strong>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                — (set dose, frequency &amp; duration to auto-calculate)
              </span>
            )}
            {result && (
              <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
                {med.dose} × {freqPerDay(med.frequency)}×/day × {durationDays(med.duration)} days
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── PDF Generator ──────────────────────────────────────────────────────
function generatePrescriptionPDF(opts: {
  doctor: { name: string; role: string; letterhead?: string };
  patient: { name: string; uhid: string; age?: number; sex?: string; blood_group?: string };
  medicines: Array<{ name: string; strength?: string; dose: string; frequency: string; duration: string; instructions?: string }>;
  advice?: string;
  followUp?: string;
  weight?: string;
  slipToken: string;
  prePrinted?: boolean;
}): string {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  let y = margin;

  // 1. Header (Letterhead or Brand)
  doc.setTextColor(15, 23, 42); // slate-900

  if (opts.prePrinted) {
    // Leave 30mm blank space for pre-printed letterhead, and print date/time on the right
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    doc.text(`${dateStr}  ${timeStr}`, pageWidth - margin, y + 2, { align: 'right' });
    y += 30; // 30mm spacing height
  } else if (opts.doctor.letterhead) {
    if (opts.doctor.letterhead.startsWith('data:image/')) {
      try {
        doc.addImage(opts.doctor.letterhead, 'PNG', margin, y, 100, 20);
      } catch (e) {
        console.error('Failed to add letterhead image to PDF:', e);
      }
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      doc.text(`Dr. ${opts.doctor.name}`, pageWidth - margin, y + 2, { align: 'right' });
      doc.text(`${opts.doctor.role || 'Doctor'}`, pageWidth - margin, y + 6, { align: 'right' });
      doc.text(`${dateStr}  ${timeStr}`, pageWidth - margin, y + 10, { align: 'right' });
      y += 24;
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(opts.doctor.letterhead, pageWidth - margin * 2 - 40);
      doc.text(lines, margin, y + 2);
      
      // Add date/time on the right
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      doc.text(`Dr. ${opts.doctor.name}`, pageWidth - margin, y + 2, { align: 'right' });
      doc.text(`${opts.doctor.role || 'Doctor'}`, pageWidth - margin, y + 6, { align: 'right' });
      doc.text(`${dateStr}  ${timeStr}`, pageWidth - margin, y + 10, { align: 'right' });
      
      y += Math.max(lines.length * 5 + 4, 15);
    }
  } else {
    // Default brand header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(29, 78, 216); // blue-700
    doc.text('Medicos Hospital', margin, y + 3);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Compassionate Care . Advanced Medicine', margin, y + 7);
    doc.text('LAN Ward, Main Building | +91-XXXX-XXXXXX', margin, y + 10.5);

    // Doctor info on the right
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr. ${opts.doctor.name}`, pageWidth - margin, y + 2, { align: 'right' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${opts.doctor.role || 'Doctor'}`, pageWidth - margin, y + 6, { align: 'right' });
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(dateStr, pageWidth - margin, y + 9.5, { align: 'right' });

    y += 15;
  }

  // Draw separation line
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // 2. Patient Info Block
  doc.setFillColor(239, 246, 255); // light blue
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, pageWidth - margin * 2, 14, 'DF');

  doc.setTextColor(59, 130, 246);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PATIENT', margin + 4, y + 4.5);
  doc.text('UHID', margin + 60, y + 4.5);
  doc.text('AGE / SEX', margin + 110, y + 4.5);
  doc.text('BLOOD GROUP', margin + 145, y + 4.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(opts.patient.name, margin + 4, y + 9.5);
  doc.text(opts.patient.uhid || '--', margin + 60, y + 9.5);
  doc.text(`${opts.patient.age ?? '?'}y  ${opts.patient.sex ?? ''}`, margin + 110, y + 9.5);
  doc.text(opts.patient.blood_group || '--', margin + 145, y + 9.5);

  if (opts.weight) {
    // Add weight at the end
    doc.setFontSize(7);
    doc.setTextColor(59, 130, 246);
    doc.text('WEIGHT', margin + 165, y + 4.5);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(opts.weight, margin + 165, y + 9.5);
  }

  y += 20;

  // 3. Rx symbol
  doc.setFont('Times', 'italic');
  doc.setFontSize(28);
  doc.setTextColor(29, 78, 216);
  doc.text('Rx', margin, y);
  y += 4;

  // 4. Medicines Table Header
  doc.setFillColor(29, 78, 216);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('#', margin + 2, y + 4.5);
  doc.text('Medicine', margin + 8, y + 4.5);
  doc.text('Dose', margin + 70, y + 4.5);
  doc.text('Frequency', margin + 100, y + 4.5);
  doc.text('Duration', margin + 130, y + 4.5);
  doc.text('Qty', margin + 155, y + 4.5);
  doc.text('Instructions', margin + 167, y + 4.5);
  
  y += 7;

  // 5. Medicines List
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  opts.medicines.forEach((med, idx) => {
    // Alternating rows
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    }
    
    doc.setFont('Helvetica', 'bold');
    doc.text(`${idx + 1}`, margin + 2, y + 5.5);
    doc.text(med.name, margin + 8, y + 5.5);
    
    doc.setFont('Helvetica', 'normal');
    doc.text(med.dose, margin + 70, y + 5.5);
    doc.text(med.frequency, margin + 100, y + 5.5);
    doc.text(med.duration, margin + 130, y + 5.5);
    
    // Qty calculate
    const u = doseUnits(med.dose), f = freqPerDay(med.frequency), d = durationDays(med.duration);
    const qtyVal = (u !== null && f !== null && d !== null) ? Math.ceil(u * f * d) : '--';
    doc.setFont('Helvetica', 'bold');
    doc.text(String(qtyVal), margin + 155, y + 5.5);
    
    doc.setFont('Helvetica', 'normal');
    doc.text(med.instructions || '--', margin + 167, y + 5.5);
    
    y += 8;
  });

  y += 6;

  // 6. Doctor Advice Box
  if (opts.advice) {
    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(252, 211, 77); // amber-300
    
    // Auto-wrap advice text
    const adviceLines = doc.splitTextToSize(opts.advice, pageWidth - margin * 2 - 8);
    const boxHeight = adviceLines.length * 5 + 10;
    
    doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'DF');
    
    doc.setTextColor(180, 83, 9); // amber-700
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("DOCTOR'S INSTRUCTIONS", margin + 4, y + 5);
    
    doc.setTextColor(15, 23, 42);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(adviceLines, margin + 4, y + 10);
    
    y += boxHeight + 8;
  }

  // 7. Footer (Follow-up & Signature)
  y = Math.max(y, pageHeight - 45); // position near the bottom

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  if (opts.followUp) {
    const fDate = new Date(opts.followUp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Follow-up: `, margin, y);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.text(fDate, margin + 20, y);
  } else {
    doc.text('Next visit: _______________', margin, y);
  }

  // Signature line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - margin - 50, y + 4, pageWidth - margin, y + 4);
  
  doc.setTextColor(71, 85, 105);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Dr. ${opts.doctor.name} . Signature & Stamp`, pageWidth - margin - 25, y + 8, { align: 'center' });

  y += 15;

  // 8. Bottom Token & Disclaimer
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 45, 6, 'DF');
  
  doc.setTextColor(100, 116, 139);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Rx Token: ${opts.slipToken}`, margin + 3, y + 4);

  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('Computer-generated prescription. Valid only with doctor\'s signature & stamp.', pageWidth - margin, y + 4, { align: 'right' });

  // Output as base64 data URI
  const pdfOutput = doc.output('datauristring');
  return pdfOutput;
}

// ── Main component ────────────────────────────────────────────────────
export default function PrescriptionPage({ onNavigate, data }: { onNavigate:(p:string,d?:any)=>void; data?:any }) {
  const { user } = useAuthStore();
  const [patients, setPatients]     = useState<any[]>([]);
  const [patientId, setPatientId]   = useState(data?.patientId || '');
  const [patientSearch, setPatSearch] = useState('');
  const [patientWeight, setWeight]  = useState('');
  const [patientSummary, setPatientSummary] = useState<any>(null);

  useEffect(() => {
    if (!patientId) {
      setPatientSummary(null);
      setWeight('');
      setComplaints('');
      setHistory('');
      setRecentInvestigations('');
      setDiagnosis('');
      setExamination('');
      setSystolic('');
      setDiastolic('');
      setPulse('');
      setHeight('');
      return;
    }
    (async () => {
      try {
        const res = await apiClient.get(`/patients/${patientId}/summary`);
        setPatientSummary(res.data);
        const vit = res.data.latestVitals;
        const enc = res.data.encounters?.[0];
        
        if (vit) {
          if (vit.weight) setWeight(String(vit.weight));
          else setWeight('');
          if (vit.bp_systolic) setSystolic(String(vit.bp_systolic));
          else setSystolic('');
          if (vit.bp_diastolic) setDiastolic(String(vit.bp_diastolic));
          else setDiastolic('');
          if (vit.heart_rate) setPulse(String(vit.heart_rate));
          else setPulse('');
          if (vit.height) setHeight(String(vit.height));
          else setHeight('');
        } else {
          setWeight('');
          setSystolic('');
          setDiastolic('');
          setPulse('');
          setHeight('');
        }
        
        if (enc) {
          if (enc.chief_complaint) setComplaints(enc.chief_complaint);
          else setComplaints('');
          if (enc.history) setHistory(enc.history);
          else setHistory('');
          if (enc.recent_investigations) setRecentInvestigations(enc.recent_investigations);
          else if (enc.investigations) setRecentInvestigations(enc.investigations);
          else setRecentInvestigations('');
          
          if (enc.diagnosis) {
            try {
              const parsed = JSON.parse(enc.diagnosis);
              if (Array.isArray(parsed)) {
                setDiagnosis(parsed.map((d: any) => d.name || d.code || d).join(', '));
              } else {
                setDiagnosis(String(enc.diagnosis));
              }
            } catch {
              setDiagnosis(String(enc.diagnosis));
            }
          } else {
            setDiagnosis('');
          }
          if (enc.examination) setExamination(enc.examination);
          else setExamination('');
        } else {
          setComplaints('');
          setHistory('');
          setRecentInvestigations('');
          setDiagnosis('');
          setExamination('');
        }
      } catch (err) {
        console.error('Failed to load patient summary for print:', err);
      }
    })();
  }, [patientId]);
  const [advice, setAdvice]         = useState('');
  const [lastPrescription, setLastPrescription] = useState<any | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [shorthandText, setShorthandText] = useState('');
  const [listening, setListening] = useState(false);
  const [customCombos, setCustomCombos] = useState<any[]>([]);
  const [saveComboInputOpen, setSaveComboInputOpen] = useState(false);
  const [newComboName, setNewComboName] = useState('');
  const recognitionRef = useRef<any>(null);
  const [followUp, setFollowUp]     = useState('');

  // Clinical / SOAP states
  const [complaints, setComplaints] = useState('');
  const [history, setHistory] = useState('');
  const [recentInvestigations, setRecentInvestigations] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [examination, setExamination] = useState('');
  
  // Vitals states
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [height, setHeight] = useState('');

  const [meds, setMeds]             = useState([{ ...EMPTY_MED }]);
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState<any>(null);
  const [error, setError]           = useState('');
  const [allergyOverride, setAllergyOverride] = useState(false);
  const [prePrintedLetterhead, setPrePrintedLetterhead] = useState(false);
  const [dbMeds, setDbMeds]         = useState<Medicine[]>([]);
  const printAfterSaveRef           = useRef(false);

  const setMed = (i:number, k:string, v:string) => {
    setMeds(ms => ms.map((m,j) => j===i ? {...m,[k]:v} : m));
    setAllergyOverride(false); // reset override when medicines change
  };
  const addMed = () => setMeds(ms => {
    const lastMed = ms[ms.length - 1];
    const newMed = {
      ...EMPTY_MED,
      instructions: lastMed ? lastMed.instructions : 'After meals',
      duration: lastMed ? lastMed.duration : '7 days',
      frequency: lastMed ? lastMed.frequency : 'Once daily'
    };
    return [...ms, newMed];
  });
  const delMed = (i:number) => setMeds(ms => ms.filter((_,j) => j!==i));

  useEffect(() => {
    (async () => {
      try { const r = await apiClient.get('/patients',{params:{limit:500}}); setPatients(r.data.patients); }
      catch { setPatients(await db.patients.toArray()); }
    })();
  }, []);

  useEffect(() => {
    db.medicines
      .toArray()
      .then(records => {
        const active = records.filter(m => m.is_active !== 0);
        if (active.length > 0) {
          const mapped = active.map(m => ({
            name: m.name,
            generics: m.generics || [],
            strengths: m.strengths || [],
            defaultDose: m.default_dose || m.strengths[0] || '1 tablet',
            category: m.category || ''
          }));
          mapped.sort((a, b) => a.name.localeCompare(b.name));
          setDbMeds(mapped);
        }
      })
      .catch(err => {
        console.error('Failed to load medicines from IndexedDB:', err);
      });
  }, []);

  const medicinesList = useMemo(() => {
    const list = dbMeds.length > 0 ? dbMeds : MEDICINES;
    const mapped = list.map(m => ({
      ...m,
      defaultDose: cleanDefaultDose(m.defaultDose)
    }));

    const specialty = getSpecialtyCode(user?.specialization);
    if (specialty === 'General') return mapped;

    const targetSpec = specialty === 'Diabetology' ? 'Endocrinology' : specialty;

    return mapped
      .filter(m => {
        const medSpec = getMedicineSpecialty(m.category, m.name);
        if (medSpec === 'General') return true;
        return medSpec === targetSpec;
      })
      .sort((a, b) => {
        const medSpecA = getMedicineSpecialty(a.category, a.name);
        const medSpecB = getMedicineSpecialty(b.category, b.name);
        
        const isA = medSpecA === targetSpec;
        const isB = medSpecB === targetSpec;
        
        if (isA && !isB) return -1;
        if (!isA && isB) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [dbMeds, user?.specialization]);

  const filteredPatients = patientSearch
    ? patients.filter(p => p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || p.uhid?.includes(patientSearch) || p.phone?.includes(patientSearch))
    : patients;

  const selectedPatient = patients.find(p => p.id === patientId);

  // Parse allergies — stored as JSON string or already as array
  const patientAllergies: string[] = useMemo(() => {
    if (!selectedPatient) return [];
    const raw = selectedPatient.allergies;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    try { return JSON.parse(raw).filter(Boolean); } catch { return []; }
  }, [selectedPatient]);

  // Parse chronic conditions — stored as JSON string or already as array
  const patientConditions: string[] = useMemo(() => {
    if (!selectedPatient) return [];
    const raw = selectedPatient.chronic_conditions;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    try { return JSON.parse(raw).filter(Boolean); } catch { return []; }
  }, [selectedPatient]);

  // Compute which medicine rows have allergy conflicts
  const allergyConflicts = useMemo(() =>
    meds.map(m => checkAllergyConflict(m.name, patientAllergies, medicinesList)),
  [meds, patientAllergies, medicinesList]);
  const hasAllergyConflict = allergyConflicts.some(Boolean);

  const handleFavoriteClick = (fav: any) => {
    setMeds(ms => {
      const emptyIdx = ms.findIndex(m => !m.name.trim());
      const newMed = {
        name: fav.name,
        strength: fav.strength || '',
        dose: fav.dose || '1 tablet',
        frequency: fav.frequency || 'Once daily',
        duration: fav.duration || '7 days',
        instructions: fav.instructions || 'After meals',
        isFlagged: false
      };
      if (emptyIdx !== -1) {
        return ms.map((m, idx) => idx === emptyIdx ? newMed : m);
      } else {
        return [...ms, newMed];
      }
    });
  };

  const copyPreviousPrescription = () => {
    if (!lastPrescription || !lastPrescription.medicines) return;
    const clonedMeds = lastPrescription.medicines.map((m: any) => ({
      name: m.name || '',
      strength: m.strength || '',
      dose: m.dose || '1 tablet',
      frequency: m.frequency || 'Once daily',
      duration: m.duration || '7 days',
      instructions: m.instructions || 'After meals',
      isFlagged: false
    }));
    setMeds(clonedMeds);
    if (lastPrescription.advice) setAdvice(lastPrescription.advice);
  };

  const parseShorthandText = (text: string) => {
    return parseShorthand(text);
  };

  const parsedPreview = useMemo(() => {
    if (!shorthandText.trim()) return null;
    return parseShorthand(shorthandText);
  }, [shorthandText]);

  const commitShorthand = () => {
    if (!shorthandText.trim()) return;
    
    const lines = shorthandText.split('\n').map(l => l.trim()).filter(Boolean);
    const newMedsList: any[] = [];
    
    lines.forEach(line => {
      const parsed = parseShorthand(line);
      if (!parsed.name) return;
      
      const isClean = !!(parsed.strength || parsed.frequency || parsed.duration);
      const drugInfo = medicinesList.find(m => m.name.toLowerCase() === parsed.name.toLowerCase());
      const defaultDose = drugInfo ? cleanDefaultDose(drugInfo.defaultDose) : '1 tablet';
      
      newMedsList.push({
        name: isClean ? parsed.name : line,
        strength: parsed.strength || (drugInfo?.strengths[0] || ''),
        dose: defaultDose,
        frequency: parsed.frequency || 'Once daily',
        duration: parsed.duration || '7 days',
        instructions: 'After meals',
        isFlagged: !isClean
      });
    });
    
    if (newMedsList.length === 0) return;
    
    setMeds(ms => {
      const activeMeds = ms.filter(m => m.name.trim());
      return [...activeMeds, ...newMedsList];
    });
    
    setShorthandText('');
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-IN';

    rec.onstart = () => {
      setListening(true);
    };

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setShorthandText(text);
    };

    rec.onerror = (e: any) => {
      console.error(e);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const saveCustomCombo = async (name: string, medicineList: any[]) => {
    if (!user?.id || !name.trim()) return;
    try {
      const newCombo = {
        name,
        medicines: medicineList.map(m => ({
          name: m.name,
          strength: m.strength,
          dose: m.dose,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions
        })),
        isCustom: true
      };
      const updated = [...customCombos.filter((c: any) => c.name !== name), newCombo];
      await db.meta.put({ key: `doctor_combos_${user.id}`, value: JSON.stringify(updated) });
      setCustomCombos(updated);
    } catch (e) {
      console.error("Save custom combo error", e);
    }
  };

  const deleteCustomCombo = async (name: string) => {
    if (!user?.id) return;
    try {
      const updated = customCombos.filter((c: any) => c.name !== name);
      await db.meta.put({ key: `doctor_combos_${user.id}`, value: JSON.stringify(updated) });
      setCustomCombos(updated);
    } catch (e) {
      console.error("Delete custom combo error", e);
    }
  };

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if (!patientId) { setError('Please select a patient'); return; }
    if (meds.some(m => !m.name.trim())) { setError('All medicines need a name'); return; }

    // ── Allergy guard ─────────────────────────────────────────────────
    if (hasAllergyConflict && !allergyOverride) {
      const conflictNames = allergyConflicts
        .map((c, i) => c ? `${meds[i].name} (allergic to ${c})` : null)
        .filter(Boolean)
        .join(', ');
      const confirmed = window.confirm(
        `⚠️ ALLERGY CONFLICT\n\n` +
        `The following medicines may conflict with the patient's known allergies:\n` +
        `${conflictNames}\n\n` +
        `Do you want to override and save anyway?\n` +
        `(Only do this if you have clinically evaluated the risk.)`
      );
      if (!confirmed) return;
      setAllergyOverride(true);
    }
    // ─────────────────────────────────────────────────────────────────

    setSaving(true); setError('');
    const now = new Date().toISOString();
    const id  = uuid();
    const slipToken = uuid().replace(/-/g,'').slice(0,12).toUpperCase();

    try {
      // 1. Auto-save vitals if entered
      let vitalsRes = null;
      if (systolic || diastolic || pulse || height || patientWeight) {
        try {
          const vPayload = {
            patient_id: patientId,
            bp_systolic: systolic ? parseInt(systolic) : null,
            bp_diastolic: diastolic ? parseInt(diastolic) : null,
            heart_rate: pulse ? parseInt(pulse) : null,
            height: height ? parseFloat(height) : null,
            weight: patientWeight ? parseFloat(patientWeight) : null,
          };
          const vRes = await apiClient.post('/vitals', vPayload);
          vitalsRes = vRes.data;
        } catch (vErr) {
          console.error('Failed to auto-save vitals from prescription:', vErr);
        }
      }

      // 2. Auto-save encounter if SOAP details entered
      let encounterId = null;
      if (complaints || history || recentInvestigations || diagnosis || examination) {
        try {
          const ePayload = {
            patient_id: patientId,
            encounter_type: 'OPD',
            chief_complaint: complaints || null,
            history: history || null,
            recent_investigations: recentInvestigations || null,
            diagnosis: diagnosis ? [{ name: diagnosis }] : [],
            examination: examination || null,
            advice: advice || null,
            follow_up_date: followUp || null,
          };
          const eRes = await apiClient.post('/encounters', ePayload);
          encounterId = eRes.data.id;
        } catch (eErr) {
          console.error('Failed to auto-save encounter from prescription:', eErr);
        }
      }

      // 3. Save prescription
      const payload: any = {
        id, hospital_id: user?.hospitalId||'hsp-001',
        patient_id: patientId, doctor_id: user?.id,
        encounter_id: encounterId,
        medicines: meds.map(m => ({...m, name:m.name.trim()})),
        advice: advice||null, follow_up_date: followUp||null,
        patient_weight: patientWeight||null, slip_token: slipToken,
        created_by_role: user?.role||'doctor', created_at: now,
        allergy_override: hasAllergyConflict && allergyOverride, // log the override
      };

      const res = await apiClient.post('/prescriptions', payload);
      await db.prescriptions.put({ ...res.data, _syncStatus: 'synced' });
      setSuccess(res.data);
      triggerSyncBroadcast();
      
      // Generate PDF
      const pdfBase64 = generatePrescriptionPDF({
        doctor: { name: user?.name ?? 'Doctor', role: user?.role ?? '', letterhead: user?.letterhead },
        patient: {
          name: selectedPatient?.name ?? '—',
          uhid: selectedPatient?.uhid ?? '—',
          age: selectedPatient?.age,
          sex: selectedPatient?.sex,
          blood_group: selectedPatient?.blood_group
        },
        medicines: meds.map(m => ({ ...m, name: m.name.trim() })),
        advice: advice || undefined,
        followUp: followUp || undefined,
        weight: patientWeight || undefined,
        slipToken: slipToken,
        prePrinted: prePrintedLetterhead,
      });

      // Upload PDF to patient-uploads
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      await apiClient.post('/patient-uploads', {
        patient_id: patientId,
        title: `Prescription — ${dateStr}`,
        file_url: pdfBase64,
        file_type: 'application/pdf',
        notes: `Automatically saved prescription PDF. Token: ${slipToken}`,
      });

      if (printAfterSaveRef.current) {
        const hNum = parseFloat(height);
        const wNum = parseFloat(patientWeight);
        const bmiVal = (hNum > 0 && wNum > 0) ? (wNum / ((hNum / 100) ** 2)).toFixed(2) : undefined;

        printPrescriptionSlip({
          doctor:  { 
            name: user?.name ?? 'Doctor', 
            role: user?.role ?? '', 
            letterhead: user?.letterhead, 
            signatureImage: (user as any)?.signature,
            qualification: user?.qualification || undefined,
            regNo: user?.registrationNumber || undefined
          },
          patient: {
            name: selectedPatient?.name ?? '—',
            uhid: selectedPatient?.uhid ?? '—',
            age: selectedPatient?.age,
            sex: selectedPatient?.sex,
            blood_group: selectedPatient?.blood_group,
            allergies: patientAllergies
          },
          medicines: res.data.medicines || meds.map(m => ({ ...m, name: m.name.trim() })),
          advice,
          followUp,
          weight: patientWeight || undefined,
          slipToken: res.data.slip_token || slipToken,
          prePrinted: prePrintedLetterhead,
          vitals: (systolic || diastolic || pulse || height || patientWeight) ? {
            bp: systolic && diastolic ? `${systolic}/${diastolic}` : undefined,
            pulse: pulse || undefined,
            height: height || undefined,
            weight: patientWeight || undefined,
            bmi: bmiVal
          } : undefined,
          complaints: complaints ? complaints.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
          history: history || undefined,
          investigations: recentInvestigations || undefined,
          diagnosis: diagnosis || undefined,
          examination: examination || undefined,
          showDiagnosisOnPrint: user?.showDiagnosisOnPrint,
          showInvestigationsOnPrint: user?.showInvestigationsOnPrint,
          showVitalsOnPrint: user?.showVitalsOnPrint,
          printMarginTop: user?.printMarginTop,
          printMarginBottom: user?.printMarginBottom,
          printMarginLeftRight: user?.printMarginLeftRight,
          printFontSize: user?.printFontSize
        });
      }
    } catch (err) {
      console.error('Failed to save prescription or upload PDF:', err);
      
      let offlineEncId = uuid();
      if (complaints || history || recentInvestigations || diagnosis || examination) {
        const ePayload = {
          id: offlineEncId,
          hospital_id: user?.hospitalId||'hsp-001',
          patient_id: patientId,
          doctor_id: user?.id || 'doc-001',
          encounter_type: 'OPD',
          chief_complaint: complaints || undefined,
          history: history || undefined,
          recent_investigations: recentInvestigations || undefined,
          diagnosis: diagnosis ? [{ name: diagnosis }] : [],
          examination: examination || undefined,
          status: 'Active',
          updated_at: now,
          created_at: now,
          _syncStatus: 'pending' as const
        };
        await db.encounters.put(ePayload);
      }

      const payload: any = {
        id, hospital_id: user?.hospitalId||'hsp-001',
        patient_id: patientId, doctor_id: user?.id,
        encounter_id: offlineEncId,
        medicines: meds.map(m => ({ ...m, name: m.name.trim() })),
        advice: advice||null, follow_up_date: followUp||null,
        patient_weight: patientWeight||null, slip_token: slipToken,
        created_by_role: user?.role||'doctor', created_at: now,
        allergy_override: hasAllergyConflict && allergyOverride,
      };

      await markPending(db.prescriptions, 'create', payload);
      await db.prescriptions.put(payload);
      setSuccess(payload);
      triggerSyncBroadcast();

      if (printAfterSaveRef.current) {
        const hNum = parseFloat(height);
        const wNum = parseFloat(patientWeight);
        const bmiVal = (hNum > 0 && wNum > 0) ? (wNum / ((hNum / 100) ** 2)).toFixed(2) : undefined;

        printPrescriptionSlip({
          doctor:  { 
            name: user?.name ?? 'Doctor', 
            role: user?.role ?? '', 
            letterhead: user?.letterhead, 
            signatureImage: (user as any)?.signature,
            qualification: user?.qualification || undefined,
            regNo: user?.registrationNumber || undefined
          },
          patient: {
            name: selectedPatient?.name ?? '—',
            uhid: selectedPatient?.uhid ?? '—',
            age: selectedPatient?.age,
            sex: selectedPatient?.sex,
            blood_group: selectedPatient?.blood_group,
            allergies: patientAllergies
          },
          medicines: meds.map(m => ({ ...m, name: m.name.trim() })),
          advice,
          followUp,
          weight: patientWeight || undefined,
          slipToken: slipToken,
          prePrinted: prePrintedLetterhead,
          vitals: (systolic || diastolic || pulse || height || patientWeight) ? {
            bp: systolic && diastolic ? `${systolic}/${diastolic}` : undefined,
            pulse: pulse || undefined,
            height: height || undefined,
            weight: patientWeight || undefined,
            bmi: bmiVal
          } : undefined,
          complaints: complaints ? complaints.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
          history: history || undefined,
          investigations: recentInvestigations || undefined,
          diagnosis: diagnosis || undefined,
          examination: examination || undefined,
          showDiagnosisOnPrint: user?.showDiagnosisOnPrint,
          showInvestigationsOnPrint: user?.showInvestigationsOnPrint,
          showVitalsOnPrint: user?.showVitalsOnPrint,
          printMarginTop: user?.printMarginTop,
          printMarginBottom: user?.printMarginBottom,
          printMarginLeftRight: user?.printMarginLeftRight,
          printFontSize: user?.printFontSize
        });
      }
    } finally { setSaving(false); }
  }

  function printSlip() {
    if (!success) return;
    const patient = patients.find((p: any) => p.id === patientId);
    const hNum = parseFloat(height);
    const wNum = parseFloat(patientWeight);
    const bmiVal = (hNum > 0 && wNum > 0) ? (wNum / ((hNum / 100) ** 2)).toFixed(2) : undefined;

    printPrescriptionSlip({
      doctor:  { 
        name: user?.name ?? 'Doctor', 
        role: user?.role ?? '', 
        letterhead: user?.letterhead, 
        signatureImage: (user as any)?.signature,
        qualification: user?.qualification || undefined,
        regNo: user?.registrationNumber || undefined
      },
      patient: { name: patient?.name ?? '—', uhid: patient?.uhid ?? '—', age: patient?.age, sex: patient?.sex, blood_group: patient?.blood_group, allergies: patientAllergies },
      medicines: success.medicines, advice, followUp,
      weight: patientWeight, slipToken: success.slip_token,
      prePrinted: prePrintedLetterhead,
      vitals: (systolic || diastolic || pulse || height || patientWeight) ? {
        bp: systolic && diastolic ? `${systolic}/${diastolic}` : undefined,
        pulse: pulse || undefined,
        height: height || undefined,
        weight: patientWeight || undefined,
        bmi: bmiVal
      } : undefined,
      complaints: complaints ? complaints.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
      history: history || undefined,
      investigations: recentInvestigations || undefined,
      diagnosis: diagnosis || undefined,
      examination: examination || undefined,
      showDiagnosisOnPrint: user?.showDiagnosisOnPrint,
      showInvestigationsOnPrint: user?.showInvestigationsOnPrint,
      showVitalsOnPrint: user?.showVitalsOnPrint,
      printMarginTop: user?.printMarginTop,
      printMarginBottom: user?.printMarginBottom,
      printMarginLeftRight: user?.printMarginLeftRight,
      printFontSize: user?.printFontSize
    });
  }

  function printDraftSlip() {
    const patient = patients.find((p: any) => p.id === patientId);
    const hNum = parseFloat(height);
    const wNum = parseFloat(patientWeight);
    const bmiVal = (hNum > 0 && wNum > 0) ? (wNum / ((hNum / 100) ** 2)).toFixed(2) : undefined;

    printPrescriptionSlip({
      doctor:  { 
        name: user?.name ?? 'Doctor', 
        role: user?.role ?? '', 
        letterhead: user?.letterhead, 
        signatureImage: (user as any)?.signature,
        qualification: user?.qualification || undefined,
        regNo: user?.registrationNumber || undefined
      },
      patient: { name: patient?.name ?? '—', uhid: patient?.uhid ?? '—', age: patient?.age, sex: patient?.sex, blood_group: patient?.blood_group, allergies: patientAllergies },
      medicines: meds.map(m => ({
        name: m.name.trim(),
        strength: m.strength || '',
        dose: m.dose || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
        instructions: m.instructions || '',
        composition: (m as any).composition || ''
      })),
      advice,
      followUp,
      weight: patientWeight,
      slipToken: 'DRAFT',
      prePrinted: prePrintedLetterhead,
      vitals: (systolic || diastolic || pulse || height || patientWeight) ? {
        bp: systolic && diastolic ? `${systolic}/${diastolic}` : undefined,
        pulse: pulse || undefined,
        height: height || undefined,
        weight: patientWeight || undefined,
        bmi: bmiVal
      } : undefined,
      complaints: complaints ? complaints.split('\n').map((line: string) => line.replace(/^[•*\s-]+/, '').trim()).filter(Boolean) : undefined,
      history: history || undefined,
      investigations: recentInvestigations || undefined,
      diagnosis: diagnosis || undefined,
      examination: examination || undefined,
      showDiagnosisOnPrint: user?.showDiagnosisOnPrint,
      showInvestigationsOnPrint: user?.showInvestigationsOnPrint,
      showVitalsOnPrint: user?.showVitalsOnPrint,
      printMarginTop: user?.printMarginTop,
      printMarginBottom: user?.printMarginBottom,
      printMarginLeftRight: user?.printMarginLeftRight,
      printFontSize: user?.printFontSize
    });
  }

  function printCalibrationTest() {
    printPrescriptionSlip({
      doctor: { name: user?.name ?? 'Doctor', role: user?.role ?? '' },
      patient: { name: 'Calibration Test', uhid: 'TEST-000' },
      medicines: [],
      slipToken: 'CALIBRATION',
      isCalibrationTest: true,
      printMarginTop: user?.printMarginTop,
      printMarginBottom: user?.printMarginBottom,
      printMarginLeftRight: user?.printMarginLeftRight,
      printFontSize: user?.printFontSize
    });
  }

  // ── Success screen ──
  if (success) return (
    <div className="card" style={{maxWidth:520, margin:'40px auto'}}>
      <div className="card-body" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:40,textAlign:'center'}}>
        <div style={{width:60,height:60,borderRadius:'50%',background:'#f0fdf4',border:'2px solid #86efac',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>✓</div>
        <div>
          <div style={{fontSize:17,fontWeight:700,color:'var(--text)'}}>Prescription Saved</div>
          <div style={{color:'var(--text-muted)',fontSize:13,marginTop:4}}>Token: <strong>{success.slip_token}</strong></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: '8px 0 12px' }}>
          <input type="checkbox" checked={prePrintedLetterhead} onChange={e => setPrePrintedLetterhead(e.target.checked)} />
          Print on pre-printed letterhead paper (leaves blank spacing at top)
        </label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
          <button className="btn btn-primary" onClick={printSlip}>🖨 Print Slip</button>
          <button className="btn btn-secondary" onClick={() => onNavigate('patient_detail', { patientId, ts: Date.now() })}>View Patient</button>
          <button className="btn btn-ghost" onClick={() => { setSuccess(null); setMeds([{...EMPTY_MED}]); setAdvice(''); setFollowUp(''); setPatientId(patientId); }}>+ New Prescription</button>
        </div>
      </div>
    </div>
  );

  const specialty = getSpecialtyCode(user?.specialization);
  const theme = SPECIALTY_THEMES[specialty] || SPECIALTY_THEMES.General;
  const templates = SPECIALTY_TEMPLATES[specialty] || [];

  const styleVariables = {
    '--primary': theme.primary,
    '--primary-light': theme.light,
    '--primary-mid': theme.border,
  } as React.CSSProperties;

  const applyTemplate = (t: any) => {
    const newMeds = t.medicines.map((m: any) => ({
      name: m.name,
      strength: m.strength,
      dose: m.dose,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions
    }));
    setMeds(newMeds);
    if (t.advice) setAdvice(t.advice);
    if (t.followUpDays) {
      const d = new Date();
      d.setDate(d.getDate() + t.followUpDays);
      setFollowUp(d.toISOString().slice(0, 10));
    }
  };

  return (
    <form onSubmit={submit} style={{ ...styleVariables, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: '#f0fdfa',
        border: '1px solid #ccfbf1',
        color: '#0f766e',
        padding: '6px 14px',
        borderRadius: '9999px',
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        width: 'fit-content',
        marginBottom: 4
      }}>
        <span>💊</span>
        <strong>New Prescription</strong>
        <span style={{ color: '#0d9488', opacity: 0.8 }}>•</span>
        <span style={{ color: '#111827', fontWeight: 600 }}>Written by Dr. {user?.name || 'Aarav Mehta'} {user?.specialization ? ` - ${user.specialization}` : ''}</span>
      </div>

      <div className="page-header" style={{ marginTop: 0 }}>
        <div>
          <div className="page-title">Write Prescription</div>
          <div className="page-sub">{meds.length} medicine{meds.length!==1?'s':''} added</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button type="button" className="btn btn-ghost" onClick={() => onNavigate('prescriptions')}>← Back</button>
          <button type="button" className="btn btn-secondary" onClick={printDraftSlip}>🖨 Print</button>
          <button type="submit" className="btn btn-primary" disabled={saving} onClick={() => { printAfterSaveRef.current = true; }}>
            {saving ? <><div className="spinner spinner-sm"/>Saving…</> : 'Save & Print'}
          </button>
        </div>
      </div>



      {error && <div className="alert alert-danger">{error}</div>}

      {/* Allergy conflict banner — shown when any medicine conflicts */}
      {hasAllergyConflict && (
        <div style={{
          padding:'12px 16px', borderRadius:10,
          background:'#fef2f2', border:'2px solid #f87171',
          display:'flex', alignItems:'flex-start', gap:12,
        }}>
          <span style={{ fontSize:20, flexShrink:0, lineHeight:1, marginTop:1 }}>🚨</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#991b1b', marginBottom:2 }}>
              Allergy Warning — Review Required
            </div>
            <div style={{ fontSize:12, color:'#7f1d1d', lineHeight:1.5 }}>
              {allergyConflicts.map((conflict, i) => conflict && (
                <span key={i} style={{ display:'block' }}>
                  • <strong>{meds[i].name || `Drug ${i+1}`}</strong> conflicts with known allergy: <strong>{conflict}</strong>
                </span>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:6 }}>
              You will be asked to confirm before saving. Check the individual drug rows below for details.
            </div>
          </div>
        </div>
      )}

      {/* Patient selection */}
      <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
          <div className="card-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)' }}>Patient Information</div>
        </div>
        <div className="card-body" style={{ padding: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)', marginBottom: 6 }}>Select Patient *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="search-bar" style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-light)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input placeholder="Name, UHID or phone…" value={patientSearch} onChange={e=>setPatSearch(e.target.value)} style={{ fontSize: 13.5 }} />
              </div>
              <select className="input" value={patientId} onChange={e=>setPatientId(e.target.value)} required style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '8px 12px', fontSize: 13.5 }}>
                <option value="">— Select patient —</option>
                {filteredPatients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.uhid})</option>)}
              </select>
            </div>
            {selectedPatient && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 14,
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 18px',
                transition: 'all 0.2s'
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                  border: '1px solid #bae6fd',
                  overflow: 'hidden'
                }}>
                  {selectedPatient.photo_url ? (
                    <img src={selectedPatient.photo_url} alt={selectedPatient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    selectedPatient.name ? selectedPatient.name[0].toUpperCase() : 'P'
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{selectedPatient.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>UHID-{selectedPatient.uhid}</span>
                    <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>{selectedPatient.age}y / {selectedPatient.sex}</span>
                    {selectedPatient.blood_group && (
                      <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>{selectedPatient.blood_group}</span>
                    )}
                  </div>
                  
                  {patientAllergies.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>⚠️ Allergic to:</span>
                      <span className="badge badge-danger" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>{patientAllergies.join(', ')}</span>
                    </div>
                  )}

                  {patientConditions.length > 0 && (
                    <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>
                      <strong>Chronic Conditions:</strong> {patientConditions.join(', ')}
                    </div>
                  )}
                  {selectedPatient.past_history && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-sec)', marginTop: 2 }}>
                      <strong>Past Medical History:</strong> {selectedPatient.past_history}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Notes / SOAP */}
      <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
          <div className="card-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)' }}>Clinical Notes (SOAP)</div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
          {/* Vitals Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>BP (Systolic / Diastolic)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="input" placeholder="SYS (e.g. 120)" value={systolic} onChange={e=>setSystolic(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <input className="input" placeholder="DIA (e.g. 80)" value={diastolic} onChange={e=>setDiastolic(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Pulse (bpm)</label>
              <input className="input" placeholder="e.g. 72" value={pulse} onChange={e=>setPulse(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Height (cm)</label>
              <input className="input" placeholder="e.g. 170" value={height} onChange={e=>setHeight(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Weight (kg)</label>
              <input className="input" placeholder="e.g. 70" value={patientWeight} onChange={e=>setWeight(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>BMI (Kg/m²)</label>
              <input className="input" disabled value={(() => {
                const hNum = parseFloat(height);
                const wNum = parseFloat(patientWeight);
                if (hNum > 0 && wNum > 0) {
                  return (wNum / ((hNum / 100) ** 2)).toFixed(2);
                }
                return '—';
              })()} style={{ background: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-sec)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Complaints</label>
              <textarea className="input" rows={2} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="e.g. POSITIONAL GIDDINESS ON/OFF since 5 Days&#10;FATIGUE/WEAKNESS" value={complaints} onChange={e=>setComplaints(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>History</label>
              <textarea className="input" rows={3} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Medical history, past illness, allergy details…" value={history} onChange={e=>setHistory(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Recent Investigations</label>
              <textarea className="input" rows={3} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="e.g. 08/06/26 FBS- 82 PPBS- 212 HB-10.1..." value={recentInvestigations} onChange={e=>setRecentInvestigations(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Diagnosis</label>
              <textarea className="input" rows={2} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="e.g. TYPE 2 DM, DPN, H/O TIA" value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Systemic Examination</label>
              <textarea className="input" rows={2} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="e.g. General :RHOMBERG-NEGATIVE" value={examination} onChange={e=>setExamination(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Medicines */}
      <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)' }}>Medicines</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addMed} style={{ borderRadius: '6px', fontSize: 12, padding: '4px 10px', height: 'auto', minHeight: 'auto' }}>+ Add Medicine</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
          {/* Favorites chips */}
          {favorites.length > 0 && (
            <div style={{ marginBottom: 12, background: 'var(--surface-alt)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⭐ Quick-Pick Favorites (Frequent Drugs)
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {favorites.map(fav => (
                  <button
                    key={fav.name}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      borderRadius: 16,
                      padding: '4px 12px',
                      fontSize: 12,
                      background: '#fff',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => handleFavoriteClick(fav)}
                  >
                    <strong>{fav.name}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({fav.strength || fav.dose})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shorthand / Voice Input Area */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✍️ Shorthand or Paste Notes (One drug per line)</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>e.g. Amoxicillin 500mg od 5 days</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <textarea
                className="input"
                rows={shorthandText.includes('\n') ? 3 : 1}
                style={{
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: '1.4',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  flex: 1
                }}
                placeholder="Type shorthand, paste lines of notes, or click 🎙️ voice..."
                value={shorthandText}
                onChange={e => setShorthandText(e.target.value)}
              />
              <button
                type="button"
                className={`btn ${listening ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  fontSize: 18,
                  padding: 0,
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  borderColor: listening ? 'red' : undefined,
                  animation: listening ? 'pulse 1.2s infinite' : undefined
                }}
                onClick={toggleListening}
                title={listening ? "Stop listening" : "Start Voice Input"}
              >
                {listening ? '🔴' : '🎙️'}
              </button>
            </div>
            
            {/* Real-time Shorthand / Bulk Paste Preview */}
            {parsedPreview && (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                background: 'var(--primary-light)',
                border: '1px dashed var(--primary-mid)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-sec)', lineHeight: 1.4 }}>
                  {shorthandText.trim().includes('\n') ? (
                    <div>
                      <strong>📝 Bulk Import Preview:</strong>
                      {shorthandText.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => {
                        const parsed = parseShorthand(line);
                        const isClean = !!(parsed.name && (parsed.strength || parsed.frequency || parsed.duration));
                        return (
                          <div key={idx} style={{ fontSize: 11.5, marginTop: 3 }}>
                            {isClean ? '✅' : '⚠️'} Line {idx+1}: {parsed.name || 'Unknown'} 
                            {parsed.strength && ` · ${parsed.strength}`}
                            {parsed.frequency && ` · ${parsed.frequency}`}
                            {parsed.duration && ` · ${parsed.duration}`}
                            {!isClean && <span style={{ color: 'var(--danger)', fontSize: 10.5 }}> (Flagged for manual review)</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <strong>🔍 Parsed:</strong> {parsedPreview.name || 'Drug name'}{' '}
                      {parsedPreview.strength && ` · ${parsedPreview.strength}`}{' '}
                      {parsedPreview.frequency && ` · ${parsedPreview.frequency}`}{' '}
                      {parsedPreview.duration && ` · ${parsedPreview.duration}`}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flexShrink: 0, marginLeft: 16 }}
                  onClick={commitShorthand}
                >
                  Confirm &amp; Add
                </button>
              </div>
            )}
          </div>

          {meds.map((m, i) => (
            <MedRow key={i} med={m} index={i}
              onUpdate={(k,v) => setMed(i,k,v)}
              onDelete={() => delMed(i)}
              canDelete={meds.length > 1}
              patientAllergies={patientAllergies}
              medicinesList={medicinesList}
            />
          ))}

          {/* Add Medicine & Save Custom Combo action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addMed}>+ Add Medicine</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saveComboInputOpen ? (
                <>
                  <input
                    className="input input-sm"
                    style={{ width: 220, height: 30, fontSize: 12 }}
                    placeholder="Combo Name (e.g. My Cough Set)"
                    value={newComboName}
                    onChange={e => setNewComboName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ height: 30, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      if (!newComboName.trim()) return;
                      saveCustomCombo(newComboName, meds);
                      setNewComboName('');
                      setSaveComboInputOpen(false);
                    }}
                  >
                    Save Set
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ height: 30, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setSaveComboInputOpen(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--primary)', padding: '4px 8px' }}
                  onClick={() => setSaveComboInputOpen(true)}
                  disabled={meds.some(m => !m.name.trim())}
                >
                  💾 Save current rows as combo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advice & Follow-up */}
      <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
          <div className="card-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)' }}>Instructions & Follow-up</div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '16px' }}>
          <div style={{ gridColumn: '1/-1' }} className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Doctor's Advice</label>
            <textarea className="input" rows={3} style={{ resize: 'vertical', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Dietary advice, rest, precautions…" value={advice} onChange={e=>setAdvice(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-sec)' }}>Follow-up Date</label>
            <input className="input" type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }} />
          </div>
        </div>
      </div>

      {/* Print Settings */}
      <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="card-header" style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
          <div className="card-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)' }}>🖨 Print Settings</div>
        </div>
        <div className="card-body" style={{ padding: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={prePrintedLetterhead} onChange={e => setPrePrintedLetterhead(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
            <span>Print on pre-printed letterhead paper (leaves 110px blank spacing at top of the slip)</span>
          </label>
        </div>
      </div>
 
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 16, marginTop: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={() => onNavigate('patients')} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: 13.5, fontWeight: 500, color: 'var(--text-sec)' }}>Cancel</button>
        <button type="button" className="btn btn-ghost" onClick={printCalibrationTest} style={{ border: '1px dashed var(--primary)', background: 'var(--bg-surface, #f8fafc)', borderRadius: '8px', padding: '8px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--primary, #0f766e)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>📐 Test Alignment</button>
        <button type="button" className="btn btn-secondary" onClick={printDraftSlip} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: 13.5, fontWeight: 500, color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>🖨 Print Draft</button>
        <button type="submit" className="btn btn-primary" disabled={saving} onClick={() => { printAfterSaveRef.current = false; }} style={{ borderRadius: '8px', padding: '8px 20px', fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? <><div className="spinner spinner-sm" />Saving…</> : 'Save Prescription'}
        </button>
      </div>
    </form>
  );
}
