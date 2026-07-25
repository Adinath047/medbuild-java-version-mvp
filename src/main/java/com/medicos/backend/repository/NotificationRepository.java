package com.medicos.backend.repository;

import com.medicos.backend.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByIsReadFalseOrderByCreatedAtDesc();
    List<Notification> findByHospitalIdOrderByCreatedAtDesc(String hospitalId);
}
