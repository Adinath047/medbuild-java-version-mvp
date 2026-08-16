-- =====================================================================
--  MEDICOS EMR — PostgreSQL Database Schema & Initial Seed Data
-- =====================================================================

-- ── 1. HOSPITALS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id           VARCHAR(64) PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(50) DEFAULT 'General',
  address      TEXT,
  city         VARCHAR(100),
  state        VARCHAR(100),
  pincode      VARCHAR(20),
  phone        VARCHAR(50),
  email        VARCHAR(100),
  logo_url     TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. USERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               VARCHAR(64) PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(150) UNIQUE NOT NULL,
  password         VARCHAR(255) NOT NULL,
  role             VARCHAR(50) NOT NULL DEFAULT 'doctor',
  hospital_id      VARCHAR(64),
  staff_id         VARCHAR(64),
  phone            VARCHAR(50),
  specialization   VARCHAR(100),
  license_number   VARCHAR(100),
  qualification    VARCHAR(255),
  registration_number VARCHAR(100),
  letterhead       TEXT,
  consultation_fee REAL NOT NULL DEFAULT 0.0,
  followup_fee     REAL NOT NULL DEFAULT 0.0,
  bed_per_day_charge REAL NOT NULL DEFAULT 0.0,
  district         VARCHAR(100),
  rating           REAL NOT NULL DEFAULT 0.0,
  experience_years INTEGER NOT NULL DEFAULT 0,
  consulted_count  INTEGER NOT NULL DEFAULT 0,
  photo_url        TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  show_diagnosis_on_print INTEGER NOT NULL DEFAULT 1,
  show_investigations_on_print INTEGER NOT NULL DEFAULT 1,
  show_vitals_on_print INTEGER NOT NULL DEFAULT 1,
  print_margin_top INTEGER NOT NULL DEFAULT 35,
  print_margin_bottom INTEGER NOT NULL DEFAULT 15,
  print_margin_left_right INTEGER NOT NULL DEFAULT 18,
  print_font_size REAL NOT NULL DEFAULT 11.0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_fee REAL DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS followup_fee REAL DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bed_per_day_charge REAL DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS letterhead TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating REAL DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consulted_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_diagnosis_on_print INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_investigations_on_print INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_vitals_on_print INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS print_margin_top INTEGER DEFAULT 35;
ALTER TABLE users ADD COLUMN IF NOT EXISTS print_margin_bottom INTEGER DEFAULT 15;
ALTER TABLE users ADD COLUMN IF NOT EXISTS print_margin_left_right INTEGER DEFAULT 18;
ALTER TABLE users ADD COLUMN IF NOT EXISTS print_font_size REAL DEFAULT 11.0;

