package com.medicos.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.BedAdmission;
import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.BedAdmissionRepository;
import com.medicos.backend.repository.BillingRepository;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class BillingService {

    private final BillingRepository billingRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final BedAdmissionRepository admissionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public BillingService(BillingRepository billingRepository,
                          PatientRepository patientRepository,
                          UserRepository userRepository,
                          BedAdmissionRepository admissionRepository) {
        this.billingRepository = billingRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.admissionRepository = admissionRepository;
    }

    private void populateBillingDetails(Billing b) {
        if (b == null) return;
        if (b.getPatientId() != null && !b.getPatientId().isEmpty()) {
            patientRepository.findById(b.getPatientId()).ifPresent(p -> {
                b.setPatientName(p.getName());
                b.setPatientUhid(p.getUhid());
                b.setPatientPhone(p.getPhone());
            });
        }
        if (b.getDoctorId() != null && !b.getDoctorId().isEmpty()) {
            userRepository.findById(b.getDoctorId()).ifPresent(d -> {
                b.setDoctorName(d.getName());
            });
        }
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
        List<Billing> sanitized = sanitizeBills(list);
        sanitized.forEach(this::populateBillingDetails);
        return sanitized;
    }

    private List<Billing> sanitizeBills(List<Billing> list) {
        if (list == null || list.isEmpty()) return list;
        List<Billing> toSave = new ArrayList<>();
        for (Billing b : list) {
            double net = b.getNetAmount() != null ? b.getNetAmount() : (b.getTotalAmount() != null ? b.getTotalAmount() : 0.0);
            double paid = b.getPaidAmount() != null ? b.getPaidAmount() : 0.0;
            String currentStatus = b.getPaymentStatus() != null ? b.getPaymentStatus().trim() : "";

            if ("Cancelled".equalsIgnoreCase(currentStatus) || "Waived".equalsIgnoreCase(currentStatus)) {
                continue;
            }

            if (paid >= net && !"Paid".equalsIgnoreCase(currentStatus)) {
                b.setPaymentStatus("Paid");
                toSave.add(b);
            } else if (paid > 0 && paid < net && !"Partial".equalsIgnoreCase(currentStatus)) {
                b.setPaymentStatus("Partial");
                toSave.add(b);
            } else if (paid <= 0 && net > 0 && !"Pending".equalsIgnoreCase(currentStatus)) {
                b.setPaymentStatus("Pending");
                toSave.add(b);
            }
        }
        if (!toSave.isEmpty()) {
            billingRepository.saveAll(toSave);
        }
        return list;
    }

    @CacheEvict(value = "bed_history", allEntries = true)
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
            String datePrefix = DateTimeFormatter.ofPattern("yyMMdd").format(LocalDateTime.now());
            String randomPart = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
            bill.setInvoiceNumber("INV-" + datePrefix + "-" + randomPart);
        }

        if (bill.getBilledBy() == null || bill.getBilledBy().isEmpty()) {
            bill.setBilledBy(Optional.ofNullable(user).map(User::getId).orElse("usr-admin-001"));
        }

        if (bill.getCreatedAt() == null) {
            bill.setCreatedAt(LocalDateTime.now());
        }
        bill.setUpdatedAt(LocalDateTime.now());

        // 1. Calculate Line Items Total if available
        double itemsSum = 0.0;
        try {
            Object rawItems = bill.getItems();
            if (rawItems instanceof List<?> itemList) {
                for (Object itemObj : itemList) {
                    if (itemObj instanceof Map<?, ?> itemMap) {
                        double qty = 1.0;
                        double price = 0.0;
                        if (itemMap.containsKey("quantity") && itemMap.get("quantity") != null) {
                            try { qty = Double.parseDouble(itemMap.get("quantity").toString()); } catch (Exception ignored) {}
                        }
                        if (itemMap.containsKey("amount") && itemMap.get("amount") != null) {
                            try { 
                                double amt = Double.parseDouble(itemMap.get("amount").toString());
                                itemsSum += amt;
                                continue;
                            } catch (Exception ignored) {}
                        }
                        if (itemMap.containsKey("unit_price") && itemMap.get("unit_price") != null) {
                            try { price = Double.parseDouble(itemMap.get("unit_price").toString()); } catch (Exception ignored) {}
                        } else if (itemMap.containsKey("price") && itemMap.get("price") != null) {
                            try { price = Double.parseDouble(itemMap.get("price").toString()); } catch (Exception ignored) {}
                        }
                        itemsSum += (qty * price);
                    }
                }
            }
        } catch (Exception ignored) {}

        double gross = itemsSum > 0 ? itemsSum : (bill.getGrossAmount() != null && bill.getGrossAmount() > 0 ? bill.getGrossAmount() : (bill.getTotalAmount() != null && bill.getTotalAmount() > 0 ? bill.getTotalAmount() : (bill.getNetAmount() != null ? bill.getNetAmount() : 0.0)));
        double discount = Math.max(0.0, bill.getDiscount() != null ? bill.getDiscount() : 0.0);
        double tax = Math.max(0.0, bill.getTax() != null ? bill.getTax() : 0.0);
        double net = Math.max(0.0, gross - discount + tax);
        double paid = bill.getPaidAmount() != null ? Math.max(0.0, bill.getPaidAmount()) : 0.0;

        bill.setGrossAmount(gross);
        bill.setTotalAmount(gross);
        bill.setDiscount(discount);
        bill.setTax(tax);
        bill.setNetAmount(net);
        bill.setPaidAmount(paid);

        if (paid >= net) {
            bill.setPaymentStatus("Paid");
        } else if (paid > 0) {
            bill.setPaymentStatus("Partial");
        } else {
            bill.setPaymentStatus("Pending");
        }

        // Initialize payment history audit entry
        if (paid > 0) {
            List<Map<String, Object>> history = new ArrayList<>();
            Map<String, Object> initialTxn = new HashMap<>();
            initialTxn.put("id", "txn-" + UUID.randomUUID().toString().substring(0, 8));
            initialTxn.put("amount", paid);
            initialTxn.put("payment_mode", bill.getPaymentMode() != null ? bill.getPaymentMode() : "Cash");
            initialTxn.put("date", LocalDateTime.now().toString());
            initialTxn.put("received_by", Optional.ofNullable(user).map(User::getName).orElse("Cashier"));
            initialTxn.put("notes", "Initial receipt on bill generation");
            history.add(initialTxn);
            bill.setPaymentHistory(history);
        }

        Billing saved = billingRepository.save(bill);

        // Link and mark Bed Admission as Billed if admission_id provided or bill_type is bed_stay
        try {
            if (bill.getAdmissionId() != null && !bill.getAdmissionId().isBlank()) {
                admissionRepository.findById(bill.getAdmissionId()).ifPresent(adm -> {
                    adm.setBillingStatus("Billed");
                    adm.setBillingId(saved.getId());
                    admissionRepository.save(adm);
                });
            } else if ("bed_stay".equalsIgnoreCase(bill.getBillType()) && bill.getPatientId() != null) {
                List<BedAdmission> admissions = admissionRepository.findByPatientIdOrderByAdmittedAtDesc(bill.getPatientId());
                if (!admissions.isEmpty()) {
                    for (BedAdmission adm : admissions) {
                        if (!"Billed".equalsIgnoreCase(adm.getBillingStatus())) {
                            adm.setBillingStatus("Billed");
                            adm.setBillingId(saved.getId());
                            admissionRepository.save(adm);
                            break;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        populateBillingDetails(saved);
        return saved;
    }

    @CacheEvict(value = "bed_history", allEntries = true)
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

        double oldPaid = bill.getPaidAmount() != null ? bill.getPaidAmount() : 0.0;
        double net = bill.getNetAmount() != null ? bill.getNetAmount() : (bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0);

        double newPaid = oldPaid;
        double paymentIncrement = 0.0;

        if (body.containsKey("amount") && body.get("amount") != null) {
            try {
                double amt = Double.parseDouble(body.get("amount").toString().trim());
                if (amt < 0) throw new BadRequestException("Payment amount cannot be negative.");
                paymentIncrement = amt;
                newPaid = oldPaid + amt;
            } catch (NumberFormatException e) {
                throw new BadRequestException("Invalid numeric value for amount.");
            }
        } else if (body.containsKey("paid_amount") && body.get("paid_amount") != null) {
            try {
                newPaid = Double.parseDouble(body.get("paid_amount").toString().trim());
                if (newPaid < 0) throw new BadRequestException("Paid amount cannot be negative.");
                paymentIncrement = Math.max(0.0, newPaid - oldPaid);
            } catch (NumberFormatException e) {
                throw new BadRequestException("Invalid numeric value for paid_amount.");
            }
        }

        bill.setPaidAmount(newPaid);
        if (newPaid >= net) {
            bill.setPaymentStatus("Paid");
        } else if (newPaid > 0) {
            bill.setPaymentStatus("Partial");
        } else {
            bill.setPaymentStatus("Pending");
        }

        if (body.containsKey("payment_mode") && body.get("payment_mode") != null) {
            bill.setPaymentMode(body.get("payment_mode").toString().trim());
        }

        if (body.containsKey("payment_status") && body.get("payment_status") != null && !body.get("payment_status").toString().isBlank()) {
            bill.setPaymentStatus(body.get("payment_status").toString().trim());
        }

        // Add installment to payment_history
        if (paymentIncrement > 0) {
            List<Map<String, Object>> history = new ArrayList<>();
            Object rawHist = bill.getPaymentHistory();
            if (rawHist instanceof List<?> histList) {
                for (Object o : histList) {
                    if (o instanceof Map<?, ?> m) {
                        history.add(new HashMap<>((Map<String, Object>) m));
                    }
                }
            }
            Map<String, Object> txn = new HashMap<>();
            txn.put("id", "txn-" + UUID.randomUUID().toString().substring(0, 8));
            txn.put("amount", paymentIncrement);
            txn.put("payment_mode", body.getOrDefault("payment_mode", bill.getPaymentMode() != null ? bill.getPaymentMode() : "Cash").toString());
            txn.put("date", LocalDateTime.now().toString());
            txn.put("received_by", body.getOrDefault("received_by", "Cashier").toString());
            txn.put("notes", body.getOrDefault("notes", "Installment payment recorded").toString());
            history.add(txn);
            bill.setPaymentHistory(history);
        }

        bill.setUpdatedAt(LocalDateTime.now());
        Billing saved = billingRepository.save(bill);
        populateBillingDetails(saved);
        return saved;
    }
}
