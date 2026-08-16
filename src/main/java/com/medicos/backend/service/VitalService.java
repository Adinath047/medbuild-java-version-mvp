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
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        if (patientId != null && !patientId.trim().isEmpty()) {
            List<Vital> vitals = vitalRepository.findByPatientIdOrderByRecordedAtDesc(patientId.trim());
            if (isTenantScoped) {
                return vitals.stream().filter(v -> hospitalId.equals(v.getHospitalId())).toList();
            }
            return vitals;
        } else if (isTenantScoped) {
            return vitalRepository.findByHospitalIdOrderByRecordedAtDesc(hospitalId);
        } else {
            return vitalRepository.findAll();
        }
    }

    @Transactional
    public Vital recordVitals(Vital vital, User user) {
        Optional.ofNullable(vital.getPatientId())
                .filter(id -> !id.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (vital.getBpSystolic() != null && (vital.getBpSystolic() < 40 || vital.getBpSystolic() > 300)) {
            throw new BadRequestException("Systolic BP must be between 40 and 300 mmHg.");
        }
        if (vital.getBpDiastolic() != null && (vital.getBpDiastolic() < 20 || vital.getBpDiastolic() > 200)) {
            throw new BadRequestException("Diastolic BP must be between 20 and 200 mmHg.");
        }
        if (vital.getHeartRate() != null && (vital.getHeartRate() < 20 || vital.getHeartRate() > 300)) {
            throw new BadRequestException("Heart rate must be between 20 and 300 bpm.");
        }
        if (vital.getSpo2() != null && (vital.getSpo2() < 0 || vital.getSpo2() > 100)) {
            throw new BadRequestException("SpO2 must be between 0 and 100%.");
        }
        if (vital.getTemperature() != null && (vital.getTemperature() < 70.0 || vital.getTemperature() > 115.0)) {
            throw new BadRequestException("Temperature must be between 70.0 and 115.0 °F.");
        }

        if (vital.getId() == null || vital.getId().isEmpty()) {
            vital.setId("vit-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            vital.setHospitalId(hospitalId);
        } else if (vital.getHospitalId() == null || vital.getHospitalId().isEmpty()) {
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
