package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "system_error_logs", indexes = {
    @Index(name = "idx_err_fingerprint", columnList = "fingerprint"),
    @Index(name = "idx_err_severity", columnList = "severity"),
    @Index(name = "idx_err_last_seen", columnList = "last_seen_at")
})
public class SystemErrorLog {

    @Id
    @Column(length = 64)
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false, length = 64)
    private String fingerprint; // MD5/SHA hash of errorType + endpoint for grouping

    @Column(nullable = false, length = 100)
    private String service = "medicos-backend";

    @Column(nullable = false, length = 255)
    private String endpoint;

    @JsonProperty("http_method")
    @Column(name = "http_method", length = 20)
    private String httpMethod;

    @JsonProperty("status_code")
    @Column(name = "status_code")
    private Integer statusCode = 500;

    @JsonProperty("error_type")
    @Column(name = "error_type", length = 150)
    private String errorType;

    @Column(columnDefinition = "TEXT")
    private String message;

    @JsonProperty("stack_trace")
    @Column(name = "stack_trace", columnDefinition = "TEXT")
    private String stackTrace;

    @Column(nullable = false, length = 30)
    private String severity = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @JsonProperty("organization_id")
    @Column(name = "organization_id", length = 64)
    private String organizationId;

    @JsonProperty("request_id")
    @Column(name = "request_id", length = 64)
    private String requestId;

    @Column(nullable = false)
    private Integer occurrences = 1;

    @JsonProperty("first_seen_at")
    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt = LocalDateTime.now();

    @JsonProperty("last_seen_at")
    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt = LocalDateTime.now();

    public SystemErrorLog() {}

    public SystemErrorLog(String fingerprint, String service, String endpoint, String httpMethod,
                          Integer statusCode, String errorType, String message, String stackTrace,
                          String severity, String organizationId, String requestId) {
        this.id = UUID.randomUUID().toString();
        this.fingerprint = fingerprint;
        this.service = service != null ? service : "medicos-backend";
        this.endpoint = endpoint;
        this.httpMethod = httpMethod;
        this.statusCode = statusCode != null ? statusCode : 500;
        this.errorType = errorType;
        this.message = message;
        this.stackTrace = stackTrace;
        this.severity = severity != null ? severity : "MEDIUM";
        this.organizationId = organizationId;
        this.requestId = requestId;
        this.occurrences = 1;
        this.firstSeenAt = LocalDateTime.now();
        this.lastSeenAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (firstSeenAt == null) firstSeenAt = LocalDateTime.now();
        if (lastSeenAt == null) lastSeenAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFingerprint() { return fingerprint; }
    public void setFingerprint(String fingerprint) { this.fingerprint = fingerprint; }

    public String getService() { return service; }
    public void setService(String service) { this.service = service; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }

    public Integer getStatusCode() { return statusCode; }
    public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }

    public String getErrorType() { return errorType; }
    public void setErrorType(String errorType) { this.errorType = errorType; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getStackTrace() { return stackTrace; }
    public void setStackTrace(String stackTrace) { this.stackTrace = stackTrace; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public Integer getOccurrences() { return occurrences; }
    public void setOccurrences(Integer occurrences) { this.occurrences = occurrences; }

    public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(LocalDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
