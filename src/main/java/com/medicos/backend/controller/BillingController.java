package com.medicos.backend.controller;

import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.BillingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping
    public ResponseEntity<?> getBills(@RequestParam(value = "patient_id", required = false) String patientId) {
        List<Billing> list = billingService.getBills(patientId);
        return ResponseEntity.ok(list);
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BILLING', 'RECEPTIONIST', 'DOCTOR')")
    public ResponseEntity<?> createBill(@RequestBody Billing bill, @AuthenticationPrincipal User user) {
        Billing saved = billingService.createBill(bill, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}/payment")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BILLING', 'RECEPTIONIST', 'DOCTOR')")
    public ResponseEntity<?> recordPayment(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        Billing saved = billingService.recordPayment(id, body);
        return ResponseEntity.ok(saved);
    }
}
