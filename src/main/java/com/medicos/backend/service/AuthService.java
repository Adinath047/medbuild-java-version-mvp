package com.medicos.backend.service;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.UnauthorizedException;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final TenantSessionBinder tenantSessionBinder;

    public AuthService(UserRepository userRepository, HospitalRepository hospitalRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider, TenantSessionBinder tenantSessionBinder) {
        this.userRepository = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.tenantSessionBinder = tenantSessionBinder;
    }

    @Transactional
    public Map<String, Object> login(AuthDTO.LoginRequest request, HttpServletResponse response) {
        String rawPassword = Optional.ofNullable(request.getPassword())
                .filter(p -> !p.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Password is required."));

        String hospitalId = request.getHospitalId() != null ? request.getHospitalId().trim() : null;
        if (hospitalId == null || hospitalId.isEmpty()) {
            throw new BadRequestException("Hospital Code is required.");
        }
        tenantSessionBinder.bindTenant(hospitalId);

        // --- Look up the user: staffId (UUID from picker) preferred, email as fallback ---
        User user;
        String staffId = request.getStaffId();
        if (staffId != null && !staffId.trim().isEmpty()) {
            // Primary path: picker sends the staff UUID — no email leaves the server
            user = userRepository.findById(staffId.trim())
                    .orElseThrow(() -> new UnauthorizedException("Invalid staff ID or password."));
        } else {
            // Fallback path: direct API callers (e.g. password reset, curl) may still send email
            String email = Optional.ofNullable(request.getEmail())
                    .filter(e -> !e.trim().isEmpty())
                    .orElseThrow(() -> new BadRequestException("Either staffId or email is required."));
            user = userRepository.findByEmail(email.toLowerCase().trim())
                    .orElseThrow(() -> new UnauthorizedException("Invalid email or password."));
        }

        // Validate hospital ownership (defence-in-depth; RLS already scopes the lookup)
        if (user.getHospitalId() == null || !user.getHospitalId().equalsIgnoreCase(hospitalId)) {
            throw new UnauthorizedException("Access Denied: Account does not belong to hospital code '" + hospitalId + "'.");
        }

        // Validate password with BCrypt, with legacy plaintext migration
        boolean matches = passwordEncoder.matches(rawPassword, user.getPassword());
        if (!matches) {
            if (rawPassword.equals(user.getPassword())) {
                // Upgrade plaintext password to BCrypt hash
                user.setPassword(passwordEncoder.encode(rawPassword));
                userRepository.save(user);
            } else {
                throw new UnauthorizedException("Invalid email or password.");
            }
        }

        if (user.getIsActive() != null && user.getIsActive() == 0) {
            throw new UnauthorizedException("Account deactivated.");
        }

        String token = tokenProvider.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getHospitalId());

        // Set ResponseCookies for browser auth with modern SameSite=Lax attributes
        ResponseCookie emrTokenCookie = ResponseCookie.from("emr_token", token)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(86400)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, emrTokenCookie.toString());

        ResponseCookie csrfCookie = ResponseCookie.from("csrf_token", UUID.randomUUID().toString())
                .httpOnly(false) // must be false so the React client can read it
                .secure(true)
                .path("/")
                .maxAge(86400)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, csrfCookie.toString());

        AuthDTO.UserDTO userDTO = mapToDTO(user);
        return Map.of(
                "token", token,
                "user", userDTO
        );
    }

    public AuthDTO.UserDTO getMe(User user) {
        User authenticatedUser = Optional.ofNullable(user)
                .orElseThrow(() -> new UnauthorizedException("Not authenticated."));

        User freshUser = userRepository.findById(authenticatedUser.getId())
                .orElse(authenticatedUser);

        return mapToDTO(freshUser);
    }

    @Transactional
    public Map<String, Object> register(AuthDTO.RegisterRequest request, User adminUser) {
        // hospitalId is NEVER taken from the payload — it is sourced from the authenticated admin's record.
        // This prevents a client from registering accounts into an arbitrary hospital.
        if (adminUser == null || adminUser.getHospitalId() == null) {
            throw new UnauthorizedException("Registration requires an authenticated admin session.");
        }
        String hospitalId = adminUser.getHospitalId().trim();

        String name = Optional.ofNullable(request.getName())
                .filter(n -> !n.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Name is required."));

        String email = Optional.ofNullable(request.getEmail())
                .filter(e -> !e.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Email is required."));

        String password = Optional.ofNullable(request.getPassword())
                .filter(p -> !p.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Password is required."));

        tenantSessionBinder.bindTenant(hospitalId);

        userRepository.findByEmail(email.toLowerCase().trim())
                .ifPresent(u -> { throw new BadRequestException("Email is already registered."); });

        User newUser = new User();
        newUser.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
        newUser.setName(name);
        newUser.setEmail(email.toLowerCase().trim());
        newUser.setPassword(passwordEncoder.encode(password));
        String role = Optional.ofNullable(request.getRole()).orElse("doctor").toLowerCase().trim();
        java.util.Set<String> ALLOWED_ROLES = java.util.Set.of(
                "doctor", "nurse", "receptionist", "lab_technician", "pharmacist", "billing", "admin"
        );
        if (!ALLOWED_ROLES.contains(role)) {
            throw new BadRequestException("Invalid role '" + role + "'. Allowed values: " + ALLOWED_ROLES);
        }
        newUser.setRole(role);
        newUser.setHospitalId(hospitalId); // always from admin session, never from payload
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

    public Map<String, String> logout(jakarta.servlet.http.HttpServletRequest request, HttpServletResponse response) {
        String token = getJwtFromRequest(request);
        if (token != null && tokenProvider.validateToken(token)) {
            tokenProvider.invalidateToken(token);
        }

        ResponseCookie cookie = ResponseCookie.from("emr_token", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        ResponseCookie csrfCookie = ResponseCookie.from("csrf_token", "")
                .httpOnly(false)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, csrfCookie.toString());

        return Map.of("message", "Logged out successfully");
    }

    private String getJwtFromRequest(jakarta.servlet.http.HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("emr_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getHospitalStaff(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new BadRequestException("Hospital Code is required.");
        }
        final String hospitalId = code.trim();
        tenantSessionBinder.bindTenant(hospitalId);
        
        // Find hospital in DB case-insensitively
        Optional<Hospital> hospitalOpt = hospitalRepository.findAll().stream()
                .filter(h -> h.getId() != null && h.getId().equalsIgnoreCase(hospitalId))
                .findFirst();

        // Filter staff by hospital ID case-insensitively
        List<User> users = userRepository.findAll();
        List<AuthDTO.StaffPickerDTO> staff = users.stream()
                .filter(u -> u.getHospitalId() != null && u.getHospitalId().equalsIgnoreCase(hospitalId))
                .filter(u -> u.getIsActive() == null || u.getIsActive() != 0)
                .map(this::mapToPickerDTO)
                .collect(Collectors.toList());

        // Strictly enforce hospital validation: must exist in hospital table OR have registered staff
        if (hospitalOpt.isEmpty() && staff.isEmpty()) {
            throw new BadRequestException("Invalid Hospital Code: '" + hospitalId + "'. No hospital or clinic found for this code.");
        }

        Hospital hospital = hospitalOpt.orElseGet(() -> {
            Hospital h = new Hospital();
            h.setId(hospitalId);
            h.setName("Clinic (" + hospitalId.toUpperCase() + ")");
            h.setType("Clinic");
            return h;
        });

        if (staff.isEmpty()) {
            throw new BadRequestException("Hospital code '" + hospitalId + "' has no registered active staff members.");
        }

        return Map.of(
                "hospital", Map.of(
                        "id", hospital.getId(),
                        "name", hospital.getName() != null ? hospital.getName() : "Medicos EMR Clinic",
                        "type", hospital.getType() != null ? hospital.getType() : "General"
                ),
                "staff", staff
        );
    }

    /**
     * Slim DTO for the public staff-lookup endpoint.
     * Only name, role, specialization, and photo — no PII.
     */
    private AuthDTO.StaffPickerDTO mapToPickerDTO(User user) {
        AuthDTO.StaffPickerDTO dto = new AuthDTO.StaffPickerDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setRole(user.getRole());
        // email intentionally omitted — login now uses staffId, so email never needs
        // to leave the server through an unauthenticated endpoint
        dto.setSpecialization(user.getSpecialization());
        dto.setPhotoUrl(user.getPhotoUrl());
        return dto;
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
        dto.setQualification(user.getQualification());
        dto.setRegistrationNumber(user.getRegistrationNumber());
        dto.setLetterhead(user.getLetterhead());
        dto.setConsultationFee(user.getConsultationFee());
        dto.setFollowupFee(user.getFollowupFee());
        dto.setBedPerDayCharge(user.getBedPerDayCharge());
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

    @Transactional
    public void changePassword(User user, String currentPassword, String newPassword) {
        if (currentPassword == null || currentPassword.trim().isEmpty()) {
            throw new BadRequestException("Current password is required.");
        }
        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new BadRequestException("New password must be at least 6 characters long.");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new BadRequestException("Current password does not match.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        tokenProvider.revokeAllUserTokens(user.getId());
    }
}
