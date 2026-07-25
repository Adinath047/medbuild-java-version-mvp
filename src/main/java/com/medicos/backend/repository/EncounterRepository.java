package com.medicos.backend.repository;

import com.medicos.backend.entity.Encounter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EncounterRepository extends JpaRepository<Encounter, String> {
    List<Encounter> findByPatientIdOrderByCreatedAtDesc(String patientId);
    List<Encounter> findByDoctorIdOrderByCreatedAtDesc(String doctorId);
    List<Encounter> findByHospitalIdOrderByCreatedAtDesc(String hospitalId);
}
