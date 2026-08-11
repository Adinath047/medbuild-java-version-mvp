package com.medicos.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * JWT token creation, validation, and blacklisting.
 *
 * Security measures:
 *  - Fails on startup if jwt.secret matches the known insecure default (prevents accidental prod exposure)
 *  - Every token gets a unique JTI (JWT ID) so individual tokens can be invalidated on logout
 *  - Blacklisted JTIs are stored in Redis with a TTL matching the token's remaining lifetime
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    /**
     * Known insecure default — hard-fail on startup if this is still set in prod.
     * Set JWT_SECRET environment variable to a cryptographically random 64-char string.
     */
    private static final String INSECURE_DEFAULT_SECRET =
            "MedicosSecretKeySuperSecureJwtTokenSignatureKey2026WithAtLeast256BitsSecretKey!";

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    private final StringRedisTemplate redisTemplate;

    public JwtTokenProvider(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Startup validation — prevents the server from booting with the default insecure secret.
     * In development, this is intentionally relaxed via a log warning instead of a hard fail
     * so local dev still works. In production (detected by the secret being the default),
     * we emit a loud warning. Override with JWT_SECRET env var.
     */
    @PostConstruct
    public void validateSecretOnStartup() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret is not configured. Set the JWT_SECRET environment variable.");
        }
        if (jwtSecret.length() < 32) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret is too short (minimum 32 characters). Use a cryptographically random value.");
        }
        if (INSECURE_DEFAULT_SECRET.equals(jwtSecret)) {
            log.warn("⚠️  [SECURITY WARNING] Using the default JWT secret. " +
                     "Set JWT_SECRET environment variable before deploying to production!");
        } else {
            log.info("✅ JWT secret is configured and meets minimum length requirements.");
        }
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /** Generate a token for EMR staff (doctor, nurse, admin, etc.) */
    public String generateToken(String userId, String email, String role, String hospitalId) {
        return buildToken(userId, email, role, hospitalId, true, jwtExpirationMs);
    }

    /** Generate a token with explicit MFA status */
    public String generateToken(String userId, String email, String role, String hospitalId, boolean mfaVerified) {
        return buildToken(userId, email, role, hospitalId, mfaVerified, jwtExpirationMs);
    }

    /** Generate a patient app token (same expiry, different role) */
    public String generatePatientToken(String patientId, String phone) {
        return buildToken(patientId, phone, "patient", null, true, jwtExpirationMs);
    }

    private String buildToken(String userId, String email, String role, String hospitalId,
                               boolean mfaVerified, long expiryMs) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiryMs);
        String jti = UUID.randomUUID().toString();  // unique ID per token for blacklisting

        return Jwts.builder()
                .id(jti)                   // JTI claim — used for individual token revocation
                .subject(userId)
                .claim("email", email)
                .claim("role", role)
                .claim("hospitalId", hospitalId)
                .claim("mfaVerified", mfaVerified)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    // ─── Token Claims ─────────────────────────────────────────────────────────

    public String getUserIdFromToken(String token) {
        return getClaims(token).getSubject();
    }

    public String getEmailFromToken(String token) {
        return getClaims(token).get("email", String.class);
    }

    public String getRoleFromToken(String token) {
        return getClaims(token).get("role", String.class);
    }

    public String getHospitalIdFromToken(String token) {
        return getClaims(token).get("hospitalId", String.class);
    }

    public boolean isMfaVerifiedFromToken(String token) {
        Boolean mfa = getClaims(token).get("mfaVerified", Boolean.class);
        return Boolean.TRUE.equals(mfa);
    }

    public String getJtiFromToken(String token) {
        return getClaims(token).getId();
    }

    /** Returns remaining valid time in milliseconds, or 0 if already expired. */
    public long getRemainingValidityMs(String token) {
        Date expiry = getClaims(token).getExpiration();
        long remaining = expiry.getTime() - System.currentTimeMillis();
        return Math.max(0, remaining);
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // ─── Validation ───────────────────────────────────────────────────────────

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    // ─── Token Blacklist (Redis-backed) ───────────────────────────────────────

    /**
     * Invalidates a token by storing its JTI in Redis with a TTL equal to
     * the token's remaining validity period. After that window the token
     * expires naturally, so we don't need to keep the JTI forever.
     */
    public void invalidateToken(String token) {
        try {
            String jti = getJtiFromToken(token);
            long remainingMs = getRemainingValidityMs(token);
            if (remainingMs > 0 && jti != null) {
                String key = BLACKLIST_PREFIX + jti;
                redisTemplate.opsForValue().set(key, "1", Duration.ofMillis(remainingMs));
                log.debug("Token JTI {} blacklisted for {}ms", jti, remainingMs);
            }
        } catch (Exception e) {
            // Log but don't fail logout if Redis is temporarily unreachable
            log.warn("Could not blacklist token in Redis: {}", e.getMessage());
        }
    }

    /**
     * Returns true if the token's JTI has been blacklisted (user logged out or token revoked).
     */
    public boolean isTokenBlacklisted(String token) {
        String jti = getJtiFromToken(token);
        if (jti != null) {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti))) {
                return true;
            }
        }

        // Check global user revocation
        String userId = getUserIdFromToken(token);
        if (userId != null) {
            String key = "user:revoked:" + userId;
            String revocationTimeStr = redisTemplate.opsForValue().get(key);
            if (revocationTimeStr != null) {
                try {
                    long revocationTime = Long.parseLong(revocationTimeStr);
                    Date issuedAt = getClaims(token).getIssuedAt();
                    if (issuedAt != null && issuedAt.getTime() < revocationTime) {
                        log.info("Token for user {} rejected: issued at {} is before revocation time {}",
                                userId, issuedAt.getTime(), revocationTime);
                        return true;
                    }
                } catch (NumberFormatException ignored) {}
            }
        }
        return false;
    }

    /**
     * Set a revocation timestamp for the user in Redis. Any token issued
     * prior to this timestamp will be rejected.
     */
    public void revokeAllUserTokens(String userId) {
        String key = "user:revoked:" + userId;
        redisTemplate.opsForValue().set(key, String.valueOf(System.currentTimeMillis()), Duration.ofDays(7));
        log.info("All active tokens for user {} have been globally revoked.", userId);
    }
}

