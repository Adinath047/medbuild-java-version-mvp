package com.medicos.backend.controller;

import com.medicos.backend.dto.InviteDTO;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.InviteService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class InviteController {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    /**
     * Platform Super Admin creates a new hospital and sends an invite email to ONLY the Hospital Admin.
     * POST /api/auth/onboard-hospital
     */
    @PostMapping("/onboard-hospital")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public ResponseEntity<?> onboardHospital(@RequestBody InviteDTO.OnboardHospitalRequest request,
                                             @AuthenticationPrincipal User superAdmin) {
        Map<String, Object> result = inviteService.onboardHospitalAndInviteAdmin(request, superAdmin);
        return ResponseEntity.ok(result);
    }

    /**
     * Lists all hospital tenants and their admin info.
     * GET /api/auth/hospitals
     */
    @GetMapping("/hospitals")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public ResponseEntity<?> getHospitals() {
        return ResponseEntity.ok(inviteService.getAllHospitals());
    }

    /**
     * Admin invites a staff member or hospital admin.
     * POST /api/auth/invite
     */
    @PostMapping("/invite")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> sendInvite(@RequestBody InviteDTO.SendInviteRequest request,
                                        @AuthenticationPrincipal User adminUser) {
        inviteService.sendInvite(request, adminUser);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Invitation sent successfully to " + request.getEmail()
        ));
    }

    /**
     * Validate invite token before rendering the password setup form.
     * GET /api/auth/invites/validate?token=...
     */
    @GetMapping("/invites/validate")
    public ResponseEntity<InviteDTO.ValidateResponse> validateToken(@RequestParam("token") String token) {
        InviteDTO.ValidateResponse response = inviteService.validateToken(token);
        return ResponseEntity.ok(response);
    }

    /**
     * Clinician/Staff sets password and activates account.
     * POST /api/auth/invites/accept
     */
    @PostMapping("/invites/accept")
    public ResponseEntity<InviteDTO.AcceptResponse> acceptInvite(@RequestBody InviteDTO.AcceptRequest request) {
        InviteDTO.AcceptResponse response = inviteService.acceptInvite(request);
        return ResponseEntity.ok(response);
    }
}
