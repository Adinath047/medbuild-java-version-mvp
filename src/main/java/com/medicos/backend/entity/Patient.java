package com.medicos.backend.entity;

import com.medicos.backend.security.CryptoConverter;
import com.medicos.backend.config.StringListConverter;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "patients")
public class Patient {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, unique = true, length = 64)
    private String uhid;

    @Column(name = "hospital_id", nullable = false, length = 64)
    private String hospitalId;

    @Column(nullable = false)
    private String name;

    private String dob;
    private Integer age;

    @Column(nullable = false)
    private String sex = "Male";

    @Column(name = "blood_group")
    private String bloodGroup;

    private String phone;
    private String email;
    private String password;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(columnDefinition = "TEXT")
    private String location;

    private String weight;
    private String height;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> allergies = new ArrayList<>();

    @Convert(converter = StringListConverter.class)
    @Column(name = "chronic_conditions", columnDefinition = "TEXT")
    private List<String> chronicConditions = new ArrayList<>();

    @Convert(converter = StringListConverter.class)
    @Column(name = "current_medications", columnDefinition = "TEXT")
    private List<String> currentMedications = new ArrayList<>();

    @Column(name = "ec_name")
    private String ecName;

    @Column(name = "ec_phone")
    private String ecPhone;

    @Column(name = "ec_relation")
    private String ecRelation;

    @Column(name = "govt_id_type")
    private String govtIdType;

    @Convert(converter = CryptoConverter.class)
    @Column(name = "govt_id_number")
    private String govtIdNumber;

    @Column(name = "insurance_provider")
    private String insuranceProvider;

    @Convert(converter = CryptoConverter.class)
    @Column(name = "insurance_number")
    private String insuranceNumber;

    @Column(name = "primary_doctor_id", length = 64)
    private String primaryDoctorId;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Convert(converter = CryptoConverter.class)
    @Column(name = "past_history", columnDefinition = "TEXT")
    private String pastHistory;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "is_active", nullable = false)
    private Integer isActive = 1;

    @Column(name = "registered_by", length = 64)
    private String registeredBy;

    @Column(name = "abha_number")
    private String abhaNumber;

    @Column(name = "abha_address")
    private String abhaAddress;

    @Column(name = "abha_status")
    private String abhaStatus;

    @Column(name = "consent_given")
    private Boolean consentGiven = true;

    @Column(name = "consent_given_at")
    private LocalDateTime consentGivenAt = LocalDateTime.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Patient() {}

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

    public String getUhid() { return uhid; }
    public void setUhid(String uhid) { this.uhid = uhid; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getWeight() { return weight; }
    public void setWeight(String weight) { this.weight = weight; }

    public String getHeight() { return height; }
    public void setHeight(String height) { this.height = height; }

    public List<String> getAllergies() { return allergies; }
    public void setAllergies(List<String> allergies) { this.allergies = allergies; }

    public List<String> getChronicConditions() { return chronicConditions; }
    public void setChronicConditions(List<String> chronicConditions) { this.chronicConditions = chronicConditions; }

    public List<String> getCurrentMedications() { return currentMedications; }
    public void setCurrentMedications(List<String> currentMedications) { this.currentMedications = currentMedications; }

    public String getEcName() { return ecName; }
    public void setEcName(String ecName) { this.ecName = ecName; }

    public String getEcPhone() { return ecPhone; }
    public void setEcPhone(String ecPhone) { this.ecPhone = ecPhone; }

    public String getEcRelation() { return ecRelation; }
    public void setEcRelation(String ecRelation) { this.ecRelation = ecRelation; }

    public String getGovtIdType() { return govtIdType; }
    public void setGovtIdType(String govtIdType) { this.govtIdType = govtIdType; }

    public String getGovtIdNumber() { return govtIdNumber; }
    public void setGovtIdNumber(String govtIdNumber) { this.govtIdNumber = govtIdNumber; }

    public String getInsuranceProvider() { return insuranceProvider; }
    public void setInsuranceProvider(String insuranceProvider) { this.insuranceProvider = insuranceProvider; }

    public String getInsuranceNumber() { return insuranceNumber; }
    public void setInsuranceNumber(String insuranceNumber) { this.insuranceNumber = insuranceNumber; }

    public String getPrimaryDoctorId() { return primaryDoctorId; }
    public void setPrimaryDoctorId(String primaryDoctorId) { this.primaryDoctorId = primaryDoctorId; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getPastHistory() { return pastHistory; }
    public void setPastHistory(String pastHistory) { this.pastHistory = pastHistory; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Integer getIsActive() { return isActive; }
    public void setIsActive(Integer isActive) { this.isActive = isActive; }

    public String getRegisteredBy() { return registeredBy; }
    public void setRegisteredBy(String registeredBy) { this.registeredBy = registeredBy; }

    public String getAbhaNumber() { return abhaNumber; }
    public void setAbhaNumber(String abhaNumber) { this.abhaNumber = abhaNumber; }

    public String getAbhaAddress() { return abhaAddress; }
    public void setAbhaAddress(String abhaAddress) { this.abhaAddress = abhaAddress; }

    public String getAbhaStatus() { return abhaStatus; }
    public void setAbhaStatus(String abhaStatus) { this.abhaStatus = abhaStatus; }

    public Boolean getConsentGiven() { return consentGiven; }
    public void setConsentGiven(Boolean consentGiven) { this.consentGiven = consentGiven; }

    public LocalDateTime getConsentGivenAt() { return consentGivenAt; }
    public void setConsentGivenAt(LocalDateTime consentGivenAt) { this.consentGivenAt = consentGivenAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
