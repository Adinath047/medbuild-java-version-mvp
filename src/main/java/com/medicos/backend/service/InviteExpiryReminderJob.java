package com.medicos.backend.service;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * InviteExpiryReminderJob — Permanent nightly scheduled task.
 *
 * Runs every morning at 08:00 IST (02:30 UTC).
 *
 * What it does:
 *   1. Finds all users in state: invited=true, active=0, token expired.
 *   2. Groups them by hospital.
 *   3. Sends ONE consolidated email to that hospital's admin listing
 *      every staff member who never accepted their invite.
 *   4. Never deletes any records — data stays safe forever.
 *   5. Admin can resend invites directly from the Command Center.
 *
 * Why permanent (not temporary):
 *   - Invite expiry is a permanent operational reality in any EMR.
 *   - Admins forget to follow up — this closes that gap automatically.
 *   - Zero data loss risk (no deletes, only reads + email).
 */
@Service
public class InviteExpiryReminderJob {

    private static final Logger log = LoggerFactory.getLogger(InviteExpiryReminderJob.class);

    private static final DateTimeFormatter DISPLAY_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final TenantSessionBinder tenantSessionBinder;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:noreply@medbuilds.com}")
    private String fromEmail;

    @Value("${app.frontend.url:https://medbuild-java-version-mvp-614571130325.asia-south1.run.app}")
    private String frontendUrl;

    public InviteExpiryReminderJob(UserRepository userRepository,
                                   HospitalRepository hospitalRepository,
                                   TenantSessionBinder tenantSessionBinder) {
        this.userRepository   = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.tenantSessionBinder = tenantSessionBinder;
    }

    /**
     * Runs every morning at 08:00 IST = 02:30 UTC.
     * Cron: second minute hour day month weekday
     */
    @Scheduled(cron = "0 30 2 * * *", zone = "UTC")
    @Transactional(readOnly = true)
    public void notifyAdminsOfExpiredInvites() {
        log.info("[InviteExpiryReminderJob] Starting nightly expired-invite scan...");

        if (mailSender == null) {
            log.warn("[InviteExpiryReminderJob] Mail sender not configured — skipping.");
            return;
        }

        // All queries run under GLOBAL RLS — cross-tenant by design
        tenantSessionBinder.bindTenant("GLOBAL");

        List<User> expired = userRepository.findExpiredPendingInvites(OffsetDateTime.now());

        if (expired.isEmpty()) {
            log.info("[InviteExpiryReminderJob] No expired pending invites found. All clear.");
            return;
        }

        log.info("[InviteExpiryReminderJob] Found {} expired pending invite(s). Grouping by hospital...",
                expired.size());

        // Group expired invites by hospitalId
        Map<String, List<User>> byHospital = new LinkedHashMap<>();
        for (User u : expired) {
            if (u.getHospitalId() != null) {
                byHospital.computeIfAbsent(u.getHospitalId(), k -> new ArrayList<>()).add(u);
            }
        }

        int emailsSent = 0;
        for (Map.Entry<String, List<User>> entry : byHospital.entrySet()) {
            String hospitalId = entry.getKey();
            List<User> expiredInHospital = entry.getValue();

            // Find the hospital admin (role=ADMIN, active=1)
            List<User> admins = userRepository.findByHospitalIdAndRole(hospitalId, "ADMIN");
            User admin = admins.stream()
                    .filter(a -> Integer.valueOf(1).equals(a.getIsActive()))
                    .findFirst()
                    .orElse(null);

            if (admin == null || admin.getEmail() == null) {
                log.warn("[InviteExpiryReminderJob] Hospital {} has no active admin — skipping reminder.", hospitalId);
                continue;
            }

            String hospitalName = hospitalRepository.findById(hospitalId)
                    .map(Hospital::getName)
                    .orElse(hospitalId);

            try {
                sendExpiryReminderEmail(admin.getEmail(), admin.getName(), hospitalName, hospitalId, expiredInHospital);
                emailsSent++;
                log.info("[InviteExpiryReminderJob] Reminder sent to admin {} for hospital {} ({} expired invite(s))",
                        admin.getEmail(), hospitalId, expiredInHospital.size());
            } catch (Exception e) {
                log.error("[InviteExpiryReminderJob] Failed to send reminder to {} for hospital {}: {}",
                        admin.getEmail(), hospitalId, e.getMessage());
            }
        }

        log.info("[InviteExpiryReminderJob] Done. {} reminder email(s) sent.", emailsSent);
    }

    private void sendExpiryReminderEmail(String adminEmail,
                                          String adminName,
                                          String hospitalName,
                                          String hospitalId,
                                          List<User> expiredUsers)
            throws MessagingException, java.io.UnsupportedEncodingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(fromEmail, "Medbuilds EMR");
        helper.setTo(adminEmail);
        helper.setSubject("Action Required: " + expiredUsers.size() +
                " staff invite(s) expired — " + hospitalName);
        helper.setText(buildReminderHtml(adminName, hospitalName, hospitalId, expiredUsers), true);

        mailSender.send(message);
    }

    private String buildReminderHtml(String adminName,
                                      String hospitalName,
                                      String hospitalId,
                                      List<User> expiredUsers) {
        StringBuilder rows = new StringBuilder();
        for (User u : expiredUsers) {
            String expiredAt = u.getInviteTokenExpires() != null
                    ? u.getInviteTokenExpires().format(DISPLAY_FMT) + " IST"
                    : "Unknown";
            rows.append("<tr>")
                .append("<td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13.5px;color:#1e293b;'>")
                    .append(u.getName() != null ? escapeHtml(u.getName()) : "—").append("</td>")
                .append("<td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;'>")
                    .append(escapeHtml(u.getEmail())).append("</td>")
                .append("<td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;'>")
                    .append(u.getRole() != null ? escapeHtml(u.getRole()) : "—").append("</td>")
                .append("<td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#94a3b8;'>")
                    .append(expiredAt).append("</td>")
                .append("</tr>");
        }

        String commandCenterUrl = frontendUrl + "/command-center/hospitals/" + hospitalId + "/staff";

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='" +
                "margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;'>" +

                "<div style='max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;" +
                "border:1px solid #e2e8f0;overflow:hidden;'>" +

                // Header
                "<div style='background:#0f766e;padding:28px 32px;'>" +
                "<div style='font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.3px;'>Medbuilds EMR</div>" +
                "<div style='font-size:12px;color:#99f6e4;margin-top:2px;'>Staff Invitation Management</div>" +
                "</div>" +

                // Body
                "<div style='padding:32px;'>" +
                "<h2 style='font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px;'>" +
                "Staff invitations have expired</h2>" +
                "<p style='font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;'>" +
                "Hi " + escapeHtml(adminName != null ? adminName : "Admin") + ", the following staff members " +
                "at <strong>" + escapeHtml(hospitalName) + "</strong> were sent an invitation email but did not " +
                "activate their account within the 48-hour window. No data has been deleted — " +
                "their records are safe. Please resend their invitations when ready." +
                "</p>" +

                // Warning card
                "<div style='background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;" +
                "margin-bottom:24px;display:flex;align-items:flex-start;gap:10px;'>" +
                "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#d97706' stroke-width='2.2' " +
                "style='flex-shrink:0;margin-top:1px;'>" +
                "<path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/>" +
                "<line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>" +
                "<p style='font-size:13px;color:#92400e;margin:0;line-height:1.5;'>" +
                "<strong>Important:</strong> These staff members cannot log in until they accept a fresh invite. " +
                "Their old invite links no longer work." +
                "</p>" +
                "</div>" +

                // Table
                "<table style='width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;" +
                "overflow:hidden;font-size:13px;'>" +
                "<thead><tr style='background:#f8fafc;'>" +
                "<th style='padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;" +
                "text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Name</th>" +
                "<th style='padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;" +
                "text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Email</th>" +
                "<th style='padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;" +
                "text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Role</th>" +
                "<th style='padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;" +
                "text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Expired At</th>" +
                "</tr></thead>" +
                "<tbody>" + rows + "</tbody>" +
                "</table>" +

                // CTA
                "<div style='margin-top:28px;text-align:center;'>" +
                "<a href='" + commandCenterUrl + "' style='display:inline-block;background:#0f766e;color:#ffffff;" +
                "text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;" +
                "letter-spacing:0.2px;'>Resend Invitations from Command Center</a>" +
                "</div>" +

                "<p style='font-size:12px;color:#94a3b8;margin:24px 0 0;line-height:1.5;text-align:center;'>" +
                "This is an automated reminder from Medbuilds EMR. Staff records are never deleted automatically." +
                "</p>" +
                "</div>" +

                // Footer
                "<div style='background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;'>" +
                "<p style='font-size:11.5px;color:#94a3b8;margin:0;text-align:center;'>" +
                "Medbuilds EMR — Secure Clinical Management Platform" +
                "</p>" +
                "</div>" +

                "</div></body></html>";
    }

    private static String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
