package com.medicos.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Built-in IP-based Rate Limiting Filter for API protection.
 * Protects against DDoS and auth brute-force attacks on Cloud Run.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_GENERAL_REQUESTS_PER_MINUTE = 120;
    private static final int MAX_AUTH_REQUESTS_PER_MINUTE = 20;

    private final Map<String, RequestBucket> generalBuckets = new ConcurrentHashMap<>();
    private final Map<String, RequestBucket> authBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Skip rate limiting for static resources and health checks
        if (path.startsWith("/static") || path.startsWith("/assets") || path.endsWith(".css") || path.endsWith(".js") || path.equals("/api/health")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        boolean isAuthEndpoint = path.startsWith("/api/auth/");

        RequestBucket bucket = isAuthEndpoint
                ? authBuckets.computeIfAbsent(clientIp, k -> new RequestBucket())
                : generalBuckets.computeIfAbsent(clientIp, k -> new RequestBucket());

        int limit = isAuthEndpoint ? MAX_AUTH_REQUESTS_PER_MINUTE : MAX_GENERAL_REQUESTS_PER_MINUTE;

        if (!bucket.allowRequest(limit)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please try again in a minute.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RequestBucket {
        private final AtomicInteger requestCount = new AtomicInteger(0);
        private final AtomicLong windowStartTime = new AtomicLong(System.currentTimeMillis());

        public boolean allowRequest(int maxRequests) {
            long now = System.currentTimeMillis();
            long start = windowStartTime.get();

            // Reset counter every 60 seconds
            if (now - start > 60000) {
                if (windowStartTime.compareAndSet(start, now)) {
                    requestCount.set(0);
                }
            }

            return requestCount.incrementAndGet() <= maxRequests;
        }
    }
}
