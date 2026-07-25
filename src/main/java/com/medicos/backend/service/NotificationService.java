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

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<Notification> getActiveNotifications() {
        return notificationRepository.findByIsReadFalseOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications() {
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

        if (notification.getHospitalId() == null || notification.getHospitalId().isEmpty()) {
            notification.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        return notificationRepository.save(notification);
    }

    @Transactional
    public Map<String, Boolean> markAsRead(String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with ID: " + id));

        notification.setIsRead(true);
        notificationRepository.save(notification);

        return Map.of("success", true);
    }
}
