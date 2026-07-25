package com.medicos.backend.controller;

import com.medicos.backend.entity.Prescription;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;

    public PrescriptionController(PrescriptionService prescriptionService) {
        this.prescriptionService = prescriptionService;
    }

    @GetMapping
    public ResponseEntity<?> getPrescriptions(@RequestParam(value = "patient_id", required = false) String patientId) {
        List<Prescription> list = prescriptionService.getPrescriptions(patientId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPrescriptionById(@PathVariable("id") String id) {
        Prescription rx = prescriptionService.getPrescriptionById(id);
        return ResponseEntity.ok(rx);
    }

    @GetMapping("/slip/{token}")
    public ResponseEntity<?> getPrescriptionBySlipToken(@PathVariable("token") String token) {
        Prescription rx = prescriptionService.getPrescriptionBySlipToken(token);
        return ResponseEntity.ok(rx);
    }

    @PostMapping
    public ResponseEntity<?> createPrescription(@RequestBody Prescription rx, @AuthenticationPrincipal User user) {
        Prescription saved = prescriptionService.createPrescription(rx, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
