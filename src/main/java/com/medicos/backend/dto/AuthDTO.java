package com.medicos.backend.dto;

public class AuthDTO {

    public static class LoginRequest {
        private String email;
        private String password;
        private String hospitalId;

        public LoginRequest() {}

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
     * UserDTO — used by /api/auth/login, /api/auth/me, and /api/auth/hospital/{code}/staff.
     *
     * Field names are kept in camelCase intentionally: the authStore (AuthUser interface)
     * and all pages reference user.hospitalId, user.licenseNumber, user.consultationFee,
     * user.photoUrl, etc. in camelCase.
     *
     * DO NOT add @JsonProperty snake_case annotations here — that would break the frontend
     * auth session and every page that reads user properties from the auth store.
     *
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
