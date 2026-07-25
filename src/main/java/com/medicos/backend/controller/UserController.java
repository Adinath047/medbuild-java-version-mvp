package com.medicos.backend.controller;

import com.medicos.backend.entity.User;
import com.medicos.backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/doctors")
    public ResponseEntity<?> getDoctors() {
        List<User> doctors = userService.getDoctors();
        return ResponseEntity.ok(doctors);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable("id") String id) {
        User user = userService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/verify-license")
    public ResponseEntity<?> verifyLicense(@RequestBody Map<String, String> body) {
        Map<String, Object> result = userService.verifyLicense(body);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable("id") String id, @RequestBody Map<String, String> body) {
        Map<String, String> result = userService.resetPassword(id, body);
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        User user = userService.updateStatus(id, body);
        return ResponseEntity.ok(user);
    }
}
