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

    @Transactional
    public List<Billing> getBills(String patientId) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        List<Billing> list;
        if (patientId != null && !patientId.isEmpty()) {
            List<Billing> raw = billingRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
            list = isTenantScoped ? raw.stream().filter(b -> hospitalId.equals(b.getHospitalId())).toList() : raw;
        } else if (isTenantScoped) {
            list = billingRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId);
        } else {
            list = billingRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        }
        return sanitizeBills(list);
    }

    private List<Billing> sanitizeBills(List<Billing> list) {
        if (list == null || list.isEmpty()) return list;
        List<Billing> toSave = new ArrayList<>();
        for (Billing b : list) {
            double net = b.getNetAmount() != null ? b.getNetAmount() : (b.getTotalAmount() != null ? b.getTotalAmount() : 0.0);
            double paid = b.getPaidAmount() != null ? b.getPaidAmount() : 0.0;
            String currentStatus = b.getPaymentStatus() != null ? b.getPaymentStatus().trim() : "";

            if (paid >= net && !"Paid".equalsIgnoreCase(currentStatus)) {
                b.setPaymentStatus("Paid");
                toSave.add(b);
            } else if (paid > 0 && paid < net && !"Partial".equalsIgnoreCase(currentStatus)) {
                b.setPaymentStatus("Partial");
                toSave.add(b);
            }
        }
        if (!toSave.isEmpty()) {
            billingRepository.saveAll(toSave);
        }
        return list;
    }

    @Transactional
    public Billing createBill(Billing bill, User user) {
        Optional.ofNullable(bill.getPatientId())
                .filter(id -> !id.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        if (bill.getId() == null || bill.getId().isEmpty()) {
            bill.setId("bill-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            bill.setHospitalId(hospitalId);
        } else if (bill.getHospitalId() == null || bill.getHospitalId().isEmpty()) {
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

        double net = bill.getNetAmount() != null ? Math.max(0.0, bill.getNetAmount()) : (bill.getTotalAmount() != null ? Math.max(0.0, bill.getTotalAmount()) : 0.0);
        double paid = bill.getPaidAmount() != null ? Math.max(0.0, bill.getPaidAmount()) : 0.0;
        bill.setNetAmount(net);
        bill.setPaidAmount(paid);

        if (paid >= net) {
            bill.setPaymentStatus("Paid");
        } else if (paid > 0) {
            bill.setPaymentStatus("Partial");
        } else {
            bill.setPaymentStatus("Pending");
        }

        return billingRepository.save(bill);
    }

    @Transactional
    public Billing recordPayment(String id, Map<String, Object> body) {
        Billing bill = billingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found with ID: " + id));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            if (bill.getHospitalId() != null && !hospitalId.equals(bill.getHospitalId())) {
                throw new ResourceNotFoundException("Bill not found with ID: " + id);
            }
        }

        if (body.containsKey("paid_amount") && body.get("paid_amount") != null) {
            try {
                double paid = Double.parseDouble(body.get("paid_amount").toString().trim());
                if (paid < 0) {
                    throw new BadRequestException("Paid amount cannot be negative.");
                }
                bill.setPaidAmount(paid);
                double net = bill.getNetAmount() != null ? bill.getNetAmount() : (bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0);

                if (paid >= net) {
                    bill.setPaymentStatus("Paid");
                } else if (paid > 0) {
                    bill.setPaymentStatus("Partial");
                } else {
                    bill.setPaymentStatus("Pending");
                }
            } catch (NumberFormatException e) {
                throw new BadRequestException("Invalid numeric value for paid_amount.");
            }
        }

        if (body.containsKey("payment_mode") && body.get("payment_mode") != null) {
            bill.setPaymentMode(body.get("payment_mode").toString().trim());
        }

        if (body.containsKey("payment_status") && body.get("payment_status") != null) {
            bill.setPaymentStatus(body.get("payment_status").toString().trim());
        }

        return billingRepository.save(bill);
    }
}
