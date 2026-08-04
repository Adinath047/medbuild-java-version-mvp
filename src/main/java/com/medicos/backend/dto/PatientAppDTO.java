package com.medicos.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * DTOs for the patient-facing mobile app API.
 * All fields use snake_case @JsonProperty to match the frontend TypeScript types exactly.
 * These are intentionally separate from the EMR portal DTOs (AuthDTO.UserDTO)
 * which use camelCase for the web portal frontend.
 */
public class PatientAppDTO {

    // ─── Patient Profile ───────────────────────────────────────────────────────

    public static class PatientProfile {
        private String id;
        private String name;
        private String phone;
        private String email;
        private String location;
        private String avatar;
        private String dob;

        @JsonProperty("blood_group")
        private String bloodGroup;

        public PatientProfile() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }

        public String getAvatar() { return avatar; }
        public void setAvatar(String avatar) { this.avatar = avatar; }

        public String getDob() { return dob; }
        public void setDob(String dob) { this.dob = dob; }

        public String getBloodGroup() { return bloodGroup; }
        public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
    }

    public static class PatientUpdateRequest {
        private String name;
        private String phone;
        private String email;
        private String location;
        private String avatar;
        private String dob;

        @JsonProperty("blood_group")
        private String bloodGroup;

        public PatientUpdateRequest() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }

        public String getAvatar() { return avatar; }
        public void setAvatar(String avatar) { this.avatar = avatar; }

        public String getDob() { return dob; }
        public void setDob(String dob) { this.dob = dob; }

        public String getBloodGroup() { return bloodGroup; }
        public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
    }

    // ─── Doctor View ───────────────────────────────────────────────────────────

    public static class DoctorView {
        private String id;
        private String name;
        private String specialty;
        private String hospital;
        private String avatar;
        private double rating;

        @JsonProperty("experience_years")
        private int experienceYears;

        @JsonProperty("consulted_count")
        private int consultedCount;

        private double fee;
        private String initials;
        private String color;
        private String district;

        public DoctorView() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getSpecialty() { return specialty; }
        public void setSpecialty(String specialty) { this.specialty = specialty; }

        public String getHospital() { return hospital; }
        public void setHospital(String hospital) { this.hospital = hospital; }

        public String getAvatar() { return avatar; }
        public void setAvatar(String avatar) { this.avatar = avatar; }

        public double getRating() { return rating; }
        public void setRating(double rating) { this.rating = rating; }

        public int getExperienceYears() { return experienceYears; }
        public void setExperienceYears(int experienceYears) { this.experienceYears = experienceYears; }

        public int getConsultedCount() { return consultedCount; }
        public void setConsultedCount(int consultedCount) { this.consultedCount = consultedCount; }

        public double getFee() { return fee; }
        public void setFee(double fee) { this.fee = fee; }

        public String getInitials() { return initials; }
        public void setInitials(String initials) { this.initials = initials; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }

        public String getDistrict() { return district; }
        public void setDistrict(String district) { this.district = district; }
    }

    // ─── Appointment View ──────────────────────────────────────────────────────

    public static class AppointmentView {
        private String id;

        @JsonProperty("doctor_id")
        private String doctorId;

        @JsonProperty("patient_id")
        private String patientId;

        private String date;
        private String time;
        private String status;
        private String reason;
        private String type;

        public AppointmentView() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

        public String getPatientId() { return patientId; }
        public void setPatientId(String patientId) { this.patientId = patientId; }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }

    public static class CreateAppointmentRequest {
        @JsonProperty("doctor_id")
        private String doctorId;

        private String date;
        private String time;
        private String reason;
        private String type;

        public CreateAppointmentRequest() {}

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }

    // ─── Prescription View ─────────────────────────────────────────────────────

    public static class MedicineItem {
        private String name;
        private String dosage;
        private String duration;
        private String note;

        public MedicineItem() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getDosage() { return dosage; }
        public void setDosage(String dosage) { this.dosage = dosage; }

        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }

        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    public static class PrescriptionView {
        private String id;

        @JsonProperty("doctor_id")
        private String doctorId;

        @JsonProperty("patient_id")
        private String patientId;

        private String date;
        private String title;
        private List<MedicineItem> medicines;
        private String advice;
        private String diagnosis;

        public PrescriptionView() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }

        public String getPatientId() { return patientId; }
        public void setPatientId(String patientId) { this.patientId = patientId; }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public List<MedicineItem> getMedicines() { return medicines; }
        public void setMedicines(List<MedicineItem> medicines) { this.medicines = medicines; }

        public String getAdvice() { return advice; }
        public void setAdvice(String advice) { this.advice = advice; }

        public String getDiagnosis() { return diagnosis; }
        public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
    }

    // ─── OTP Auth ─────────────────────────────────────────────────────────────

    public static class OtpRequest {
        private String phone;

        public OtpRequest() {}

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
    }

    public static class OtpVerifyRequest {
        private String phone;
        private String otp;

        public OtpVerifyRequest() {}

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getOtp() { return otp; }
        public void setOtp(String otp) { this.otp = otp; }
    }

    public static class OtpResponse {
        private boolean success;
        private String message;
        private String otp; // Only exposed in dev mode

        public OtpResponse() {}

        public OtpResponse(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public OtpResponse(boolean success, String message, String otp) {
            this.success = success;
            this.message = message;
            this.otp = otp;
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public String getOtp() { return otp; }
        public void setOtp(String otp) { this.otp = otp; }
    }

    public static class OtpVerifyResponse {
        private String token;
        private PatientProfile user;

        public OtpVerifyResponse() {}

        public OtpVerifyResponse(String token, PatientProfile user) {
            this.token = token;
            this.user = user;
        }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public PatientProfile getUser() { return user; }
        public void setUser(PatientProfile user) { this.user = user; }
    }
}
