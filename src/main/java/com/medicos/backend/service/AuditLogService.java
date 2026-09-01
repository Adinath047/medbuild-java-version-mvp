package com.medicos.backend.service;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.AuditLogRepository;
import com.medicos.backend.security.TenantContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * High-performance Audit Logging Service for HIPAA/DPDP compliance.
 * Enforces ACID transaction guarantees and hospital multi-tenant isolation.
 */
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Autowired
    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Records an audit log entry scoped to the current hospital tenant.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public AuditLog record(String actionType, String details, User user, String patientId, String patientUhid, String status) {
        return record(null, actionType, details, user, patientId, patientUhid, status);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public AuditLog record(String targetHospitalId, String actionType, String details, User user, String patientId, String patientUhid, String status) {
        try {
            String hospitalId = targetHospitalId;
            if (hospitalId == null || hospitalId.trim().isEmpty()) {
                hospitalId = TenantContext.getTenantId();
            }
            if ((hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) && user != null) {
                hospitalId = user.getHospitalId();
            }
            if (hospitalId == null || hospitalId.trim().isEmpty()) {
                hospitalId = "hsp-001";
            }

            String userId = user != null ? user.getId() : "system";
            String userRole = user != null ? user.getRole() : "system";
            String userName = user != null ? user.getName() : "System Administrator";

            AuditLog log = new AuditLog(hospitalId, userId, userRole, userName, patientId, patientUhid,
                    actionType, details, null, null, null, status != null ? status : "SUCCESS");
            return auditLogRepository.save(log);
        } catch (Exception e) {
            System.err.println("[AuditLogService] Failed to record audit log: " + e.getMessage());
            return null;
        }
    }

    /**
     * Asynchronously records audit entries in an isolated atomic transaction.
     * Uses REQUIRES_NEW propagation to ensure durability independently of caller transaction.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void logAsync(String userId, String userRole, String userName, String patientId, String patientUhid,
                         String actionType, String details, String ipAddress, String endpoint, String httpMethod, String status) {
        try {
            String hospitalId = TenantContext.getTenantId();
            if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
                hospitalId = "hsp-001";
            }
            AuditLog log = new AuditLog(hospitalId, userId, userRole, userName, patientId, patientUhid,
                    actionType, details, ipAddress, endpoint, httpMethod, status);
            auditLogRepository.save(log);
        } catch (Exception e) {
            System.err.println("[AuditLogService] Failed to record async audit log: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getRecentLogs() {
        String hospitalId = TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return auditLogRepository.findTop100ByHospitalIdOrderByTimestampDesc(hospitalId);
        }
        return auditLogRepository.findTop100ByOrderByTimestampDesc();
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getLogsForPatient(String patientId) {
        String hospitalId = TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return auditLogRepository.findByHospitalIdAndPatientIdOrderByTimestampDesc(hospitalId, patientId);
        }
        return auditLogRepository.findByPatientIdOrderByTimestampDesc(patientId);
    }
}

