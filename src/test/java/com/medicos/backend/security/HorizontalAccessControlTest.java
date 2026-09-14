package com.medicos.backend.security;

import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.AuditLogRepository;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.service.PatientService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Horizontal Access Control & IDOR Security Test Suite
 *
 * Verifies that authorized roles cannot access data across tenant boundaries
 * (Horizontal Privilege Escalation / Insecure Direct Object Reference).
 *
 * Failure modes tested:
 *   1. Cross-Tenant Patient Chart Read (IDOR):
 *      A clinician in Hospital 1 attempting to access Hospital 2's patient.
 *      Must return 404 (ResourceNotFoundException) rather than 403 to prevent
 *      patient ID enumeration attacks.
 *   2. HIPAA/DPDP Audit Trail for IDOR:
 *      Every blocked cross-tenant chart access must generate a security audit log
 *      with action=READ_PATIENT_PHI and status=DENIED.
 *   3. Cross-Tenant Patient Erasure Prevention:
 *      An Admin in Hospital 1 must NOT be able to trigger DPDP erasure for
 *      a patient belonging to Hospital 2.
 *   4. DPDP Section 12 Erasure Compliance & Audit Trail:
 *      A legitimate admin erasure must securely anonymize patient PII while
 *      generating an immutable DPDP_ERASURE audit record with status=SUCCESS.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Horizontal Access Control & IDOR Tests")
class HorizontalAccessControlTest {

    @Autowired
    private PatientService patientService;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private User doctorHsp1;
    private User adminHsp1;
    private User doctorHsp2;
    private Patient patientHsp1;
    private Patient patientHsp2;

    @BeforeEach
    void setUp() {
        TenantContext.clear();

        // Clinicians & Administrators
        doctorHsp1 = new User();
        doctorHsp1.setId("usr-hac-doc-hsp1");
        doctorHsp1.setName("Dr. Alice Hosp1");
        doctorHsp1.setHospitalId("hsp-001");
        doctorHsp1.setRole("DOCTOR");

        adminHsp1 = new User();
        adminHsp1.setId("usr-hac-adm-hsp1");
        adminHsp1.setName("Admin Hosp1");
        adminHsp1.setHospitalId("hsp-001");
        adminHsp1.setRole("ADMIN");

        doctorHsp2 = new User();
        doctorHsp2.setId("usr-hac-doc-hsp2");
        doctorHsp2.setName("Dr. Bob Hosp2");
        doctorHsp2.setHospitalId("hsp-002");
        doctorHsp2.setRole("DOCTOR");

        // Hospital 1 Patient
        patientHsp1 = new Patient();
        patientHsp1.setId("pat-hac-hsp1-01");
        patientHsp1.setName("John Doe Hsp1");
        patientHsp1.setHospitalId("hsp-001");
        patientHsp1.setUhid("UHID-HAC-001");
        patientHsp1.setPhone("+919876543210");
        patientHsp1.setEmail("john.doe@example.com");
        patientHsp1.setIsActive(1);
        patientRepository.save(patientHsp1);

        // Hospital 2 Patient
        patientHsp2 = new Patient();
        patientHsp2.setId("pat-hac-hsp2-01");
        patientHsp2.setName("Jane Smith Hsp2");
        patientHsp2.setHospitalId("hsp-002");
        patientHsp2.setUhid("UHID-HAC-002");
        patientHsp2.setPhone("+919876543211");
        patientHsp2.setEmail("jane.smith@example.com");
        patientHsp2.setIsActive(1);
        patientRepository.save(patientHsp2);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        patientRepository.deleteById("pat-hac-hsp1-01");
        patientRepository.deleteById("pat-hac-hsp2-01");
        patientRepository.deleteById("pat-hac-erasure-target");
    }

