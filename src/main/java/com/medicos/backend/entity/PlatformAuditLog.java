package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "platform_audit_logs", indexes = {
    @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_actor", columnList = "actor_id"),
    @Index(name = "idx_audit_org", columnList = "organization_id"),
    @Index(name = "idx_audit_resource", columnList = "resource_type, resource_id"),
    @Index(name = "idx_audit_action", columnList = "action")
})
public class PlatformAuditLog {

    @Id
    @Column(length = 64)
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @JsonProperty("actor_id")
    @Column(name = "actor_id", nullable = false, length = 64)
    private String actorId;

    @JsonProperty("actor_email")
    @Column(name = "actor_email", length = 150)
    private String actorEmail;

    @JsonProperty("actor_role")
    @Column(name = "actor_role", length = 50)
    private String actorRole;

    @JsonProperty("organization_id")
    @Column(name = "organization_id", length = 64)
    private String organizationId;

    @Column(nullable = false, length = 100)
    private String action; // e.g. CREATE_HOSPITAL, SUSPEND_HOSPITAL, EXTEND_TRIAL, CHANGE_ROLE

    @JsonProperty("resource_type")
    @Column(name = "resource_type", nullable = false, length = 50)
    private String resourceType; // HOSPITAL, USER, SUBSCRIPTION, TRIAL, INCIDENT, SYSTEM

    @JsonProperty("resource_id")
    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @Column(nullable = false, length = 30)
    private String result = "SUCCESS"; // SUCCESS, FAILURE, DENIED

    @Column(length = 1000)
    private String reason;

    @JsonProperty("request_id")
    @Column(name = "request_id", length = 64)
    private String requestId;

    @JsonProperty("ip_address")
    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "endpoint", length = 255)
    private String endpoint;

    @JsonProperty("http_method")
    @Column(name = "http_method", length = 20)
    private String httpMethod;

    @Column(columnDefinition = "TEXT")
    private String metadata; // JSON sanitized metadata, NO PHI / PASSWORDS

    public PlatformAuditLog() {}

    public PlatformAuditLog(String actorId, String actorEmail, String actorRole, String organizationId,
                            String action, String resourceType, String resourceId, String result,
                            String reason, String requestId, String ipAddress, String endpoint,
                            String httpMethod, String metadata) {
        this.id = UUID.randomUUID().toString();
        this.timestamp = LocalDateTime.now();
        this.actorId = actorId;
        this.actorEmail = actorEmail;
        this.actorRole = actorRole;
        this.organizationId = organizationId;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.result = result != null ? result : "SUCCESS";
        this.reason = reason;
        this.requestId = requestId;
        this.ipAddress = ipAddress;
        this.endpoint = endpoint;
        this.httpMethod = httpMethod;
        this.metadata = metadata;
    }

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (timestamp == null) timestamp = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}
