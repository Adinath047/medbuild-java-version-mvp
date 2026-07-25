package com.medicos.backend.service;

import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.UnauthorizedException;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class SuperAdminService {

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;

    @Value("${superadmin.secret:medicos-superadmin-secret-key-2026}")
    private String superAdminSecret;

    public SuperAdminService(HospitalRepository hospitalRepository, UserRepository userRepository) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
    }

    public Map<String, Object> unlockConsole(Map<String, String> body) {
        String secret = Optional.ofNullable(body.get("secretKey"))
                .filter(s -> s.equals(superAdminSecret))
                .orElseThrow(() -> new UnauthorizedException("Invalid Super Admin Secret Key."));

        return Map.of("success", true, "message", "Console unlocked successfully");
    }

    @Transactional(readOnly = true)
    public List<Hospital> getHospitals() {
        return hospitalRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
}
