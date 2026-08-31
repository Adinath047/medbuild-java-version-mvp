package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable HIPAA & DPDP Audit Log Entity.
 * Stores an append-only log of every patient record action/access across Medbuilds.
 */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(name = "hospital_id", length = 64)
    @JsonProperty("hospital_id")
    private String hospitalId;

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    @Column(name = "user_id")
    @JsonProperty("user_id")
    private String userId;

    @Column(name = "user_role")
    @JsonProperty("user_role")
    private String userRole;

    @Column(name = "user_name")
    @JsonProperty("user_name")
    private String userName;

    @Column(name = "patient_id")
    @JsonProperty("patient_id")
    private String patientId;

    @Column(name = "patient_uhid")
    @JsonProperty("patient_uhid")
    private String patientUhid;

    @Column(name = "action_type", nullable = false)
    @JsonProperty("action")
    private String actionType; // VIEW_PATIENT, CREATE_PATIENT, UPDATE_PATIENT, CHECK_IN, GENERATE_BILL, EXPORT_PDF, DPDP_ERASURE, USER_LOGIN, USER_LOGOUT

    @Column(length = 1000)
    private String details;

    @Column(name = "ip_address")
    @JsonProperty("ip_address")
    private String ipAddress;

    private String endpoint;

    @Column(name = "http_method")
    @JsonProperty("http_method")
    private String httpMethod;

    @Column(nullable = false)
    private String status = "SUCCESS"; // SUCCESS, DENIED, FAILURE

    public AuditLog() {}

    public AuditLog(String hospitalId, String userId, String userRole, String userName, String patientId, String patientUhid,
                    String actionType, String details, String ipAddress, String endpoint, String httpMethod, String status) {
        this.hospitalId = hospitalId;
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

    public AuditLog(String userId, String userRole, String userName, String patientId, String patientUhid,
                    String actionType, String details, String ipAddress, String endpoint, String httpMethod, String status) {
        this(null, userId, userRole, userName, patientId, patientUhid, actionType, details, ipAddress, endpoint, httpMethod, status);
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

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
