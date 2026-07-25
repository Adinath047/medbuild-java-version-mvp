package com.medicos.backend.controller;

import com.medicos.backend.entity.Encounter;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.EncounterService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/encounters")
public class EncounterController {

    private final EncounterService encounterService;

    public EncounterController(EncounterService encounterService) {
        this.encounterService = encounterService;
    }

    @GetMapping
    public ResponseEntity<?> getEncounters(@RequestParam(value = "patient_id", required = false) String patientId,
                                           @RequestParam(value = "doctor_id", required = false) String doctorId) {
        List<Encounter> list = encounterService.getEncounters(patientId, doctorId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEncounterById(@PathVariable("id") String id) {
        Encounter enc = encounterService.getEncounterById(id);
        return ResponseEntity.ok(enc);
    }

    @PostMapping
    public ResponseEntity<?> createEncounter(@RequestBody Encounter encounter, @AuthenticationPrincipal User user) {
        Encounter saved = encounterService.createEncounter(encounter, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
