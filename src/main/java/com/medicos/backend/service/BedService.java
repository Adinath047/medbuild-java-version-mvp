package com.medicos.backend.service;

import com.medicos.backend.entity.Bed;
import com.medicos.backend.entity.BedAdmission;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.BedAdmissionRepository;
import com.medicos.backend.repository.BedRepository;
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

    public BedService(BedRepository bedRepository, BedAdmissionRepository admissionRepository) {
        this.bedRepository = bedRepository;
        this.admissionRepository = admissionRepository;
    }

    @Cacheable(value = "beds", key = "'ALL'")
    @Transactional(readOnly = true)
    public List<Bed> getAllBeds() {
        return bedRepository.findAll();
    }

    @Cacheable(value = "bed_history", key = "'ALL'")
    @Transactional(readOnly = true)
    public List<BedAdmission> getBedHistory() {
        return admissionRepository.findAll();
    }

    @CacheEvict(value = {"beds", "bed_history"}, allEntries = true)
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

    @CacheEvict(value = {"beds", "bed_history"}, allEntries = true)
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

    @CacheEvict(value = {"beds", "bed_history"}, allEntries = true)
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
}
