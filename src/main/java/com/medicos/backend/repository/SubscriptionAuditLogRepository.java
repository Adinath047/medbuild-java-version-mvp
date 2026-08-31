package com.medicos.backend.repository;

import com.medicos.backend.entity.SubscriptionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubscriptionAuditLogRepository extends JpaRepository<SubscriptionAuditLog, String> {
    List<SubscriptionAuditLog> findByTenantIdOrderByTransitionedAtDesc(String tenantId);
}
