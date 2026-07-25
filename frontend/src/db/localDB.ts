// client/src/db/localDB.ts
// Dexie.js — IndexedDB schema for offline-first operation
// Mirrors server SQLite tables with additional sync metadata fields

import Dexie, { type Table } from 'dexie';

// ── Type: sync metadata added to every local record ──────────────────
export type SyncStatus = 'synced' | 'pending' | 'conflict';
export type SyncOp     = 'create' | 'update' | 'delete';

export interface SyncMeta {
  _syncStatus:  SyncStatus;
  _syncOp:      SyncOp;
  _localSeq:    number;     // auto-incremented by Dexie for ordering
  _updatedAt:   string;     // ISO timestamp for conflict resolution
}

// ── Data types ────────────────────────────────────────────────────────
export interface LocalPatient extends Partial<SyncMeta> {
  id:                   string;
  uhid:                 string;
  hospital_id:          string;
  name:                 string;
  dob?:                 string;
  age?:                 number;
  sex:                  'Male' | 'Female' | 'Other';
  blood_group?:         string;
  phone?:               string;
  email?:               string;
  address?:             string;
  weight?:              string;
  height?:              string;
  allergies:            string[];
  chronic_conditions:   string[];
  current_medications:  string[];
  ec_name?:             string;
  ec_phone?:            string;
  ec_relation?:         string;
  govt_id_type?:        string;
  govt_id_number?:      string;
  insurance_provider?:  string;
  insurance_number?:    string;
  primary_doctor_id?:   string;
  photo_url?:           string;
  past_history?:        string;
  notes?:               string;
  registered_by?:       string;
  abha_number?:         string;
  abha_address?:        string;
  abha_status?:         string;
  created_at:           string;
  updated_at:           string;
}

export interface LocalEncounter extends Partial<SyncMeta> {
  id:             string;
  hospital_id:    string;
  patient_id:     string;
  doctor_id:      string;
  encounter_type: string;
  token_number?:  number;
  status:         string;
  chief_complaint?: string;
  history?:       string;
  past_history?:  string;
  examination?:   string;
  diagnosis:      Array<{ code?: string; name: string; type?: string }>;
  impression?:    string;
  plan?:          string;
  advice?:        string;
  follow_up_date?:string;
  notes?:         string;
  // joined
  patient_name?:  string;
  doctor_name?:   string;
  uhid?:          string;
  created_at:     string;
  updated_at:     string;
}

export interface LocalVitals extends Partial<SyncMeta> {
  id:               string;
  patient_id:       string;
  encounter_id?:    string;
  hospital_id:      string;
  bp_systolic?:     number;
  bp_diastolic?:    number;
  heart_rate?:      number;
  temperature?:     number;
  temperature_unit: string;
  spo2?:            number;
  weight?:          number;
  weight_unit:      string;
  height?:          number;
  bmi?:             number;
  respiratory_rate?:number;
  blood_sugar?:     number;
  blood_sugar_type?:string;
  pain_score?:      number;
  notes?:           string;
  medicines_given?: string;
  recorded_by:      string;
  recorded_at:      string;
}

export interface LocalMedicine {
  name:         string;
  strength:     string;
  dose:         string;
  frequency:    string;
  duration:     string;
  instructions?:string;
}

export interface LocalMedicineRecord extends Partial<SyncMeta> {
  id:           string;
  hospital_id:  string;
  name:         string;
  generics:     string[];
  strengths:    string[];
  default_dose?: string;
  category?:    string;
  is_active:    number;
  sr_no?:       number;
  drug_code?:   string;
  generic_name?:string;
  group_name?:  string;
  created_at:   string;
  updated_at:   string;
}

export interface LocalPrescription extends Partial<SyncMeta> {
  id:             string;
  hospital_id:    string;
  patient_id:     string;
  doctor_id:      string;
  encounter_id?:  string;
  medicines:      LocalMedicine[];
  advice?:        string;
  follow_up_date?:string;
  patient_weight?:string;
  slip_token?:    string;
  created_by_role:string;
  created_at:     string;
  // joined
  patient_name?:  string;
  doctor_name?:   string;
}

