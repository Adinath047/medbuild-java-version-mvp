package com.medicos.backend.service;

import com.medicos.backend.entity.Notification;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final com.medicos.backend.repository.PatientRepository patientRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               com.medicos.backend.repository.PatientRepository patientRepository) {
        this.notificationRepository = notificationRepository;
        this.patientRepository = patientRepository;
    }

    @Transactional(readOnly = true)
    public List<Notification> getActiveNotifications() {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return notificationRepository.findByHospitalIdAndIsReadFalseOrderByCreatedAtDesc(hospitalId);
        }
        return notificationRepository.findByIsReadFalseOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications() {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return notificationRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId);
        }
        return notificationRepository.findAll();
    }

    @Transactional
    public Notification createNotification(Notification notification, User user) {
        Optional.ofNullable(notification.getMessage())
                .filter(m -> !m.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Message is required."));

        if (notification.getId() == null || notification.getId().isEmpty()) {
            notification.setId("notif-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            notification.setHospitalId(hospitalId);
        } else if (notification.getHospitalId() == null || notification.getHospitalId().isEmpty()) {
            notification.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (notification.getPatientId() != null && !notification.getPatientId().trim().isEmpty()) {
            String patientId = notification.getPatientId().trim();
            com.medicos.backend.entity.Patient p = patientRepository.findById(patientId)
                    .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));
            if (!"GLOBAL".equalsIgnoreCase(notification.getHospitalId()) && p.getHospitalId() != null && !notification.getHospitalId().equals(p.getHospitalId())) {
                throw new ResourceNotFoundException("Patient not found with ID: " + patientId);
            }
            notification.setPatientId(patientId);
        }

        return notificationRepository.save(notification);
    }

    @Transactional
    public Map<String, Boolean> markAsRead(String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with ID: " + id));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            if (notification.getHospitalId() != null && !hospitalId.equals(notification.getHospitalId())) {
                throw new ResourceNotFoundException("Notification not found with ID: " + id);
            }
        }

        notification.setIsRead(true);
        notificationRepository.save(notification);

        return Map.of("success", true);
    }
}
