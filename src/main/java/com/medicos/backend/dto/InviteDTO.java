package com.medicos.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class InviteDTO {

    public static class SendInviteRequest {
        private String email;
        private String name;
        private String role;
        @JsonAlias({"hospital_id", "hospitalId"})
        private String hospitalId;
        private String specialization;
        private String phone;

        public SendInviteRequest() {}
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }
        public String getSpecialization() { return specialization; }
        public void setSpecialization(String specialization) { this.specialization = specialization; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
    }

    public static class OnboardHospitalRequest {
        @JsonAlias({"hospital_name", "hospitalName"})
        private String hospitalName;
        @JsonAlias({"hospital_type", "hospitalType"})
        private String hospitalType = "General";
        private String city;
        private String phone;
        @JsonAlias({"admin_name", "adminName"})
        private String adminName;
        @JsonAlias({"admin_email", "adminEmail"})
        private String adminEmail;
        @JsonAlias({"plan_type", "planType"})
        private String planType = "TRIAL";
        @JsonAlias({"trial_days", "trialDays"})
        private Integer trialDays = 30;

        public OnboardHospitalRequest() {}
        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }
        public String getHospitalType() { return hospitalType; }
        public void setHospitalType(String hospitalType) { this.hospitalType = hospitalType; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        public String getAdminName() { return adminName; }
        public void setAdminName(String adminName) { this.adminName = adminName; }
        public String getAdminEmail() { return adminEmail; }
        public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }
        public String getPlanType() { return planType; }
        public void setPlanType(String planType) { this.planType = planType; }
        public Integer getTrialDays() { return trialDays; }
        public void setTrialDays(Integer trialDays) { this.trialDays = trialDays; }
        @JsonAlias({"hospital_id", "hospitalId", "hospital_code", "hospitalCode", "custom_code", "customCode"})
        private String hospitalId;
        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }
    }

    public static class ValidateResponse {
        private boolean valid;
        private String email;
        private String name;
        private String role;
        private String hospitalName;
        private String hospitalId;
        private String message;

        public ValidateResponse() {}
        public boolean isValid() { return valid; }
        public void setValid(boolean valid) { this.valid = valid; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }
        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    public static class AcceptRequest {
        private String token;
        private String password;

        public AcceptRequest() {}
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class AcceptResponse {
        private String token;
        private AuthDTO.UserDTO user;
        private String message;

        public AcceptResponse() {}
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public AuthDTO.UserDTO getUser() { return user; }
        public void setUser(AuthDTO.UserDTO user) { this.user = user; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
