package com.medicos.backend.controller;

import com.medicos.backend.dto.PrescriptionDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;

    public PrescriptionController(PrescriptionService prescriptionService) {
        this.prescriptionService = prescriptionService;
    }

    @GetMapping
    public ResponseEntity<List<PrescriptionDTO>> getPrescriptions(@RequestParam(value = "patient_id", required = false) String patientId) {
        List<PrescriptionDTO> list = prescriptionService.getPrescriptions(patientId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PrescriptionDTO> getPrescriptionById(@PathVariable("id") String id) {
        PrescriptionDTO rx = prescriptionService.getPrescriptionById(id);
        return ResponseEntity.ok(rx);
    }

    @GetMapping("/slip/{token}")
    public ResponseEntity<PrescriptionDTO> getPrescriptionBySlipToken(@PathVariable("token") String token) {
        PrescriptionDTO rx = prescriptionService.getPrescriptionBySlipToken(token);
        return ResponseEntity.ok(rx);
    }

    @PostMapping
    public ResponseEntity<PrescriptionDTO> createPrescription(@RequestBody Map<String, Object> body, @AuthenticationPrincipal User user) {
        PrescriptionDTO saved = prescriptionService.createPrescriptionFromMap(body, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PrescriptionDTO> updatePrescription(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        PrescriptionDTO updated = prescriptionService.updatePrescription(id, body);
        return ResponseEntity.ok(updated);
    }
}
