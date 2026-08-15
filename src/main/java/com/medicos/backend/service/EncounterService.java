package com.medicos.backend.service;

import com.medicos.backend.entity.Encounter;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.EncounterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class EncounterService {

    private final EncounterRepository encounterRepository;

    public EncounterService(EncounterRepository encounterRepository) {
        this.encounterRepository = encounterRepository;
    }

    @Transactional(readOnly = true)
    public List<Encounter> getEncounters(String patientId, String doctorId) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (patientId != null && !patientId.isEmpty()) {
            return encounterRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        } else if (doctorId != null && !doctorId.isEmpty()) {
            return encounterRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId);
        } else if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return encounterRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId);
        } else {
            return encounterRepository.findAll();
        }
    }

    @Transactional(readOnly = true)
    public Encounter getEncounterById(String id) {
        return encounterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found with ID: " + id));
    }

    @Transactional
    public Encounter createEncounter(Encounter encounter, User user) {
        Optional.ofNullable(encounter.getPatientId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (encounter.getId() == null || encounter.getId().isEmpty()) {
            encounter.setId("enc-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (encounter.getHospitalId() == null || encounter.getHospitalId().isEmpty()) {
            encounter.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (encounter.getDoctorId() == null || encounter.getDoctorId().isEmpty()) {
            encounter.setDoctorId(Optional.ofNullable(user).map(User::getId).orElse("usr-doc-001"));
        }

        if (encounter.getCreatedAt() == null) encounter.setCreatedAt(LocalDateTime.now());
        if (encounter.getUpdatedAt() == null) encounter.setUpdatedAt(LocalDateTime.now());

        return encounterRepository.save(encounter);
    }
}
