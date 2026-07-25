package com.medicos.backend.controller;

import com.medicos.backend.entity.Notification;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveNotifications() {
        List<Notification> active = notificationService.getActiveNotifications();
        return ResponseEntity.ok(active);
    }

    @GetMapping
    public ResponseEntity<?> getAllNotifications() {
        List<Notification> all = notificationService.getAllNotifications();
        return ResponseEntity.ok(all);
    }

    @PostMapping
    public ResponseEntity<?> createNotification(@RequestBody Notification notification, @AuthenticationPrincipal User user) {
        Notification saved = notificationService.createNotification(notification, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable("id") String id) {
        Map<String, Boolean> result = notificationService.markAsRead(id);
        return ResponseEntity.ok(result);
    }
}
