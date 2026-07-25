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
        return uploadRepository.findByPatientIdOrderByUploadedAtDesc(patientId);
    }

    @Transactional
    public PatientUpload uploadDocument(PatientUpload upload, User user) {
        Optional.ofNullable(upload.getPatientId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        Optional.ofNullable(upload.getFileUrl())
                .filter(url -> !url.isEmpty())
                .orElseThrow(() -> new BadRequestException("file_url is required."));

        Optional.ofNullable(upload.getTitle())
                .filter(t -> !t.isEmpty())
                .orElseThrow(() -> new BadRequestException("title is required."));

        if (upload.getId() == null || upload.getId().isEmpty()) {
            upload.setId("up-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (upload.getHospitalId() == null || upload.getHospitalId().isEmpty()) {
            upload.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        return uploadRepository.save(upload);
    }
}
