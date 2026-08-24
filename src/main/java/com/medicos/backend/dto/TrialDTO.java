package com.medicos.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public class TrialDTO {

    public static class TrialStatusResponse {
        @JsonProperty("hospital_id")
        private String hospitalId;

        @JsonProperty("hospital_name")
        private String hospitalName;

        @JsonProperty("subscription_plan")
        private String subscriptionPlan;

        @JsonProperty("trial_started_at")
        private LocalDateTime trialStartedAt;

        @JsonProperty("trial_ends_at")
        private LocalDateTime trialEndsAt;

        @JsonProperty("trial_status")
        private String trialStatus;

        @JsonProperty("days_remaining")
        private long daysRemaining;

        @JsonProperty("hours_remaining")
        private long hoursRemaining;

        @JsonProperty("is_read_only")
        private boolean isReadOnly;

        @JsonProperty("tour_completed")
        private boolean tourCompleted;

        public TrialStatusResponse() {}

        public TrialStatusResponse(String hospitalId, String hospitalName, String subscriptionPlan,
                                   LocalDateTime trialStartedAt, LocalDateTime trialEndsAt,
                                   String trialStatus, long daysRemaining, long hoursRemaining,
                                   boolean isReadOnly, boolean tourCompleted) {
            this.hospitalId = hospitalId;
            this.hospitalName = hospitalName;
            this.subscriptionPlan = subscriptionPlan;
            this.trialStartedAt = trialStartedAt;
            this.trialEndsAt = trialEndsAt;
            this.trialStatus = trialStatus;
            this.daysRemaining = daysRemaining;
            this.hoursRemaining = hoursRemaining;
            this.isReadOnly = isReadOnly;
            this.tourCompleted = tourCompleted;
        }

        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

        public String getSubscriptionPlan() { return subscriptionPlan; }
        public void setSubscriptionPlan(String subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; }

        public LocalDateTime getTrialStartedAt() { return trialStartedAt; }
        public void setTrialStartedAt(LocalDateTime trialStartedAt) { this.trialStartedAt = trialStartedAt; }

        public LocalDateTime getTrialEndsAt() { return trialEndsAt; }
        public void setTrialEndsAt(LocalDateTime trialEndsAt) { this.trialEndsAt = trialEndsAt; }

        public String getTrialStatus() { return trialStatus; }
        public void setTrialStatus(String trialStatus) { this.trialStatus = trialStatus; }

        public long getDaysRemaining() { return daysRemaining; }
        public void setDaysRemaining(long daysRemaining) { this.daysRemaining = daysRemaining; }

        public long getHoursRemaining() { return hoursRemaining; }
        public void setHoursRemaining(long hoursRemaining) { this.hoursRemaining = hoursRemaining; }

        public boolean isReadOnly() { return isReadOnly; }
        public void setReadOnly(boolean readOnly) { isReadOnly = readOnly; }

        public boolean isTourCompleted() { return tourCompleted; }
        public void setTourCompleted(boolean tourCompleted) { this.tourCompleted = tourCompleted; }
    }

    public static class TrialSignupRequest {
        @JsonProperty("hospital_name")
        private String hospitalName;

        @JsonProperty("hospital_type")
        private String hospitalType;

        @JsonProperty("admin_name")
        private String adminName;

        @JsonProperty("admin_email")
        private String adminEmail;

        @JsonProperty("admin_password")
        private String adminPassword;

        private String phone;
        private String city;
        private String state;

        public TrialSignupRequest() {}

        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

        public String getHospitalType() { return hospitalType; }
        public void setHospitalType(String hospitalType) { this.hospitalType = hospitalType; }

        public String getAdminName() { return adminName; }
        public void setAdminName(String adminName) { this.adminName = adminName; }

        public String getAdminEmail() { return adminEmail; }
        public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }

        public String getAdminPassword() { return adminPassword; }
        public void setAdminPassword(String adminPassword) { this.adminPassword = adminPassword; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }

        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
    }

    public static class TrialContactRequest {
        @JsonProperty("hospital_id")
        private String hospitalId;

        @JsonProperty("hospital_name")
        private String hospitalName;

        @JsonProperty("contact_name")
        private String contactName;

        private String email;
        private String phone;
        private String message;

        @JsonProperty("inquiry_type")
        private String inquiryType = "UPGRADE";

        public TrialContactRequest() {}

        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

        public String getContactName() { return contactName; }
        public void setContactName(String contactName) { this.contactName = contactName; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public String getInquiryType() { return inquiryType; }
        public void setInquiryType(String inquiryType) { this.inquiryType = inquiryType; }
    }
}
