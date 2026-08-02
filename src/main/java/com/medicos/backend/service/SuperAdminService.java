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

import com.medicos.backend.exception.BadRequestException;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class SuperAdminService {

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${superadmin.secret:medicos-superadmin-secret-key-2026}")
    private String superAdminSecret;

    public SuperAdminService(HospitalRepository hospitalRepository,
                             UserRepository userRepository,
                             PasswordEncoder passwordEncoder) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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

    @Transactional
    public Hospital createHospital(Map<String, Object> body) {
        String id = String.valueOf(body.getOrDefault("id", "hsp-" + UUID.randomUUID().toString().substring(0, 6)));
        String name = String.valueOf(body.getOrDefault("name", "New Hospital Clinic"));

        Hospital hospital = new Hospital();
        hospital.setId(id);
        hospital.setName(name);
        hospital.setType(String.valueOf(body.getOrDefault("type", "General")));
        hospital.setAddress(String.valueOf(body.getOrDefault("address", "")));
        hospital.setCity(String.valueOf(body.getOrDefault("city", "")));
        hospital.setState(String.valueOf(body.getOrDefault("state", "")));
        hospital.setPincode(String.valueOf(body.getOrDefault("pincode", "")));
        hospital.setPhone(String.valueOf(body.getOrDefault("phone", "")));
        hospital.setEmail(String.valueOf(body.getOrDefault("email", "")));
        hospital.setIsActive(1);

        return hospitalRepository.save(hospital);
    }

    @Transactional
    public User createStaffUser(Map<String, Object> body) {
        String email = String.valueOf(body.get("email")).toLowerCase().trim();
        if (email.isEmpty()) throw new BadRequestException("Email is required for staff user.");

        userRepository.findByEmail(email).ifPresent(u -> {
            throw new BadRequestException("User with email " + email + " already exists.");
        });

        String rawPassword = String.valueOf(body.getOrDefault("password", "doctor123"));

        User user = new User();
        user.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
        user.setName(String.valueOf(body.getOrDefault("name", "Hospital Staff")));
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(String.valueOf(body.getOrDefault("role", "doctor")));
        user.setHospitalId(String.valueOf(body.getOrDefault("hospital_id", body.getOrDefault("hospitalId", "hsp-001"))));
        user.setStaffId(String.valueOf(body.getOrDefault("staff_id", body.getOrDefault("staffId", "STF-" + (int)(Math.random() * 900 + 100)))));
        user.setSpecialization(String.valueOf(body.getOrDefault("specialization", "")));
        user.setQualification(String.valueOf(body.getOrDefault("qualification", "")));
        user.setPhone(String.valueOf(body.getOrDefault("phone", "")));
        user.setIsActive(1);

        return userRepository.save(user);
    }
}
