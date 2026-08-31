package com.medicos.backend.licensing;

import com.medicos.backend.entity.TenantSubscription;
import com.medicos.backend.repository.TenantSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class LicenseScheduler {

    private static final Logger log = LoggerFactory.getLogger(LicenseScheduler.class);

    private final TenantSubscriptionRepository subscriptionRepository;
    private final LicenseService licenseService;

    public LicenseScheduler(TenantSubscriptionRepository subscriptionRepository, LicenseService licenseService) {
        this.subscriptionRepository = subscriptionRepository;
        this.licenseService = licenseService;
    }

    /**
     * Hourly idempotent background job that transitions tenant subscriptions
     * according to the immutable database UTC clock.
     */
    @Scheduled(fixedRate = 3600000, initialDelay = 60000) // Every hour
    @Transactional
    public void evaluateSubscriptions() {
        log.info("Running scheduled license evaluation job...");
        try {
            List<TenantSubscription> activeSubs = subscriptionRepository.findAllActiveForUpdate();
            
            for (TenantSubscription sub : activeSubs) {
                LicenseState currentState = licenseService.computeLicenseState(sub);
                String targetStatus = currentState.name().toLowerCase();

                // Check if a state transition is warranted
                if (!targetStatus.equalsIgnoreCase(sub.getStatus())) {
                    String reason = String.format("Automated lifecycle transition from %s to %s based on UTC clock",
                            sub.getStatus().toUpperCase(), currentState.name());
                    licenseService.transitionState(sub, targetStatus, "system_scheduler", reason);
                }
            }
        } catch (Exception e) {
            log.error("Error executing license evaluation scheduler: {}", e.getMessage(), e);
        }
    }
}
