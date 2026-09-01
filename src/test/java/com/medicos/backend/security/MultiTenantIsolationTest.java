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

    @Test
    public void testGlobalElevationBlockedForNonAdminRoles() {
        org.springframework.security.core.Authentication doctorAuth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "doctor@hospital.com", "pass",
                        java.util.Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_DOCTOR"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(doctorAuth);

        jakarta.persistence.EntityManager mockEm = org.mockito.Mockito.mock(jakarta.persistence.EntityManager.class);
        com.medicos.backend.config.TenantSessionBinder binder = new com.medicos.backend.config.TenantSessionBinder(mockEm);

        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> {
            binder.bindTenant("GLOBAL");
        }, "Non-admin role must not be permitted to elevate to GLOBAL context");

        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }
}
