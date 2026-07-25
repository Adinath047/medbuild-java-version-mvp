package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "beds")
public class Bed {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(name = "bed_number", nullable = false, length = 50)
    private String bedNumber;

    @Column(nullable = false, length = 50)
    private String ward;

    @Column(length = 50)
    private String room;

    @Column(length = 50)
    private String type = "General";

    @Column(nullable = false, length = 50)
    private String status = "Available";

    @Column(name = "patient_id", length = 64)
    private String patientId;

    @Column(name = "doctor_id", length = 64)
    private String doctorId;

    @Column(name = "admitted_at")
    private LocalDateTime admittedAt;

    public Bed() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public String getWard() { return ward; }
    public void setWard(String ward) { this.ward = ward; }

    public String getRoom() { return room; }
    public void setRoom(String room) { this.room = room; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getDoctorId() { return doctorId; }
    public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

    public LocalDateTime getAdmittedAt() { return admittedAt; }
    public void setAdmittedAt(LocalDateTime admittedAt) { this.admittedAt = admittedAt; }
}
