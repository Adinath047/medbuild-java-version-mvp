package com.medicos.backend.service;

import com.medicos.backend.entity.User;
import com.medicos.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class SyncService {

    private final PatientRepository patientRepository;
    private final EncounterRepository encounterRepository;
    private final VitalRepository vitalRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final AppointmentRepository appointmentRepository;
    private final BedRepository bedRepository;
    private final BillingRepository billingRepository;
    private final MedicineRepository medicineRepository;

    public SyncService(PatientRepository patientRepository,
                       EncounterRepository encounterRepository,
                       VitalRepository vitalRepository,
                       PrescriptionRepository prescriptionRepository,
                       AppointmentRepository appointmentRepository,
                       BedRepository bedRepository,
                       BillingRepository billingRepository,
                       MedicineRepository medicineRepository) {
        this.patientRepository = patientRepository;
        this.encounterRepository = encounterRepository;
        this.vitalRepository = vitalRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.appointmentRepository = appointmentRepository;
        this.bedRepository = bedRepository;
        this.billingRepository = billingRepository;
        this.medicineRepository = medicineRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> pullData(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("patients", patientRepository.findAll());
        response.put("encounters", encounterRepository.findAll());
        response.put("vitals", vitalRepository.findAll());
        response.put("prescriptions", prescriptionRepository.findAll());
        response.put("appointments", appointmentRepository.findAll());
        response.put("beds", bedRepository.findAll());
        response.put("billing", billingRepository.findAll());
        response.put("medicines", medicineRepository.findAll());
        response.put("synced_at", System.currentTimeMillis());

        return response;
    }

    public Map<String, Object> pushData(Map<String, Object> payload) {
        // Acknowledge receipt of pushed changes from offline client
        return Map.of("success", true, "synced_at", System.currentTimeMillis());
    }
}
