# Medicos — Project Skills & Engineering Playbook

This document defines the essential engineering skills, architectural conventions, operational workflows, and development rules for the **Medicos EMR & Hospital Management System** codebase.

---

## 1. Project Overview & Architecture

Medicos is a multi-tenant, offline-first Electronic Medical Record (EMR) and Hospital Management System (HMS) built for clinics and multi-specialty hospitals.

```
medicos-java-backend/
├── src/main/java/com/medicos/backend/       # Spring Boot 3 Backend (Java 21)
│   ├── config/                              # Security, DataInitializer, Multi-tenancy, Redis
│   ├── controller/                          # REST API Endpoints
│   ├── entity/                              # JPA Database Entities
│   ├── repository/                          # Spring Data JPA Repositories
│   ├── security/                            # JWT, CSRF, Password Rotation, HIPAA Aspects
│   └── service/                             # Business Logic & Workflows
├── frontend/src/                            # React 18 + Vite + TypeScript Frontend
│   ├── api/                                 # Axios client with interceptors
│   ├── db/                                  # Dexie.js IndexedDB schema & sync queue
│   ├── pages/                               # Role-based dashboards & clinical pages
│   │   ├── beds/                            # Bed Allocation & Vitals Board
│   │   ├── billing/                         # OPD & IPD Invoice Management
│   │   ├── dashboards/                      # Reception, Nurse, Lab, Billing Dashboards
│   │   └── patients/                        # Patient Directory & Records
│   ├── store/                               # Zustand state stores (auth, notifications)
│   └── sync/                                # Offline-first bi-directional sync manager
└── pom.xml                                  # Maven configuration (Java 21 + Frontend Maven Plugin)
```

---

## 2. Core Mandatory Rules

> [!IMPORTANT]
> **Rule 1: ZERO Emojis**
> Do **NOT** use emoji characters (e.g. 🩺, 🛏️, 👥, ⚡, 💵, 📅, ⚠️) anywhere in the user interface or templates. Always use clean, lightweight, inline SVG icons with responsive scaling (`width`, `height`, `viewBox="0 0 24 24"`, `stroke="currentColor"`).

> [!IMPORTANT]
> **Rule 2: ZERO Hardcoded Mock Data**
> Never display hardcoded dummy records, fake patient arrays, or placeholder statistics in tables or KPI cards. All metrics, patient listings, bed allocations, and rosters must be dynamically derived from the API endpoints and local Dexie IndexedDB cache.

> [!IMPORTANT]
> **Rule 3: Multi-Tenant Data Isolation**
> Every database query, entity creation, and sync transaction **MUST** be scoped by `hospital_id`. Cross-tenant data leakage is strictly prevented by Hibernate filters, `TenantContext`, and database constraints.

> [!IMPORTANT]
> **Rule 4: HIPAA & DPDP Compliance**
> All access to Protected Health Information (PHI) and clinical records is intercepted by `HipaaAuditAspect` (`@AuditLog`). Passwords must meet rotation policies, and patient data rights (access, correction, erasure) must follow DPDP guidelines.

---

## 3. Technology Stack & Toolchain Skills

### Backend Stack (Java 21 / Spring Boot 3)
* **Framework:** Spring Boot 3.4+ / Java 21 LTS
* **Database:** PostgreSQL (with HikariCP connection pooling)
* **ORM:** Spring Data JPA / Hibernate
* **Security:** Spring Security 6 (Stateless JWT token authentication, BCrypt hashing, CSRF protection)
* **Caching & Queue:** Redis / Embedded Redis for session and token invalidation
* **Build System:** Apache Maven (`pom.xml`)

### Frontend Stack (React 18 / TypeScript / Vite)
* **Framework:** React 18, TypeScript, Vite
* **Offline Database:** Dexie.js (IndexedDB wrapper with local sync queue)
* **State Management:** Zustand
* **Styling:** CSS variables, responsive modern design system (`--surface`, `--border`, `--primary: #0d9488`, `--radius-xl`)
* **PDF & Printing:** `jsPDF` for vector prescriptions and CSS print templates for invoices

---

## 4. Key Engineering Workflows & Patterns

### 4.1. Offline-First Sync Architecture
1. **Local Writes:** User actions (create patient, write encounter, log vitals, generate bill) write immediately to local Dexie tables (`db.patients`, `db.vitals`, `db.billing`, etc.) with `_syncStatus = 'pending'`.
2. **Sync Queue:** Changes are enqueued in `db.syncQueue` and broadcast across open tabs via `triggerSyncBroadcast()`.
3. **Background Sync:** `syncManager.ts` drains the queue to `/api/sync/push` and pulls new deltas from `/api/sync/pull`.
4. **Reactive Refresh:** Components listen to `const { syncCount } = useSync()` and trigger a data re-fetch whenever `syncCount` increments.

```typescript
// Pattern: Reactive Sync Listener in Frontend Components
const { syncCount } = useSync();

useEffect(() => {
  fetchRecords();
}, []);

useEffect(() => {
  if (syncCount > 0) {
    fetchRecords();
  }
}, [syncCount]);
```

### 4.2. Billing & Invoicing Automation
* When creating an invoice or recording payments, `payment_status` is automatically computed:
  * $\text{Paid Amount} \ge \text{Net Amount} > 0 \implies \textbf{Paid}$
  * $\text{Paid Amount} > 0 \implies \textbf{Partial}$
  * $\text{Otherwise} \implies \textbf{Pending}$
* Balance due is automatically maintained as $\max(0, \text{Net Amount} - \text{Paid Amount})$.
* Payments update both backend database and local IndexedDB cache, re-triggering KPI recalculations in real time.

### 4.3. Bed Allocation & Vitals Board
* Beds track room number, bed code, department/ward (`ICU`, `General`, `Emergency`, `Maternity`), and occupancy status (`Available`, `Occupied`, `Maintenance`).
* Occupied beds maintain real-time vitals (Blood Pressure, Heart Rate, SpO2, Temperature, Respiratory Rate).
* Vitals outside safe thresholds are automatically flagged in red as **Critical Patients**.
* Releasing a bed records the admission duration and marks the stay as `Unbilled` for IPD finance settlement.

---

## 5. Verification & Testing Playbook

Always verify both frontend and backend before committing changes:

```bash
# 1. Build and typecheck Frontend
npm --prefix frontend run build

# 2. Run Backend Test Suite (all 23 tests must pass)
mvn clean test

# 3. Local Development Servers
# Backend (Port 8080):
mvn spring-boot:run
# Frontend Dev Server (Port 5173):
npm --prefix frontend run dev
```

---

## 6. Cloud Run & Docker Deployment Skill

When deploying to Google Cloud Run:
* Container port must be configured to listen to `PORT=8080` (or `PORT` environment variable injected by Cloud Run).
* Docker multi-stage build compiles Vite frontend into `src/main/resources/static/` and packages the single runnable Spring Boot jar.
* JVM flags for container environments:
  ```bash
  java -XX:InitialRAMPercentage=40.0 -XX:MaxRAMPercentage=80.0 -Dserver.port=${PORT:-8080} -jar app.jar
  ```
* Cloud SQL connection uses Cloud SQL Auth Proxy or Unix socket `/cloudsql/INSTANCE_CONNECTION_NAME`.
