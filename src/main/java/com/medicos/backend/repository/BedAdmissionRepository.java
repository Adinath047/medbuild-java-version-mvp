package com.medicos.backend.repository;

import com.medicos.backend.entity.BedAdmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BedAdmissionRepository extends JpaRepository<BedAdmission, String> {
    List<BedAdmission> findByPatientIdOrderByAdmittedAtDesc(String patientId);
    List<BedAdmission> findByHospitalIdOrderByAdmittedAtDesc(String hospitalId);
}
