package com.medicos.backend.service;

import com.medicos.backend.entity.Prescription;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.PrescriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;

    public PrescriptionService(PrescriptionRepository prescriptionRepository) {
        this.prescriptionRepository = prescriptionRepository;
    }

    @Transactional(readOnly = true)
    public List<Prescription> getPrescriptions(String patientId) {
        return Optional.ofNullable(patientId)
                .filter(id -> !id.isEmpty())
                .map(prescriptionRepository::findByPatientIdOrderByCreatedAtDesc)
                .orElseGet(prescriptionRepository::findAll);
    }

    @Transactional(readOnly = true)
    public Prescription getPrescriptionById(String id) {
        return prescriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription not found with ID: " + id));
    }

    @Transactional(readOnly = true)
    public Prescription getPrescriptionBySlipToken(String token) {
        return prescriptionRepository.findBySlipToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid or expired prescription slip token."));
    }

    @Transactional
    public Prescription createPrescription(Prescription rx, User user) {
        Optional.ofNullable(rx.getPatientId())
                .filter(id -> !id.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (rx.getId() == null || rx.getId().isEmpty()) {
            rx.setId("rx-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (rx.getHospitalId() == null || rx.getHospitalId().isEmpty()) {
            rx.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (rx.getDoctorId() == null || rx.getDoctorId().isEmpty()) {
            rx.setDoctorId(Optional.ofNullable(user).map(User::getId).orElse("usr-doc-001"));
        }

        if (rx.getSlipToken() == null || rx.getSlipToken().isEmpty()) {
            rx.setSlipToken(UUID.randomUUID().toString().replace("-", ""));
        }

        if (rx.getCreatedAt() == null) {
            rx.setCreatedAt(LocalDateTime.now());
        }

        return prescriptionRepository.save(rx);
    }
}
