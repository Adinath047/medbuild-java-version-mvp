package com.medicos.backend.security;

import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final JwtUserLookupService jwtUserLookupService;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider,
                                   JwtUserLookupService jwtUserLookupService) {
        this.tokenProvider = tokenProvider;
        this.jwtUserLookupService = jwtUserLookupService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {

                // ── Blacklist check ──────────────────────────────────────────
                // Reject tokens that have been explicitly revoked (e.g. via logout).
                try {
                    if (tokenProvider.isTokenBlacklisted(jwt)) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.getWriter().write(
                            "{\"error\":\"Unauthorized\",\"message\":\"Token has been revoked. Please log in again.\"}");
                        return;
                    }
                } catch (org.springframework.dao.DataAccessException e) {
                    logger.error("Redis connection failed during token validation. Failing closed.", e);
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    response.setContentType("application/json");
                    response.getWriter().write(
                        "{\"error\":\"Service Unavailable\",\"message\":\"Authentication service is temporarily unavailable. Please try again later.\"}");
                    return;
                }

                String userId = tokenProvider.getUserIdFromToken(jwt);
                String role = tokenProvider.getRoleFromToken(jwt);
                // hospitalId is embedded in the JWT at token generation time.
                // We pass it to the lookup service so it can bind the RLS session variable
                // within the same transaction as the findById query — breaking the
                // chicken-and-egg: we don't need the DB user to know the tenant,
                // and we don't need the tenant bound externally to query the DB user.
                String hospitalId = tokenProvider.getHospitalIdFromToken(jwt);

                // ── First try: EMR staff / doctor ──────────────────────────
                Optional<User> userOptional = jwtUserLookupService.findUserByIdWithTenant(userId, hospitalId);
                if (userOptional.isPresent()) {
                    User user = userOptional.get();
                    if (user.getIsActive() != null && user.getIsActive() == 0) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Account has been deactivated. Access revoked.\"}");
                        return;
                    }
                    SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase());
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(user, null, Collections.singletonList(authority));
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                } else if ("patient".equalsIgnoreCase(role)) {
                    // ── Second try: patient mobile app ───────────────────────
                    // Patient JWTs also embed hospitalId (PatientAuthService.verifyOtp line 131),
                    // so the same RLS-bind-before-SELECT pattern applies here.
                    Optional<Patient> patientOptional = jwtUserLookupService.findPatientByIdWithTenant(userId, hospitalId);
                    if (patientOptional.isPresent()) {
                        Patient patient = patientOptional.get();
                        if (patient.getIsActive() != null && patient.getIsActive() == 0) {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Patient account is inactive. Access revoked.\"}");
                            return;
                        }
                        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_PATIENT");
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(patient, null, Collections.singletonList(authority));
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        } catch (Exception ex) {
            // Log with enough context to diagnose the failure without exposing token content.
            // Common causes: RLS session variable not set, expired token, malformed claim.
            logger.error("JWT authentication failed [path=" + request.getRequestURI()
                    + " cause=" + ex.getMessage() + "] — request continues unauthenticated", ex);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extracts the JWT from:
     *  1. Authorization Bearer header (preferred for API clients / mobile)
     *  2. emr_token cookie (for browser-based EMR portal)
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("emr_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
