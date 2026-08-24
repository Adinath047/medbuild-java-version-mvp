package com.medicos.backend.repository;

import com.medicos.backend.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, String> {
    Optional<Hospital> findByIdIgnoreCase(String id);
    List<Hospital> findByTrialStatusAndTrialEndsAtBefore(String trialStatus, LocalDateTime dateTime);
}
