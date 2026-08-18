package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "billing")
public class Billing {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "hospital_id", nullable = false, length = 64)
    @JsonProperty("hospital_id")
    private String hospitalId;

    @Column(name = "patient_id", nullable = false, length = 64)
    @JsonProperty("patient_id")
    private String patientId;

    @Column(name = "encounter_id", length = 64)
    @JsonProperty("encounter_id")
    private String encounterId;

    @Column(name = "doctor_id", length = 64)
    @JsonProperty("doctor_id")
    private String doctorId;

    @Column(name = "bill_type", length = 50)
    @JsonProperty("bill_type")
    private String billType = "OPD";

    @Column(columnDefinition = "TEXT", nullable = false)
    private String items = "[]";

    @Column(name = "gross_amount")
    @JsonProperty("gross_amount")
    private Double grossAmount = 0.0;

    @Column(name = "total_amount", nullable = false)
    @JsonProperty("total_amount")
    private Double totalAmount = 0.0;

    @Column(name = "discount")
    @JsonProperty("discount")
    private Double discount = 0.0;

    @Column(name = "tax")
    @JsonProperty("tax")
    private Double tax = 0.0;

    @Column(name = "net_amount", nullable = false)
    @JsonProperty("net_amount")
    private Double netAmount = 0.0;

    @Column(name = "paid_amount")
    @JsonProperty("paid_amount")
    private Double paidAmount = 0.0;

    @Column(name = "payment_mode")
    @JsonProperty("payment_mode")
    private String paymentMode = "Cash";

    @Column(name = "payment_status", nullable = false)
    @JsonProperty("payment_status")
    private String paymentStatus = "Pending";

    @Column(name = "payment_history", columnDefinition = "TEXT")
    private String paymentHistory = "[]";

    @Column(name = "invoice_number", unique = true, length = 100)
    @JsonProperty("invoice_number")
    private String invoiceNumber;

    @Column(columnDefinition = "TEXT")
    @JsonProperty("notes")
    private String notes;

    @Column(name = "billed_by", length = 64)
    @JsonProperty("billed_by")
    private String billedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonProperty("created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @JsonProperty("updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    // Transient Enrichment Fields
    @Transient
    @JsonProperty("patient_name")
    private String patientName;

    @Transient
    @JsonProperty("patient_uhid")
    private String patientUhid;

    @Transient
    @JsonProperty("patient_phone")
    private String patientPhone;

    @Transient
    @JsonProperty("doctor_name")
    private String doctorName;

    @Transient
    @JsonProperty("balance_due")
    public Double getBalanceDue() {
        double net = netAmount != null ? netAmount : (totalAmount != null ? totalAmount : 0.0);
        double paid = paidAmount != null ? paidAmount : 0.0;
        return Math.max(0.0, net - paid);
    }

    public Billing() {}

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
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

    public String getDoctorId() { return doctorId; }
    public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

    public String getBillType() { return billType; }
    public void setBillType(String billType) { this.billType = billType; }

    @JsonProperty("items")
    public Object getItems() {
        if (this.items == null || this.items.isBlank()) return new java.util.ArrayList<>();
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(this.items, Object.class);
        } catch (Exception e) {
            return this.items;
        }
    }

    @JsonProperty("items")
    public void setItems(Object items) {
        if (items == null) {
            this.items = "[]";
        } else if (items instanceof String) {
            this.items = (String) items;
        } else {
            try {
                this.items = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(items);
            } catch (Exception e) {
                this.items = "[]";
            }
        }
    }

    @JsonProperty("payment_history")
    public Object getPaymentHistory() {
        if (this.paymentHistory == null || this.paymentHistory.isBlank()) return new java.util.ArrayList<>();
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(this.paymentHistory, Object.class);
        } catch (Exception e) {
            return this.paymentHistory;
        }
    }

    @JsonProperty("payment_history")
    public void setPaymentHistory(Object paymentHistory) {
        if (paymentHistory == null) {
            this.paymentHistory = "[]";
        } else if (paymentHistory instanceof String) {
            this.paymentHistory = (String) paymentHistory;
        } else {
            try {
                this.paymentHistory = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(paymentHistory);
            } catch (Exception e) {
                this.paymentHistory = "[]";
            }
        }
    }

    public Double getGrossAmount() { return grossAmount != null ? grossAmount : totalAmount; }
    public void setGrossAmount(Double grossAmount) { 
        this.grossAmount = grossAmount; 
        if (this.totalAmount == null || this.totalAmount == 0.0) this.totalAmount = grossAmount;
    }

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { 
        this.totalAmount = totalAmount; 
        if (this.grossAmount == null || this.grossAmount == 0.0) this.grossAmount = totalAmount;
    }

    public Double getDiscount() { return discount; }
    public void setDiscount(Double discount) { this.discount = discount; }

    public Double getTax() { return tax; }
    public void setTax(Double tax) { this.tax = tax; }

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

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getPatientUhid() { return patientUhid; }
    public void setPatientUhid(String patientUhid) { this.patientUhid = patientUhid; }

    public String getPatientPhone() { return patientPhone; }
    public void setPatientPhone(String patientPhone) { this.patientPhone = patientPhone; }

    public String getDoctorName() { return doctorName; }
    public void setDoctorName(String doctorName) { this.doctorName = doctorName; }
}
