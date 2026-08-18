# Medicos EMR — AI Agent Guidelines & Architecture Rules

You must strictly adhere to the following rules for every code modification, test, and refactoring:

## Rule 1: Contain the Blast Radius (Modularity)
- Single Responsibility: Each module, service, and helper has exactly one job.
- Explicit Contracts: Use DTOs/TypeScript types for all inputs/outputs. Never leak raw DB entities.
- Isolate Utilities: Do not alter shared utilities for one-off edge cases; extend via adapters or create dedicated helpers.

## Rule 2: Build Automated Safety Nets
- TDD-Lite: When fixing a bug, write a reproducing test first, apply the fix, then verify all tests pass.
- Static Typing & Build Integrity: Always ensure `npm --prefix frontend run build` (tsc) and `mvn test` succeed with 0 errors.

## Rule 3: Strict Architectural Boundaries
- API Layer: Request routing, DTO validation, auth extraction. Zero direct DB queries.
- Service Layer: Business logic, domain rules, orchestration. Context-free and testable.
- Persistence Layer: Parameterized queries, RLS tenant isolation, transactions.
- Single Source of Truth: Route identical operations through a shared domain service.

## Rule 4: Security & Tenant Isolation by Default
- Multi-Tenant RLS: Enforce isolation at the database layer (PostgreSQL Row-Level Security).
- Server-Side Identity: Extract user ID, tenant ID, and roles strictly from verified JWT tokens. Never trust client body overrides.
- Fail Closed: Ambiguous or unauthorized requests must immediately return 401/403.
- Parameterized Queries: Never concatenate user input into queries.

## Rule 5: One Change at a Time
- Separate Refactoring from Logic Changes: Do not mix structural cleanup with bug fixes.
- Atomic, Reversible Commits: Keep edits small, clean, and easily reversible.

## Pre-Flight Checklist
1. Did I fix the root cause, not just the symptom?
2. Did I check all call sites of any changed function?
3. Is input validation in place before processing?
4. Are tenant boundaries preserved?
5. Did I run tests (`mvn test`, `npm run build`) with 0 failures?
6. Are there 0 hardcoded secrets, test credentials, or unhandled errors?