export interface LocalAppointment extends Partial<SyncMeta> {
  id:           string;
  hospital_id:  string;
  patient_id:   string;
  doctor_id:    string;
  date:         string;
  time:         string;
  token_number?:number;
  reason?:      string;
  status:       string;
  notes?:       string;
  // joined
  patient_name?:string;
  doctor_name?: string;
  patient_phone?:string;
  uhid?:        string;
  created_at:   string;
  updated_at:   string;
}

export interface LocalBilling extends Partial<SyncMeta> {
  id:             string;
  hospital_id:    string;
  patient_id:     string;
  encounter_id?:  string;
  items:          Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
  total_amount:   number;
  discount:       number;
  net_amount:     number;
  paid_amount:    number;
  payment_mode:   string;
  payment_status: string;
  invoice_number?:string;
  notes?:         string;
  created_at:     string;
}

export interface SyncQueueItem {
  id?:       number;
  table:     string;
  operation: SyncOp;
  payload:   Record<string, unknown>;
  clientUpdatedAt: string;
  createdAt: string;
  attempts:  number;
}

// ── Dexie Database class ──────────────────────────────────────────────
class EMRDatabase extends Dexie {
  patients!:      Table<LocalPatient>;
  encounters!:    Table<LocalEncounter>;
  vitals!:        Table<LocalVitals>;
  prescriptions!: Table<LocalPrescription>;
  appointments!:  Table<LocalAppointment>;
  billing!:       Table<LocalBilling>;
  medicines!:     Table<LocalMedicineRecord>;
  syncQueue!:     Table<SyncQueueItem>;
  meta!:          Table<{ key: string; value: string }>;

  constructor() {
    super('MedicosEMR');

    this.version(2).stores({
      patients:      'id, uhid, hospital_id, name, phone, _syncStatus, created_at, updated_at',
      encounters:    'id, patient_id, doctor_id, hospital_id, created_at, _syncStatus',
      vitals:        'id, patient_id, encounter_id, recorded_at, _syncStatus',
      prescriptions: 'id, patient_id, doctor_id, encounter_id, created_at, _syncStatus',
      appointments:  'id, patient_id, doctor_id, date, status, hospital_id, _syncStatus',
      billing:       'id, patient_id, payment_status, hospital_id, created_at, _syncStatus',
      medicines:     'id, hospital_id, name, category, _syncStatus',
      syncQueue:     '++id, table, operation, createdAt',
      meta:          'key',
    });
  }
}

export const db = new EMRDatabase();

// ── Sync helpers ──────────────────────────────────────────────────────

/** Mark a record as pending sync and add to queue */
export async function markPending<T extends { id: string; updated_at?: string }>(
  table: Table<T>,
  operation: SyncOp,
  record: T
): Promise<void> {
  const now = new Date().toISOString();

  // FIX Bug 1: The clientUpdatedAt MUST be the record's own updated_at field so
  // the server's last-write-wins check (clientTime >= serverTime) is meaningful.
  // We stamp updated_at=now on the record first, then use that same value for
  // the queue entry. Previously a fresh Date.now() was generated for the queue
  // but the record kept its old timestamp, causing every subsequent push to
  // appear "older" than the server version and get silently conflict_skipped.
  const recordWithTs: T = { ...record, updated_at: now };
  const clientUpdatedAt = now;

  await table.put({ ...recordWithTs, _syncStatus: 'pending', _syncOp: operation, _updatedAt: clientUpdatedAt } as T);
  await db.syncQueue.add({
    table: (table as any).name,
    operation,
    payload: recordWithTs as any,
    clientUpdatedAt,
    createdAt: now,
    attempts: 0,
  });

  // Trigger immediate sync to server if online
  if (navigator.onLine) {
    import('../sync/syncManager').then(m => m.syncNow()).catch(console.error);
  }
}

/** Get last sync timestamp */
export async function getLastSync(): Promise<string> {
  const row = await db.meta.get('lastSync');
  return row?.value ?? '2000-01-01T00:00:00.000Z';
}

/** Set last sync timestamp */
export async function setLastSync(ts: string): Promise<void> {
  await db.meta.put({ key: 'lastSync', value: ts });
}

/** Count pending items */
export async function getPendingCount(): Promise<number> {
  return db.syncQueue.count();
}
