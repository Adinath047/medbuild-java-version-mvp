package com.medicos.backend.licensing;

import com.medicos.backend.entity.TenantSubscription;
import com.medicos.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LicenseServiceTest {

    private TenantSubscriptionRepository subscriptionRepository;
    private SubscriptionAuditLogRepository auditLogRepository;
    private PatientRepository patientRepository;
    private EncounterRepository encounterRepository;
    private VitalRepository vitalRepository;
    private PrescriptionRepository prescriptionRepository;
    private BillingRepository billingRepository;
    private BedRepository bedRepository;
    private LicenseService licenseService;

    @BeforeEach
    void setUp() {
        subscriptionRepository = mock(TenantSubscriptionRepository.class);
        auditLogRepository = mock(SubscriptionAuditLogRepository.class);
        patientRepository = mock(PatientRepository.class);
        encounterRepository = mock(EncounterRepository.class);
        vitalRepository = mock(VitalRepository.class);
        prescriptionRepository = mock(PrescriptionRepository.class);
        billingRepository = mock(BillingRepository.class);
        bedRepository = mock(BedRepository.class);

        licenseService = new LicenseService(
                subscriptionRepository,
                auditLogRepository,
                patientRepository,
                encounterRepository,
                vitalRepository,
                prescriptionRepository,
                billingRepository,
                bedRepository
        );
    }

    @Test
    void testComputeLicenseState_TrialActive() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("trial");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now());
        sub.setTrialEndsAt(Instant.now().plus(Duration.ofDays(20)));
        sub.setGraceEndsAt(Instant.now().plus(Duration.ofDays(27)));
        sub.setDataExportDeadline(Instant.now().plus(Duration.ofDays(72)));

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.TRIAL_ACTIVE, state);
    }

    @Test
    void testComputeLicenseState_TrialEndingSoon() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("trial");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now().minus(Duration.ofDays(28)));
        sub.setTrialEndsAt(Instant.now().plus(Duration.ofDays(2))); // 2 days left (< 3 days)
        sub.setGraceEndsAt(Instant.now().plus(Duration.ofDays(9)));
        sub.setDataExportDeadline(Instant.now().plus(Duration.ofDays(54)));

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.TRIAL_ENDING_SOON, state);
    }

    @Test
    void testComputeLicenseState_GracePeriod() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("trial");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now().minus(Duration.ofDays(32)));
        sub.setTrialEndsAt(Instant.now().minus(Duration.ofDays(2))); // trial expired 2 days ago
        sub.setGraceEndsAt(Instant.now().plus(Duration.ofDays(5)));    // 5 days grace left
        sub.setDataExportDeadline(Instant.now().plus(Duration.ofDays(50)));

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.GRACE_PERIOD, state);
    }

    @Test
    void testComputeLicenseState_Locked() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("trial");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now().minus(Duration.ofDays(45)));
        sub.setTrialEndsAt(Instant.now().minus(Duration.ofDays(15)));
        sub.setGraceEndsAt(Instant.now().minus(Duration.ofDays(8)));  // grace period ended 8 days ago
        sub.setDataExportDeadline(Instant.now().plus(Duration.ofDays(37))); // export window still open

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.LOCKED, state);
    }

    @Test
    void testComputeLicenseState_Archived() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("trial");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now().minus(Duration.ofDays(100)));
        sub.setTrialEndsAt(Instant.now().minus(Duration.ofDays(70)));
        sub.setGraceEndsAt(Instant.now().minus(Duration.ofDays(63)));
        sub.setDataExportDeadline(Instant.now().minus(Duration.ofDays(18))); // export deadline passed

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.ARCHIVED, state);
    }

    @Test
    void testComputeLicenseState_Paid() {
        TenantSubscription sub = new TenantSubscription();
        sub.setPlanType("paid");
        sub.setStatus("active");
        sub.setTrialStartedAt(Instant.now().minus(Duration.ofDays(100)));
        sub.setTrialEndsAt(Instant.now().minus(Duration.ofDays(70)));

        LicenseState state = licenseService.computeLicenseState(sub);
        assertEquals(LicenseState.PAID, state);
    }

    @Test
    void testGetOrCreateSubscription_InitializesNewTrial() {
        when(subscriptionRepository.findByTenantId("hsp-test-123")).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any(TenantSubscription.class))).thenAnswer(i -> i.getArgument(0));

        TenantSubscription created = licenseService.getOrCreateSubscription("hsp-test-123");

        assertNotNull(created);
        assertEquals("hsp-test-123", created.getTenantId());
        assertEquals("trial", created.getPlanType());
        assertNotNull(created.getTrialStartedAt());
        assertNotNull(created.getTrialEndsAt());
        assertNotNull(created.getGraceEndsAt());
        assertNotNull(created.getDataExportDeadline());

        verify(subscriptionRepository, times(1)).save(any(TenantSubscription.class));
        verify(auditLogRepository, times(1)).save(any());
    }
}
