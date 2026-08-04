package com.medicos.backend.controller;

import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.SuperAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/super-admin")
public class SuperAdminController {

    private final SuperAdminService superAdminService;

    public SuperAdminController(SuperAdminService superAdminService) {
        this.superAdminService = superAdminService;
    }

    @PostMapping("/unlock")
    public ResponseEntity<?> unlockConsole(@RequestBody Map<String, String> body) {
        Map<String, Object> result = superAdminService.unlockConsole(body);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/hospitals")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getHospitals() {
        List<Hospital> hospitals = superAdminService.getHospitals();
        return ResponseEntity.ok(hospitals);
    }

    @GetMapping("/users")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getAllUsers() {
        List<User> users = superAdminService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @PostMapping("/hospitals")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createHospital(@RequestBody Map<String, Object> body) {
        Hospital created = superAdminService.createHospital(body);
        return ResponseEntity.status(201).body(created);
    }

    @PostMapping("/users")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createStaffUser(@RequestBody Map<String, Object> body) {
        User created = superAdminService.createStaffUser(body);
        return ResponseEntity.status(201).body(created);
    }
}
