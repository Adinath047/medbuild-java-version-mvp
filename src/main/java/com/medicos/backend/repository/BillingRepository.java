package com.medicos.backend.repository;

import com.medicos.backend.entity.Billing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BillingRepository extends JpaRepository<Billing, String> {
    List<Billing> findByPatientIdOrderByCreatedAtDesc(String patientId);
    List<Billing> findByHospitalIdOrderByCreatedAtDesc(String hospitalId);
}
