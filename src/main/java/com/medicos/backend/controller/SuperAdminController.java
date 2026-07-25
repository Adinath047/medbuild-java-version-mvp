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
    public ResponseEntity<?> getHospitals() {
        List<Hospital> hospitals = superAdminService.getHospitals();
        return ResponseEntity.ok(hospitals);
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<User> users = superAdminService.getAllUsers();
        return ResponseEntity.ok(users);
    }
}
