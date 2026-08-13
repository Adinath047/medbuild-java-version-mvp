package com.medicos.backend;

import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import com.medicos.backend.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordRotationTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @InjectMocks
    private AuthService authService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("usr-test-001");
        testUser.setName("Test Doctor");
        testUser.setPassword("encodedOldPassword");
    }

    @Test
    void changePassword_success() {
        when(passwordEncoder.matches("oldPassword123", "encodedOldPassword")).thenReturn(true);
        when(passwordEncoder.encode("newSecret456")).thenReturn("encodedNewPassword");

        authService.changePassword(testUser, "oldPassword123", "newSecret456");

        assertEquals("encodedNewPassword", testUser.getPassword());
        verify(userRepository, times(1)).save(testUser);
        verify(tokenProvider, times(1)).revokeAllUserTokens("usr-test-001");
    }

    @Test
    void changePassword_invalidCurrentPassword_throwsException() {
        when(passwordEncoder.matches("wrongPassword", "encodedOldPassword")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> 
            authService.changePassword(testUser, "wrongPassword", "newSecret456")
        );

        verify(userRepository, never()).save(any());
        verify(tokenProvider, never()).revokeAllUserTokens(any());
    }

    @Test
    void changePassword_shortNewPassword_throwsException() {
        assertThrows(BadRequestException.class, () -> 
            authService.changePassword(testUser, "oldPassword123", "123")
        );
    }
}
