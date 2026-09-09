package com.medicos.backend.controller;

import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.AuthService;
import com.medicos.backend.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider tokenProvider;

    public AuthController(AuthService authService, JwtTokenProvider tokenProvider) {
        this.authService = authService;
        this.tokenProvider = tokenProvider;
    }

    @GetMapping("/hospital/{code}/staff")
    public ResponseEntity<?> getHospitalStaff(@PathVariable String code) {
        Map<String, Object> result = authService.getHospitalStaff(code);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDTO.LoginRequest request, HttpServletResponse response) {
        Map<String, Object> result = authService.login(request, response);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(jakarta.servlet.http.HttpServletRequest request, HttpServletResponse response) {
        Map<String, Object> result = authService.refreshToken(request, response);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal User user) {
        AuthDTO.UserDTO userDTO = authService.getMe(user);
        return ResponseEntity.ok(Map.of("user", userDTO));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthDTO.RegisterRequest request,
                                      @AuthenticationPrincipal User adminUser) {
        Map<String, Object> result = authService.register(request, adminUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(jakarta.servlet.http.HttpServletRequest request, HttpServletResponse response) {
        Map<String, String> result = authService.logout(request, response);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal User user,
                                            @RequestBody Map<String, String> payload) {
        String currentPassword = payload.get("current_password");
        String newPassword = payload.get("new_password");
        authService.changePassword(user, currentPassword, newPassword);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully. Please log in with your new password."));
    }

    /**
     * RFC 7662 Token Introspection endpoint.
     *
     * <p>Required by SMART App Launch so resource servers (e.g., a third-party EHR)
     * can validate a Bearer token issued by Medbuilds without needing to share the
     * JWT secret.  The endpoint is public (no auth required) per RFC 7662 §2.1,
     * but returns {@code "active": false} for any invalid/expired/missing token
     * rather than leaking error detail.</p>
     *
     * <p>Request: {@code application/x-www-form-urlencoded} with field {@code token}.
     * Response: {@code application/json} introspection response.</p>
     */
    @PostMapping(value = "/introspect", consumes = {
        "application/x-www-form-urlencoded",
        "application/json"
    })
    public ResponseEntity<?> introspect(@RequestParam(value = "token", required = false) String token) {
        if (token == null || token.isBlank()) {
            return ResponseEntity.ok(Map.of("active", false));
        }
        try {
            if (!tokenProvider.validateToken(token)) {
                return ResponseEntity.ok(Map.of("active", false));
            }
            String email     = tokenProvider.getEmailFromToken(token);
            String userId    = tokenProvider.getUserIdFromToken(token);
            String hospitalId = tokenProvider.getHospitalIdFromToken(token);
            long remainingMs = tokenProvider.getRemainingValidityMs(token);
            long expSeconds  = (System.currentTimeMillis() + remainingMs) / 1000L;

            Map<String, Object> claims = new HashMap<>();
            claims.put("active",      true);
            claims.put("sub",         userId);
            claims.put("email",       email);
            claims.put("hospital_id", hospitalId);
            claims.put("exp",         expSeconds);
            // Scope declaration: Phase 1 read-only patient access
            claims.put("scope",      "patient/*.read");
            return ResponseEntity.ok(claims);
        } catch (Exception ex) {
            // Any parsing failure → token inactive (RFC 7662 §2.2)
            return ResponseEntity.ok(Map.of("active", false));
        }
    }
}
