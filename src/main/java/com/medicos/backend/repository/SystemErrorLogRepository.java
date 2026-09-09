package com.medicos.backend.repository;

import com.medicos.backend.entity.SystemErrorLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for telemetry and grouped system errors.
 */
@Repository
public interface SystemErrorLogRepository extends JpaRepository<SystemErrorLog, String> {

    Page<SystemErrorLog> findAllByOrderByLastSeenAtDesc(Pageable pageable);

    List<SystemErrorLog> findTop50ByOrderByLastSeenAtDesc();

    List<SystemErrorLog> findBySeverityOrderByLastSeenAtDesc(String severity);

    Optional<SystemErrorLog> findByFingerprint(String fingerprint);

    List<SystemErrorLog> findTop100ByOrganizationIdOrderByLastSeenAtDesc(String organizationId);

    long countBySeverity(String severity);

    long countByLastSeenAtAfter(LocalDateTime timestamp);
}
