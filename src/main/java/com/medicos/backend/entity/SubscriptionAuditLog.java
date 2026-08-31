package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "subscription_audit_logs")
public class SubscriptionAuditLog {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "from_state", length = 30, nullable = false)
    private String fromState;

    @Column(name = "to_state", length = 30, nullable = false)
    private String toState;

    @Column(name = "transitioned_at", nullable = false)
    private Instant transitionedAt = Instant.now();

    @Column(name = "actor", length = 100, nullable = false)
    private String actor = "system";

    @Column(columnDefinition = "TEXT")
    private String details;

    public SubscriptionAuditLog() {}

    public SubscriptionAuditLog(String id, String tenantId, String fromState, String toState, String actor, String details) {
        this.id = id;
        this.tenantId = tenantId;
        this.fromState = fromState;
        this.toState = toState;
        this.transitionedAt = Instant.now();
        this.actor = actor;
        this.details = details;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getFromState() { return fromState; }
    public void setFromState(String fromState) { this.fromState = fromState; }

    public String getToState() { return toState; }
    public void setToState(String toState) { this.toState = toState; }

    public Instant getTransitionedAt() { return transitionedAt; }
    public void setTransitionedAt(Instant transitionedAt) { this.transitionedAt = transitionedAt; }

    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
}
