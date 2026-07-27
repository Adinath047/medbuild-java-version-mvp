package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable HIPAA & DPDP Audit Log Entity.
 * Stores an append-only log of every patient record action/access across MedBuild.
 */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    private String userId;
    private String userRole;
    private String userName;

    private String patientId;
    private String patientUhid;

    @Column(nullable = false)
    private String actionType; // VIEW_PATIENT, CREATE_PATIENT, UPDATE_PATIENT, CHECK_IN, GENERATE_BILL, EXPORT_PDF

    @Column(length = 1000)
    private String details;

    private String ipAddress;
    private String endpoint;
    private String httpMethod;

    @Column(nullable = false)
    private String status = "SUCCESS"; // SUCCESS, DENIED, FAILURE

    public AuditLog() {}

    public AuditLog(String userId, String userRole, String userName, String patientId, String patientUhid,
                    String actionType, String details, String ipAddress, String endpoint, String httpMethod, String status) {
        this.userId = userId;
        this.userRole = userRole;
        this.userName = userName;
        this.patientId = patientId;
        this.patientUhid = patientUhid;
        this.actionType = actionType;
        this.details = details;
        this.ipAddress = ipAddress;
        this.endpoint = endpoint;
        this.httpMethod = httpMethod;
        this.status = status != null ? status : "SUCCESS";
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getPatientUhid() { return patientUhid; }
    public void setPatientUhid(String patientUhid) { this.patientUhid = patientUhid; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
