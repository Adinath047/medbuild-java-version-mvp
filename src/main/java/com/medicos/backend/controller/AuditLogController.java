package com.medicos.backend.controller;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.service.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Endpoint for inspecting HIPAA/DPDP Audit Trails.
 * Accessible to Administrators, Compliance Officers, and Clinical Leaders.
 */
@RestController
@RequestMapping("/api/audit-logs")
@org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @Autowired
    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<List<AuditLog>> getRecentLogs() {
        List<AuditLog> logs = auditLogService.getRecentLogs();
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AuditLog>> getLogsForPatient(@PathVariable String patientId) {
        List<AuditLog> logs = auditLogService.getLogsForPatient(patientId);
        return ResponseEntity.ok(logs);
    }
}
