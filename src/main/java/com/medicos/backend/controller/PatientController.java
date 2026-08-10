package com.medicos.backend.controller;

import com.medicos.backend.dto.PatientDTO;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.service.PatientService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping
    public ResponseEntity<?> getPatients(@RequestParam(value = "search", required = false) String search,
                                         @RequestParam(value = "q", required = false) String q,
                                         @RequestParam(value = "limit", required = false, defaultValue = "100") int limit) {
        String query = search != null ? search : q;
        PatientDTO.PatientListResponse response = patientService.getPatients(query, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPatientById(@PathVariable("id") String id) {
        Patient patient = patientService.getPatientById(id);
        return ResponseEntity.ok(patient);
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<?> getPatientSummary(@PathVariable("id") String id) {
        PatientDTO.PatientSummaryResponse summary = patientService.getPatientSummary(id);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/{id}/vitals-history")
    public ResponseEntity<?> getVitalsHistory(@PathVariable("id") String id) {
        List<Vital> history = patientService.getVitalsHistory(id);
        return ResponseEntity.ok(history);
    }

    @PostMapping
    public ResponseEntity<?> createPatient(@RequestBody Patient patient, @AuthenticationPrincipal User user) {
        Patient saved = patientService.createPatient(patient, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePatient(@PathVariable("id") String id, @RequestBody Patient updated) {
        Patient saved = patientService.updatePatient(id, updated);
        return ResponseEntity.ok(saved);
    }
}
