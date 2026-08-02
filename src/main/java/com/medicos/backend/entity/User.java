package com.medicos.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 50)
    private String role = "doctor";

    @JsonProperty("hospital_id")
    @Column(name = "hospital_id", length = 64)
    private String hospitalId;

    @JsonProperty("staff_id")
    @Column(name = "staff_id", length = 64)
    private String staffId;

    private String phone;
    private String specialization;
    
    @JsonProperty("license_number")
    @Column(name = "license_number")
    private String licenseNumber;

    private String qualification;

    @JsonProperty("registration_number")
    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(columnDefinition = "TEXT")
    private String letterhead;

    @JsonProperty("consultation_fee")
    @Column(name = "consultation_fee")
    private Double consultationFee = 0.0;

    @JsonProperty("followup_fee")
    @Column(name = "followup_fee")
    private Double followupFee = 0.0;
    
    @JsonProperty("photo_url")
    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @JsonProperty("is_active")
    @Column(name = "is_active", nullable = false)
    private Integer isActive = 1;

    @JsonProperty("show_diagnosis_on_print")
    @Column(name = "show_diagnosis_on_print")
    private Integer showDiagnosisOnPrint = 1;

    @JsonProperty("show_investigations_on_print")
    @Column(name = "show_investigations_on_print")
    private Integer showInvestigationsOnPrint = 1;

    @JsonProperty("show_vitals_on_print")
    @Column(name = "show_vitals_on_print")
    private Integer showVitalsOnPrint = 1;

    @JsonProperty("print_margin_top")
    @Column(name = "print_margin_top")
    private Integer printMarginTop = 35;

    @JsonProperty("print_margin_bottom")
    @Column(name = "print_margin_bottom")
    private Integer printMarginBottom = 15;

    @JsonProperty("print_margin_left_right")
    @Column(name = "print_margin_left_right")
    private Integer printMarginLeftRight = 18;

    @JsonProperty("print_font_size")
    @Column(name = "print_font_size")
    private Double printFontSize = 11.0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public User() {}

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

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getStaffId() { return staffId; }
    public void setStaffId(String staffId) { this.staffId = staffId; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    public String getLicenseNumber() { return licenseNumber; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getQualification() { return qualification; }
    public void setQualification(String qualification) { this.qualification = qualification; }

    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

    public String getLetterhead() { return letterhead; }
    public void setLetterhead(String letterhead) { this.letterhead = letterhead; }

    public Double getConsultationFee() { return consultationFee; }
    public void setConsultationFee(Double consultationFee) { this.consultationFee = consultationFee; }

    public Double getFollowupFee() { return followupFee; }
    public void setFollowupFee(Double followupFee) { this.followupFee = followupFee; }

    public Integer getIsActive() { return isActive; }
    public void setIsActive(Integer isActive) { this.isActive = isActive; }

    public Integer getShowDiagnosisOnPrint() { return showDiagnosisOnPrint; }
    public void setShowDiagnosisOnPrint(Integer showDiagnosisOnPrint) { this.showDiagnosisOnPrint = showDiagnosisOnPrint; }

    public Integer getShowInvestigationsOnPrint() { return showInvestigationsOnPrint; }
    public void setShowInvestigationsOnPrint(Integer showInvestigationsOnPrint) { this.showInvestigationsOnPrint = showInvestigationsOnPrint; }

    public Integer getShowVitalsOnPrint() { return showVitalsOnPrint; }
    public void setShowVitalsOnPrint(Integer showVitalsOnPrint) { this.showVitalsOnPrint = showVitalsOnPrint; }

    public Integer getPrintMarginTop() { return printMarginTop; }
    public void setPrintMarginTop(Integer printMarginTop) { this.printMarginTop = printMarginTop; }

    public Integer getPrintMarginBottom() { return printMarginBottom; }
    public void setPrintMarginBottom(Integer printMarginBottom) { this.printMarginBottom = printMarginBottom; }

    public Integer getPrintMarginLeftRight() { return printMarginLeftRight; }
    public void setPrintMarginLeftRight(Integer printMarginLeftRight) { this.printMarginLeftRight = printMarginLeftRight; }

    public Double getPrintFontSize() { return printFontSize; }
    public void setPrintFontSize(Double printFontSize) { this.printFontSize = printFontSize; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
