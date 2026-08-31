package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tenant_subscriptions")
public class TenantSubscription {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "tenant_id", length = 64, nullable = false, unique = true)
    private String tenantId;

    @Column(name = "plan_type", length = 30, nullable = false)
    private String planType = "trial"; // 'trial', 'paid', 'expired', 'suspended'

    @Column(name = "trial_started_at", nullable = false, updatable = false)
    private Instant trialStartedAt;

    @Column(name = "trial_ends_at", nullable = false)
    private Instant trialEndsAt;

    @Column(name = "grace_ends_at")
    private Instant graceEndsAt;

    @Column(name = "converted_at")
    private Instant convertedAt;

    @Column(name = "status", length = 30, nullable = false)
    private String status = "active"; // 'active', 'grace', 'locked', 'archived'

    @Column(name = "data_export_deadline")
    private Instant dataExportDeadline;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public TenantSubscription() {}

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
        if (trialStartedAt == null) trialStartedAt = Instant.now();
        if (trialEndsAt == null) trialEndsAt = trialStartedAt.plusSeconds(30L * 24 * 3600); // 30-day default
        if (graceEndsAt == null) graceEndsAt = trialEndsAt.plusSeconds(7L * 24 * 3600);    // 7-day grace
        if (dataExportDeadline == null) dataExportDeadline = graceEndsAt.plusSeconds(45L * 24 * 3600); // 45-day export window
        if (status == null) status = "active";
        if (planType == null) planType = "trial";
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public Instant getTrialStartedAt() { return trialStartedAt; }
    public void setTrialStartedAt(Instant trialStartedAt) { this.trialStartedAt = trialStartedAt; }

    public Instant getTrialEndsAt() { return trialEndsAt; }
    public void setTrialEndsAt(Instant trialEndsAt) { this.trialEndsAt = trialEndsAt; }

    public Instant getGraceEndsAt() { return graceEndsAt; }
    public void setGraceEndsAt(Instant graceEndsAt) { this.graceEndsAt = graceEndsAt; }

    public Instant getConvertedAt() { return convertedAt; }
    public void setConvertedAt(Instant convertedAt) { this.convertedAt = convertedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getDataExportDeadline() { return dataExportDeadline; }
    public void setDataExportDeadline(Instant dataExportDeadline) { this.dataExportDeadline = dataExportDeadline; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
