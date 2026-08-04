package com.medicos.backend.repository;

import com.medicos.backend.entity.HealthTip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HealthTipRepository extends JpaRepository<HealthTip, String> {
    List<HealthTip> findByTag(String tag);
}