-- ── 3. PATIENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                      VARCHAR(64) PRIMARY KEY,
  uhid                    VARCHAR(64) UNIQUE NOT NULL,
  hospital_id             VARCHAR(64) NOT NULL,
  name                    VARCHAR(255) NOT NULL,
  dob                     VARCHAR(20),
  age                     INTEGER,
  sex                     VARCHAR(20) NOT NULL DEFAULT 'Male',
  blood_group             VARCHAR(20),
  phone                   VARCHAR(50),
  email                   VARCHAR(150),
  password                VARCHAR(255),
  address                 TEXT,
  weight                  VARCHAR(20),
  height                  VARCHAR(20),
  allergies               TEXT DEFAULT '[]',
  chronic_conditions      TEXT DEFAULT '[]',
  current_medications     TEXT DEFAULT '[]',
  ec_name                 VARCHAR(255),
  ec_phone                VARCHAR(50),
  ec_relation             VARCHAR(50),
  govt_id_type            VARCHAR(50),
  govt_id_number          VARCHAR(100),
  insurance_provider      VARCHAR(100),
  insurance_number        VARCHAR(100),
  primary_doctor_id       VARCHAR(64),
  photo_url               TEXT,
  past_history            TEXT,
  notes                   TEXT,
  is_active               INTEGER NOT NULL DEFAULT 1,
  registered_by           VARCHAR(64),
  abha_number             VARCHAR(50),
  abha_address            VARCHAR(100),
  abha_status             VARCHAR(50),
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. ENCOUNTERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encounters (
  id               VARCHAR(64) PRIMARY KEY,
  hospital_id      VARCHAR(64) NOT NULL,
  patient_id       VARCHAR(64) NOT NULL,
  doctor_id        VARCHAR(64) NOT NULL,
  encounter_type   VARCHAR(50) NOT NULL DEFAULT 'OPD',
  token_number     INTEGER,
  appointment_id   VARCHAR(64),
  status           VARCHAR(50) NOT NULL DEFAULT 'Active',
  chief_complaint  TEXT,
  history          TEXT,
  past_history     TEXT,
  examination      TEXT,
  diagnosis        TEXT DEFAULT '[]',
  impression       TEXT,
  plan             TEXT,
  advice           TEXT,
  follow_up_date   VARCHAR(20),
  refer_to         VARCHAR(100),
  duration_mins    INTEGER,
  billing_amount   DOUBLE PRECISION,
  notes            TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. VITALS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id               VARCHAR(64) PRIMARY KEY,
  patient_id       VARCHAR(64) NOT NULL,
  encounter_id     VARCHAR(64),
  hospital_id      VARCHAR(64) NOT NULL,
  bp_systolic      INTEGER,
  bp_diastolic     INTEGER,
  heart_rate       INTEGER,
  temperature      DOUBLE PRECISION,
  temperature_unit VARCHAR(10) DEFAULT 'F',
  spo2             INTEGER,
  weight           DOUBLE PRECISION,
  weight_unit      VARCHAR(10) DEFAULT 'kg',
  height           DOUBLE PRECISION,
  height_unit      VARCHAR(10) DEFAULT 'cm',
  bmi              DOUBLE PRECISION,
  respiratory_rate INTEGER,
  blood_sugar      DOUBLE PRECISION,
  blood_sugar_type VARCHAR(20),
  pain_score       INTEGER,
  hba1c            DOUBLE PRECISION,
  tsh              DOUBLE PRECISION,
  notes            TEXT,
  medicines_given  TEXT,
  recorded_by      VARCHAR(64) NOT NULL,
  recorded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. PRESCRIPTIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id            VARCHAR(64) PRIMARY KEY,
  hospital_id   VARCHAR(64) NOT NULL,
  patient_id    VARCHAR(64) NOT NULL,
  doctor_id     VARCHAR(64) NOT NULL,
  encounter_id  VARCHAR(64),
  medicines     TEXT NOT NULL DEFAULT '[]',
  advice        TEXT,
  follow_up_date VARCHAR(20),
  patient_weight VARCHAR(20),
  slip_token    VARCHAR(128) UNIQUE,
  is_printed    INTEGER DEFAULT 0,
  created_by_role VARCHAR(50) DEFAULT 'doctor',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 7. APPOINTMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               VARCHAR(64) PRIMARY KEY,
  hospital_id      VARCHAR(64) NOT NULL,
  patient_id       VARCHAR(64) NOT NULL,
  doctor_id        VARCHAR(64) NOT NULL,
  date             VARCHAR(20) NOT NULL,
  time             VARCHAR(20) NOT NULL,
  token_number     INTEGER,
  reason           TEXT,
  status           VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  notes            TEXT,
  booked_by        VARCHAR(64),
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 8. BEDS / WARDS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beds (
  id           VARCHAR(64) PRIMARY KEY,
  hospital_id  VARCHAR(64) NOT NULL,
  bed_number   VARCHAR(50) NOT NULL,
  ward         VARCHAR(50) NOT NULL,
  room         VARCHAR(50),
  type         VARCHAR(50) DEFAULT 'General',
  status       VARCHAR(50) NOT NULL DEFAULT 'Available',
  patient_id   VARCHAR(64),
  doctor_id    VARCHAR(64),
  admitted_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bed_admissions (
  id             VARCHAR(64) PRIMARY KEY,
  hospital_id    VARCHAR(64) NOT NULL,
  bed_id         VARCHAR(64) NOT NULL,
  patient_id     VARCHAR(64) NOT NULL,
  doctor_id      VARCHAR(64),
  admitted_at    TIMESTAMP NOT NULL,
  discharged_at  TIMESTAMP,
  status         VARCHAR(50) NOT NULL DEFAULT 'Admitted',
  billing_status VARCHAR(50) NOT NULL DEFAULT 'Unbilled',
  billing_id     VARCHAR(64)
);

-- ── 9. BILLING ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing (
  id             VARCHAR(64) PRIMARY KEY,
  hospital_id    VARCHAR(64) NOT NULL,
  patient_id     VARCHAR(64) NOT NULL,
  encounter_id   VARCHAR(64),
  items          TEXT NOT NULL DEFAULT '[]',
  total_amount   DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount       DOUBLE PRECISION DEFAULT 0,
  net_amount     DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_amount    DOUBLE PRECISION DEFAULT 0,
  payment_mode   VARCHAR(50) DEFAULT 'Cash',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  invoice_number VARCHAR(100) UNIQUE,
  notes          TEXT,
  billed_by      VARCHAR(64),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 10. MEDICINES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicines (
  id           VARCHAR(64) PRIMARY KEY,
  hospital_id  VARCHAR(64) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  generics     TEXT DEFAULT '[]',
  strengths    TEXT DEFAULT '[]',
  default_dose VARCHAR(100),
  category     VARCHAR(100),
  is_active    INTEGER NOT NULL DEFAULT 1,
  sr_no        INTEGER,
  drug_code    VARCHAR(100),
  generic_name VARCHAR(255),
  group_name   VARCHAR(100),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 11. NOTIFICATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(64) PRIMARY KEY,
  hospital_id  VARCHAR(64),
  type         VARCHAR(50) NOT NULL DEFAULT 'general',
  message      TEXT NOT NULL,
  patient_id   VARCHAR(64),
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 12. PATIENT UPLOADS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_uploads (
  id            VARCHAR(64) PRIMARY KEY,
  patient_id    VARCHAR(64) NOT NULL,
  hospital_id   VARCHAR(64) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  file_url      TEXT NOT NULL,
  file_type     VARCHAR(50),
  notes         TEXT,
  uploaded_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 13. SEED INITIAL DATA ─────────────────────────────────────────────
INSERT INTO hospitals (id, name, type, city, phone) 
VALUES ('hsp-001', 'Medicos General Hospital', 'General', 'Mumbai', '+91-22-12345678')
ON CONFLICT (id) DO NOTHING;

-- Seed default Super Admin (Password: admin123)
INSERT INTO users (id, name, email, password, role, hospital_id)
VALUES ('usr-admin-001', 'Adinath Admin', 'adinathmade@medicos.com',
        '$2a$10$1LADfgd8HQ0allD5lnGLb.dVxH.sVVCt07WYykl48x0vryQ1fCgLO',
        'admin', 'hsp-001')
ON CONFLICT (id) DO NOTHING;

-- Seed default Doctor (Password: doctor123)
INSERT INTO users (id, name, email, password, role, hospital_id, staff_id, specialization, qualification)
VALUES ('usr-doc-001', 'Dr. Ananya Rao', 'doctor@medicos.com',
        '$2a$10$1LADfgd8HQ0allD5lnGLb.dVxH.sVVCt07WYykl48x0vryQ1fCgLO',
        'doctor', 'hsp-001', 'STF-101', 'Cardiology', 'MBBS, MD (Cardiology)')
ON CONFLICT (id) DO NOTHING;

-- Seed sample patient
INSERT INTO patients (id, uhid, hospital_id, name, age, sex, blood_group, phone, allergies, chronic_conditions, registered_by)
VALUES ('pat-001', 'UHID-001-000001', 'hsp-001', 'Rahul Mehta', 34, 'Male', 'B+',
        '+91-9876543210', '["Penicillin"]', '["Hypertension", "Type 2 Diabetes"]', 'usr-admin-001')
ON CONFLICT (id) DO NOTHING;

-- Seed initial beds
INSERT INTO beds (id, hospital_id, bed_number, ward, room, type, status)
VALUES 
  ('bed-101', 'hsp-001', 'B-101', 'ICU', 'ICU-1', 'ICU', 'Available'),
  ('bed-102', 'hsp-001', 'B-102', 'General', 'G-102', 'General', 'Available'),
  ('bed-103', 'hsp-001', 'B-103', 'General', 'G-103', 'General', 'Available')
ON CONFLICT (id) DO NOTHING;

-- ── 14. ROW-LEVEL SECURITY (RLS) POLICIES ─────────────────────────────
-- Enable and force RLS on all EMR/clinical transactional tables

-- Users Table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON users;
CREATE POLICY tenant_isolation_policy ON users
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Patients Table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON patients;
CREATE POLICY tenant_isolation_policy ON patients
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Encounters Table
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON encounters;
CREATE POLICY tenant_isolation_policy ON encounters
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Vitals Table
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON vitals;
CREATE POLICY tenant_isolation_policy ON vitals
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Prescriptions Table
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON prescriptions;
CREATE POLICY tenant_isolation_policy ON prescriptions
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Appointments Table
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON appointments;
CREATE POLICY tenant_isolation_policy ON appointments
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Beds Table
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON beds;
CREATE POLICY tenant_isolation_policy ON beds
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Bed Admissions Table
ALTER TABLE bed_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_admissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON bed_admissions;
CREATE POLICY tenant_isolation_policy ON bed_admissions
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Billing Table
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON billing;
CREATE POLICY tenant_isolation_policy ON billing
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Medicines Table
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON medicines;
CREATE POLICY tenant_isolation_policy ON medicines
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Notifications Table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON notifications;
CREATE POLICY tenant_isolation_policy ON notifications
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));

-- Patient Uploads Table
ALTER TABLE patient_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_uploads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON patient_uploads;
CREATE POLICY tenant_isolation_policy ON patient_uploads
  USING (hospital_id = current_setting('app.current_hospital_id', true))
  WITH CHECK (hospital_id = current_setting('app.current_hospital_id', true));


