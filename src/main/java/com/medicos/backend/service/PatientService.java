package com.medicos.backend.service;

import com.medicos.backend.dto.PatientDTO;
import com.medicos.backend.entity.*;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.*;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final EncounterRepository encounterRepository;
    private final VitalRepository vitalRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final AppointmentRepository appointmentRepository;

    public PatientService(PatientRepository patientRepository,
                          EncounterRepository encounterRepository,
                          VitalRepository vitalRepository,
                          PrescriptionRepository prescriptionRepository,
                          AppointmentRepository appointmentRepository) {
        this.patientRepository = patientRepository;
        this.encounterRepository = encounterRepository;
        this.vitalRepository = vitalRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.appointmentRepository = appointmentRepository;
    }

    @Cacheable(value = "patients", key = "(#search != null ? #search : 'ALL') + '_' + #limit")
    @Transactional(readOnly = true)
    public PatientDTO.PatientListResponse getPatients(String search, int limit) {
        List<Patient> list = Optional.ofNullable(search)
                .filter(s -> !s.trim().isEmpty())
                .map(s -> patientRepository.searchPatients(s.trim()))
                .orElseGet(patientRepository::findAll);

        long total = patientRepository.countTotalPatients();
        return new PatientDTO.PatientListResponse(list, total);
    }

    @Cacheable(value = "patient_by_id", key = "#id")
    @Transactional(readOnly = true)
    public Patient getPatientById(String id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + id));
    }

    @Cacheable(value = "patient_summary", key = "#id")
    @Transactional(readOnly = true)
    public PatientDTO.PatientSummaryResponse getPatientSummary(String id) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + id));

        List<Encounter> encounters = encounterRepository.findByPatientIdOrderByCreatedAtDesc(id);
        Optional<Vital> latestVitalOpt = vitalRepository.findFirstByPatientIdOrderByRecordedAtDesc(id);
        List<Prescription> prescriptions = prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(id);
        List<Appointment> appointments = appointmentRepository.findByPatientIdOrderByDateDesc(id);

        PatientDTO.PatientSummaryResponse summary = new PatientDTO.PatientSummaryResponse();
        summary.setPatient(patient);
        summary.setEncounters(encounters);
        summary.setLatestVitals(latestVitalOpt.orElse(null));
        summary.setRxCount(prescriptions.size());
        summary.setPrescriptions(prescriptions);
        summary.setApptUpcoming(new ArrayList<>(appointments));

        return summary;
    }

    @Transactional(readOnly = true)
    public List<Vital> getVitalsHistory(String id) {
        patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + id));

        return vitalRepository.findByPatientIdOrderByRecordedAtDesc(id);
    }

    @CacheEvict(value = "patients", allEntries = true)
    @Transactional
    public Patient createPatient(Patient patient, User currentUser) {
        Optional.ofNullable(patient.getName())
                .filter(name -> !name.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Patient name is required."));

        if (patient.getId() == null || patient.getId().isEmpty()) {
            patient.setId("pat-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (patient.getUhid() == null || patient.getUhid().isEmpty()) {
            long count = patientRepository.count() + 1;
            patient.setUhid(String.format("UHID-001-%06d", count));
        }

        if (patient.getHospitalId() == null || patient.getHospitalId().isEmpty()) {
            patient.setHospitalId(Optional.ofNullable(currentUser).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (patient.getConsentGiven() == null) {
            patient.setConsentGiven(true);
        }
        if (Boolean.TRUE.equals(patient.getConsentGiven()) && patient.getConsentGivenAt() == null) {
            patient.setConsentGivenAt(java.time.LocalDateTime.now());
        }

        Optional.ofNullable(currentUser).ifPresent(u -> patient.setRegisteredBy(u.getId()));

        return patientRepository.save(patient);
    }

    @Caching(evict = {
            @CacheEvict(value = "patients", allEntries = true),
            @CacheEvict(value = "patient_by_id", key = "#id"),
            @CacheEvict(value = "patient_summary", key = "#id")
    })
    @Transactional
    public Patient updatePatient(String id, Patient updated) {
        Patient p = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + id));

        Optional.ofNullable(updated.getName()).ifPresent(p::setName);
        Optional.ofNullable(updated.getAge()).ifPresent(p::setAge);
        Optional.ofNullable(updated.getSex()).ifPresent(p::setSex);
        Optional.ofNullable(updated.getBloodGroup()).ifPresent(p::setBloodGroup);
        Optional.ofNullable(updated.getPhone()).ifPresent(p::setPhone);
        Optional.ofNullable(updated.getEmail()).ifPresent(p::setEmail);
        Optional.ofNullable(updated.getAddress()).ifPresent(p::setAddress);
        Optional.ofNullable(updated.getAllergies()).ifPresent(p::setAllergies);
        Optional.ofNullable(updated.getChronicConditions()).ifPresent(p::setChronicConditions);
        Optional.ofNullable(updated.getPrimaryDoctorId()).ifPresent(p::setPrimaryDoctorId);

        return patientRepository.save(p);
    }
}
