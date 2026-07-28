package com.medicos.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret:MedicosSecretKeySuperSecureJwtTokenSignatureKey2026WithAtLeast256BitsSecretKey!}")
    private String jwtSecret = "MedicosSecretKeySuperSecureJwtTokenSignatureKey2026WithAtLeast256BitsSecretKey!";

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs = 86400000L;

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String userId, String email, String role, String hospitalId) {
        return generateToken(userId, email, role, hospitalId, true);
    }

    public String generateToken(String userId, String email, String role, String hospitalId, boolean mfaVerified) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
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

    public String getUserIdFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.getSubject();
    }

    public String getEmailFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.get("email", String.class);
    }

    public String getHospitalIdFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.get("hospitalId", String.class);
    }

    public boolean isMfaVerifiedFromToken(String token) {
        Claims claims = getClaims(token);
        Boolean mfa = claims.get("mfaVerified", Boolean.class);
        return Boolean.TRUE.equals(mfa);
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

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
}
