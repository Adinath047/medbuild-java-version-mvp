package com.medicos.backend.controller;

import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.UnauthorizedException;
import com.medicos.backend.service.AuthService;
import com.medicos.backend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthService authService;

    public UserController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<?> createUser(
            @RequestBody AuthDTO.RegisterRequest request,
            @AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        Map<String, Object> result = authService.register(request, caller);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /**
     * Returns only staff belonging to the authenticated user's hospital.
     * Admin sees their own hospital's staff only (strict tenant isolation).
     */
    @GetMapping
    public ResponseEntity<?> getAllUsers(@AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        List<User> users = userService.getUsersByHospital(caller.getHospitalId());
        return ResponseEntity.ok(users);
    }

    /**
     * Returns doctors in the same hospital as the caller.
     */
    @GetMapping("/doctors")
    public ResponseEntity<?> getDoctors(@AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        List<User> doctors = userService.getDoctorsByHospital(caller.getHospitalId());
        return ResponseEntity.ok(doctors);
    }

    /**
     * Fetch a user by ID — only allowed if the target user belongs to the caller's hospital.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(
            @PathVariable("id") String id,
            @AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        User target = userService.getUserById(id);
        if (!target.getHospitalId().equalsIgnoreCase(caller.getHospitalId())) {
            throw new UnauthorizedException("Access denied: user belongs to a different hospital.");
        }
        return ResponseEntity.ok(target);
    }

    @PostMapping("/verify-license")
    public ResponseEntity<?> verifyLicense(@RequestBody Map<String, String> body) {
        Map<String, Object> result = userService.verifyLicense(body);
        return ResponseEntity.ok(result);
    }

    /**
     * Reset a password — only for users in the same hospital.
     */
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(
            @PathVariable("id") String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        User target = userService.getUserById(id);
        if (!target.getHospitalId().equalsIgnoreCase(caller.getHospitalId())) {
            throw new UnauthorizedException("Access denied: user belongs to a different hospital.");
        }
        Map<String, String> result = userService.resetPassword(id, body);
        return ResponseEntity.ok(result);
    }

    /**
     * Update active/inactive status — only for users in the same hospital.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        User target = userService.getUserById(id);
        if (!target.getHospitalId().equalsIgnoreCase(caller.getHospitalId())) {
            throw new UnauthorizedException("Access denied: user belongs to a different hospital.");
        }
        User updated = userService.updateStatus(id, body);
        return ResponseEntity.ok(updated);
    }

    /**
     * Update own profile — always scoped to self.
     */
    @PatchMapping("/me/profile")
    public ResponseEntity<?> updateMyProfile(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (user == null) throw new UnauthorizedException("Authentication required.");
        User updated = userService.updateUserProfile(user, body);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/me/profile")
    public ResponseEntity<?> updateMyProfilePut(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        return updateMyProfile(body, user);
    }

    /**
     * Admin updates any staff member — only within same hospital.
     */
    @PatchMapping("/{id}/profile")
    public ResponseEntity<?> updateUserProfile(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required.");
        User target = userService.getUserById(id);
        if (!target.getHospitalId().equalsIgnoreCase(caller.getHospitalId())) {
            throw new UnauthorizedException("Access denied: user belongs to a different hospital.");
        }
        User updated = userService.updateUserProfile(target, body);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUserById(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User caller) {
        return updateUserProfile(id, body, caller);
    }
}
