package com.medicos.backend.config;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Patient;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;

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

        Session session = entityManager.unwrap(Session.class);
        session.doWork(connection -> {
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT set_config('app.current_hospital_id', ?, true)")) {
                ps.setString(1, hospitalId);
                ps.execute();
            }
        });
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
