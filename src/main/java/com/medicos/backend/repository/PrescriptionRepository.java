package com.medicos.backend.repository;

import com.medicos.backend.entity.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, String> {
    List<Prescription> findByPatientIdOrderByCreatedAtDesc(String patientId);
    List<Prescription> findByDoctorIdOrderByCreatedAtDesc(String doctorId);
    List<Prescription> findByHospitalIdOrderByCreatedAtDesc(String hospitalId);
    List<Prescription> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(String patientId, String doctorId);
    Optional<Prescription> findBySlipToken(String slipToken);
}

