package com.medicos.backend.security;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.SystemErrorLog;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.AuditLogRepository;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.PlatformAuditLogRepository;
import com.medicos.backend.repository.SystemErrorLogRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.service.PlatformSecurityService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PlatformSecurityService platformSecurityService;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private PlatformAuditLogRepository platformAuditLogRepository;

    @Autowired
    private SystemErrorLogRepository systemErrorLogRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private String superAdminToken;
    private String doctorToken;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("GLOBAL");

        User superAdmin = new User();
        superAdmin.setId("usr-test-super-admin");
        superAdmin.setEmail("admin@medbuilds.com");
        superAdmin.setName("Platform Super Admin");
        superAdmin.setRole("super_admin");
        superAdmin.setHospitalId("GLOBAL");
        superAdmin.setPassword("hashed");
        userRepository.save(superAdmin);

        User doctor = new User();
        doctor.setId("usr-test-doctor");
        doctor.setEmail("dr.test@hospital.com");
        doctor.setName("Dr. Test");
        doctor.setRole("doctor");
        doctor.setHospitalId("hsp-001");
        doctor.setPassword("hashed");
        userRepository.save(doctor);

        superAdminToken = tokenProvider.generateToken(superAdmin.getId(), superAdmin.getEmail(), superAdmin.getRole(), superAdmin.getHospitalId());
        doctorToken = tokenProvider.generateToken(doctor.getId(), doctor.getEmail(), doctor.getRole(), doctor.getHospitalId());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Security metrics compute posture score, 0 Dependabot CVEs, and compliance rating")
    void testSecurityMetrics() {
        Map<String, Object> metrics = platformSecurityService.getSecurityMetrics();

        assertThat(metrics).isNotNull();
        assertThat(metrics.get("complianceStatus")).isEqualTo("HIPAA_DPDP_VERIFIED_ACTIVE");
        assertThat(metrics.get("dependabotVulnerabilities")).isEqualTo(0);
        assertThat(metrics.get("dependabotStatus")).isEqualTo("12_OF_12_CVES_RESOLVED");
        assertThat((Integer) metrics.get("overallScore")).isBetween(45, 100);
        assertThat(metrics.get("connectedRepository")).isEqualTo("Adinath047/medbuild-java-version-mvp");
    }

    @Test
    @DisplayName("Denied audit events automatically generate high-priority security alerts")
    void testAlertGenerationFromDeniedLogs() {
        AuditLog deniedLog = new AuditLog("hsp-001", "usr-attacker", "RECEPTIONIST", "Eve Hacker",
                "pat-999", "UHID-001", "CROSS_TENANT_PATIENT_ACCESS_DENIED",
                "Attempted cross-tenant access to unowned patient chart", "192.168.1.50",
                "/api/patients/pat-999", "GET", "DENIED");
        deniedLog.setTimestamp(Instant.now());
        auditLogRepository.save(deniedLog);

        List<Map<String, Object>> alerts = platformSecurityService.getSecurityAlerts("CRITICAL", "NEW", null);
        assertThat(alerts).isNotEmpty();

        boolean found = alerts.stream().anyMatch(a ->
                "Unauthorized Cross-Tenant Reconnaissance Detected".equals(a.get("title"))
                        || "ACCESS_VIOLATION".equals(a.get("category")));
        assertThat(found).isTrue();
    }

    @Test
    @DisplayName("Alert lifecycle updates status and records audit history")
    void testAlertStatusTransition() {
        String testAlertId = "alt-test-001";
        Map<String, Object> updated = platformSecurityService.updateAlertStatus(
                testAlertId, "ACKNOWLEDGED", "sec-officer@medbuilds.com", "Investigating originating IP"
        );

        assertThat(updated.get("status")).isEqualTo("ACKNOWLEDGED");
        assertThat(updated.get("assignee")).isEqualTo("sec-officer@medbuilds.com");
        assertThat(updated.get("notes")).isEqualTo("Investigating originating IP");
    }

    @Test
    @DisplayName("System error grouping deduplicates identical exception fingerprints and increments occurrences")
    void testSystemErrorGrouping() {
        SystemErrorLog err1 = platformSecurityService.recordSystemError(
                "NullPointerException", "Chart data null", "stacktrace...",
                "/api/clinical/chart", "GET", 500, "HIGH", "hsp-001", "req-1"
        );
        assertThat(err1).isNotNull();
        int initialCount = err1.getOccurrences();

        SystemErrorLog err2 = platformSecurityService.recordSystemError(
                "NullPointerException", "Chart data null", "stacktrace...",
                "/api/clinical/chart", "GET", 500, "HIGH", "hsp-001", "req-2"
        );
        assertThat(err2.getId()).isEqualTo(err1.getId());
        assertThat(err2.getOccurrences()).isEqualTo(initialCount + 1);
    }

    @Test
    @DisplayName("SUPER_ADMIN role successfully accesses platform security metrics endpoint")
    void testPlatformSecurityControllerWithSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/platform/security/metrics")
                        .header("Authorization", "Bearer " + superAdminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complianceStatus").value("HIPAA_DPDP_VERIFIED_ACTIVE"))
                .andExpect(jsonPath("$.dependabotVulnerabilities").value(0));
    }

    @Test
    @DisplayName("DOCTOR role is strictly forbidden (403) from accessing platform security endpoints")
    void testPlatformSecurityControllerForbiddenForDoctor() throws Exception {
        mockMvc.perform(get("/api/platform/security/metrics")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated request is rejected (401) on platform security endpoints")
    void testPlatformSecurityControllerUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/platform/security/metrics")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }
}
