package com.medicos.backend.licensing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.TenantSubscription;
import com.medicos.backend.security.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

@Component
public class LicenseEnforcementFilter extends OncePerRequestFilter {

    private final LicenseService licenseService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Set<String> UNCHECKED_PREFIXES = Set.of(
            "/api/auth",
            "/api/licensing",
            "/api/health",
            "/swagger-ui",
            "/v3/api-docs"
    );

    public LicenseEnforcementFilter(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        // 1. Skip non-API and public endpoints
        if (!path.startsWith("/api") || isUncheckedPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String hospitalId = TenantContext.getTenantId();
        if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
            filterChain.doFilter(request, response);
            return;
        }

        TenantSubscription sub = licenseService.getOrCreateSubscription(hospitalId);
        LicenseState state = licenseService.computeLicenseState(sub);
        long daysLeft = licenseService.getDaysRemaining(sub);

        // Attach license telemetry headers to response
        response.setHeader("X-License-State", state.name());
        response.setHeader("X-License-Days-Left", String.valueOf(daysLeft));

        // 2. ARCHIVED Account: Complete lockdown (403)
        if (state == LicenseState.ARCHIVED) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), Map.of(
                    "error", "account_archived",
                    "licenseState", state.name(),
                    "message", "This hospital account has been archived per data retention policies. Contact support for recovery."
            ));
            return;
        }

        // 3. LOCKED Account: Read-only preservation of patient history. Mutations return 402 Payment Required
        if (state == LicenseState.LOCKED) {
            boolean isReadOnly = "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method);
            boolean isBillingOrExport = path.startsWith("/api/billing") || path.startsWith("/api/licensing");

            if (!isReadOnly && !isBillingOrExport) {
                response.setStatus(402); // 402 Payment Required
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getWriter(), Map.of(
                        "error", "license_expired",
                        "licenseState", state.name(),
                        "upgradeUrl", "/billing",
                        "daysLeftInExportWindow", daysLeft,
                        "message", "Hospital trial/license has expired. Existing clinical records are preserved in read-only mode, but creating or modifying entries requires an active plan."
                ));
                return;
            }
        }

        // 4. GRACE PERIOD: Clinical care continues; block administrative user expansion
        if (state == LicenseState.GRACE_PERIOD) {
            if (path.startsWith("/api/auth/register") && "POST".equalsIgnoreCase(method)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getWriter(), Map.of(
                        "error", "grace_period_restriction",
                        "licenseState", state.name(),
                        "message", "Adding new staff seats is restricted during the trial grace period. Please activate your subscription."
                ));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isUncheckedPath(String path) {
        for (String prefix : UNCHECKED_PREFIXES) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
