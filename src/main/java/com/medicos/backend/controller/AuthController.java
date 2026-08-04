package com.medicos.backend.controller;

import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
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

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal User user) {
        AuthDTO.UserDTO userDTO = authService.getMe(user);
        return ResponseEntity.ok(Map.of("user", userDTO));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthDTO.RegisterRequest request) {
        Map<String, Object> result = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(jakarta.servlet.http.HttpServletRequest request, HttpServletResponse response) {
        Map<String, String> result = authService.logout(request, response);
        return ResponseEntity.ok(result);
    }
}
