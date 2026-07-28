package com.medicos.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class MfaBypassSecurityTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    public void setUp() {
        jwtTokenProvider = new JwtTokenProvider();
        // Reflectively set secret for testing if needed
    }

    @Test
    public void testMfaBypassTokenRejectedForEphiAccess() {
        // Token generated after password authentication BUT WITHOUT completing MFA step
        String unverifiedMfaToken = jwtTokenProvider.generateToken("USER-DR-55", "dr.smith@clinic.com", "DOCTOR", "HOSPITAL-A", false);

        assertNotNull(unverifiedMfaToken);
        assertTrue(jwtTokenProvider.validateToken(unverifiedMfaToken));

        boolean isMfaVerified = jwtTokenProvider.isMfaVerifiedFromToken(unverifiedMfaToken);
        assertFalse(isMfaVerified, "2026 HIPAA Security Rule: Tokens lacking MFA verification must be rejected for ePHI endpoints");
    }

    @Test
    public void testMfaVerifiedTokenAccepted() {
        String verifiedMfaToken = jwtTokenProvider.generateToken("USER-DR-55", "dr.smith@clinic.com", "DOCTOR", "HOSPITAL-A", true);

        assertTrue(jwtTokenProvider.validateToken(verifiedMfaToken));
        assertTrue(jwtTokenProvider.isMfaVerifiedFromToken(verifiedMfaToken));
    }
}
