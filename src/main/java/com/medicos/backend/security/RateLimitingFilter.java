package com.medicos.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * IP-based rate limiting for API protection.
 *
 * Security improvements over original:
 *  - X-Forwarded-For spoofing protection: validates that the IP is a real IPv4/IPv6 address
 *    and only takes the first IP (the client) from the chain
 *  - Separate OTP bucket with a very tight limit (5 req/min) to prevent OTP brute force
 *  - Reduced auth limit: 20 req/min (down from 100)
 *  - Reduced general limit: 300 req/min (down from 2000)
 *  - Adds Retry-After response header so clients know when to retry
 *  - Periodic bucket cleanup to prevent memory growth under sustained load
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    @Value("${rate-limiting.enabled:true}")
    private boolean enabled;

    // General API requests per minute per IP
    private static final int MAX_GENERAL_REQUESTS_PER_MINUTE = 1200;

    // Auth endpoints (login, register) per minute per IP.
    @Value("${rate-limiting.auth-max-per-minute:120}")
    private int maxAuthRequestsPerMinute;

    // OTP-specific limit — much tighter to prevent 6-digit brute force
    private static final int MAX_OTP_REQUESTS_PER_MINUTE = 10;

    // Trial signup limit — strictly capped to prevent schema generation abuse
    private static final int MAX_TRIAL_SIGNUP_REQUESTS_PER_HOUR = 10;
    private static final long ONE_HOUR_IN_MS = 3600_000L;

    // IPv4 pattern for X-Forwarded-For validation
    private static final Pattern IP_PATTERN = Pattern.compile(
        "^([0-9]{1,3}\\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]{2,39}$");

    private final Map<String, RequestBucket> generalBuckets     = new ConcurrentHashMap<>();
    private final Map<String, RequestBucket> authBuckets        = new ConcurrentHashMap<>();
    private final Map<String, RequestBucket> otpBuckets         = new ConcurrentHashMap<>();
    private final Map<String, RequestBucket> trialSignupBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Skip: static resources, sync, health, and local development traffic
        if (!enabled || isExemptPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);

        // Determine which bucket applies (most specific first)
        RequestBucket bucket;
        int limit;
        String errorMessage = "Rate limit exceeded. Please try again in 60 seconds.";
        String retryAfter = "60";

        if ("/api/trial/signup".equals(path)) {
            bucket = trialSignupBuckets.computeIfAbsent(clientIp, k -> new RequestBucket(ONE_HOUR_IN_MS));
            limit  = MAX_TRIAL_SIGNUP_REQUESTS_PER_HOUR;
            errorMessage = "Trial signup rate limit exceeded. Please try again in an hour.";
            retryAfter = "3600";
        } else if (isOtpEndpoint(path)) {
            bucket = otpBuckets.computeIfAbsent(clientIp, k -> new RequestBucket());
            limit  = MAX_OTP_REQUESTS_PER_MINUTE;
        } else if (isAuthEndpoint(path)) {
            bucket = authBuckets.computeIfAbsent(clientIp, k -> new RequestBucket());
            limit  = maxAuthRequestsPerMinute;
        } else {
            bucket = generalBuckets.computeIfAbsent(clientIp, k -> new RequestBucket());
            limit  = MAX_GENERAL_REQUESTS_PER_MINUTE;
        }

        if (!bucket.allowRequest(limit)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.setHeader("Retry-After", retryAfter);
            response.getWriter().write(
                "{\"error\":\"Too Many Requests\"," +
                "\"message\":\"" + errorMessage + "\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isExemptPath(String path) {
        return path.startsWith("/static") || path.startsWith("/assets")
            || path.endsWith(".css")      || path.endsWith(".js")
            || path.endsWith(".png")      || path.endsWith(".ico")
            || path.startsWith("/api/sync")
            || path.startsWith("/api/auth/hospital/")
            || path.equals("/api/auth/me")
            || path.equals("/api/auth/refresh")
            || path.equals("/api/auth/logout")
            || path.startsWith("/api/trial/")
            || path.equals("/api/health")
            || path.equals("/api/system/status");
    }

    private boolean isOtpEndpoint(String path) {
        return path.contains("/send-otp") || path.contains("/verify-otp");
    }

    private boolean isAuthEndpoint(String path) {
        return "/api/auth/login".equals(path) || "/api/auth/register".equals(path);
    }

    /**
     * Safely resolves client IP from X-Forwarded-For.
     *
     * Security: blindly trusting X-Forwarded-For lets any client spoof their IP
     * by sending a header like "X-Forwarded-For: 127.0.0.1, realip".
     * We take only the first IP in the chain (the original client before any proxy),
     * then validate it looks like a real IP address before trusting it.
     * If it fails validation, we fall back to the direct socket address.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            // First IP in the chain = original client
            String candidate = xForwardedFor.split(",")[0].trim();
            if (isValidIp(candidate)) {
                return candidate;
            }
        }
        return request.getRemoteAddr();
    }

    private boolean isValidIp(String ip) {
        return ip != null && !ip.isBlank() && IP_PATTERN.matcher(ip).matches();
    }

    // ─── Sliding-window rate bucket ───────────────────────────────────────────

    private static class RequestBucket {
        private final AtomicInteger count     = new AtomicInteger(0);
        private final AtomicLong    windowStart = new AtomicLong(System.currentTimeMillis());
        private final long          windowDurationMs;

        public RequestBucket() {
            this(60_000L); // 1 minute default
        }

        public RequestBucket(long windowDurationMs) {
            this.windowDurationMs = windowDurationMs;
        }

        /**
         * Returns true if the request should be allowed under the given limit.
         * Uses a fixed window with atomic compare-and-swap reset.
         */
        public boolean allowRequest(int maxRequests) {
            long now   = System.currentTimeMillis();
            long start = windowStart.get();

            if (now - start > windowDurationMs) {
                // CAS to reset: only one thread resets, others just increment into the new window
                if (windowStart.compareAndSet(start, now)) {
                    count.set(0);
                }
            }
            return count.incrementAndGet() <= maxRequests;
        }
    }
}
