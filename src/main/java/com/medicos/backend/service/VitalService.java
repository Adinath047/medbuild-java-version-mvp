package com.medicos.backend.service;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.VitalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class VitalService {

    private final VitalRepository vitalRepository;

    public VitalService(VitalRepository vitalRepository) {
        this.vitalRepository = vitalRepository;
    }

    @Transactional(readOnly = true)
    public List<Vital> getVitals(String patientId) {
        return Optional.ofNullable(patientId)
                .filter(id -> !id.isEmpty())
                .map(vitalRepository::findByPatientIdOrderByRecordedAtDesc)
                .orElseGet(vitalRepository::findAll);
    }

    @Transactional
    public Vital recordVitals(Vital vital, User user) {
        Optional.ofNullable(vital.getPatientId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (vital.getId() == null || vital.getId().isEmpty()) {
            vital.setId("vit-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (vital.getHospitalId() == null || vital.getHospitalId().isEmpty()) {
            vital.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (vital.getRecordedBy() == null || vital.getRecordedBy().isEmpty()) {
            vital.setRecordedBy(Optional.ofNullable(user).map(User::getId).orElse("usr-admin-001"));
        }

        if (vital.getRecordedAt() == null) {
            vital.setRecordedAt(LocalDateTime.now());
        }

        return vitalRepository.save(vital);
    }
}
