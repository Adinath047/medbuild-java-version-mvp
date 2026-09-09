package com.medicos.backend.service;

import com.medicos.backend.entity.PatientUpload;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.PatientUploadRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class PatientUploadService {

    private final PatientUploadRepository uploadRepository;
    private final com.medicos.backend.repository.PatientRepository patientRepository;
    private final AuditLogService auditLogService;

    public PatientUploadService(PatientUploadRepository uploadRepository,
                                com.medicos.backend.repository.PatientRepository patientRepository,
                                AuditLogService auditLogService) {
        this.uploadRepository = uploadRepository;
        this.patientRepository = patientRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<PatientUpload> getUploadsByPatientId(String patientId, User user) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        com.medicos.backend.entity.Patient p = patientRepository.findById(patientId != null ? patientId.trim() : "")
                .orElseThrow(() -> new com.medicos.backend.exception.ResourceNotFoundException("Patient not found with ID: " + patientId));

        if (isTenantScoped && p.getHospitalId() != null && !hospitalId.equals(p.getHospitalId())) {
            throw new com.medicos.backend.exception.ResourceNotFoundException("Patient not found with ID: " + patientId);
        }

        List<PatientUpload> list = uploadRepository.findByPatientIdOrderByUploadedAtDesc(patientId);
        List<PatientUpload> result = isTenantScoped
                ? list.stream().filter(u -> hospitalId.equals(u.getHospitalId())).toList()
                : list;

        if (auditLogService != null) {
            auditLogService.record(
                    p.getHospitalId(),
                    "READ_PATIENT_PHI_DOCUMENTS",
                    "Retrieved " + result.size() + " clinical upload(s) for patient " + p.getName(),
                    user,
                    p.getId(),
                    p.getUhid(),
                    "SUCCESS"
            );
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<PatientUpload> getUploadsByPatientId(String patientId) {
        return getUploadsByPatientId(patientId, null);
    }

    public static final int MAX_FILE_PAYLOAD_CHARS = 7 * 1024 * 1024; // ~5MB raw payload in base64 (~7.34M characters)
    public static final int MAX_TITLE_LENGTH = 255;
    public static final int MAX_NOTES_LENGTH = 5000;

    @Transactional
    public PatientUpload uploadDocument(PatientUpload upload, User user) {
        Optional.ofNullable(upload.getPatientId())
                .filter(id -> !id.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        String rawFileUrl = Optional.ofNullable(upload.getFileUrl())
                .map(String::trim)
                .filter(url -> !url.isEmpty())
                .orElseThrow(() -> new BadRequestException("file_url is required."));

        if (rawFileUrl.length() > MAX_FILE_PAYLOAD_CHARS) {
            throw new BadRequestException("Upload payload exceeds maximum allowed size of 5MB.");
        }

        if (rawFileUrl.startsWith("data:")) {
            if (!rawFileUrl.contains(";base64,")) {
                throw new BadRequestException("Invalid Data URI: Must contain ';base64,' encoding specification.");
            }
        } else if (!rawFileUrl.startsWith("http://") && !rawFileUrl.startsWith("https://")) {
            throw new BadRequestException("Invalid file_url: Must be a base64 Data URI or HTTP/HTTPS reference.");
        }
        upload.setFileUrl(rawFileUrl);

        String title = Optional.ofNullable(upload.getTitle())
                .map(String::trim)
                .filter(t -> !t.isEmpty())
                .orElseThrow(() -> new BadRequestException("title is required."));

        if (title.length() > MAX_TITLE_LENGTH) {
            throw new BadRequestException("Title exceeds maximum allowed length of " + MAX_TITLE_LENGTH + " characters.");
        }
        upload.setTitle(title);

        if (upload.getNotes() != null) {
            String trimmedNotes = upload.getNotes().trim();
            if (trimmedNotes.length() > MAX_NOTES_LENGTH) {
                throw new BadRequestException("Notes exceed maximum allowed length of " + MAX_NOTES_LENGTH + " characters.");
            }
            upload.setNotes(trimmedNotes.isEmpty() ? null : trimmedNotes);
        }

        if (upload.getId() == null || upload.getId().isEmpty()) {
            upload.setId("up-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            upload.setHospitalId(hospitalId);
        } else if (upload.getHospitalId() == null || upload.getHospitalId().isEmpty()) {
            upload.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        String patientId = upload.getPatientId().trim();
        com.medicos.backend.entity.Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new com.medicos.backend.exception.ResourceNotFoundException("Patient not found with ID: " + patientId));

        if (!"GLOBAL".equalsIgnoreCase(upload.getHospitalId()) && patient.getHospitalId() != null && !upload.getHospitalId().equals(patient.getHospitalId())) {
            if (auditLogService != null) {
                auditLogService.record(
                        upload.getHospitalId(),
                        "UPLOAD_PATIENT_PHI_DOCUMENT",
                        "Denied cross-tenant document upload attempt for patient " + patient.getUhid()
                                + " belonging to hospital " + patient.getHospitalId(),
                        user,
                        patient.getId(),
                        patient.getUhid(),
                        "DENIED"
                );
            }
            throw new com.medicos.backend.exception.ResourceNotFoundException("Patient not found with ID: " + patientId);
        }

        PatientUpload saved = uploadRepository.save(upload);

        if (auditLogService != null) {
            auditLogService.record(
                    patient.getHospitalId(),
                    "UPLOAD_PATIENT_PHI_DOCUMENT",
                    "Uploaded clinical document: " + saved.getTitle() + " (type: " + saved.getFileType() + ")",
                    user,
                    patient.getId(),
                    patient.getUhid(),
                    "SUCCESS"
            );
        }

        return saved;
    }

    @Transactional
    public void deleteUpload(String id, User user) {
        PatientUpload upload = uploadRepository.findById(id)
                .orElseThrow(() -> new com.medicos.backend.exception.ResourceNotFoundException("Upload not found with ID: " + id));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            if (upload.getHospitalId() != null && !hospitalId.equals(upload.getHospitalId())) {
                if (auditLogService != null) {
                    auditLogService.record(
                            hospitalId,
                            "DELETE_PATIENT_PHI_DOCUMENT",
                            "Denied cross-tenant document deletion attempt for upload ID: " + id
                                    + " belonging to hospital " + upload.getHospitalId(),
                            user,
                            upload.getPatientId(),
                            null,
                            "DENIED"
                    );
                }
                throw new com.medicos.backend.exception.ResourceNotFoundException("Upload not found with ID: " + id);
            }
        }

        if (user != null && "patient".equalsIgnoreCase(user.getRole()) && !user.getId().equals(upload.getPatientId())) {
            if (auditLogService != null) {
                auditLogService.record(
                        upload.getHospitalId(),
                        "DELETE_PATIENT_PHI_DOCUMENT",
                        "Denied unauthorized patient document deletion attempt for upload ID: " + id,
                        user,
                        upload.getPatientId(),
                        null,
                        "DENIED"
                );
            }
            throw new com.medicos.backend.exception.UnauthorizedException("Access Denied: You can only delete your own uploads.");
        }

        uploadRepository.delete(upload);

        if (auditLogService != null) {
            auditLogService.record(
                    upload.getHospitalId(),
                    "DELETE_PATIENT_PHI_DOCUMENT",
                    "Deleted clinical document: " + upload.getTitle(),
                    user,
                    upload.getPatientId(),
                    null,
                    "SUCCESS"
            );
        }
    }
}
