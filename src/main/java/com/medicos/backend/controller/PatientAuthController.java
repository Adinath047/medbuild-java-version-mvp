package com.medicos.backend.controller;

import com.medicos.backend.dto.PatientAppDTO;
import com.medicos.backend.service.PatientAuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Handles patient phone-based OTP authentication.
 * Endpoints are under /api/auth/patient/ which is already permitted by SecurityConfig's /api/auth/** rule.
 */
@RestController
@RequestMapping("/api/auth/patient")
public class PatientAuthController {

    private final PatientAuthService patientAuthService;

    public PatientAuthController(PatientAuthService patientAuthService) {
        this.patientAuthService = patientAuthService;
    }

    /**
     * POST /api/auth/patient/send-otp
     * Sends an OTP to the provided phone number.
     * Body: { "phone": "+919876543210" }
     */
    @PostMapping("/send-otp")
    public ResponseEntity<PatientAppDTO.OtpResponse> sendOtp(@RequestBody PatientAppDTO.OtpRequest request) {
        PatientAppDTO.OtpResponse response = patientAuthService.sendOtp(request.getPhone());
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/patient/verify-otp
     * Verifies the OTP and returns a JWT token + patient profile.
     * Body: { "phone": "+919876543210", "otp": "123456" }
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<PatientAppDTO.OtpVerifyResponse> verifyOtp(@RequestBody PatientAppDTO.OtpVerifyRequest request) {
        PatientAppDTO.OtpVerifyResponse response = patientAuthService.verifyOtp(request.getPhone(), request.getOtp());
        return ResponseEntity.ok(response);
    }
}
