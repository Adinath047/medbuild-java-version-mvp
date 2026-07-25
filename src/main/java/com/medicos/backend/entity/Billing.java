package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "billing")
public class Billing {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(name = "patient_id", nullable = false, length = 64)
    private String patientId;

    @Column(name = "encounter_id", length = 64)
    private String encounterId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String items = "[]";

    @Column(name = "total_amount", nullable = false)
    private Double totalAmount = 0.0;

    private Double discount = 0.0;

    @Column(name = "net_amount", nullable = false)
    private Double netAmount = 0.0;

    @Column(name = "paid_amount")
    private Double paidAmount = 0.0;

    @Column(name = "payment_mode")
    private String paymentMode = "Cash";

    @Column(name = "payment_status", nullable = false)
    private String paymentStatus = "Pending";

    @Column(name = "invoice_number", unique = true, length = 100)
    private String invoiceNumber;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "billed_by", length = 64)
    private String billedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Billing() {}

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public String getItems() { return items; }
    public void setItems(String items) { this.items = items; }

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }

    public Double getDiscount() { return discount; }
    public void setDiscount(Double discount) { this.discount = discount; }

    public Double getNetAmount() { return netAmount; }
    public void setNetAmount(Double netAmount) { this.netAmount = netAmount; }

    public Double getPaidAmount() { return paidAmount; }
    public void setPaidAmount(Double paidAmount) { this.paidAmount = paidAmount; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getBilledBy() { return billedBy; }
    public void setBilledBy(String billedBy) { this.billedBy = billedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
