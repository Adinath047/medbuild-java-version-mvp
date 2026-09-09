package com.medicos.backend.security;

import com.medicos.backend.dto.PatientDTO;
import com.medicos.backend.entity.AuditLog;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.PatientUpload;
import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.PatientUploadRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.repository.VitalRepository;
import com.medicos.backend.service.PatientService;
import com.medicos.backend.service.PatientUploadService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class PatientUploadSecurityTest {

    @Autowired
    private PatientUploadService uploadService;

    @Autowired
    private PatientUploadRepository uploadRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.medicos.backend.repository.AuditLogRepository auditLogRepository;

    @Autowired
    private PatientService patientService;

    @Autowired
    private VitalRepository vitalRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User doctorHsp1;
    private User doctorHsp2;
    private Patient patientHsp1;
    private Patient patientHsp2;

    @BeforeEach
    void setUp() {
        // Hospital 1 user and patient
        doctorHsp1 = new User();
        doctorHsp1.setId("usr-doc-up-hsp1");
        doctorHsp1.setName("Dr. HSP1");
        doctorHsp1.setEmail("doc.up.hsp1@hospital.com");
        doctorHsp1.setPassword("hashedpass");
        doctorHsp1.setRole("doctor");
        doctorHsp1.setHospitalId("hsp-001");
        userRepository.save(doctorHsp1);

        patientHsp1 = new Patient();
        patientHsp1.setId("pat-up-hsp1");
        patientHsp1.setUhid("UHID-UP-001");
        patientHsp1.setHospitalId("hsp-001");
        patientHsp1.setName("Patient HSP1");
        patientHsp1.setSex("Female");
        patientRepository.save(patientHsp1);

        // Hospital 2 user and patient
        doctorHsp2 = new User();
        doctorHsp2.setId("usr-doc-up-hsp2");
        doctorHsp2.setName("Dr. HSP2");
        doctorHsp2.setEmail("doc.up.hsp2@hospital.com");
        doctorHsp2.setPassword("hashedpass");
        doctorHsp2.setRole("doctor");
        doctorHsp2.setHospitalId("hsp-002");
        userRepository.save(doctorHsp2);

        patientHsp2 = new Patient();
        patientHsp2.setId("pat-up-hsp2");
        patientHsp2.setUhid("UHID-UP-002");
        patientHsp2.setHospitalId("hsp-002");
        patientHsp2.setName("Patient HSP2");
        patientHsp2.setSex("Male");
        patientRepository.save(patientHsp2);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        uploadRepository.deleteAll();
        auditLogRepository.deleteAll();
        vitalRepository.deleteAll();
        patientRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("PatientUpload: viewing, uploading, and deleting PHI documents creates HIPAA audit entries")
    void testPatientUploadPhiAccessAuditLogging() {
        TenantContext.setTenantId("hsp-001");

        // 1. Test Audit on Upload
        PatientUpload upload = new PatientUpload();
        upload.setPatientId("pat-up-hsp1");
        upload.setTitle("Cardiology ECG");
        upload.setFileUrl("data:application/pdf;base64,JVBERi0xLjQK");
        upload.setFileType("application/pdf");

        PatientUpload saved = uploadService.uploadDocument(upload, doctorHsp1);
        assertNotNull(saved.getId());

        List<com.medicos.backend.entity.AuditLog> logs = auditLogRepository.findByPatientIdOrderByTimestampDesc("pat-up-hsp1");
        assertEquals(1, logs.size());
        assertEquals("UPLOAD_PATIENT_PHI_DOCUMENT", logs.get(0).getActionType());
        assertEquals("hsp-001", logs.get(0).getHospitalId());
        assertEquals("usr-doc-up-hsp1", logs.get(0).getUserId());
        assertEquals("UHID-UP-001", logs.get(0).getPatientUhid());

        // 2. Test Audit on Read / Download
        List<PatientUpload> retrieved = uploadService.getUploadsByPatientId("pat-up-hsp1", doctorHsp1);
        assertEquals(1, retrieved.size());

        List<com.medicos.backend.entity.AuditLog> readLogs = auditLogRepository.findByPatientIdOrderByTimestampDesc("pat-up-hsp1");
        assertEquals(2, readLogs.size());
        assertEquals("READ_PATIENT_PHI_DOCUMENTS", readLogs.get(0).getActionType());
        assertEquals("usr-doc-up-hsp1", readLogs.get(0).getUserId());
        assertTrue(readLogs.get(0).getDetails().contains("clinical upload(s)"));

        // 3. Test Audit on Deletion
        uploadService.deleteUpload(saved.getId(), doctorHsp1);

        List<com.medicos.backend.entity.AuditLog> deleteLogs = auditLogRepository.findByPatientIdOrderByTimestampDesc("pat-up-hsp1");
        assertEquals(3, deleteLogs.size());
        assertEquals("DELETE_PATIENT_PHI_DOCUMENT", deleteLogs.get(0).getActionType());
    }

    @Test
    @DisplayName("PatientUpload: file_url and notes are encrypted with AES-256-GCM at rest in database")
    void testPatientUploadFileUrlAndNotesAreEncryptedAtRest() {
        TenantContext.setTenantId("hsp-001");

        String plainFilePayload = "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2Jq";
        String sensitiveNotes = "Confidential Biopsy Results: Negative for malignancy.";

        PatientUpload upload = new PatientUpload();
        upload.setPatientId("pat-up-hsp1");
        upload.setTitle("Pathology Report — Jan 2026");
        upload.setFileUrl(plainFilePayload);
        upload.setFileType("application/pdf");
        upload.setNotes(sensitiveNotes);

        PatientUpload saved = uploadService.uploadDocument(upload, doctorHsp1);
        assertNotNull(saved.getId());

        // 1. Verify at the raw database layer via direct SQL
        Map<String, Object> rawRow = jdbcTemplate.queryForMap(
                "SELECT file_url, notes FROM patient_uploads WHERE id = ?",
                saved.getId()
        );

        String rawFileUrl = (String) rawRow.get("file_url");
        String rawNotes = (String) rawRow.get("notes");

        assertNotNull(rawFileUrl);
        assertNotNull(rawNotes);

        // Crucial PHI at rest assertions:
        assertTrue(rawFileUrl.startsWith("ENC:"), "file_url must be encrypted with ENC: prefix at rest");
        assertFalse(rawFileUrl.contains(plainFilePayload), "file_url must not contain raw plaintext in database column");

        assertTrue(rawNotes.startsWith("ENC:"), "notes must be encrypted with ENC: prefix at rest");
        assertFalse(rawNotes.contains("Confidential Biopsy"), "notes must not contain plaintext PHI in database column");

        // 2. Verify seamless application-layer transparent decryption on retrieval
        List<PatientUpload> retrievedList = uploadService.getUploadsByPatientId("pat-up-hsp1");
        assertEquals(1, retrievedList.size());
        PatientUpload retrieved = retrievedList.get(0);

        assertEquals(plainFilePayload, retrieved.getFileUrl(), "file_url must be transparently decrypted on load");
        assertEquals(sensitiveNotes, retrieved.getNotes(), "notes must be transparently decrypted on load");
    }

    @Test
    @DisplayName("PatientUpload: unencrypted legacy database rows remain backward-compatible")
    void testLegacyUnencryptedUploadFallback() {
        TenantContext.setTenantId("hsp-001");

        String legacyPayload = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        String legacyNotes = "Legacy unencrypted ultrasound note";
        String uploadId = "up-legacy-001";

        // Manually insert unencrypted row without ENC: prefix
        jdbcTemplate.update(
                "INSERT INTO patient_uploads (id, patient_id, hospital_id, title, file_url, file_type, notes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                uploadId, "pat-up-hsp1", "hsp-001", "Old Ultrasound", legacyPayload, "image/png", legacyNotes
        );

        List<PatientUpload> retrieved = uploadService.getUploadsByPatientId("pat-up-hsp1");
        assertEquals(1, retrieved.size());
        assertEquals(legacyPayload, retrieved.get(0).getFileUrl());
        assertEquals(legacyNotes, retrieved.get(0).getNotes());
    }

    @Test
    @DisplayName("PatientUpload: payload exceeding 5MB ceiling is rejected with BadRequestException")
    void testUploadPayloadExceedingSizeLimitRejected() {
        TenantContext.setTenantId("hsp-001");

        // 7MB + 1 char exceeds MAX_FILE_PAYLOAD_CHARS
        StringBuilder oversized = new StringBuilder("data:application/pdf;base64,");
        while (oversized.length() <= PatientUploadService.MAX_FILE_PAYLOAD_CHARS) {
            oversized.append("AAAA");
        }

        PatientUpload upload = new PatientUpload();
        upload.setPatientId("pat-up-hsp1");
        upload.setTitle("Oversized Scan");
        upload.setFileUrl(oversized.toString());
        upload.setFileType("application/pdf");

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                uploadService.uploadDocument(upload, doctorHsp1)
        );
        assertTrue(ex.getMessage().contains("exceeds maximum allowed size"));
    }

    @Test
    @DisplayName("PatientUpload: invalid Data URI without base64 specifier is rejected")
    void testUploadInvalidDataUriFormatRejected() {
        TenantContext.setTenantId("hsp-001");

        PatientUpload upload = new PatientUpload();
        upload.setPatientId("pat-up-hsp1");
        upload.setTitle("Corrupt Data URI");
        upload.setFileUrl("data:application/pdf;malicious_payload_not_base64");
        upload.setFileType("application/pdf");

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                uploadService.uploadDocument(upload, doctorHsp1)
        );
        assertTrue(ex.getMessage().contains("Invalid Data URI"));
    }

    @Test
    @DisplayName("PatientUpload: cross-tenant patient reference is blocked and logged as DENIED")
    void testUploadCrossTenantPatientBlocked() {
        TenantContext.setTenantId("hsp-001");

        // doctor from hsp-001 attempts to attach document to patient belonging to hsp-002
        PatientUpload upload = new PatientUpload();
        upload.setPatientId("pat-up-hsp2");
        upload.setTitle("Stolen Record");
        upload.setFileUrl("data:application/pdf;base64,JVBERi0xLjQK");

        assertThrows(ResourceNotFoundException.class, () ->
                uploadService.uploadDocument(upload, doctorHsp1)
        );

        List<AuditLog> logs = auditLogRepository.findAll();
        AuditLog deniedLog = logs.stream()
                .filter(l -> "UPLOAD_PATIENT_PHI_DOCUMENT".equals(l.getActionType()) && "DENIED".equals(l.getStatus()))
                .findFirst()
                .orElse(null);

        assertNotNull(deniedLog, "Expected DENIED audit log entry for cross-tenant upload attempt");
        assertEquals("hsp-001", deniedLog.getHospitalId());
        assertEquals(doctorHsp1.getId(), deniedLog.getUserId());
        assertEquals("pat-up-hsp2", deniedLog.getPatientId());
        assertEquals("UHID-UP-002", deniedLog.getPatientUhid());
        assertTrue(deniedLog.getDetails().contains("Denied cross-tenant document upload"));
    }

    @Test
    @DisplayName("HIPAA Audit: getPatientById records READ_PATIENT_PHI with clinician attribution")
    void testPatientGetByIdAuditLogging() {
        TenantContext.setTenantId("hsp-001");

        Patient retrieved = patientService.getPatientById("pat-up-hsp1", doctorHsp1);
        assertNotNull(retrieved);
        assertEquals("Patient HSP1", retrieved.getName());

        List<AuditLog> logs = auditLogRepository.findAll();
        AuditLog phiLog = logs.stream()
                .filter(l -> "READ_PATIENT_PHI".equals(l.getActionType()))
                .findFirst()
                .orElse(null);

        assertNotNull(phiLog, "Expected READ_PATIENT_PHI audit log entry");
        assertEquals("hsp-001", phiLog.getHospitalId());
        assertEquals(doctorHsp1.getId(), phiLog.getUserId());
        assertEquals("pat-up-hsp1", phiLog.getPatientId());
        assertEquals("UHID-UP-001", phiLog.getPatientUhid());
        assertEquals("SUCCESS", phiLog.getStatus());
        assertTrue(phiLog.getDetails().contains("Viewed patient medical chart: Patient HSP1"));
    }

    @Test
    @DisplayName("HIPAA Audit: getPatientSummary records READ_PATIENT_SUMMARY audit trail")
    void testPatientGetSummaryAuditLogging() {
        TenantContext.setTenantId("hsp-001");

        PatientDTO.PatientSummaryResponse summary = patientService.getPatientSummary("pat-up-hsp1", doctorHsp1);
        assertNotNull(summary);
        assertEquals("Patient HSP1", summary.getPatient().getName());

        List<AuditLog> logs = auditLogRepository.findAll();
        AuditLog summaryLog = logs.stream()
                .filter(l -> "READ_PATIENT_SUMMARY".equals(l.getActionType()))
                .findFirst()
                .orElse(null);

        assertNotNull(summaryLog, "Expected READ_PATIENT_SUMMARY audit log entry");
        assertEquals("hsp-001", summaryLog.getHospitalId());
        assertEquals(doctorHsp1.getId(), summaryLog.getUserId());
        assertEquals("pat-up-hsp1", summaryLog.getPatientId());
        assertEquals("UHID-UP-001", summaryLog.getPatientUhid());
    }

    @Test
    @DisplayName("HIPAA Audit: getVitalsHistory records READ_VITALS_HISTORY with measurement count")
    void testVitalsHistoryAuditLogging() {
        TenantContext.setTenantId("hsp-001");

        Vital vital = new Vital();
        vital.setId("vit-audit-001");
        vital.setPatientId("pat-up-hsp1");
        vital.setHospitalId("hsp-001");
        vital.setBpSystolic(120);
        vital.setBpDiastolic(80);
        vital.setRecordedBy("usr-doc-up-hsp1");
        vital.setRecordedAt(LocalDateTime.now());
        vitalRepository.save(vital);

        List<Vital> history = patientService.getVitalsHistory("pat-up-hsp1", doctorHsp1);
        assertEquals(1, history.size());

        List<AuditLog> logs = auditLogRepository.findAll();
        AuditLog vitalsLog = logs.stream()
                .filter(l -> "READ_VITALS_HISTORY".equals(l.getActionType()))
                .findFirst()
                .orElse(null);

        assertNotNull(vitalsLog, "Expected READ_VITALS_HISTORY audit log entry");
        assertEquals("hsp-001", vitalsLog.getHospitalId());
        assertEquals(doctorHsp1.getId(), vitalsLog.getUserId());
        assertEquals("pat-up-hsp1", vitalsLog.getPatientId());
        assertTrue(vitalsLog.getDetails().contains("Retrieved 1 vitals measurement(s)"));
    }

    @Test
    @DisplayName("HIPAA Audit: audit log successfully writes even inside readOnly = true transaction via REQUIRES_NEW")
    void testReadPathAuditPersistsInsideReadOnlyTransaction() {
        TenantContext.setTenantId("hsp-001");

        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setName("ReadOnlyTxTest");
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        def.setReadOnly(true);

        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager, def);

        // Execute patient read from inside a read-only transaction boundary
        txTemplate.execute(status -> {
            Patient p = patientService.getPatientById("pat-up-hsp1", doctorHsp1);
            assertNotNull(p);
            return null;
        });

        // Verify REQUIRES_NEW successfully committed the audit log in its own independent transaction
        List<AuditLog> logs = auditLogRepository.findAll();
        boolean hasPhiLog = logs.stream().anyMatch(l -> "READ_PATIENT_PHI".equals(l.getActionType()));
        assertTrue(hasPhiLog, "Audit log must persist despite outer transaction being read-only");
    }

    @Test
    @DisplayName("HIPAA Audit: cross-tenant access is blocked and logged as DENIED")
    void testCrossTenantPatientReadBlockedAndLoggedAsDenied() {
        TenantContext.setTenantId("hsp-002");

        assertThrows(ResourceNotFoundException.class, () ->
                patientService.getPatientById("pat-up-hsp1", doctorHsp2)
        );

        List<AuditLog> logs = auditLogRepository.findAll();
        boolean hasSuccessLog = logs.stream().anyMatch(l -> "READ_PATIENT_PHI".equals(l.getActionType()) && "SUCCESS".equals(l.getStatus()));
        assertFalse(hasSuccessLog, "No successful READ_PATIENT_PHI log should exist for unauthorized cross-tenant attempt");

        AuditLog deniedLog = logs.stream()
                .filter(l -> "READ_PATIENT_PHI".equals(l.getActionType()) && "DENIED".equals(l.getStatus()))
                .findFirst()
                .orElse(null);

        assertNotNull(deniedLog, "Expected DENIED audit log entry for cross-tenant chart reconnaissance attempt");
        assertEquals("hsp-002", deniedLog.getHospitalId());
        assertEquals(doctorHsp2.getId(), deniedLog.getUserId());
        assertEquals("pat-up-hsp1", deniedLog.getPatientId());
        assertEquals("UHID-UP-001", deniedLog.getPatientUhid());
        assertTrue(deniedLog.getDetails().contains("Denied cross-tenant chart access attempt"));
    }
}
