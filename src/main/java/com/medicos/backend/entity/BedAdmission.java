package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bed_admissions")
public class BedAdmission {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(name = "bed_id", nullable = false, length = 64)
    private String bedId;

    @Column(name = "patient_id", nullable = false, length = 64)
    private String patientId;

    @Column(name = "doctor_id", length = 64)
    private String doctorId;

    @Column(name = "admitted_at", nullable = false)
    private LocalDateTime admittedAt = LocalDateTime.now();

    @Column(name = "discharged_at")
    private LocalDateTime dischargedAt;

    @Column(nullable = false, length = 50)
    private String status = "Admitted";

    @Column(name = "billing_status", nullable = false, length = 50)
    private String billingStatus = "Unbilled";

    @Column(name = "billing_id", length = 64)
    private String billingId;

    public BedAdmission() {}

    @PrePersist
    public void prePersist() {
        if (admittedAt == null) admittedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getBedId() { return bedId; }
    public void setBedId(String bedId) { this.bedId = bedId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getDoctorId() { return doctorId; }
    public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

    public LocalDateTime getAdmittedAt() { return admittedAt; }
    public void setAdmittedAt(LocalDateTime admittedAt) { this.admittedAt = admittedAt; }

    public LocalDateTime getDischargedAt() { return dischargedAt; }
    public void setDischargedAt(LocalDateTime dischargedAt) { this.dischargedAt = dischargedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getBillingStatus() { return billingStatus; }
    public void setBillingStatus(String billingStatus) { this.billingStatus = billingStatus; }

    public String getBillingId() { return billingId; }
    public void setBillingId(String billingId) { this.billingId = billingId; }
}
