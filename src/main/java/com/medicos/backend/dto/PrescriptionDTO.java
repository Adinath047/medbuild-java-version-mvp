package com.medicos.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public class PrescriptionDTO {

    private String id;

    @JsonProperty("hospital_id")
    private String hospitalId;

    @JsonProperty("patient_id")
    private String patientId;

    @JsonProperty("doctor_id")
    private String doctorId;

    @JsonProperty("encounter_id")
    private String encounterId;

    private Object medicines;

    private String advice;

    @JsonProperty("follow_up_date")
    private String followUpDate;

    @JsonProperty("patient_weight")
    private String patientWeight;

    @JsonProperty("slip_token")
    private String slipToken;

    @JsonProperty("is_printed")
    private Integer isPrinted;

    @JsonProperty("created_by_role")
    private String createdByRole;

    @JsonProperty("created_at")
    private String createdAt;

    // Joined Patient fields
    @JsonProperty("patient_name")
    private String patientName;

    private String uhid;
    private Integer age;
    private String sex;

    @JsonProperty("blood_group")
    private String bloodGroup;

    private String weight;
    private Object allergies;

    // Joined Doctor fields
    @JsonProperty("doctor_name")
    private String doctorName;

    @JsonProperty("doctor_phone")
    private String doctorPhone;

    @JsonProperty("doctor_email")
    private String doctorEmail;

    @JsonProperty("doctor_role")
    private String doctorRole;

    @JsonProperty("doctor_letterhead")
    private String doctorLetterhead;

    @JsonProperty("doctor_qualification")
    private String doctorQualification;

    @JsonProperty("doctor_registration_number")
    private String doctorRegistrationNumber;

    @JsonProperty("doctor_show_diagnosis_on_print")
    private Integer doctorShowDiagnosisOnPrint;

    @JsonProperty("doctor_show_investigations_on_print")
    private Integer doctorShowInvestigationsOnPrint;

    @JsonProperty("doctor_show_vitals_on_print")
    private Integer doctorShowVitalsOnPrint;

    @JsonProperty("doctor_print_margin_top")
    private Integer doctorPrintMarginTop;

    @JsonProperty("doctor_print_margin_bottom")
    private Integer doctorPrintMarginBottom;

    @JsonProperty("doctor_print_margin_left_right")
    private Integer doctorPrintMarginLeftRight;

    @JsonProperty("doctor_print_font_size")
    private Double doctorPrintFontSize;

    // Joined Encounter fields
    @JsonProperty("chief_complaint")
    private String chiefComplaint;

    private String history;

    @JsonProperty("past_history")
    private String pastHistory;

    private String examination;

    @JsonProperty("encounter_diagnosis")
    private String encounterDiagnosis;

    private String impression;

    // Joined Vital fields
    @JsonProperty("bp_systolic")
    private Integer bpSystolic;

    @JsonProperty("bp_diastolic")
    private Integer bpDiastolic;

    @JsonProperty("heart_rate")
    private Integer heartRate;

    private Double temperature;

    @JsonProperty("temperature_unit")
    private String temperatureUnit;

    private Integer spo2;

    @JsonProperty("vit_weight")
    private Double vitWeight;

    @JsonProperty("vit_weight_unit")
    private String vitWeightUnit;

    @JsonProperty("vit_height")
    private Double vitHeight;

    private Double bmi;

    public PrescriptionDTO() {}

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

    public Object getMedicines() { return medicines; }
    public void setMedicines(Object medicines) { this.medicines = medicines; }

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

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getUhid() { return uhid; }
    public void setUhid(String uhid) { this.uhid = uhid; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public String getWeight() { return weight; }
    public void setWeight(String weight) { this.weight = weight; }

    public Object getAllergies() { return allergies; }
    public void setAllergies(Object allergies) { this.allergies = allergies; }

    public String getDoctorName() { return doctorName; }
    public void setDoctorName(String doctorName) { this.doctorName = doctorName; }

    public String getDoctorPhone() { return doctorPhone; }
    public void setDoctorPhone(String doctorPhone) { this.doctorPhone = doctorPhone; }

    public String getDoctorEmail() { return doctorEmail; }
    public void setDoctorEmail(String doctorEmail) { this.doctorEmail = doctorEmail; }

    public String getDoctorRole() { return doctorRole; }
    public void setDoctorRole(String doctorRole) { this.doctorRole = doctorRole; }

    public String getDoctorLetterhead() { return doctorLetterhead; }
    public void setDoctorLetterhead(String doctorLetterhead) { this.doctorLetterhead = doctorLetterhead; }

    public String getDoctorQualification() { return doctorQualification; }
    public void setDoctorQualification(String doctorQualification) { this.doctorQualification = doctorQualification; }

    public String getDoctorRegistrationNumber() { return doctorRegistrationNumber; }
    public void setDoctorRegistrationNumber(String doctorRegistrationNumber) { this.doctorRegistrationNumber = doctorRegistrationNumber; }

    public Integer getDoctorShowDiagnosisOnPrint() { return doctorShowDiagnosisOnPrint; }
    public void setDoctorShowDiagnosisOnPrint(Integer doctorShowDiagnosisOnPrint) { this.doctorShowDiagnosisOnPrint = doctorShowDiagnosisOnPrint; }

    public Integer getDoctorShowInvestigationsOnPrint() { return doctorShowInvestigationsOnPrint; }
    public void setDoctorShowInvestigationsOnPrint(Integer doctorShowInvestigationsOnPrint) { this.doctorShowInvestigationsOnPrint = doctorShowInvestigationsOnPrint; }

    public Integer getDoctorShowVitalsOnPrint() { return doctorShowVitalsOnPrint; }
    public void setDoctorShowVitalsOnPrint(Integer doctorShowVitalsOnPrint) { this.doctorShowVitalsOnPrint = doctorShowVitalsOnPrint; }

    public Integer getDoctorPrintMarginTop() { return doctorPrintMarginTop; }
    public void setDoctorPrintMarginTop(Integer doctorPrintMarginTop) { this.doctorPrintMarginTop = doctorPrintMarginTop; }

    public Integer getDoctorPrintMarginBottom() { return doctorPrintMarginBottom; }
    public void setDoctorPrintMarginBottom(Integer doctorPrintMarginBottom) { this.doctorPrintMarginBottom = doctorPrintMarginBottom; }

    public Integer getDoctorPrintMarginLeftRight() { return doctorPrintMarginLeftRight; }
    public void setDoctorPrintMarginLeftRight(Integer doctorPrintMarginLeftRight) { this.doctorPrintMarginLeftRight = doctorPrintMarginLeftRight; }

    public Double getDoctorPrintFontSize() { return doctorPrintFontSize; }
    public void setDoctorPrintFontSize(Double doctorPrintFontSize) { this.doctorPrintFontSize = doctorPrintFontSize; }

    public String getChiefComplaint() { return chiefComplaint; }
    public void setChiefComplaint(String chiefComplaint) { this.chiefComplaint = chiefComplaint; }

    public String getHistory() { return history; }
    public void setHistory(String history) { this.history = history; }

    public String getPastHistory() { return pastHistory; }
    public void setPastHistory(String pastHistory) { this.pastHistory = pastHistory; }

    public String getExamination() { return examination; }
    public void setExamination(String examination) { this.examination = examination; }

    public String getEncounterDiagnosis() { return encounterDiagnosis; }
    public void setEncounterDiagnosis(String encounterDiagnosis) { this.encounterDiagnosis = encounterDiagnosis; }

    public String getImpression() { return impression; }
    public void setImpression(String impression) { this.impression = impression; }

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

    public Double getVitWeight() { return vitWeight; }
    public void setVitWeight(Double vitWeight) { this.vitWeight = vitWeight; }

    public String getVitWeightUnit() { return vitWeightUnit; }
    public void setVitWeightUnit(String vitWeightUnit) { this.vitWeightUnit = vitWeightUnit; }

    public Double getVitHeight() { return vitHeight; }
    public void setVitHeight(Double vitHeight) { this.vitHeight = vitHeight; }

    public Double getBmi() { return bmi; }
    public void setBmi(Double bmi) { this.bmi = bmi; }
}
