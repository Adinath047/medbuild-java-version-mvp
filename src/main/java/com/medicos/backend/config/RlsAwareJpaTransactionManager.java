package com.medicos.backend.config;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.exception.SecurityViolationException;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.TransactionDefinition;

/**
 * JpaTransactionManager that binds the PostgreSQL RLS session variable
 * (app.current_hospital_id) at the start of every transaction.
 *
 * Routing through TenantSessionBinder (rather than calling set_config directly)
 * ensures that:
 *   1. GLOBAL elevation is always gated by the same RBAC guard.
 *   2. We have a single canonical binding path — no duplicate privilege checks.
 *
 * Defence-in-depth: if the in-memory principal somehow carries "GLOBAL" but the
 * thread's SecurityContextHolder shows a non-admin role, we throw immediately
 * rather than silently allowing a cross-tenant query.
 */
public class RlsAwareJpaTransactionManager extends JpaTransactionManager {

    private final TenantSessionBinder tenantSessionBinder;

    public RlsAwareJpaTransactionManager(TenantSessionBinder tenantSessionBinder) {
        this.tenantSessionBinder = tenantSessionBinder;
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {
        super.doBegin(transaction, definition);

        String hospitalId = getCurrentHospitalId();
        if (hospitalId == null || hospitalId.isBlank()) {
            // No authenticated tenant context — RLS will use whatever the session
            // already has (or nothing). This is correct for unauthenticated requests
            // handled by JwtUserLookupService's own explicit bindTenant() call.
            return;
        }

        // Defence-in-depth: a regular principal should never carry "GLOBAL".
        // If it does, that indicates a corrupted or replayed principal object.
        if ("GLOBAL".equalsIgnoreCase(hospitalId.trim())) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean isAdmin = auth != null && auth.isAuthenticated() &&
                    auth.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .anyMatch(r -> "ROLE_SUPER_ADMIN".equalsIgnoreCase(r)
                                       || "ROLE_ADMIN".equalsIgnoreCase(r));
            if (!isAdmin) {
                throw new SecurityViolationException(
                    "Security violation: non-admin principal carries GLOBAL hospitalId — " +
                    "possible corrupted or replayed security context. Request rejected.");
            }
        }

        // Route through TenantSessionBinder so the elevation guard is always applied.
        tenantSessionBinder.bindTenant(hospitalId);
    }

    private String getCurrentHospitalId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof User) {
                return ((User) principal).getHospitalId();
            } else if (principal instanceof Patient) {
                return ((Patient) principal).getHospitalId();
            }
        }
        return null;
    }
}
