package com.medicos.backend.security;

import com.medicos.backend.entity.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAccountDeactivationTest {

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private JwtUserLookupService jwtUserLookupService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private StringWriter responseBody;

    @BeforeEach
    void setUp() throws Exception {
        responseBody = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
    }

    @Test
    void doFilter_deactivatedUser_returns401Unauthorized() throws Exception {
        String token = "valid.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(tokenProvider.validateToken(token)).thenReturn(true);
        when(tokenProvider.isTokenBlacklisted(token)).thenReturn(false);
        when(tokenProvider.getUserIdFromToken(token)).thenReturn("usr-deactivated-001");
        when(tokenProvider.getRoleFromToken(token)).thenReturn("doctor");
        when(tokenProvider.getHospitalIdFromToken(token)).thenReturn("hsp-001");

        User deactivatedUser = new User();
        deactivatedUser.setId("usr-deactivated-001");
        deactivatedUser.setIsActive(0); // Deactivated

        when(jwtUserLookupService.findUserByIdWithTenant("usr-deactivated-001", "hsp-001"))
                .thenReturn(Optional.of(deactivatedUser));

        jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        assertTrue(responseBody.toString().contains("Account has been deactivated. Access revoked."));
        verify(filterChain, never()).doFilter(request, response);
    }
}
