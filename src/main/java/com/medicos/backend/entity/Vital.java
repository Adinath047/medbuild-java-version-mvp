package com.medicos.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "vitals")
public class Vital {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "patient_id", nullable = false, length = 64)
    private String patientId;

    @Column(name = "encounter_id", length = 64)
    private String encounterId;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(name = "bp_systolic")
    private Integer bpSystolic;

    @Column(name = "bp_diastolic")
    private Integer bpDiastolic;

    @Column(name = "heart_rate")
    private Integer heartRate;

    private Double temperature;

    @Column(name = "temperature_unit")
    private String temperatureUnit = "F";

    private Integer spo2;
    private Double weight;

    @Column(name = "weight_unit")
    private String weightUnit = "kg";

    private Double height;

    @Column(name = "height_unit")
    private String heightUnit = "cm";

    private Double bmi;

    @Column(name = "respiratory_rate")
    private Integer respiratoryRate;

    @Column(name = "blood_sugar")
    private Double bloodSugar;

    @Column(name = "blood_sugar_type")
    private String bloodSugarType;

    @Column(name = "pain_score")
    private Integer painScore;

    private Double hba1c;
    private Double tsh;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "medicines_given", columnDefinition = "TEXT")
    private String medicinesGiven;

    @Column(name = "recorded_by", nullable = false, length = 64)
    private String recordedBy;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt = LocalDateTime.now();

    public Vital() {}

    @PrePersist
    public void prePersist() {
        if (recordedAt == null) recordedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public Integer getBpSystolic() { return bpSystolic; }
    public void setBpSystolic(Integer bpSystolic) { this.bpSystolic = bpSystolic; }

    public Integer getBpDiastolic() { return bpDiastolic; }
    public void setBpDiastolic(Integer bpDiastolic) { this.bpDiastolic = bpDiastolic; }

    public Integer getHeartRate() { return heartRate; }
    public void setHeartRate(Integer heartRate) { this.heartRate = heartRate; }

    public Double getTemperature() { return temperature; }
    public void setTemperature(Double temperature) { this.temperature = temperature; }

    public String getTemperatureUnit() { return temperatureUnit; }
    public void setTemperatureUnit(String temperatureUnit) { this.temperatureUnit = temperatureUnit; }

    public Integer getSpo2() { return spo2; }
    public void setSpo2(Integer spo2) { this.spo2 = spo2; }

    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }

    public String getWeightUnit() { return weightUnit; }
    public void setWeightUnit(String weightUnit) { this.weightUnit = weightUnit; }

    public Double getHeight() { return height; }
    public void setHeight(Double height) { this.height = height; }

    public String getHeightUnit() { return heightUnit; }
    public void setHeightUnit(String heightUnit) { this.heightUnit = heightUnit; }

    public Double getBmi() { return bmi; }
    public void setBmi(Double bmi) { this.bmi = bmi; }

    public Integer getRespiratoryRate() { return respiratoryRate; }
    public void setRespiratoryRate(Integer respiratoryRate) { this.respiratoryRate = respiratoryRate; }

    public Double getBloodSugar() { return bloodSugar; }
    public void setBloodSugar(Double bloodSugar) { this.bloodSugar = bloodSugar; }

    public String getBloodSugarType() { return bloodSugarType; }
    public void setBloodSugarType(String bloodSugarType) { this.bloodSugarType = bloodSugarType; }

    public Integer getPainScore() { return painScore; }
    public void setPainScore(Integer painScore) { this.painScore = painScore; }

    public Double getHba1c() { return hba1c; }
    public void setHba1c(Double hba1c) { this.hba1c = hba1c; }

    public Double getTsh() { return tsh; }
    public void setTsh(Double tsh) { this.tsh = tsh; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getMedicinesGiven() { return medicinesGiven; }
    public void setMedicinesGiven(String medicinesGiven) { this.medicinesGiven = medicinesGiven; }

    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }
}
