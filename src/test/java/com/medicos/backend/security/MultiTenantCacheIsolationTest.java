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

    @Test
    public void testTenantAwareKeyGeneratorIsolation() throws Exception {
        com.medicos.backend.config.TenantAwareKeyGenerator keyGenerator =
                new com.medicos.backend.config.TenantAwareKeyGenerator();

        java.lang.reflect.Method dummyMethod = String.class.getMethod("substring", int.class);
        String targetService = "PatientService";

        TenantContext.setTenantId("hsp-001");
        Object key1 = keyGenerator.generate(targetService, dummyMethod, 42);

        TenantContext.setTenantId("hsp-002");
        Object key2 = keyGenerator.generate(targetService, dummyMethod, 42);

        assertNotNull(key1);
        assertNotNull(key2);
        assertNotEquals(key1, key2, "Keys for same method and arguments in different hospitals must differ");
        assertTrue(key1.toString().startsWith("hsp-001:"), "Key 1 must be prefixed with hsp-001 tenant ID");
        assertTrue(key2.toString().startsWith("hsp-002:"), "Key 2 must be prefixed with hsp-002 tenant ID");
        assertTrue(key1.toString().contains("42"), "Key must include method parameters");
    }

    @Test
    public void testCacheEvictKeySymmetryAndCrossTenantEvictionSafety() throws Exception {
        com.medicos.backend.config.TenantAwareKeyGenerator keyGenerator =
                new com.medicos.backend.config.TenantAwareKeyGenerator();

        java.lang.reflect.Method getMethod = String.class.getMethod("substring", int.class);
        String service = "PatientService";
        String patientId = "pat-12345";

        // Read path in Hospital A
        TenantContext.setTenantId("hsp-001");
        Object readKeyHsp1 = keyGenerator.generate(service, getMethod, patientId);

        // Eviction path in Hospital A (e.g. updating patient in same hospital)
        Object evictKeyHsp1 = keyGenerator.generate(service, getMethod, patientId);

        // Eviction path in Hospital B (e.g. attempted eviction by another hospital)
        TenantContext.setTenantId("hsp-002");
        Object evictKeyHsp2 = keyGenerator.generate(service, getMethod, patientId);

        // Read and Evict keys MUST be symmetric within the same tenant
        assertEquals(readKeyHsp1, evictKeyHsp1, "Eviction key must match read key for the same tenant to ensure successful invalidation");

        // Eviction in Hospital B must NEVER match Hospital A's cache key
        assertNotEquals(evictKeyHsp2, readKeyHsp1, "Hospital B eviction key must never collide with or wipe Hospital A cached data");
    }
}
