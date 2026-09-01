package com.medicos.backend.service;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.dto.AuthDTO;
import com.medicos.backend.dto.InviteDTO;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

/**
 * InviteService — secure email-based staff onboarding for Medbuilds EMR.
 *
 * Security guarantees:
 *  - Raw tokens (32 random bytes, hex-encoded) are only sent in email links.
 *  - Database stores only the SHA-256 hash of the raw token.
 *  - Tokens expire after 48 hours.
 *  - After acceptance, invite_token_hash is cleared preventing replay attacks.
 */
@Service
public class InviteService {

    private static final Logger log = LoggerFactory.getLogger(InviteService.class);

    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final TenantSessionBinder tenantSessionBinder;
    private final AuditLogService auditLogService;
    private final com.medicos.backend.licensing.LicenseService licenseService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.frontend.url:https://app.medbuilds.com}")
    private String frontendUrl;

    @Value("${spring.mail.username:noreply@medbuilds.com}")
    private String fromEmail;

    public InviteService(UserRepository userRepository,
                         HospitalRepository hospitalRepository,
                         PasswordEncoder passwordEncoder,
                         JwtTokenProvider tokenProvider,
                         TenantSessionBinder tenantSessionBinder,
                         AuditLogService auditLogService,
                         com.medicos.backend.licensing.LicenseService licenseService) {
        this.userRepository = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.tenantSessionBinder = tenantSessionBinder;
        this.auditLogService = auditLogService;
        this.licenseService = licenseService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 0. Super Admin onboards a new hospital and sends invite to ONLY the Hospital Admin
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public java.util.Map<String, Object> onboardHospitalAndInviteAdmin(InviteDTO.OnboardHospitalRequest req, User superAdmin) {
        if (req.getHospitalName() == null || req.getHospitalName().isBlank()) {
            throw new BadRequestException("Hospital name is required.");
        }
        if (req.getAdminEmail() == null || req.getAdminEmail().isBlank()) {
            throw new BadRequestException("Admin email is required.");
        }

        tenantSessionBinder.bindTenant("GLOBAL");

        String hospitalId = "hsp-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String planType = req.getPlanType() != null && !req.getPlanType().isBlank() ? req.getPlanType().toUpperCase() : "TRIAL";
        int trialDays = req.getTrialDays() != null && req.getTrialDays() > 0 ? req.getTrialDays() : 30;
        boolean isPaid = "PAID".equals(planType) || "ENTERPRISE".equals(planType);

        Hospital hospital = new Hospital();
        hospital.setId(hospitalId);
        hospital.setName(req.getHospitalName().trim());
        hospital.setType(req.getHospitalType() != null ? req.getHospitalType() : "General");
        hospital.setCity(req.getCity());
        hospital.setPhone(req.getPhone());
        hospital.setIsActive(1);
        hospital.setSubscriptionPlan(planType);
        hospital.setTrialStartedAt(java.time.LocalDateTime.now());
        hospital.setTrialEndsAt(isPaid ? java.time.LocalDateTime.now().plusYears(10) : java.time.LocalDateTime.now().plusDays(trialDays));
        hospital.setTrialStatus(isPaid ? "PAID" : "ACTIVE");
        hospitalRepository.save(hospital);

        if (licenseService != null) {
            licenseService.getOrCreateSubscription(hospitalId, planType, trialDays);
        }

        // Send invite specifically to this hospital's administrator
        InviteDTO.SendInviteRequest inviteReq = new InviteDTO.SendInviteRequest();
        inviteReq.setEmail(req.getAdminEmail());
        inviteReq.setName(req.getAdminName() != null && !req.getAdminName().isBlank() ? req.getAdminName() : "Hospital Administrator");
        inviteReq.setRole("admin");
        inviteReq.setHospitalId(hospitalId);
        inviteReq.setPhone(req.getPhone());

        sendInvite(inviteReq, superAdmin, "Rotstruck Pvt. Ltd.");

        return java.util.Map.of(
                "hospital_id", hospitalId,
                "hospital_name", hospital.getName(),
                "admin_email", req.getAdminEmail(),
                "plan_type", planType,
                "trial_days", isPaid ? 0 : trialDays,
                "message", "Hospital provisioned successfully. Admin invitation email sent to " + req.getAdminEmail()
        );
    }

    public java.util.List<java.util.Map<String, Object>> getAllHospitals() {
        tenantSessionBinder.bindTenant("GLOBAL");
        java.util.List<Hospital> hospitals = hospitalRepository.findAll();
        return hospitals.stream().map(h -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", h.getId());
            map.put("name", h.getName());
            map.put("type", h.getType());
            map.put("city", h.getCity());
            map.put("phone", h.getPhone());
            map.put("subscription_plan", h.getSubscriptionPlan());
            map.put("trial_status", h.getTrialStatus());
            map.put("trial_started_at", h.getTrialStartedAt());
            map.put("trial_ends_at", h.getTrialEndsAt());

            java.util.List<User> admins = userRepository.findByHospitalIdAndRole(h.getId(), "admin");
            if (!admins.isEmpty()) {
                User a = admins.get(0);
                map.put("admin_name", a.getName());
                map.put("admin_email", a.getEmail());
                map.put("admin_active", a.getIsActive());
                map.put("admin_is_invited", a.getIsInvited());
            }
            return map;
        }).collect(java.util.stream.Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Send invite
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void sendInvite(InviteDTO.SendInviteRequest req, User admin) {
        sendInvite(req, admin, null);
    }

    @Transactional
    public void sendInvite(InviteDTO.SendInviteRequest req, User admin, String customInviterName) {
        if (req.getEmail() == null || req.getEmail().isBlank()) {
            throw new BadRequestException("Recipient email is required.");
        }
        if (req.getRole() == null || req.getRole().isBlank()) {
            throw new BadRequestException("Role is required.");
        }

        String hospitalId = req.getHospitalId() != null ? req.getHospitalId() : (admin != null ? admin.getHospitalId() : "hsp-001");
        if (hospitalId == null) {
            throw new BadRequestException("Hospital context is required.");
        }

        tenantSessionBinder.bindTenant(hospitalId);

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new BadRequestException("Hospital not found: " + hospitalId));

        // Generate cryptographic token
        String rawToken = generateRawToken();
        String tokenHash = sha256(rawToken);
        OffsetDateTime expires = OffsetDateTime.now().plusHours(48);

        String email = req.getEmail().toLowerCase().trim();

        // Upsert: create new user or refresh invite token for existing user
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setId("usr-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            u.setEmail(email);
            u.setPassword(""); // empty until invite is accepted
            u.setIsInvited(true);
            return u;
        });

        user.setName(req.getName() != null && !req.getName().isBlank() ? req.getName() : email.split("@")[0]);
        user.setRole(req.getRole());
        user.setHospitalId(hospitalId);
        if (req.getSpecialization() != null) user.setSpecialization(req.getSpecialization());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        user.setInviteTokenHash(tokenHash);
        user.setInviteTokenExpires(expires);
        user.setIsInvited(true);
        userRepository.save(user);

        // Send invite email
        String inviteLink = frontendUrl + "/accept-invite/" + rawToken;
        String inviter = (customInviterName != null && !customInviterName.isBlank()) 
                ? customInviterName 
                : (admin != null && admin.getName() != null && !admin.getName().isBlank() ? admin.getName() : "Rotstruck Pvt. Ltd.");
        dispatchInviteEmail(email, user.getName(), req.getRole(), hospital.getName(), inviteLink, inviter);

        auditLogService.record(hospitalId, "STAFF_INVITE_SENT", "Invited " + email + " as " + req.getRole(), admin, null, null, "SUCCESS");

        log.info("[InviteService] Invite sent to {} (role={}, hospital={})", email, req.getRole(), hospitalId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Validate invite token (called before showing password form)
    // ─────────────────────────────────────────────────────────────────────────

    public InviteDTO.ValidateResponse validateToken(String rawToken) {
        InviteDTO.ValidateResponse resp = new InviteDTO.ValidateResponse();
        if (rawToken == null || rawToken.isBlank()) {
            resp.setValid(false);
            resp.setMessage("Token is missing.");
            return resp;
        }

        String hash = sha256(rawToken);
        User user = userRepository.findByInviteTokenHash(hash).orElse(null);

        if (user == null) {
            resp.setValid(false);
            resp.setMessage("This invite link is invalid or has already been used.");
            return resp;
        }

        if (user.getInviteTokenExpires() == null || OffsetDateTime.now().isAfter(user.getInviteTokenExpires())) {
            resp.setValid(false);
            resp.setMessage("This invite link has expired. Please ask your admin to send a new one.");
            return resp;
        }

        String hospitalName = user.getHospitalId() != null
                ? hospitalRepository.findById(user.getHospitalId()).map(Hospital::getName).orElse("Your Hospital")
                : "Your Hospital";

        resp.setValid(true);
        resp.setEmail(user.getEmail());
        resp.setName(user.getName());
        resp.setRole(user.getRole());
        resp.setHospitalId(user.getHospitalId());
        resp.setHospitalName(hospitalName);
        return resp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Accept invite — set password, clear token, return JWT
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public InviteDTO.AcceptResponse acceptInvite(InviteDTO.AcceptRequest req) {
        if (req.getToken() == null || req.getToken().isBlank()) {
            throw new BadRequestException("Invite token is required.");
        }
        if (req.getPassword() == null || req.getPassword().length() < 8) {
            throw new BadRequestException("Password must be at least 8 characters.");
        }

        String hash = sha256(req.getToken());
        User user = userRepository.findByInviteTokenHash(hash)
                .orElseThrow(() -> new BadRequestException("Invalid or already-used invite link."));

        if (user.getInviteTokenExpires() == null || OffsetDateTime.now().isAfter(user.getInviteTokenExpires())) {
            throw new BadRequestException("This invite link has expired. Please request a new one.");
        }

        // Set password and clear token (prevent replay)
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setInviteTokenHash(null);
        user.setInviteTokenExpires(null);
        user.setIsActive(1);
        userRepository.save(user);

        // Issue JWT for immediate login: (userId, email, role, hospitalId)
        String jwt = tokenProvider.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getHospitalId());

        // Build UserDTO for response
        AuthDTO.UserDTO userDTO = buildUserDTO(user);

        auditLogService.record("STAFF_INVITE_ACCEPTED", "Account activated via invite link", user, null, null, "SUCCESS");

        InviteDTO.AcceptResponse resp = new InviteDTO.AcceptResponse();
        resp.setToken(jwt);
        resp.setUser(userDTO);
        resp.setMessage("Account activated. Welcome to Medbuilds!");
        return resp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    @jakarta.annotation.PostConstruct
    public void init() {
        if (fromEmail != null && !fromEmail.isBlank() && mailSender != null) {
            log.info("[InviteService] ✅ SMTP Mail Dispatcher initialized with sender: {}", fromEmail);
        } else {
            log.info("[InviteService] ℹ️ SMTP credentials not set (EMAIL_USER is empty). Invite links will be output to server logs.");
        }
    }

    private void dispatchInviteEmail(String to, String name, String role,
                                     String hospitalName, String inviteLink, String inviterName) {
        if (mailSender == null || fromEmail == null || fromEmail.isBlank()) {
            // Local dev / unconfigured SMTP fallback — log the link so testing continues uninterrupted
            log.info("[InviteService][DEV] Invite link for {}: {}", to, inviteLink);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("You have been invited to Medbuilds EMR — " + hospitalName);
            helper.setText(buildHtmlEmail(name, role, hospitalName, inviteLink, inviterName), true);
            mailSender.send(message);
            log.info("[InviteService] ✅ Invite email dispatched successfully to {}", to);
        } catch (Exception e) {
            log.error("[InviteService] ❌ Failed to dispatch email to {}: {}", to, e.getMessage());
            log.warn("[InviteService][FALLBACK] Direct invite link: {}", inviteLink);
            log.info("[InviteService][TIP] For Gmail SMTP, ensure you use a 16-character App Password (without spaces) and 2-Step Verification enabled.");
        }
    }

    private String buildHtmlEmail(String name, String role, String hospitalName,
                                   String inviteLink, String inviterName) {
        return """
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                             background:#f4f6f8; margin:0; padding:24px;">
                  <div style="max-width:520px; margin:0 auto; background:#ffffff;
                              border-radius:12px; overflow:hidden;
                              box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                    <div style="background:#0f766e; padding:32px 40px;">
                      <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700;">
                        Medbuilds EMR
                      </h1>
                      <p style="color:#ccfbf1; margin:6px 0 0; font-size:13px;">
                        Medical Records &amp; Hospital Management
                      </p>
                    </div>
                    <div style="padding:40px;">
                      <p style="color:#1e293b; font-size:15px; margin:0 0 8px;">
                        Hello <strong>%s</strong>,
                      </p>
                      <p style="color:#475569; font-size:14px; line-height:1.6; margin:0 0 24px;">
                        <strong>%s</strong> has invited you to join
                        <strong>%s</strong> on Medbuilds EMR as
                        <strong>%s</strong>.
                      </p>
                      <a href="%s"
                         style="display:inline-block; background:#0f766e; color:#ffffff;
                                text-decoration:none; padding:14px 28px; border-radius:8px;
                                font-size:15px; font-weight:600;">
                        Activate Account &amp; Set Password
                      </a>
                      <p style="color:#94a3b8; font-size:12px; margin:24px 0 0;">
                        This link expires in 48 hours. If you were not expecting this invitation,
                        you can safely ignore this email.
                      </p>
                    </div>
                    <div style="background:#f8fafc; padding:20px 40px;">
                      <p style="color:#94a3b8; font-size:11px; margin:0;">
                        Medbuilds EMR — Powered by Rotstruck Pvt. Ltd.
                      </p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(name, inviterName, hospitalName, role, inviteLink);
    }

    private AuthDTO.UserDTO buildUserDTO(User user) {
        AuthDTO.UserDTO dto = new AuthDTO.UserDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setHospitalId(user.getHospitalId());
        dto.setPhone(user.getPhone());
        dto.setSpecialization(user.getSpecialization());
        dto.setPhotoUrl(user.getPhotoUrl());
        dto.setIsActive(user.getIsActive());
        return dto;
    }
}
