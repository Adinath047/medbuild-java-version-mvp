package com.medicos.backend.service;

import com.medicos.backend.entity.Bed;
import com.medicos.backend.entity.BedAdmission;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.BedAdmissionRepository;
import com.medicos.backend.repository.BedRepository;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.repository.VitalRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class BedService {

    private final BedRepository bedRepository;
    private final BedAdmissionRepository admissionRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final VitalRepository vitalRepository;

    public BedService(BedRepository bedRepository, 
                      BedAdmissionRepository admissionRepository,
                      PatientRepository patientRepository,
                      UserRepository userRepository,
                      VitalRepository vitalRepository) {
        this.bedRepository = bedRepository;
        this.admissionRepository = admissionRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.vitalRepository = vitalRepository;
    }

    private void populateBedDetails(Bed bed) {
        if (bed == null) return;
        if ("Occupied".equals(bed.getStatus())) {
            if (bed.getPatientId() != null) {
                patientRepository.findById(bed.getPatientId()).ifPresent(p -> {
                    bed.setPatientName(p.getName());
                    bed.setPatientUhid(p.getUhid());
                    bed.setPatientPhoto(p.getPhotoUrl());
                });
                vitalRepository.findFirstByPatientIdOrderByRecordedAtDesc(bed.getPatientId()).ifPresent(bed::setVitals);
            }
            if (bed.getDoctorId() != null) {
                userRepository.findById(bed.getDoctorId()).ifPresent(d -> {
                    bed.setDoctorName(d.getName());
                });
            }
        }
    }

    @Transactional(readOnly = true)
    public List<Bed> getAllBeds() {
        List<Bed> beds = bedRepository.findAll();
        beds.forEach(this::populateBedDetails);
        return beds;
    }

    @Cacheable(value = "bed_history", key = "'ALL'")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBedHistory() {
        List<BedAdmission> admissions = admissionRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (BedAdmission adm : admissions) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", adm.getId());
            map.put("hospital_id", adm.getHospitalId());
            map.put("bed_id", adm.getBedId());
            map.put("patient_id", adm.getPatientId());
            map.put("doctor_id", adm.getDoctorId());
            map.put("admitted_at", adm.getAdmittedAt());
            map.put("discharged_at", adm.getDischargedAt());
            map.put("status", adm.getStatus());
            map.put("billing_status", adm.getBillingStatus());
            map.put("billing_id", adm.getBillingId());

            if (adm.getPatientId() != null) {
                patientRepository.findById(adm.getPatientId()).ifPresent(p -> {
                    map.put("patient_name", p.getName());
                    map.put("patient_uhid", p.getUhid());
                });
            }

            if (adm.getBedId() != null) {
                bedRepository.findById(adm.getBedId()).ifPresent(b -> {
                    map.put("room", b.getRoom());
                    map.put("bed_number", b.getBedNumber());
                    map.put("ward", b.getWard());
                    map.put("bed_type", b.getType());
                });
            }

            if (adm.getDoctorId() != null) {
                userRepository.findById(adm.getDoctorId()).ifPresent(d -> {
                    map.put("doctor_name", d.getName());
                });
            }

            LocalDateTime end = adm.getDischargedAt() != null ? adm.getDischargedAt() : LocalDateTime.now();
            long days = java.time.Duration.between(adm.getAdmittedAt(), end).toDays();
            map.put("stay_days", Math.max(1, days));

            result.add(map);
        }
        return result;
    }

    @CacheEvict(value = "bed_history", allEntries = true)
    @Transactional
    public Bed createBed(Bed bed, User user) {
        Optional.ofNullable(bed.getBedNumber())
                .filter(b -> !b.isEmpty())
                .orElseThrow(() -> new BadRequestException("bed_number is required."));

        Optional.ofNullable(bed.getWard())
                .filter(w -> !w.isEmpty())
                .orElseThrow(() -> new BadRequestException("ward is required."));

        if (bed.getId() == null || bed.getId().isEmpty()) {
            bed.setId("bed-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (bed.getHospitalId() == null || bed.getHospitalId().isEmpty()) {
            bed.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        return bedRepository.save(bed);
    }

    @CacheEvict(value = "bed_history", allEntries = true)
    @Transactional
    public Map<String, Object> allocateBed(String id, Map<String, String> body, User user) {
        Bed bed = bedRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bed not found with ID: " + id));

        String patientId = Optional.ofNullable(body.get("patient_id"))
                .filter(p -> !p.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        String doctorId = body.get("doctor_id");

        bed.setStatus("Occupied");
        bed.setPatientId(patientId);
        bed.setDoctorId(doctorId);
        bed.setAdmittedAt(LocalDateTime.now());
        bedRepository.save(bed);
        populateBedDetails(bed);

        // Record Bed Admission
        BedAdmission admission = new BedAdmission();
        admission.setId("adm-" + UUID.randomUUID().toString().substring(0, 8));
        admission.setHospitalId(bed.getHospitalId());
        admission.setBedId(bed.getId());
        admission.setPatientId(patientId);
        admission.setDoctorId(doctorId);
        admission.setAdmittedAt(LocalDateTime.now());
        admission.setStatus("Admitted");
        admissionRepository.save(admission);

        return Map.of("message", "Bed allocated successfully", "bed", bed);
    }


    @CacheEvict(value = "bed_history", allEntries = true)
    @Transactional
    public Map<String, Object> releaseBed(String id) {
        Bed bed = bedRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bed not found with ID: " + id));

        String patientId = bed.getPatientId();

        bed.setStatus("Available");
        bed.setPatientId(null);
        bed.setDoctorId(null);
        bed.setAdmittedAt(null);
        bedRepository.save(bed);

        Optional.ofNullable(patientId).ifPresent(pid -> {
            List<BedAdmission> admissions = admissionRepository.findByPatientIdOrderByAdmittedAtDesc(pid);
            if (!admissions.isEmpty()) {
                BedAdmission latest = admissions.get(0);
                if ("Admitted".equals(latest.getStatus())) {
                    latest.setStatus("Discharged");
                    latest.setDischargedAt(LocalDateTime.now());
                    admissionRepository.save(latest);
                }
            }
        });

        return Map.of("message", "Bed released successfully", "bed", bed);
    }

    @CacheEvict(value = "bed_history", allEntries = true)
    @Transactional
    public Bed updateBed(String id, Bed updated, User user) {
        Bed bed = bedRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bed not found with ID: " + id));

        if (updated.getBedNumber() != null && !updated.getBedNumber().trim().isEmpty()) {
            bed.setBedNumber(updated.getBedNumber().trim());
        }
        if (updated.getRoom() != null) {
            bed.setRoom(updated.getRoom().trim());
        }
        if (updated.getWard() != null && !updated.getWard().trim().isEmpty()) {
            bed.setWard(updated.getWard().trim());
        }
        if (updated.getType() != null) {
            bed.setType(updated.getType().trim());
        }
        if (updated.getStatus() != null && !updated.getStatus().trim().isEmpty()) {
            bed.setStatus(updated.getStatus().trim());
        }

        return bedRepository.save(bed);
    }

    @CacheEvict(value = "bed_history", allEntries = true)
    @Transactional
    public void deleteBed(String id) {
        Bed bed = bedRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bed not found with ID: " + id));
        bedRepository.delete(bed);
    }
}
