package com.medicos.backend.controller;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.SystemErrorLog;
import com.medicos.backend.service.PlatformSecurityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API Endpoint for Medbuilds Platform Super Admin Command Center.
 * Exposes system-wide security metrics, threat alerts, audit forensics, and telemetry.
 */
@RestController
@RequestMapping("/api/platform/security")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
public class PlatformSecurityController {

    private final PlatformSecurityService platformSecurityService;

    @Autowired
    public PlatformSecurityController(PlatformSecurityService platformSecurityService) {
        this.platformSecurityService = platformSecurityService;
    }

    /**
     * High-level security posture, compliance rating, and threat counters.
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        return ResponseEntity.ok(platformSecurityService.getSecurityMetrics());
    }

    /**
     * Active security, compliance, and operational alerts across hospitals.
     */
    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, Object>>> getAlerts(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String organizationId) {
        return ResponseEntity.ok(platformSecurityService.getSecurityAlerts(severity, status, organizationId));
    }

    /**
     * Transition the lifecycle state of a security alert (ACKNOWLEDGE, RESOLVE, etc.).
     */
    @PostMapping("/alerts/{id}/status")
    public ResponseEntity<Map<String, Object>> updateAlertStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        String assignee = body.get("assignee");
        String notes = body.get("notes");
        return ResponseEntity.ok(platformSecurityService.updateAlertStatus(id, newStatus, assignee, notes));
    }

    /**
     * Grouped system errors and exception telemetry.
     */
    @GetMapping("/errors")
    public ResponseEntity<List<SystemErrorLog>> getErrors() {
        return ResponseEntity.ok(platformSecurityService.getSystemErrors());
    }

    /**
     * System-wide HIPAA/DPDP and platform audit trail with multi-tenant filtering.
     */
    @GetMapping("/audit-trail")
    public ResponseEntity<List<AuditLog>> getAuditTrail(
            @RequestParam(required = false) String hospitalId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(platformSecurityService.getAuditTrail(hospitalId, action, status));
    }

    /**
     * Telemetry ingestion endpoint for recording exceptions.
     */
    @PostMapping("/telemetry/report")
    public ResponseEntity<SystemErrorLog> reportTelemetry(@RequestBody Map<String, Object> payload) {
        String errorType = (String) payload.get("error_type");
        String message = (String) payload.get("message");
        String stackTrace = (String) payload.get("stack_trace");
        String endpoint = (String) payload.get("endpoint");
        String httpMethod = (String) payload.get("http_method");
        Integer statusCode = payload.get("status_code") != null ? ((Number) payload.get("status_code")).intValue() : 500;
        String severity = (String) payload.get("severity");
        String organizationId = (String) payload.get("organization_id");
        String requestId = (String) payload.get("request_id");

        SystemErrorLog log = platformSecurityService.recordSystemError(
                errorType, message, stackTrace, endpoint, httpMethod, statusCode, severity, organizationId, requestId
        );
        return ResponseEntity.ok(log);
    }
}
