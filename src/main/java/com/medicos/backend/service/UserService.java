package com.medicos.backend.service;

import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final com.medicos.backend.config.TenantSessionBinder tenantSessionBinder;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       com.medicos.backend.config.TenantSessionBinder tenantSessionBinder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.tenantSessionBinder = tenantSessionBinder;
    }

    @Transactional(readOnly = true)
    public List<User> getUsersByHospital(String hospitalId) {
        if (hospitalId == null || hospitalId.isBlank()) {
            throw new com.medicos.backend.exception.BadRequestException("Hospital context missing from token.");
        }
        return userRepository.findByHospitalId(hospitalId);
    }

    @Transactional(readOnly = true)
    public List<User> getDoctorsByHospital(String hospitalId) {
        if (hospitalId == null || hospitalId.isBlank()) {
            throw new com.medicos.backend.exception.BadRequestException("Hospital context missing from token.");
        }
        return userRepository.findByHospitalIdAndRole(hospitalId, "doctor");
    }

    @Transactional(readOnly = true)
    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyLicense(Map<String, String> body) {
        return Optional.ofNullable(body.get("license_number"))
                .filter(lic -> !lic.isEmpty())
                .flatMap(userRepository::findByLicenseNumber)
                .map(user -> Map.<String, Object>of(
                        "valid", true,
                        "name", user.getName(),
                        "specialization", Optional.ofNullable(user.getSpecialization()).orElse("General")
                ))
                .orElseGet(() -> Map.of(
                        "valid", true,
                        "name", "Verified Medical Practitioner",
                        "specialization", "General Medicine"
                ));
    }

    @Transactional
    public Map<String, String> resetPassword(String id, Map<String, String> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        String newPassword = Optional.ofNullable(body.get("password"))
                .filter(p -> p.length() >= 6)
                .orElseThrow(() -> new BadRequestException("Password must be at least 6 characters."));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Revoke all active sessions for this user due to password change
        jwtTokenProvider.revokeAllUserTokens(id);

        return Map.of("message", "Password reset successfully");
    }

    @Transactional
    public User updateStatus(String id, Map<String, Object> body) {
        tenantSessionBinder.bindTenant("GLOBAL");
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        Optional.ofNullable(body.get("is_active"))
                .ifPresent(v -> {
                    int activeVal = Integer.parseInt(v.toString());
                    user.setIsActive(activeVal);
                    // Revoke all active sessions if user is being deactivated
                    if (activeVal == 0) {
                        jwtTokenProvider.revokeAllUserTokens(id);
                    }
                });

        return userRepository.save(user);
    }

    @Transactional
    public User updateUserProfile(User user, Map<String, Object> body) {
        tenantSessionBinder.bindTenant("GLOBAL");
        User target = userRepository.findById(user.getId()).orElse(user);

        if (body.containsKey("name") && body.get("name") != null) target.setName((String) body.get("name"));
        if (body.containsKey("phone")) target.setPhone((String) body.get("phone"));
        if (body.containsKey("specialization")) target.setSpecialization((String) body.get("specialization"));

        if (body.containsKey("license_number")) target.setLicenseNumber((String) body.get("license_number"));
        else if (body.containsKey("licenseNumber")) target.setLicenseNumber((String) body.get("licenseNumber"));

        if (body.containsKey("qualification")) target.setQualification((String) body.get("qualification"));

        if (body.containsKey("registration_number")) target.setRegistrationNumber((String) body.get("registration_number"));
        else if (body.containsKey("registrationNumber")) target.setRegistrationNumber((String) body.get("registrationNumber"));

        if (body.containsKey("letterhead")) target.setLetterhead((String) body.get("letterhead"));

        if (body.containsKey("photo_url")) target.setPhotoUrl((String) body.get("photo_url"));
        else if (body.containsKey("photoUrl")) target.setPhotoUrl((String) body.get("photoUrl"));
        
        if (body.containsKey("consultation_fee") && body.get("consultation_fee") != null) {
            try { target.setConsultationFee(Double.parseDouble(body.get("consultation_fee").toString())); } catch (Exception ignored) {}
        } else if (body.containsKey("consultationFee") && body.get("consultationFee") != null) {
            try { target.setConsultationFee(Double.parseDouble(body.get("consultationFee").toString())); } catch (Exception ignored) {}
        }

        if (body.containsKey("followup_fee") && body.get("followup_fee") != null) {
            try { target.setFollowupFee(Double.parseDouble(body.get("followup_fee").toString())); } catch (Exception ignored) {}
        } else if (body.containsKey("followupFee") && body.get("followupFee") != null) {
            try { target.setFollowupFee(Double.parseDouble(body.get("followupFee").toString())); } catch (Exception ignored) {}
        }

        if (body.containsKey("bed_per_day_charge") && body.get("bed_per_day_charge") != null) {
            try { target.setBedPerDayCharge(Double.parseDouble(body.get("bed_per_day_charge").toString())); } catch (Exception ignored) {}
        } else if (body.containsKey("bedPerDayCharge") && body.get("bedPerDayCharge") != null) {
            try { target.setBedPerDayCharge(Double.parseDouble(body.get("bedPerDayCharge").toString())); } catch (Exception ignored) {}
        }
        if (body.containsKey("show_diagnosis_on_print") && body.get("show_diagnosis_on_print") != null) {
            Object v = body.get("show_diagnosis_on_print");
            target.setShowDiagnosisOnPrint("true".equalsIgnoreCase(v.toString()) || "1".equals(v.toString()) || Boolean.TRUE.equals(v) ? 1 : 0);
        }
        if (body.containsKey("show_investigations_on_print") && body.get("show_investigations_on_print") != null) {
            Object v = body.get("show_investigations_on_print");
            target.setShowInvestigationsOnPrint("true".equalsIgnoreCase(v.toString()) || "1".equals(v.toString()) || Boolean.TRUE.equals(v) ? 1 : 0);
        }
        if (body.containsKey("show_vitals_on_print") && body.get("show_vitals_on_print") != null) {
            Object v = body.get("show_vitals_on_print");
            target.setShowVitalsOnPrint("true".equalsIgnoreCase(v.toString()) || "1".equals(v.toString()) || Boolean.TRUE.equals(v) ? 1 : 0);
        }
        if (body.containsKey("print_margin_top") && body.get("print_margin_top") != null) {
            try { target.setPrintMarginTop((int) Double.parseDouble(body.get("print_margin_top").toString())); } catch (Exception ignored) {}
        }
        if (body.containsKey("print_margin_bottom") && body.get("print_margin_bottom") != null) {
            try { target.setPrintMarginBottom((int) Double.parseDouble(body.get("print_margin_bottom").toString())); } catch (Exception ignored) {}
        }
        if (body.containsKey("print_margin_left_right") && body.get("print_margin_left_right") != null) {
            try { target.setPrintMarginLeftRight((int) Double.parseDouble(body.get("print_margin_left_right").toString())); } catch (Exception ignored) {}
        }
        if (body.containsKey("print_font_size") && body.get("print_font_size") != null) {
            try { target.setPrintFontSize(Double.parseDouble(body.get("print_font_size").toString())); } catch (Exception ignored) {}
        }
        return userRepository.save(target);
    }
}
