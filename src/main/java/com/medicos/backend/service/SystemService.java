package com.medicos.backend.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SystemService {

    public Map<String, Object> getHealthCheck() {
        return Map.of(
                "status", "UP",
                "service", "medicos-java-backend",
                "timestamp", LocalDateTime.now().toString(),
                "database", "PostgreSQL"
        );
    }

    public Map<String, Object> getSystemStatus() {
        return Map.of(
                "status", "healthy",
                "version", "1.0.0",
                "engine", "Spring Boot 3 + PostgreSQL",
                "timestamp", LocalDateTime.now().toString()
        );
    }
}
