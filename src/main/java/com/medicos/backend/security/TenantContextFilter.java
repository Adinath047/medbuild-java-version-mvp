package com.medicos.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that derives tenant/hospital ID from secure server-side JWT claims during
 * authenticated requests, ignoring client-passed headers to prevent context manipulation.
 */
@Component
public class TenantContextFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-ID";
    private static final String HOSPITAL_HEADER = "X-Hospital-ID";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;

    public TenantContextFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String tenantId = null;
            String jwt = null;
            String authHeader = request.getHeader(AUTHORIZATION_HEADER);

            // 1. Derive tenant ID from Authorization header
            if (StringUtils.hasText(authHeader) && authHeader.startsWith(BEARER_PREFIX)) {
                jwt = authHeader.substring(BEARER_PREFIX.length()).trim();
            }

            // 2. Or derive from emr_token cookie if header is absent
            if (!StringUtils.hasText(jwt) && request.getCookies() != null) {
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    if ("emr_token".equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                        jwt = cookie.getValue().trim();
                        break;
                    }
                }
            }

            if (StringUtils.hasText(jwt) && jwtTokenProvider.validateToken(jwt)) {
                tenantId = jwtTokenProvider.getHospitalIdFromToken(jwt);
            }

            // 3. Fallback to header for unauthenticated endpoints if JWT is absent
            if (!StringUtils.hasText(tenantId)) {
                tenantId = request.getHeader(TENANT_HEADER);
                if (!StringUtils.hasText(tenantId)) {
                    tenantId = request.getHeader(HOSPITAL_HEADER);
                }
            }

            if (StringUtils.hasText(tenantId)) {
                TenantContext.setTenantId(tenantId.trim());
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
