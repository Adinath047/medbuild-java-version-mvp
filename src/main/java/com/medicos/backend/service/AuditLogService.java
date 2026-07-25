package com.medicos.backend.service;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public AuditLog logEvent(User user, String action, String resourceType, String resourceId, String ipAddress, String details) {
        AuditLog log = new AuditLog();
        log.setId("audit-" + UUID.randomUUID().toString().substring(0, 8));
        
        if (user != null) {
            log.setUserId(user.getId());
            log.setUserEmail(user.getEmail());
            log.setUserRole(user.getRole());
            log.setHospitalId(user.getHospitalId());
        } else {
            log.setUserId("anonymous");
            log.setUserRole("SYSTEM");
        }

        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setIpAddress(Optional.ofNullable(ipAddress).orElse("0.0.0.0"));
        log.setDetails(details);
        log.setTimestamp(LocalDateTime.now());

        return auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getRecentAuditLogs() {
        return auditLogRepository.findTop100ByOrderByTimestampDesc();
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getAuditLogsForResource(String resourceType, String resourceId) {
        return auditLogRepository.findByResourceTypeAndResourceIdOrderByTimestampDesc(resourceType, resourceId);
    }
}
