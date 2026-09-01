package com.medicos.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Automatically applies and synchronizes Row-Level Security (RLS) policies across all
 * tables in the live PostgreSQL database upon application startup.
 * Ensures GLOBAL Super Admin context and multi-tenant isolation are always up to date.
 */
@Component
@Order(1)
public class DatabasePolicyUpdater implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabasePolicyUpdater.class);

    private final DataSource dataSource;

    public DatabasePolicyUpdater(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        log.info("[DatabasePolicyUpdater] Checking and synchronizing PostgreSQL RLS policies...");

        String[] tables = {
                "users", "patients", "encounters", "vitals", "prescriptions",
                "appointments", "beds", "bed_admissions", "billing",
                "medicines", "notifications", "patient_uploads", "audit_logs"
        };

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Check if PostgreSQL database
            String dbProductName = conn.getMetaData().getDatabaseProductName();
            if (dbProductName == null || !dbProductName.toLowerCase().contains("postgresql")) {
                log.info("[DatabasePolicyUpdater] Non-PostgreSQL database detected ({}), skipping RLS policy setup.", dbProductName);
                return;
            }

            for (String table : tables) {
                try {
                    stmt.execute("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY;");
                    stmt.execute("ALTER TABLE " + table + " FORCE ROW LEVEL SECURITY;");
                    stmt.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON " + table + ";");
                    stmt.execute("CREATE POLICY tenant_isolation_policy ON " + table + " " +
                            "USING (current_setting('app.current_hospital_id', true) = 'GLOBAL' OR hospital_id = current_setting('app.current_hospital_id', true)) " +
                            "WITH CHECK (current_setting('app.current_hospital_id', true) = 'GLOBAL' OR hospital_id = current_setting('app.current_hospital_id', true));");
                    log.info("[DatabasePolicyUpdater] ✅ Synchronized RLS policy on table '{}'", table);
                } catch (Exception ex) {
                    log.warn("[DatabasePolicyUpdater] Could not update policy on table '{}': {}", table, ex.getMessage());
                }
            }
            log.info("[DatabasePolicyUpdater] ✅ PostgreSQL RLS policy synchronization completed successfully.");
        } catch (Exception e) {
            log.warn("[DatabasePolicyUpdater] RLS synchronization encountered non-fatal error: {}", e.getMessage());
        }
    }
}
