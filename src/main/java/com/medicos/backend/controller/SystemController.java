package com.medicos.backend.controller;

import com.medicos.backend.service.SystemService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class SystemController {

    private final SystemService systemService;

    public SystemController(SystemService systemService) {
        this.systemService = systemService;
    }

    @GetMapping("/health")
    public ResponseEntity<?> healthCheck() {
        Map<String, Object> health = systemService.getHealthCheck();
        return ResponseEntity.ok(health);
    }

    @GetMapping("/system/status")
    public ResponseEntity<?> systemStatus() {
        Map<String, Object> status = systemService.getSystemStatus();
        return ResponseEntity.ok(status);
    }

    @GetMapping("/system/privacy-policy")
    public ResponseEntity<?> privacyPolicy() {
        return ResponseEntity.ok(systemService.getPrivacyPolicy());
    }

    @GetMapping("/system/terms")
    public ResponseEntity<?> termsOfService() {
        return ResponseEntity.ok(systemService.getTermsOfService());
    }
}
