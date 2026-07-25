package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(name = "patient_id", nullable = false, length = 64)
    private String patientId;

    @Column(name = "doctor_id", nullable = false, length = 64)
    private String doctorId;

    @Column(name = "encounter_id", length = 64)
    private String encounterId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String medicines = "[]";

    @Column(columnDefinition = "TEXT")
    private String advice;

    @Column(name = "follow_up_date")
    private String followUpDate;

    @Column(name = "patient_weight")
    private String patientWeight;

    @Column(name = "slip_token", unique = true, length = 128)
    private String slipToken;

    @Column(name = "is_printed")
    private Integer isPrinted = 0;

    @Column(name = "created_by_role")
    private String createdByRole = "doctor";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Prescription() {}

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

    public String getDoctorId() { return doctorId; }
    public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public String getMedicines() { return medicines; }
    public void setMedicines(String medicines) { this.medicines = medicines; }

    public String getAdvice() { return advice; }
    public void setAdvice(String advice) { this.advice = advice; }

    public String getFollowUpDate() { return followUpDate; }
    public void setFollowUpDate(String followUpDate) { this.followUpDate = followUpDate; }

    public String getPatientWeight() { return patientWeight; }
    public void setPatientWeight(String patientWeight) { this.patientWeight = patientWeight; }

    public String getSlipToken() { return slipToken; }
    public void setSlipToken(String slipToken) { this.slipToken = slipToken; }

    public Integer getIsPrinted() { return isPrinted; }
    public void setIsPrinted(Integer isPrinted) { this.isPrinted = isPrinted; }

    public String getCreatedByRole() { return createdByRole; }
    public void setCreatedByRole(String createdByRole) { this.createdByRole = createdByRole; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
