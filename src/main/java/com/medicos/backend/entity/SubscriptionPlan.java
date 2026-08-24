package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String code; // STARTER, PROFESSIONAL, ENTERPRISE

    @Column(length = 50)
    private String tier = "Standard";

    @JsonProperty("max_users")
    @Column(name = "max_users")
    private Integer maxUsers = 10;

    @JsonProperty("max_patients")
    @Column(name = "max_patients")
    private Integer maxPatients = 1000;

    @JsonProperty("monthly_price")
    @Column(name = "monthly_price")
    private Double monthlyPrice = 0.0;

    @Column(columnDefinition = "TEXT")
    private String features = "[]";

    @JsonProperty("is_active")
    @Column(name = "is_active")
    private Integer isActive = 1;

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public SubscriptionPlan() {}

    public SubscriptionPlan(String id, String name, String code, String tier, Integer maxUsers, Integer maxPatients, Double monthlyPrice, String features) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.tier = tier;
        this.maxUsers = maxUsers;
        this.maxPatients = maxPatients;
        this.monthlyPrice = monthlyPrice;
        this.features = features;
        this.isActive = 1;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (isActive == null) isActive = 1;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }

    public Integer getMaxUsers() { return maxUsers; }
    public void setMaxUsers(Integer maxUsers) { this.maxUsers = maxUsers; }

    public Integer getMaxPatients() { return maxPatients; }
    public void setMaxPatients(Integer maxPatients) { this.maxPatients = maxPatients; }

    public Double getMonthlyPrice() { return monthlyPrice; }
    public void setMonthlyPrice(Double monthlyPrice) { this.monthlyPrice = monthlyPrice; }

    public String getFeatures() { return features; }
    public void setFeatures(String features) { this.features = features; }

    public Integer getIsActive() { return isActive; }
    public void setIsActive(Integer isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
