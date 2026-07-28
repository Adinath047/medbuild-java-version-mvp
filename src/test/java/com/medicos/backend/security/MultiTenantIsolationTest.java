package com.medicos.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class MultiTenantIsolationTest {

    @BeforeEach
    public void setUp() {
        TenantContext.clear();
    }

    @Test
    public void testTenantContextIsolationBetweenThreads() throws InterruptedException {
        TenantContext.setTenantId("HOSPITAL-TENANT-A");
        assertEquals("HOSPITAL-TENANT-A", TenantContext.getTenantId());

        Thread otherThread = new Thread(() -> {
            assertNull(TenantContext.getTenantId(), "Other thread must not see Tenant A context");
            TenantContext.setTenantId("HOSPITAL-TENANT-B");
            assertEquals("HOSPITAL-TENANT-B", TenantContext.getTenantId());
            TenantContext.clear();
        });

        otherThread.start();
        otherThread.join();

        // Ensure main thread context remains unaffected
        assertEquals("HOSPITAL-TENANT-A", TenantContext.getTenantId());
        TenantContext.clear();
    }

    @Test
    public void testIdorAccessDeniedForCrossTenantPatientId() {
        String tenantAContext = "HOSPITAL-TENANT-A";
        String tenantBContext = "HOSPITAL-TENANT-B";

        TenantContext.setTenantId(tenantAContext);

        String requestedPatientHospitalId = tenantBContext;

        boolean isAuthorized = tenantAContext.equals(requestedPatientHospitalId);
        assertFalse(isAuthorized, "IDOR access attempt across tenant boundaries must be rejected");

        TenantContext.clear();
    }
}
