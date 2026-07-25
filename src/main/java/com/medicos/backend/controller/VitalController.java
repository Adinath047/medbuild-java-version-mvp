package com.medicos.backend.controller;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.service.VitalService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vitals")
public class VitalController {

    private final VitalService vitalService;

    public VitalController(VitalService vitalService) {
        this.vitalService = vitalService;
    }

    @GetMapping
    public ResponseEntity<?> getVitals(@RequestParam(value = "patient_id", required = false) String patientId) {
        List<Vital> list = vitalService.getVitals(patientId);
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> recordVitals(@RequestBody Vital vital, @AuthenticationPrincipal User user) {
        Vital saved = vitalService.recordVitals(vital, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
