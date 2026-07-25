package com.medicos.backend.controller;

import com.medicos.backend.entity.User;
import com.medicos.backend.service.SyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping("/pull")
    @PostMapping("/pull")
    public ResponseEntity<?> pullData(@AuthenticationPrincipal User user) {
        Map<String, Object> response = syncService.pullData(user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/push")
    public ResponseEntity<?> pushData(@RequestBody Map<String, Object> payload) {
        Map<String, Object> response = syncService.pushData(payload);
        return ResponseEntity.ok(response);
    }
}
