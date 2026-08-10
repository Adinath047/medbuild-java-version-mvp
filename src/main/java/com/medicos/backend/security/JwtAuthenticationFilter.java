package com.medicos.backend.security;

import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
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
    private final PatientRepository patientRepository;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider,
                                   JwtUserLookupService jwtUserLookupService,
                                   PatientRepository patientRepository) {
        this.tokenProvider = tokenProvider;
        this.jwtUserLookupService = jwtUserLookupService;
        this.patientRepository = patientRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {

                // ── Blacklist check ──────────────────────────────────────────
                // Reject tokens that have been explicitly revoked (e.g. via logout).
                if (tokenProvider.isTokenBlacklisted(jwt)) {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write(
                        "{\"error\":\"Unauthorized\",\"message\":\"Token has been revoked. Please log in again.\"}");
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
                    SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase());
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(user, null, Collections.singletonList(authority));
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                } else if ("patient".equalsIgnoreCase(role)) {
                    // ── Second try: patient mobile app ───────────────────────
                    Optional<Patient> patientOptional = patientRepository.findById(userId);
                    if (patientOptional.isPresent()) {
                        Patient patient = patientOptional.get();
                        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_PATIENT");
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(patient, null, Collections.singletonList(authority));
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication in security context", ex);
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
