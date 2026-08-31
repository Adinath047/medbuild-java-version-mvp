package com.medicos.backend.controller;

import com.medicos.backend.entity.TenantSubscription;
import com.medicos.backend.licensing.LicenseService;
import com.medicos.backend.licensing.LicenseState;
import com.medicos.backend.security.TenantContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/licensing")
public class LicensingController {

    private final LicenseService licenseService;

    public LicensingController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam(value = "hospitalId", required = false) String paramHospitalId) {
        String hospitalId = paramHospitalId != null && !paramHospitalId.trim().isEmpty() 
                ? paramHospitalId 
                : TenantContext.getTenantId();

        if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
            hospitalId = "hsp-001"; // default fallback for initial setup
        }

        TenantSubscription sub = licenseService.getOrCreateSubscription(hospitalId);
        LicenseState state = licenseService.computeLicenseState(sub);
        long daysLeft = licenseService.getDaysRemaining(sub);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tenantId", sub != null ? sub.getTenantId() : hospitalId);
        response.put("planType", sub != null ? sub.getPlanType() : "trial");
        response.put("licenseState", state.name());
        response.put("daysRemaining", daysLeft);
        response.put("trialStartedAt", sub != null && sub.getTrialStartedAt() != null ? sub.getTrialStartedAt().toString() : Instant.now().toString());
        response.put("trialEndsAt", sub != null && sub.getTrialEndsAt() != null ? sub.getTrialEndsAt().toString() : Instant.now().toString());
        response.put("graceEndsAt", sub != null && sub.getGraceEndsAt() != null ? sub.getGraceEndsAt().toString() : null);
        response.put("dataExportDeadline", sub != null && sub.getDataExportDeadline() != null ? sub.getDataExportDeadline().toString() : null);
        response.put("isReadOnly", state == LicenseState.LOCKED);
        response.put("isArchived", state == LicenseState.ARCHIVED);
        response.put("isGracePeriod", state == LicenseState.GRACE_PERIOD);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/export")
    public ResponseEntity<?> exportData(@RequestParam(value = "hospitalId", required = false) String paramHospitalId) {
        String hospitalId = paramHospitalId != null && !paramHospitalId.trim().isEmpty() 
                ? paramHospitalId 
                : TenantContext.getTenantId();

        if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
            hospitalId = "hsp-001";
        }

        Map<String, Object> bundle = licenseService.exportHospitalData(hospitalId);

        String filename = "medbuilds-clinical-export-" + hospitalId + "-" + Instant.now().getEpochSecond() + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(bundle);
    }

    @PostMapping("/time-travel")
    public ResponseEntity<?> timeTravel(@RequestBody Map<String, Object> payload) {
        String hospitalId = (String) payload.getOrDefault("hospitalId", TenantContext.getTenantId());
        if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
            hospitalId = "hsp-001";
        }
        
        int offsetDays = ((Number) payload.getOrDefault("offsetDays", -35)).intValue();
        licenseService.timeTravel(hospitalId, offsetDays);
        
        TenantSubscription sub = licenseService.getOrCreateSubscription(hospitalId);
        LicenseState newState = licenseService.computeLicenseState(sub);
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "tenantId", hospitalId,
                "offsetDays", offsetDays,
                "newLicenseState", newState.name(),
                "daysRemaining", licenseService.getDaysRemaining(sub)
        ));
    }
}
