package com.medicos.backend.service;

import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.BillingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class BillingService {

    private final BillingRepository billingRepository;

    public BillingService(BillingRepository billingRepository) {
        this.billingRepository = billingRepository;
    }

    @Transactional(readOnly = true)
    public List<Billing> getBills(String patientId) {
        return Optional.ofNullable(patientId)
                .filter(id -> !id.isEmpty())
                .map(billingRepository::findByPatientIdOrderByCreatedAtDesc)
                .orElseGet(billingRepository::findAll);
    }

    @Transactional
    public Billing createBill(Billing bill, User user) {
        Optional.ofNullable(bill.getPatientId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (bill.getId() == null || bill.getId().isEmpty()) {
            bill.setId("bill-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (bill.getHospitalId() == null || bill.getHospitalId().isEmpty()) {
            bill.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (bill.getInvoiceNumber() == null || bill.getInvoiceNumber().isEmpty()) {
            bill.setInvoiceNumber("INV-" + System.currentTimeMillis());
        }

        if (bill.getBilledBy() == null || bill.getBilledBy().isEmpty()) {
            bill.setBilledBy(Optional.ofNullable(user).map(User::getId).orElse("usr-admin-001"));
        }

        if (bill.getCreatedAt() == null) {
            bill.setCreatedAt(LocalDateTime.now());
        }

        return billingRepository.save(bill);
    }

    @Transactional
    public Billing recordPayment(String id, Map<String, Object> body) {
        Billing bill = billingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found with ID: " + id));

        Optional.ofNullable(body.get("paid_amount"))
                .ifPresent(v -> bill.setPaidAmount(Double.parseDouble(v.toString())));

        Optional.ofNullable(body.get("payment_mode"))
                .ifPresent(v -> bill.setPaymentMode(v.toString()));

        Optional.ofNullable(body.get("payment_status"))
                .ifPresent(v -> bill.setPaymentStatus(v.toString()));

        return billingRepository.save(bill);
    }
}
