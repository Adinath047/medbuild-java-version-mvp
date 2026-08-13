package com.medicos.backend.service;

import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.BillingRepository;
import org.springframework.data.domain.Sort;
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
                .orElseGet(() -> billingRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")));
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

        double net = bill.getNetAmount() != null ? bill.getNetAmount() : (bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0);
        double paid = bill.getPaidAmount() != null ? bill.getPaidAmount() : 0.0;
        bill.setNetAmount(net);
        bill.setPaidAmount(paid);

        if (bill.getPaymentStatus() == null || bill.getPaymentStatus().isEmpty()) {
            if (paid >= net && net > 0) {
                bill.setPaymentStatus("Paid");
            } else if (paid > 0) {
                bill.setPaymentStatus("Partial");
            } else {
                bill.setPaymentStatus("Pending");
            }
        }

        return billingRepository.save(bill);
    }

    @Transactional
    public Billing recordPayment(String id, Map<String, Object> body) {
        Billing bill = billingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found with ID: " + id));

        if (body.containsKey("paid_amount") && body.get("paid_amount") != null) {
            double paid = Double.parseDouble(body.get("paid_amount").toString());
            bill.setPaidAmount(paid);
            double net = bill.getNetAmount() != null ? bill.getNetAmount() : 0.0;

            if (paid >= net && net > 0) {
                bill.setPaymentStatus("Paid");
            } else if (paid > 0) {
                bill.setPaymentStatus("Partial");
            } else {
                bill.setPaymentStatus("Pending");
            }
        }

        if (body.containsKey("payment_mode") && body.get("payment_mode") != null) {
            bill.setPaymentMode(body.get("payment_mode").toString());
        }

        if (body.containsKey("payment_status") && body.get("payment_status") != null) {
            bill.setPaymentStatus(body.get("payment_status").toString());
        }

        return billingRepository.save(bill);
    }
}
