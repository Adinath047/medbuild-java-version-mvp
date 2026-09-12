package com.medicos.backend.repository;

import com.medicos.backend.entity.PlatformAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * High-performance append-only repository for Platform-level and Security Audit Logs.
 */
@Repository
public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, String> {

    Page<PlatformAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    List<PlatformAuditLog> findTop100ByOrderByTimestampDesc();

    List<PlatformAuditLog> findTop100ByOrganizationIdOrderByTimestampDesc(String organizationId);

    List<PlatformAuditLog> findTop50ByResultOrderByTimestampDesc(String result);

    List<PlatformAuditLog> findTop50ByActionOrderByTimestampDesc(String action);

    long countByResult(String result);

    long countByTimestampAfter(LocalDateTime timestamp);

    long countByResultAndTimestampAfter(String result, LocalDateTime timestamp);
}
