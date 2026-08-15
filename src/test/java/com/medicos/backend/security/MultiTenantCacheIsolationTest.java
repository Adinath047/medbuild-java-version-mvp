package com.medicos.backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

public class MultiTenantCacheIsolationTest {

    @BeforeEach
    @AfterEach
    public void cleanup() {
        TenantContext.clear();
    }

    @Test
    public void testCacheKeyPartitioningAcrossTenants() {
        // Given two distinct hospital tenants
        String tenant1 = "HOSPITAL-ALPHA";
        String tenant2 = "HOSPITAL-BETA";

        TenantContext.setTenantId(tenant1);
        String currentTenant = TenantContext.getTenantId();
        String cacheKey1 = (currentTenant != null ? currentTenant : "GLOBAL") + "_patient_101";

        TenantContext.setTenantId(tenant2);
        currentTenant = TenantContext.getTenantId();
        String cacheKey2 = (currentTenant != null ? currentTenant : "GLOBAL") + "_patient_101";

        assertNotEquals(cacheKey1, cacheKey2, "Cache keys for the same patient ID in different tenants must never collide");
        assertTrue(cacheKey1.startsWith("HOSPITAL-ALPHA_"), "Tenant 1 key must be prefixed with tenant ID");
        assertTrue(cacheKey2.startsWith("HOSPITAL-BETA_"), "Tenant 2 key must be prefixed with tenant ID");
    }

    @Test
    public void testHighConcurrencyThreadLocalTenantIntegrity() throws InterruptedException {
        int threads = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicBoolean leakDetected = new AtomicBoolean(false);

        for (int i = 0; i < threads; i++) {
            final String tenantName = "HOSPITAL-" + i;
            executor.submit(() -> {
                try {
                    TenantContext.setTenantId(tenantName);
                    // Simulate work and ensure TenantContext doesn't leak
                    for (int j = 0; j < 100; j++) {
                        if (!tenantName.equals(TenantContext.getTenantId())) {
                            leakDetected.set(true);
                        }
                    }
                } finally {
                    TenantContext.clear();
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();

        assertFalse(leakDetected.get(), "ThreadLocal TenantContext must remain completely isolated across concurrent threads");
    }
}
