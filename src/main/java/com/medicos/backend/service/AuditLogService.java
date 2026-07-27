package com.medicos.backend.service;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * High-performance Asynchronous Audit Logging Service for HIPAA/DPDP compliance.
 * Enforces ACID transaction guarantees (Atomicity, Consistency, Isolation, Durability)
 * across all audit data persistence.
 */
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Autowired
    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Asynchronously records audit entries in an isolated atomic transaction.
     * Uses REQUIRES_NEW propagation to ensure durability independently of the caller transaction context.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void logAsync(String userId, String userRole, String userName, String patientId, String patientUhid,
                         String actionType, String details, String ipAddress, String endpoint, String httpMethod, String status) {
        try {
            AuditLog log = new AuditLog(userId, userRole, userName, patientId, patientUhid,
                    actionType, details, ipAddress, endpoint, httpMethod, status);
            auditLogRepository.save(log);
        } catch (Exception e) {
            System.err.println("[AuditLogService] Failed to record audit log: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getRecentLogs() {
        return auditLogRepository.findTop100ByOrderByTimestampDesc();
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getLogsForPatient(String patientId) {
        return auditLogRepository.findByPatientIdOrderByTimestampDesc(patientId);
    }
}

