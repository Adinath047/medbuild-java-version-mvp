package com.medicos.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class AuthDTO {

    public static class LoginRequest {
        @JsonAlias({"staff_id", "staffId"})
        private String staffId;  // preferred: UUID of the selected staff member from the picker
        private String email;    // fallback: still accepted for direct API / password-reset flows
        private String password;
        @JsonAlias({"hospital_id", "hospitalId"})
        private String hospitalId;

        public LoginRequest() {}

        public String getStaffId() { return staffId; }
        public void setStaffId(String staffId) { this.staffId = staffId; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }

        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }
    }

    public static class RegisterRequest {
        private String name;
        private String email;
        private String password;
        private String role = "doctor";
        @JsonAlias({"hospital_id", "hospitalId"})
        private String hospitalId = "hsp-001";
        private String specialization;
        private String phone;
        private String licenseNumber;

        public RegisterRequest() {}

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

        public String getSpecialization() { return specialization; }
        public void setSpecialization(String specialization) { this.specialization = specialization; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getLicenseNumber() { return licenseNumber; }
        public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }
    }

    /**
     * StaffPickerDTO — the only fields exposed by the public unauthenticated staff-lookup
     * endpoint (GET /api/auth/hospital/{code}/staff).
     *
     * email is intentionally excluded: login now accepts staffId (UUID) instead, so there
     * is no longer any downstream reason to expose email through an unauthenticated endpoint.
     * Phone, licenseNumber, and all other PII remain excluded.
     */
    public static class StaffPickerDTO {
        private String id;
        private String name;
        private String role;
        private String specialization;
        private String photoUrl;

        public StaffPickerDTO() {}

        public String getId()             { return id; }
        public void   setId(String id)    { this.id = id; }
        public String getName()               { return name; }
        public void   setName(String name)    { this.name = name; }
        public String getRole()               { return role; }
        public void   setRole(String role)    { this.role = role; }
        public String getSpecialization()                     { return specialization; }
        public void   setSpecialization(String specialization){ this.specialization = specialization; }
        public String getPhotoUrl()               { return photoUrl; }
        public void   setPhotoUrl(String photoUrl){ this.photoUrl = photoUrl; }
    }


    /**
     * The raw User entity (returned by GET /api/users) has its own @JsonProperty annotations
     * for snake_case, which is what the Admin portal's staff table needs.
     */
    public static class UserDTO {
        private String id;
        private String name;
        private String email;
        private String role;
        private String hospitalId;
        private String phone;
        private String specialization;
        private String licenseNumber;
        private String qualification;
        private String registrationNumber;
        private String letterhead;
        private Double consultationFee;
        private Double followupFee;
        private Double bedPerDayCharge;
        private String photoUrl;
        private Integer isActive;
        private Integer showDiagnosisOnPrint;
        private Integer showInvestigationsOnPrint;
        private Integer showVitalsOnPrint;
        private Integer printMarginTop;
        private Integer printMarginBottom;
        private Integer printMarginLeftRight;
        private Double printFontSize;

        public UserDTO() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

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

        public Double getBedPerDayCharge() { return bedPerDayCharge; }
        public void setBedPerDayCharge(Double bedPerDayCharge) { this.bedPerDayCharge = bedPerDayCharge; }

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
    }

    public static class LoginResponse {
        private String token;
        private UserDTO user;

        public LoginResponse() {}
        public LoginResponse(String token, UserDTO user) {
            this.token = token;
            this.user = user;
        }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public UserDTO getUser() { return user; }
        public void setUser(UserDTO user) { this.user = user; }
    }

    public static class MessageResponse {
        private String message;
        private boolean success;

        public MessageResponse() {}

        public MessageResponse(String message, boolean success) {
            this.message = message;
            this.success = success;
        }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
    }
}
