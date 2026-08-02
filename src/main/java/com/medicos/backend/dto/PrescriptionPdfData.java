package com.medicos.backend.dto;

import java.util.List;

/**
 * Plain data carrier for everything the "prescription.html" Thymeleaf
 * template needs.
 */
public class PrescriptionPdfData {

    private String hospitalName;
    private String hospitalTagline;
    private String hospitalAddress;
    private String hospitalPhone;

    private String doctorName;
    private String doctorQualification;
    private String secondDoctorName;          // nullable
    private String secondDoctorQualification;

    private String patientName;
    private String patientMeta;               // e.g. "34 / Female / UHID-Pat-1029"
    private String visitDateTime;              // e.g. "01-Aug-2026 10:00 AM"

    private String bp;
    private String pulse;
    private String heightCm;
    private String weightKg;
    private String bmi;

    private List<String> complaints;
    private String history;
    private String investigations;
    private String diagnosis;
    private String systemicExamination;

    private List<MedicineItem> medicines;

    private String advice;
    private String followUp;

    private String doctorSignName;
    private String doctorSignQualification;

    public String getHospitalName() { return hospitalName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

    public String getHospitalTagline() { return hospitalTagline; }
    public void setHospitalTagline(String hospitalTagline) { this.hospitalTagline = hospitalTagline; }

    public String getHospitalAddress() { return hospitalAddress; }
    public void setHospitalAddress(String hospitalAddress) { this.hospitalAddress = hospitalAddress; }

    public String getHospitalPhone() { return hospitalPhone; }
    public void setHospitalPhone(String hospitalPhone) { this.hospitalPhone = hospitalPhone; }

    public String getDoctorName() { return doctorName; }
    public void setDoctorName(String doctorName) { this.doctorName = doctorName; }

    public String getDoctorQualification() { return doctorQualification; }
    public void setDoctorQualification(String doctorQualification) { this.doctorQualification = doctorQualification; }

    public String getSecondDoctorName() { return secondDoctorName; }
    public void setSecondDoctorName(String secondDoctorName) { this.secondDoctorName = secondDoctorName; }

    public String getSecondDoctorQualification() { return secondDoctorQualification; }
    public void setSecondDoctorQualification(String secondDoctorQualification) { this.secondDoctorQualification = secondDoctorQualification; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getPatientMeta() { return patientMeta; }
    public void setPatientMeta(String patientMeta) { this.patientMeta = patientMeta; }

    public String getVisitDateTime() { return visitDateTime; }
    public void setVisitDateTime(String visitDateTime) { this.visitDateTime = visitDateTime; }

    public String getBp() { return bp; }
    public void setBp(String bp) { this.bp = bp; }

    public String getPulse() { return pulse; }
    public void setPulse(String pulse) { this.pulse = pulse; }

    public String getHeightCm() { return heightCm; }
    public void setHeightCm(String heightCm) { this.heightCm = heightCm; }

    public String getWeightKg() { return weightKg; }
    public void setWeightKg(String weightKg) { this.weightKg = weightKg; }

    public String getBmi() { return bmi; }
    public void setBmi(String bmi) { this.bmi = bmi; }

    public List<String> getComplaints() { return complaints; }
    public void setComplaints(List<String> complaints) { this.complaints = complaints; }

    public String getHistory() { return history; }
    public void setHistory(String history) { this.history = history; }

    public String getInvestigations() { return investigations; }
    public void setInvestigations(String investigations) { this.investigations = investigations; }

    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }

    public String getSystemicExamination() { return systemicExamination; }
    public void setSystemicExamination(String systemicExamination) { this.systemicExamination = systemicExamination; }

    public List<MedicineItem> getMedicines() { return medicines; }
    public void setMedicines(List<MedicineItem> medicines) { this.medicines = medicines; }

    public String getAdvice() { return advice; }
    public void setAdvice(String advice) { this.advice = advice; }

    public String getFollowUp() { return followUp; }
    public void setFollowUp(String followUp) { this.followUp = followUp; }

    public String getDoctorSignName() { return doctorSignName; }
    public void setDoctorSignName(String doctorSignName) { this.doctorSignName = doctorSignName; }

    public String getDoctorSignQualification() { return doctorSignQualification; }
    public void setDoctorSignQualification(String doctorSignQualification) { this.doctorSignQualification = doctorSignQualification; }

    /** One row in the Rx table. */
    public static class MedicineItem {
        private String name;
        private String composition;
        private String dosage;
        private String frequencyDuration;
        private String timing;      // nullable
        private String qty;

        public MedicineItem() { }

        public MedicineItem(String name, String composition, String dosage,
                             String frequencyDuration, String timing, String qty) {
            this.name = name;
            this.composition = composition;
            this.dosage = dosage;
            this.frequencyDuration = frequencyDuration;
            this.timing = timing;
            this.qty = qty;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getComposition() { return composition; }
        public void setComposition(String composition) { this.composition = composition; }

        public String getDosage() { return dosage; }
        public void setDosage(String dosage) { this.dosage = dosage; }

        public String getFrequencyDuration() { return frequencyDuration; }
        public void setFrequencyDuration(String frequencyDuration) { this.frequencyDuration = frequencyDuration; }

        public String getTiming() { return timing; }
        public void setTiming(String timing) { this.timing = timing; }

        public String getQty() { return qty; }
        public void setQty(String qty) { this.qty = qty; }
    }
}
