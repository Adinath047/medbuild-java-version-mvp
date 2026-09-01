package com.medicos.backend.config;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Patient;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;

/**
 * Enforces PostgreSQL Row-Level Security (RLS) session variable binding.
 * Guarded by strict RBAC checks to prevent unauthorized tenant elevation.
 */
@Component
public class TenantSessionBinder {

    private final EntityManager entityManager;

    public TenantSessionBinder(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public void bindCurrentTenant() {
        String hospitalId = getCurrentHospitalId();
        if (hospitalId == null) {
            throw new IllegalStateException(
                "No tenant context available — bindCurrentTenant() was called outside an authenticated, tenant-scoped request.");
        }
        bindTenant(hospitalId);
    }

    public void bindTenant(String hospitalId) {
        if (hospitalId == null || hospitalId.isBlank()) {
            throw new IllegalArgumentException("hospitalId must not be null/blank when binding tenant context explicitly.");
        }

        // Strict RBAC Guardrail: GLOBAL elevation is restricted to SUPER_ADMIN / ADMIN roles
        if ("GLOBAL".equalsIgnoreCase(hospitalId.trim())) {
            validateGlobalElevationPrivileges();
        }

        Session session = entityManager.unwrap(Session.class);
        session.doWork(connection -> {
            // is_local = true ensures the setting automatically reverts at transaction commit/rollback
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT set_config('app.current_hospital_id', ?, true)")) {
                ps.setString(1, hospitalId);
                ps.execute();
            }
        });
    }

    public void clearTenant() {
        Session session = entityManager.unwrap(Session.class);
        session.doWork(connection -> {
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT set_config('app.current_hospital_id', '', true)")) {
                ps.execute();
            }
        });
    }

    private void validateGlobalElevationPrivileges() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            boolean hasAdminRole = auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .anyMatch(role -> "ROLE_SUPER_ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role));

            if (!hasAdminRole) {
                throw new AccessDeniedException("Security Violation: Unauthorized attempt to elevate to GLOBAL platform tenant context.");
            }
        }
    }

    private String getCurrentHospitalId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
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
