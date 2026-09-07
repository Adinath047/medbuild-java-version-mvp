package com.medicos.backend.config;

import com.medicos.backend.security.TenantContext;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * Tenant-aware cache key generator for Spring Cache abstraction.
 * Automatically injects the current TenantContext hospitalId into all generated cache keys,
 * ensuring zero cross-tenant cache collision or data leakage for multi-tenant PHI.
 */
@Component("tenantAwareKeyGenerator")
public class TenantAwareKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "GLOBAL";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(tenantId)
          .append(":")
          .append(target.getClass().getSimpleName())
          .append(".")
          .append(method.getName());

        if (params != null && params.length > 0) {
            sb.append(":");
            for (int i = 0; i < params.length; i++) {
                if (i > 0) sb.append(",");
                Object p = params[i];
                if (p == null) {
                    sb.append("null");
                } else if (p.getClass().isArray()) {
                    sb.append(Arrays.deepToString((Object[]) p));
                } else {
                    sb.append(p.toString());
                }
            }
        }
        return sb.toString();
    }
}
