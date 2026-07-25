package com.medicos.backend.controller;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.service.AuditLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ResponseEntity<?> getRecentAuditLogs() {
        List<AuditLog> logs = auditLogService.getRecentAuditLogs();
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/resource/{resourceType}/{resourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ResponseEntity<?> getAuditLogsForResource(@PathVariable("resourceType") String resourceType,
                                                    @PathVariable("resourceId") String resourceId) {
        List<AuditLog> logs = auditLogService.getAuditLogsForResource(resourceType, resourceId);
        return ResponseEntity.ok(logs);
    }
}
