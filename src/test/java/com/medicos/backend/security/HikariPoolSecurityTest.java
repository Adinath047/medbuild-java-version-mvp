package com.medicos.backend.security;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class HikariPoolSecurityTest {

    @Autowired
    private DataSource dataSource;

    @Test
    public void testHikariCpPoolIsConfiguredWithLeakDetection() {
        assertNotNull(dataSource, "DataSource must be injected");
        assertTrue(dataSource instanceof HikariDataSource, "DataSource must be an instance of HikariDataSource");

        HikariDataSource hikari = (HikariDataSource) dataSource;

        // Verify leak detection threshold is set (>= 15000 ms)
        long leakThreshold = hikari.getLeakDetectionThreshold();
        assertTrue(leakThreshold >= 15000, "Leak detection threshold should be at least 15000ms to detect unclosed connections");

        // Verify connection validation timeout
        long validationTimeout = hikari.getValidationTimeout();
        assertTrue(validationTimeout > 0, "Validation timeout must be positive to ensure live connection checks");

        // Verify pool bounds
        assertTrue(hikari.getMaximumPoolSize() >= 5, "Maximum pool size must be sufficient for concurrent EMR workloads");
        assertTrue(hikari.getConnectionTimeout() >= 5000, "Connection timeout should give fair chance to acquire a connection");
    }
}
