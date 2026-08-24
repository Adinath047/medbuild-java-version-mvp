package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "hospital_subscriptions")
public class HospitalSubscription {

    @Id
    @Column(length = 64)
    private String id;

    @JsonProperty("hospital_id")
    @Column(name = "hospital_id", nullable = false, unique = true, length = 64)
    private String hospitalId;

    @JsonProperty("plan_id")
    @Column(name = "plan_id", nullable = false, length = 64)
    private String planId;

    @Column(nullable = false, length = 50)
    private String status = "TRIAL"; // TRIAL, ACTIVE, EXPIRED, SUSPENDED, CANCELLED

    @JsonProperty("start_date")
    @Column(name = "start_date")
    private LocalDateTime startDate;

    @JsonProperty("expiry_date")
    @Column(name = "expiry_date")
    private LocalDateTime expiryDate;

    @JsonProperty("trial_enabled")
    @Column(name = "trial_enabled")
    private Boolean trialEnabled = true;

    @JsonProperty("trial_start_date")
    @Column(name = "trial_start_date")
    private LocalDateTime trialStartDate;

    @JsonProperty("trial_end_date")
    @Column(name = "trial_end_date")
    private LocalDateTime trialEndDate;

    @JsonProperty("auto_renew")
    @Column(name = "auto_renew")
    private Boolean autoRenew = false;

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @JsonProperty("updated_at")
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public HospitalSubscription() {}

    public HospitalSubscription(String id, String hospitalId, String planId, String status, LocalDateTime startDate, LocalDateTime expiryDate) {
        this.id = id;
        this.hospitalId = hospitalId;
        this.planId = planId;
        this.status = status;
        this.startDate = startDate;
        this.expiryDate = expiryDate;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getStartDate() { return startDate; }
    public void setStartDate(LocalDateTime startDate) { this.startDate = startDate; }

    public LocalDateTime getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDateTime expiryDate) { this.expiryDate = expiryDate; }

    public Boolean getTrialEnabled() { return trialEnabled; }
    public void setTrialEnabled(Boolean trialEnabled) { this.trialEnabled = trialEnabled; }

    public LocalDateTime getTrialStartDate() { return trialStartDate; }
    public void setTrialStartDate(LocalDateTime trialStartDate) { this.trialStartDate = trialStartDate; }

    public LocalDateTime getTrialEndDate() { return trialEndDate; }
    public void setTrialEndDate(LocalDateTime trialEndDate) { this.trialEndDate = trialEndDate; }

    public Boolean getAutoRenew() { return autoRenew; }
    public void setAutoRenew(Boolean autoRenew) { this.autoRenew = autoRenew; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
