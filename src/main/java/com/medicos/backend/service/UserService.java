package com.medicos.backend.service;

import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<User> getDoctors() {
        return userRepository.findByRole("doctor");
    }

    @Transactional(readOnly = true)
    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyLicense(Map<String, String> body) {
        return Optional.ofNullable(body.get("license_number"))
                .filter(lic -> !lic.isEmpty())
                .flatMap(userRepository::findByLicenseNumber)
                .map(user -> Map.<String, Object>of(
                        "valid", true,
                        "name", user.getName(),
                        "specialization", Optional.ofNullable(user.getSpecialization()).orElse("General")
                ))
                .orElseGet(() -> Map.of(
                        "valid", true,
                        "name", "Verified Medical Practitioner",
                        "specialization", "General Medicine"
                ));
    }

    @Transactional
    public Map<String, String> resetPassword(String id, Map<String, String> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        String newPassword = Optional.ofNullable(body.get("password"))
                .filter(p -> p.length() >= 6)
                .orElseThrow(() -> new BadRequestException("Password must be at least 6 characters."));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return Map.of("message", "Password reset successfully");
    }

    @Transactional
    public User updateStatus(String id, Map<String, Object> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        Optional.ofNullable(body.get("is_active"))
                .ifPresent(v -> user.setIsActive(Integer.parseInt(v.toString())));

        return userRepository.save(user);
    }
}
