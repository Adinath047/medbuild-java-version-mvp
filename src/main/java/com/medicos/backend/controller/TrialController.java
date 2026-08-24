package com.medicos.backend.controller;

import com.medicos.backend.dto.TrialDTO.*;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.TenantContext;
import com.medicos.backend.service.TrialService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/trial")
public class TrialController {

    private final TrialService trialService;
    private final UserRepository userRepository;

    public TrialController(TrialService trialService, UserRepository userRepository) {
        this.trialService = trialService;
        this.userRepository = userRepository;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signupTrial(@RequestBody TrialSignupRequest req) {
        if (req.getAdminEmail() == null || req.getAdminEmail().isBlank() ||
            req.getAdminPassword() == null || req.getAdminPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Admin email and password are required"));
        }

        if (userRepository.findByEmail(req.getAdminEmail()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email is already registered"));
        }

        TrialStatusResponse response = trialService.signupTrial(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/status")
    public ResponseEntity<TrialStatusResponse> getStatus() {
        String hospitalId = TenantContext.getTenantId();
        String userId = null;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            Optional<User> userOpt = userRepository.findByEmail(auth.getName());
            if (userOpt.isPresent()) {
                userId = userOpt.get().getId();
                if (hospitalId == null || hospitalId.isBlank()) {
                    hospitalId = userOpt.get().getHospitalId();
                }
            }
        }

        TrialStatusResponse status = trialService.getTrialStatus(hospitalId, userId);
        return ResponseEntity.ok(status);
    }

    @PostMapping("/contact")
    public ResponseEntity<?> submitContact(@RequestBody TrialContactRequest req) {
        String tenantId = TenantContext.getTenantId();
        if (req.getHospitalId() == null || req.getHospitalId().isBlank()) {
            req.setHospitalId(tenantId);
        }
        trialService.processContactRequest(req);
        return ResponseEntity.ok(Map.of("message", "Inquiry received. Our support team will contact you shortly."));
    }

    @PostMapping("/tour/complete")
    public ResponseEntity<?> completeTour() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            Optional<User> userOpt = userRepository.findByEmail(auth.getName());
            if (userOpt.isPresent()) {
                trialService.completeTour(userOpt.get().getId());
                return ResponseEntity.ok(Map.of("message", "Tour marked as complete"));
            }
        }
        return ResponseEntity.ok(Map.of("message", "Tour status updated"));
    }
}
