package com.medicos.backend.service;

import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.UnauthorizedException;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> login(AuthDTO.LoginRequest request, HttpServletResponse response) {
        String email = Optional.ofNullable(request.getEmail())
                .filter(e -> !e.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Email is required."));

        String rawPassword = Optional.ofNullable(request.getPassword())
                .filter(p -> !p.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Password is required."));

        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password."));

        // Validate password
        if (!passwordEncoder.matches(rawPassword, user.getPassword()) && !rawPassword.equals(user.getPassword())) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        if (user.getIsActive() != null && user.getIsActive() == 0) {
            throw new UnauthorizedException("Account deactivated.");
        }

        String token = tokenProvider.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getHospitalId());

        // Set HttpOnly Cookies for browser auth
        Cookie emrTokenCookie = new Cookie("emr_token", token);
        emrTokenCookie.setHttpOnly(true);
        emrTokenCookie.setPath("/");
        emrTokenCookie.setMaxAge(86400); // 1 day
        response.addCookie(emrTokenCookie);

        Cookie csrfCookie = new Cookie("csrf_token", UUID.randomUUID().toString());
        csrfCookie.setPath("/");
        csrfCookie.setMaxAge(86400);
        response.addCookie(csrfCookie);

        AuthDTO.UserDTO userDTO = mapToDTO(user);
        return Map.of(
                "token", token,
                "user", userDTO
        );
    }

    public AuthDTO.UserDTO getMe(User user) {
        User authenticatedUser = Optional.ofNullable(user)
                .orElseThrow(() -> new UnauthorizedException("Not authenticated."));

        return mapToDTO(authenticatedUser);
    }

    @Transactional
    public Map<String, Object> register(AuthDTO.RegisterRequest request) {
        String name = Optional.ofNullable(request.getName())
                .filter(n -> !n.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Name is required."));

        String email = Optional.ofNullable(request.getEmail())
                .filter(e -> !e.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Email is required."));

        String password = Optional.ofNullable(request.getPassword())
                .filter(p -> !p.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Password is required."));

        userRepository.findByEmail(email.toLowerCase().trim())
                .ifPresent(u -> { throw new BadRequestException("Email is already registered."); });

        User newUser = new User();
        newUser.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
        newUser.setName(name);
        newUser.setEmail(email.toLowerCase().trim());
        newUser.setPassword(passwordEncoder.encode(password));
        newUser.setRole(Optional.ofNullable(request.getRole()).orElse("doctor"));
        newUser.setHospitalId(Optional.ofNullable(request.getHospitalId()).orElse("hsp-001"));
        newUser.setSpecialization(request.getSpecialization());
        newUser.setPhone(request.getPhone());
        newUser.setLicenseNumber(request.getLicenseNumber());

        User savedUser = userRepository.save(newUser);
        String token = tokenProvider.generateToken(savedUser.getId(), savedUser.getEmail(), savedUser.getRole(), savedUser.getHospitalId());

        return Map.of(
                "token", token,
                "user", mapToDTO(savedUser)
        );
    }

    public Map<String, String> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("emr_token", null);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return Map.of("message", "Logged out successfully");
    }

    public AuthDTO.UserDTO mapToDTO(User user) {
        AuthDTO.UserDTO dto = new AuthDTO.UserDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setHospitalId(user.getHospitalId());
        dto.setPhone(user.getPhone());
        dto.setSpecialization(user.getSpecialization());
        dto.setLicenseNumber(user.getLicenseNumber());
        dto.setPhotoUrl(user.getPhotoUrl());
        dto.setIsActive(user.getIsActive());
        dto.setShowDiagnosisOnPrint(user.getShowDiagnosisOnPrint());
        dto.setShowInvestigationsOnPrint(user.getShowInvestigationsOnPrint());
        dto.setShowVitalsOnPrint(user.getShowVitalsOnPrint());
        dto.setPrintMarginTop(user.getPrintMarginTop());
        dto.setPrintMarginBottom(user.getPrintMarginBottom());
        dto.setPrintMarginLeftRight(user.getPrintMarginLeftRight());
        dto.setPrintFontSize(user.getPrintFontSize());
        return dto;
    }
}
