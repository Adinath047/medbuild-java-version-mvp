package com.medicos.backend.repository;

import com.medicos.backend.entity.Bed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BedRepository extends JpaRepository<Bed, String> {
    List<Bed> findByHospitalId(String hospitalId);
    List<Bed> findByStatus(String status);
    List<Bed> findByPatientId(String patientId);
}
