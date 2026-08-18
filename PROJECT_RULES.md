# Medicos EMR — Engineering & Architecture Rules

This document establishes the mandatory engineering standards, architectural boundaries, testing practices, and security requirements for all development on the Medicos EMR codebase. Every change must adhere to these rules without exception.

---

## Rule 1: Contain the Blast Radius (Modularity)

1. **Single Responsibility per Module:**
   * A service, handler, or module must perform exactly one job.
   * If a helper function handles validation, database access, and formatting simultaneously, it must be decomposed. Touching one feature must never risk breaking unrelated features.

2. **Explicit Interfaces & Contracts (DTOs):**
   * Always define explicit Data Transfer Objects (DTOs) and TypeScript types for inputs and outputs.
   * Never pass raw database entities/models directly to clients, presentation components, or API response payloads.

3. **Isolate Shared Utilities:**
   * If multiple features rely on a shared utility, do not tweak its core logic to suit a specific edge case for one feature.
   * Extend shared utilities via optional parameters, adapters, or compose a dedicated new helper.

---

## Rule 2: Build Automated Safety Nets

1. **Regression Test Before Fixing (TDD-Lite):**
   * Step 1: Write a failing test that reproduces the bug or edge case.
   * Step 2: Apply the minimal, targeted fix.
   * Step 3: Verify the new test passes and 100% of existing tests remain green.

2. **End-to-End API Smoke Tests:**
   * Maintain a fast, reliable suite of high-priority API smoke tests covering authentication flows, tenant isolation, and primary CRUD actions before committing.

3. **Static Typing & Linting Enforcement:**
   * Enforce strict TypeScript compilation (`tsc`) and Java compiler checks.
   * Catch mismatched signatures, type mismatches, and invalid null/undefined operations at build time before runtime execution.

---

## Rule 3: Maintain Strict Architectural Boundaries

| Layer | Primary Responsibility | Golden Rule |
| :--- | :--- | :--- |
| **API / Presentation** | Routing, HTTP serialization, request schema validation, auth extraction. | **Never write direct database queries or core business logic here.** |
| **Service / Business** | Workflows, domain validation, business rules, orchestrating data. | **Independent of HTTP context; easily testable in isolation.** |
| **Data Access / Persistence** | Database queries, caching, transactions, data mapping. | **Strict tenant data isolation; parameterized queries only.** |

* **Single Source of Truth:** Never duplicate critical business logic across multiple controllers or components. Always route identical operations through a shared domain service.
* **Explicit Dependencies:** Avoid hidden global state, global mutable variables, or uncontrolled mutation of shared objects.

---

## Rule 4: Security & Tenant Isolation by Default

1. **Defense-in-Depth Isolation:**
   * Enforce tenant data isolation at the database layer (PostgreSQL Row-Level Security / RLS, session binding `app.current_hospital_id`) so a missed query filter cannot leak cross-tenant or private patient data.

2. **Explicit Context Injection:**
   * Always extract tenant ID, user ID, and role strictly from validated JWT claims / server-side authenticated sessions.
   * Never trust client-supplied tenant or user identifiers passed loosely in request bodies.

3. **Fail Closed (Zero Trust):**
   * If an authorization check, validation rule, or session token is malformed, missing, or ambiguous, abort execution immediately with generic `401 Unauthorized` or `403 Forbidden`.

4. **Parameterize Everything:**
   * Always use parameterized queries, JPA repository methods, or prepared statements.
   * Never concatenate dynamic user input into SQL or shell commands.

---

## Rule 5: The "One Change at a Time" Discipline

1. **Separate Refactoring from Feature/Bug Work:**
   * **Commit A:** Pure refactoring/cleanup (zero behavior change, verified by passing tests).
   * **Commit B:** The targeted bug fix or feature addition.
   * Never mix structural refactoring with logic changes.

2. **Atomic, Reversible Git Commits:**
   * Keep commits small, self-contained, and focused.
   * If a change causes an issue in production, it must be cleanly undoable with a single `git revert`.

3. **Branch Strategy:**
   * Work on short-lived feature/fix branches with standard verification before merging.

---

## Developer Pre-Flight Checklist

Before saving, committing, or deploying any change:

- [ ] **Root Cause:** Did I identify and fix the root cause, or did I just mask the symptom?
- [ ] **Call Sites:** If I changed a shared function/contract, did I check all other call sites?
- [ ] **Validation:** Is input validation enforced before processing the request?
- [ ] **Isolation:** Are tenant/user isolation boundaries strictly preserved?
- [ ] **Regressions:** Did I run the full test suite (`mvn test`, `npm run build`) to verify 0 regressions?
- [ ] **Cleanliness:** Are there any hardcoded secrets, test credentials, debug console logs, or unhandled exceptions?
