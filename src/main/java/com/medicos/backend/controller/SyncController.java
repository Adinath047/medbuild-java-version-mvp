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
    public ResponseEntity<?> pullData(@AuthenticationPrincipal User user,
                                      @RequestParam(value = "since", required = false) String since,
                                      @RequestParam(value = "tables", required = false) String tables) {
        Map<String, Object> response = syncService.pullData(user, since, tables);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/push")
    public ResponseEntity<?> pushData(@RequestBody Map<String, Object> payload, @AuthenticationPrincipal User user) {
        Map<String, Object> response = syncService.pushData(payload, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    public ResponseEntity<?> syncStatus() {
        return ResponseEntity.ok(Map.of(
                "serverTime", java.time.Instant.now().toString(),
                "pendingQueue", 0,
                "status", "online"
        ));
    }
}
