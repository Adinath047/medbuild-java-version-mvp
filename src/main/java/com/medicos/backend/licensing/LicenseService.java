package com.medicos.backend.licensing;

import com.medicos.backend.entity.SubscriptionAuditLog;
import com.medicos.backend.entity.TenantSubscription;
import com.medicos.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class LicenseService {

    private static final Logger log = LoggerFactory.getLogger(LicenseService.class);

    private final TenantSubscriptionRepository subscriptionRepository;
    private final SubscriptionAuditLogRepository auditLogRepository;
    private final PatientRepository patientRepository;
    private final EncounterRepository encounterRepository;
    private final VitalRepository vitalRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final BillingRepository billingRepository;
    private final BedRepository bedRepository;

    public LicenseService(TenantSubscriptionRepository subscriptionRepository,
                          SubscriptionAuditLogRepository auditLogRepository,
                          PatientRepository patientRepository,
                          EncounterRepository encounterRepository,
                          VitalRepository vitalRepository,
                          PrescriptionRepository prescriptionRepository,
                          BillingRepository billingRepository,
                          BedRepository bedRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.auditLogRepository = auditLogRepository;
        this.patientRepository = patientRepository;
        this.encounterRepository = encounterRepository;
        this.vitalRepository = vitalRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.billingRepository = billingRepository;
        this.bedRepository = bedRepository;
    }

    @Transactional
    public TenantSubscription getOrCreateSubscription(String tenantId) {
        return getOrCreateSubscription(tenantId, "trial", 30);
    }

    @Transactional
    public TenantSubscription getOrCreateSubscription(String tenantId, String planType, Integer trialDays) {
        if (tenantId == null || tenantId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(tenantId)) {
            return null;
        }

        return subscriptionRepository.findByTenantId(tenantId).orElseGet(() -> {
            boolean isPaid = "PAID".equalsIgnoreCase(planType) || "ENTERPRISE".equalsIgnoreCase(planType);
            TenantSubscription sub = new TenantSubscription();
            sub.setId("sub-" + UUID.randomUUID().toString().substring(0, 8));
            sub.setTenantId(tenantId);
            Instant now = Instant.now();

            if (isPaid) {
                sub.setPlanType("paid");
                sub.setStatus("active");
                sub.setTrialStartedAt(now);
                sub.setTrialEndsAt(now.plus(Duration.ofDays(3650))); // 10 years active
                sub.setGraceEndsAt(null);
                sub.setDataExportDeadline(null);
            } else {
                int days = (trialDays != null && trialDays > 0) ? trialDays : 30;
                sub.setPlanType("trial");
                sub.setStatus("active");
                sub.setTrialStartedAt(now);
                sub.setTrialEndsAt(now.plus(Duration.ofDays(days)));
                sub.setGraceEndsAt(sub.getTrialEndsAt().plus(Duration.ofDays(7)));
                sub.setDataExportDeadline(sub.getGraceEndsAt().plus(Duration.ofDays(45)));
            }

            TenantSubscription saved = subscriptionRepository.save(sub);

            // Record creation in audit log
            auditLogRepository.save(new SubscriptionAuditLog(
                    "saud-" + UUID.randomUUID().toString().substring(0, 8),
                    tenantId,
                    "NONE",
                    isPaid ? "PAID_ACTIVE" : "TRIAL_ACTIVE",
                    "system",
                    isPaid ? "Direct Paid / Enterprise subscription activated without trial limit"
                           : ((trialDays != null && trialDays > 0) ? trialDays : 30) + "-day initial trial subscription initialized"
            ));

            return saved;
        });
    }

    public LicenseState computeLicenseState(TenantSubscription sub) {
        if (sub == null) {
            return LicenseState.TRIAL_ACTIVE;
        }

        if ("paid".equalsIgnoreCase(sub.getPlanType()) || "paid".equalsIgnoreCase(sub.getStatus())) {
            return LicenseState.PAID;
        }

        if ("archived".equalsIgnoreCase(sub.getStatus())) {
            return LicenseState.ARCHIVED;
        }

        Instant now = Instant.now();

        // 1. Check Data Export Deadline (Archived)
        if (sub.getDataExportDeadline() != null && now.isAfter(sub.getDataExportDeadline())) {
            return LicenseState.ARCHIVED;
        }

        // 2. Check Grace Period Expiration (Locked / Read-Only)
        if (sub.getGraceEndsAt() != null && now.isAfter(sub.getGraceEndsAt())) {
            return LicenseState.LOCKED;
        }

        // 3. Check Trial Expiration (Grace Period)
        if (sub.getTrialEndsAt() != null && now.isAfter(sub.getTrialEndsAt())) {
            return LicenseState.GRACE_PERIOD;
        }

        // 4. Check 3 Days Warning (Trial Ending Soon)
        if (sub.getTrialEndsAt() != null && now.isAfter(sub.getTrialEndsAt().minus(Duration.ofDays(3)))) {
            return LicenseState.TRIAL_ENDING_SOON;
        }

        return LicenseState.TRIAL_ACTIVE;
    }

    public long getDaysRemaining(TenantSubscription sub) {
        if (sub == null) return 30;
        Instant now = Instant.now();
        if ("paid".equalsIgnoreCase(sub.getPlanType())) return 365;

        LicenseState state = computeLicenseState(sub);
        switch (state) {
            case TRIAL_ACTIVE:
            case TRIAL_ENDING_SOON:
                return sub.getTrialEndsAt() != null ? Math.max(0, Duration.between(now, sub.getTrialEndsAt()).toDays()) : 0;
            case GRACE_PERIOD:
                return sub.getGraceEndsAt() != null ? Math.max(0, Duration.between(now, sub.getGraceEndsAt()).toDays()) : 0;
            case LOCKED:
                return sub.getDataExportDeadline() != null ? Math.max(0, Duration.between(now, sub.getDataExportDeadline()).toDays()) : 0;
            case ARCHIVED:
            default:
                return 0;
        }
    }

    @Transactional
    public void transitionState(TenantSubscription sub, String toState, String actor, String details) {
        String fromState = sub.getStatus();
        sub.setStatus(toState.toLowerCase());
        subscriptionRepository.save(sub);

        auditLogRepository.save(new SubscriptionAuditLog(
                "saud-" + UUID.randomUUID().toString().substring(0, 8),
                sub.getTenantId(),
                fromState.toUpperCase(),
                toState.toUpperCase(),
                actor != null ? actor : "system",
                details != null ? details : "State transition triggered"
        ));
        log.info("Tenant {} transitioned from {} to {}", sub.getTenantId(), fromState, toState);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> exportHospitalData(String hospitalId) {
        Map<String, Object> export = new LinkedHashMap<>();
        export.put("hospital_id", hospitalId);
        export.put("exported_at", Instant.now().toString());
        export.put("schema_version", "2.0-clinical-export");
        export.put("patients", patientRepository.findAll());
        export.put("encounters", encounterRepository.findAll());
        export.put("vitals", vitalRepository.findAll());
        export.put("prescriptions", prescriptionRepository.findAll());
        export.put("billing", billingRepository.findAll());
        export.put("beds", bedRepository.findAll());
        return export;
    }

    @Transactional
    public void timeTravel(String tenantId, int offsetDays) {
        TenantSubscription sub = getOrCreateSubscription(tenantId);
        if (sub != null) {
            Instant now = Instant.now().plus(Duration.ofDays(offsetDays));
            sub.setTrialEndsAt(now);
            sub.setGraceEndsAt(now.plus(Duration.ofDays(7)));
            sub.setDataExportDeadline(now.plus(Duration.ofDays(45)));
            subscriptionRepository.save(sub);
            
            auditLogRepository.save(new SubscriptionAuditLog(
                    "saud-" + UUID.randomUUID().toString().substring(0, 8),
                    tenantId,
                    "TIME_TRAVEL",
                    "OFFSET_" + offsetDays,
                    "qa_engineer",
                    "Simulated time-travel offset by " + offsetDays + " days"
            ));
        }
    }
}
