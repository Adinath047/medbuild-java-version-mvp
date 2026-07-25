package com.medicos.backend.repository;

import com.medicos.backend.entity.PatientUpload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PatientUploadRepository extends JpaRepository<PatientUpload, String> {
    List<PatientUpload> findByPatientIdOrderByUploadedAtDesc(String patientId);
}