    // -----------------------------------------------------------------------
    // Test 1: IDOR Chart Access Prevention
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("IDOR: Doctor in Hospital 1 cannot read patient chart of Hospital 2")
    void doctorCannotReadForeignHospitalPatient() {
        TenantContext.setTenantId("hsp-001");

        // Attempting to read Hospital 2's patient while in Hospital 1 context
        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getPatientById(patientHsp2.getId(), doctorHsp1)
        );
    }

    @Test
    @DisplayName("IDOR: Doctor in Hospital 2 cannot read patient chart of Hospital 1")
    void doctorHsp2CannotReadHsp1Patient() {
        TenantContext.setTenantId("hsp-002");

        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getPatientById(patientHsp1.getId(), doctorHsp2)
        );
    }

    // -----------------------------------------------------------------------
    // Test 2: Audit Trail on Blocked Horizontal Access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Audit Trail: Blocked cross-tenant access creates DENIED audit log")
    void blockedCrossTenantAccessGeneratesSecurityAuditLog() {
        TenantContext.setTenantId("hsp-001");

        // Trigger blocked IDOR chart read attempt
        try {
            patientService.getPatientById(patientHsp2.getId(), doctorHsp1);
        } catch (ResourceNotFoundException ignored) {
            // Expected stealth 404
        }

        // Verify audit log captured the unauthorized access attempt
        List<AuditLog> auditLogs = auditLogRepository.findByPatientIdOrderByTimestampDesc(patientHsp2.getId());
        assertFalse(auditLogs.isEmpty(), "Security incident must be logged in audit trail");

        AuditLog denialLog = auditLogs.stream()
                .filter(log -> "DENIED".equals(log.getStatus()))
                .findFirst()
                .orElse(null);

        assertNotNull(denialLog, "Audit log with status=DENIED must be present");
        assertEquals("READ_PATIENT_PHI", denialLog.getActionType());
        assertEquals("usr-hac-doc-hsp1", denialLog.getUserId());
        assertTrue(denialLog.getDetails().contains("cross-tenant"), "Details must specify cross-tenant access attempt");
    }

    // -----------------------------------------------------------------------
    // Test 3: Horizontal Escalation on Erasure Endpoint
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Horizontal Escalation: Admin in Hospital 1 cannot erase patient belonging to Hospital 2")
    void adminCannotEraseForeignHospitalPatient() {
        TenantContext.setTenantId("hsp-001");

        // Admin of Hospital 1 attempts to invoke DPDP erasure on Hospital 2's patient
        assertThrows(ResourceNotFoundException.class, () ->
            patientService.executeErasure(patientHsp2.getId(), adminHsp1)
        );

        // Verify Hospital 2 patient remained untouched
        Patient stillExists = patientRepository.findById(patientHsp2.getId()).orElse(null);
        assertNotNull(stillExists);
        assertEquals("Jane Smith Hsp2", stillExists.getName(), "Foreign patient name must not be anonymized");
        assertNotNull(stillExists.getPhone(), "Foreign patient phone must not be cleared");
    }

    // -----------------------------------------------------------------------
    // Test 4: Authorized DPDP Erasure Anonymization & Audit Trail Verification
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("DPDP Compliance: Admin erasure anonymizes PII and creates immutable audit record")
    void adminErasureAnonymizesDataAndCreatesAuditTrail() {
        TenantContext.setTenantId("hsp-001");

        // Create dedicated erasure target patient in Hospital 1
        Patient target = new Patient();
        target.setId("pat-hac-erasure-target");
        target.setName("Robert Sensitive Data");
        target.setHospitalId("hsp-001");
        target.setUhid("UHID-ERASURE-001");
        target.setPhone("+919812345678");
        target.setEmail("robert.sensitive@example.com");
        target.setNotes("High-risk clinical condition notes");
        target.setIsActive(1);
        target.setConsentGiven(true);
        patientRepository.save(target);

        // Admin executes DPDP Section 12 erasure
        patientService.executeErasure(target.getId(), adminHsp1);

        // 1. Verify Patient Record Anonymization
        Patient erased = patientRepository.findById(target.getId()).orElse(null);
        assertNotNull(erased, "Patient entity must be preserved for relational integrity");
        assertEquals("ANONYMIZED_PATIENT", erased.getName(), "Name must be replaced with ANONYMIZED_PATIENT");
        assertNull(erased.getPhone(), "Phone must be nulled");
        assertNull(erased.getEmail(), "Email must be nulled");
        assertEquals(0, erased.getIsActive(), "Patient must be marked inactive");
        assertFalse(Boolean.TRUE.equals(erased.getConsentGiven()), "Consent must be revoked");
        assertTrue(erased.getNotes().contains("DPDP SECTION 12"), "Notes must record statutory erasure basis");

        // 2. Verify Immutable Compliance Audit Trail
        List<AuditLog> logs = auditLogRepository.findByPatientIdOrderByTimestampDesc(target.getId());
        assertFalse(logs.isEmpty(), "Erasure audit log must be recorded");

        AuditLog erasureLog = logs.stream()
                .filter(l -> "DPDP_ERASURE".equals(l.getActionType()))
                .findFirst()
                .orElse(null);

        assertNotNull(erasureLog, "DPDP_ERASURE audit log entry must exist");
        assertEquals("SUCCESS", erasureLog.getStatus());
        assertEquals("ADMIN", erasureLog.getUserRole());
        assertEquals("usr-hac-adm-hsp1", erasureLog.getUserId());
        assertTrue(erasureLog.getDetails().contains("DPDP Section 12"), "Audit details must cite statutory authority");
    }

    // -----------------------------------------------------------------------
    // Test 5: Horizontal Scoping on Summary & Vitals
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("IDOR: Hospital 1 context blocks patient summary for Hospital 2")
    void getPatientSummaryCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");

        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getPatientSummary(patientHsp2.getId())
        );
    }

    @Test
    @DisplayName("IDOR: Hospital 1 context blocks vitals history for Hospital 2")
    void getVitalsHistoryCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");

        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getVitalsHistory(patientHsp2.getId())
        );
    }
}
