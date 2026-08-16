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

    public PatientUploadService(PatientUploadRepository uploadRepository) {
        this.uploadRepository = uploadRepository;
    }

    @Transactional(readOnly = true)
    public List<PatientUpload> getUploadsByPatientId(String patientId) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        List<PatientUpload> list = uploadRepository.findByPatientIdOrderByUploadedAtDesc(patientId);
        if (isTenantScoped) {
            return list.stream().filter(u -> hospitalId.equals(u.getHospitalId())).toList();
        }
        return list;
    }

    @Transactional
    public PatientUpload uploadDocument(PatientUpload upload, User user) {
        Optional.ofNullable(upload.getPatientId())
                .filter(id -> !id.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        Optional.ofNullable(upload.getFileUrl())
                .filter(url -> !url.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("file_url is required."));

        Optional.ofNullable(upload.getTitle())
                .filter(t -> !t.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("title is required."));

        if (upload.getId() == null || upload.getId().isEmpty()) {
            upload.setId("up-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            upload.setHospitalId(hospitalId);
        } else if (upload.getHospitalId() == null || upload.getHospitalId().isEmpty()) {
            upload.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        return uploadRepository.save(upload);
    }

    @Transactional
    public void deleteUpload(String id, User user) {
        PatientUpload upload = uploadRepository.findById(id)
                .orElseThrow(() -> new com.medicos.backend.exception.ResourceNotFoundException("Upload not found with ID: " + id));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            if (upload.getHospitalId() != null && !hospitalId.equals(upload.getHospitalId())) {
                throw new com.medicos.backend.exception.ResourceNotFoundException("Upload not found with ID: " + id);
            }
        }

        if (user != null && "patient".equalsIgnoreCase(user.getRole()) && !user.getId().equals(upload.getPatientId())) {
            throw new com.medicos.backend.exception.UnauthorizedException("Access Denied: You can only delete your own uploads.");
        }

        uploadRepository.delete(upload);
    }
}
