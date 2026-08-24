package com.medicos.backend.service;

import com.medicos.backend.dto.TrialDTO.*;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TrialService {

    private static final Logger log = LoggerFactory.getLogger(TrialService.class);

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public TrialService(HospitalRepository hospitalRepository,
                        UserRepository userRepository,
                        PasswordEncoder passwordEncoder) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public TrialStatusResponse getTrialStatus(String hospitalId, String userId) {
        if (hospitalId == null || hospitalId.isBlank()) {
            return new TrialStatusResponse(
                "", "Medicos EMR", "STANDARD",
                LocalDateTime.now(), LocalDateTime.now().plusYears(1),
                "ACTIVATED", 365, 8760, false, true
            );
        }

        Optional<Hospital> hospitalOpt = hospitalRepository.findByIdIgnoreCase(hospitalId);
        if (hospitalOpt.isEmpty()) {
            return new TrialStatusResponse(
                hospitalId, "Hospital", "STANDARD",
                LocalDateTime.now(), LocalDateTime.now().plusYears(1),
                "ACTIVATED", 365, 8760, false, true
            );
        }

        Hospital hospital = hospitalOpt.get();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endsAt = hospital.getTrialEndsAt() != null ? hospital.getTrialEndsAt() : now.plusDays(7);
        LocalDateTime startedAt = hospital.getTrialStartedAt() != null ? hospital.getTrialStartedAt() : now;
        String status = hospital.getTrialStatus() != null ? hospital.getTrialStatus() : "ACTIVE";

        long daysRemaining = 0;
        long hoursRemaining = 0;
        boolean isReadOnly = false;

        if ("ACTIVATED".equalsIgnoreCase(status) || "STANDARD".equalsIgnoreCase(hospital.getSubscriptionPlan()) || "PREMIUM".equalsIgnoreCase(hospital.getSubscriptionPlan())) {
            daysRemaining = 365;
            hoursRemaining = 8760;
            isReadOnly = false;
        } else if ("EXPIRED".equalsIgnoreCase(status) || now.isAfter(endsAt)) {
            status = "EXPIRED";
            daysRemaining = 0;
            hoursRemaining = 0;
            isReadOnly = true;
        } else {
            Duration duration = Duration.between(now, endsAt);
            hoursRemaining = Math.max(0, duration.toHours());
            daysRemaining = Math.max(0, duration.toDays());
            isReadOnly = false;
        }

        boolean tourCompleted = false;
        if (userId != null && !userId.isBlank()) {
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent() && userOpt.get().getTourCompleted() != null && userOpt.get().getTourCompleted() == 1) {
                tourCompleted = true;
            }
        }

        return new TrialStatusResponse(
            hospital.getId(),
            hospital.getName(),
            hospital.getSubscriptionPlan(),
            startedAt,
            endsAt,
            status,
            daysRemaining,
            hoursRemaining,
            isReadOnly,
            tourCompleted
        );
    }

    @Transactional
    public TrialStatusResponse signupTrial(TrialSignupRequest req) {
        String hospitalCode = "hsp-" + UUID.randomUUID().toString().substring(0, 6).toLowerCase();

        Hospital hospital = new Hospital();
        hospital.setId(hospitalCode);
        hospital.setName(req.getHospitalName() != null ? req.getHospitalName() : "New Medical Center");
        hospital.setType(req.getHospitalType() != null ? req.getHospitalType() : "General");
        hospital.setPhone(req.getPhone());
        hospital.setCity(req.getCity());
        hospital.setState(req.getState());
        hospital.setSubscriptionPlan("TRIAL");
        hospital.setTrialStartedAt(LocalDateTime.now());
        hospital.setTrialEndsAt(LocalDateTime.now().plusDays(7));
        hospital.setTrialStatus("ACTIVE");
        hospital.setIsActive(1);
        hospitalRepository.save(hospital);

        User admin = new User();
        admin.setId(UUID.randomUUID().toString());
        admin.setName(req.getAdminName() != null ? req.getAdminName() : "Hospital Admin");
        admin.setEmail(req.getAdminEmail());
        admin.setPassword(passwordEncoder.encode(req.getAdminPassword()));
        admin.setRole("admin");
        admin.setHospitalId(hospitalCode);
        admin.setStaffId("ADM-001");
        admin.setPhone(req.getPhone());
        admin.setIsActive(1);
        admin.setTourCompleted(0);
        userRepository.save(admin);

        log.info("[TrialService] Created 7-day trial for hospital {} (id: {}) with admin user {}",
            hospital.getName(), hospitalCode, admin.getEmail());

        return getTrialStatus(hospitalCode, admin.getId());
    }

    @Transactional
    public boolean completeTour(String userId) {
        if (userId == null || userId.isBlank()) return false;
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setTourCompleted(1);
            userRepository.save(user);
            log.info("[TrialService] Marked onboarding tour complete for user: {}", user.getEmail());
            return true;
        }
        return false;
    }

    public void processContactRequest(TrialContactRequest req) {
        log.info("[TrialService] INQUIRY RECEIVED from Hospital: {} (ID: {}). Contact: {} <{}>, Phone: {}, Type: {}, Message: {}",
            req.getHospitalName(), req.getHospitalId(), req.getContactName(),
            req.getEmail(), req.getPhone(), req.getInquiryType(), req.getMessage());
    }

    @Scheduled(cron = "0 0 * * * *") // Run hourly
    @Transactional
    public void checkExpirations() {
        LocalDateTime now = LocalDateTime.now();
        List<Hospital> activeExpired = hospitalRepository.findByTrialStatusAndTrialEndsAtBefore("ACTIVE", now);
        for (Hospital h : activeExpired) {
            h.setTrialStatus("EXPIRED");
            hospitalRepository.save(h);
            log.warn("[TrialService] Trial expired for hospital: {} (ID: {}). Switched to READ-ONLY mode.", h.getName(), h.getId());
        }
    }
}
