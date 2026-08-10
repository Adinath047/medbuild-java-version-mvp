package com.medicos.backend.security;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import static org.junit.jupiter.api.Assertions.*;

public class RlsVerificationTest {

    private static final String DB_URL = System.getenv("TEST_DB_URL") != null 
            ? System.getenv("TEST_DB_URL") 
            : "jdbc:postgresql://34.14.172.153:5432/medbuild-mvp-01";
    private static final String ADMIN_USER = "postgres";
    private static final String ADMIN_PASS = "x6VfmVqF2MFmvoaM@";

    private static final String APP_USER = "medbuild_app";
    private static final String APP_PASS = "appSecurePassword2026!";

    @BeforeAll
    public static void setupPrivilegesAndRls() throws Exception {
        // Connect as superuser (postgres) to grant privileges and enable RLS
        try (Connection conn = DriverManager.getConnection(DB_URL, ADMIN_USER, ADMIN_PASS)) {
            try (Statement stmt = conn.createStatement()) {
                // Reset role to postgres to clear any default session role overrides
                stmt.execute("RESET ROLE;");

                // 1. Grant privileges to medbuild_app
                stmt.execute("GRANT CONNECT ON DATABASE \"medbuild-mvp-01\" TO medbuild_app;");
                stmt.execute("GRANT USAGE ON SCHEMA public TO medbuild_app;");
                stmt.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medbuild_app;");
                stmt.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medbuild_app;");
                stmt.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO medbuild_app;");
                stmt.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO medbuild_app;");

                // 2. Enable and configure RLS on all 12 transactional EMR and user tables
                String[] tables = {
                    "users", "patients", "encounters", "vitals", "prescriptions", "appointments",
                    "beds", "bed_admissions", "billing", "medicines", "notifications", "patient_uploads"
                };
                for (String table : tables) {
                    stmt.execute("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY;");
                    stmt.execute("ALTER TABLE " + table + " FORCE ROW LEVEL SECURITY;");
                    stmt.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON " + table + ";");
                    stmt.execute("CREATE POLICY tenant_isolation_policy ON " + table +
                        " USING (hospital_id = current_setting('app.current_hospital_id'));");
                }
            }
        }
    }

    @Test
    public void testPostgresqlRowLevelSecurityEnforcement() throws Exception {
        // Connect as non-superuser (medbuild_app) to verify RLS
        try (Connection conn = DriverManager.getConnection(DB_URL, APP_USER, APP_PASS)) {
            conn.setAutoCommit(false); // Enable transaction block

            // Test 1: Query as Hospital 1 (hsp-001)
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET LOCAL app.current_hospital_id = 'hsp-001';");
                try (ResultSet rs = stmt.executeQuery("SELECT DISTINCT hospital_id FROM patients;")) {
                    while (rs.next()) {
                        String hospId = rs.getString("hospital_id");
                        assertEquals("hsp-001", hospId, "RLS failed: Query returned data belonging to: " + hospId);
                    }
                }
            }

            // Test 2: Query as Hospital 2 (hsp-002)
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET LOCAL app.current_hospital_id = 'hsp-002';");
                try (ResultSet rs = stmt.executeQuery("SELECT DISTINCT hospital_id FROM patients;")) {
                    while (rs.next()) {
                        String hospId = rs.getString("hospital_id");
                        assertEquals("hsp-002", hospId, "RLS failed: Query returned data belonging to: " + hospId);
                    }
                }
            }

            // Test 3: Unauthenticated / Unset Context (app.current_hospital_id is empty)
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET LOCAL app.current_hospital_id = '';");
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) AS cnt FROM patients;")) {
                    if (rs.next()) {
                        int count = rs.getInt("cnt");
                        assertEquals(0, count, "RLS failed: Unauthenticated transaction returned rows: " + count);
                    }
                }
            }



            conn.rollback(); // Always rollback verification queries
        }
    }
}
