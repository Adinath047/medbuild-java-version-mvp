-- ===================================================================================
--  MEDBUILDS - DATABASE SECURITY HARDENING SCRIPT
--  Run ONCE as PostgreSQL superuser before starting the application.
--  Usage: psql -U postgres -d medbuild_java_mvp -f db-security-setup.sql
--
--  What this does:
--   1. Creates medbuild_app role (no superuser, no DDL rights)
--   2. Grants scoped DML on all tables and sequences
--   3. Locks audit_logs to append-only (REVOKE UPDATE/DELETE/TRUNCATE)
--   4. Sets statement_timeout=10s and idle_in_transaction_session_timeout=30s
--   5. RLS policies in schema.sql now ACTUALLY enforced (superuser bypasses RLS)
-- ===================================================================================

-- STEP 1: Create application role (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medbuild_app') THEN
        CREATE ROLE medbuild_app WITH LOGIN PASSWORD 'CHANGE_ME_BEFORE_RUNNING';
        RAISE NOTICE 'Role medbuild_app created. Set DB_APP_PASSWORD env var.';
    ELSE
        RAISE NOTICE 'Role medbuild_app already exists - skipping creation.';
    END IF;
END $$;

-- STEP 2: Database and schema access
GRANT CONNECT ON DATABASE medbuild_java_mvp TO medbuild_app;
GRANT USAGE ON SCHEMA public TO medbuild_app;

-- STEP 3: DML grants on all existing tables and sequences
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO medbuild_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medbuild_app;

-- STEP 4: Auto-grant on future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO medbuild_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO medbuild_app;

-- STEP 5: Audit log immutability - append-only
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM medbuild_app;

-- STEP 6: Role-level safety timeouts
ALTER ROLE medbuild_app SET statement_timeout = '10s';
ALTER ROLE medbuild_app SET idle_in_transaction_session_timeout = '30s';

-- VERIFICATION:
-- SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'medbuild_app';
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE grantee = 'medbuild_app' AND table_name = 'audit_logs';
