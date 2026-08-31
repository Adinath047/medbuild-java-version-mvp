package com.medicos.backend.repository;

import com.medicos.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Append-only repository for HIPAA/DPDP audit logs.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    List<AuditLog> findTop100ByOrderByTimestampDesc();

    List<AuditLog> findTop100ByHospitalIdOrderByTimestampDesc(String hospitalId);

    List<AuditLog> findByHospitalIdOrderByTimestampDesc(String hospitalId);

    List<AuditLog> findByPatientIdOrderByTimestampDesc(String patientId);

    List<AuditLog> findByHospitalIdAndPatientIdOrderByTimestampDesc(String hospitalId, String patientId);

    List<AuditLog> findByUserIdOrderByTimestampDesc(String userId);
}
