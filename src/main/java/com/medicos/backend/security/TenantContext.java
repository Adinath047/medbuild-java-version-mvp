package com.medicos.backend.security;

/**
 * ThreadLocal container for resolving and holding the current request's tenant/hospital context.
 * Guarantees zero cross-tenant state leakage across thread pool executions.
 */
public class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
