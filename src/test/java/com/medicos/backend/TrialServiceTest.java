package com.medicos.backend;

import com.medicos.backend.dto.TrialDTO.*;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.service.TrialService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TrialServiceTest {

    private HospitalRepository hospitalRepository;
    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private TrialService trialService;

    @BeforeEach
    void setUp() {
        hospitalRepository = mock(HospitalRepository.class);
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode(any())).thenReturn("encoded_pass");

        trialService = new TrialService(hospitalRepository, userRepository, passwordEncoder);
    }

    @Test
    void signupTrial_createsHospitalWith7DaysTrialAndAdminUser() {
        TrialSignupRequest req = new TrialSignupRequest();
        req.setHospitalName("Metro Health Clinic");
        req.setHospitalType("Specialty");
        req.setAdminName("Dr. Alice");
        req.setAdminEmail("alice@metrohealth.com");
        req.setAdminPassword("Secret123!");
        req.setPhone("9876543210");

        when(hospitalRepository.save(any(Hospital.class))).thenAnswer(i -> i.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(hospitalRepository.findByIdIgnoreCase(anyString())).thenAnswer(i -> {
            Hospital h = new Hospital();
            h.setId(i.getArgument(0));
            h.setName("Metro Health Clinic");
            h.setSubscriptionPlan("TRIAL");
            h.setTrialStartedAt(LocalDateTime.now());
            h.setTrialEndsAt(LocalDateTime.now().plusDays(7));
            h.setTrialStatus("ACTIVE");
            return Optional.of(h);
        });

        TrialStatusResponse res = trialService.signupTrial(req);

        assertNotNull(res);
        assertEquals("ACTIVE", res.getTrialStatus());
        assertEquals("TRIAL", res.getSubscriptionPlan());
        assertTrue(res.getDaysRemaining() >= 6);
        assertFalse(res.isReadOnly());

        ArgumentCaptor<Hospital> hCap = ArgumentCaptor.forClass(Hospital.class);
        verify(hospitalRepository).save(hCap.capture());
        assertEquals("Metro Health Clinic", hCap.getValue().getName());
        assertEquals("ACTIVE", hCap.getValue().getTrialStatus());

        ArgumentCaptor<User> uCap = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(uCap.capture());
        assertEquals("admin", uCap.getValue().getRole());
        assertEquals("alice@metrohealth.com", uCap.getValue().getEmail());
    }

    @Test
    void getTrialStatus_expiredHospital_returnsReadOnly() {
        Hospital h = new Hospital();
        h.setId("hsp-expired");
        h.setName("Expired Clinic");
        h.setSubscriptionPlan("TRIAL");
        h.setTrialStartedAt(LocalDateTime.now().minusDays(10));
        h.setTrialEndsAt(LocalDateTime.now().minusDays(3));
        h.setTrialStatus("EXPIRED");

        when(hospitalRepository.findByIdIgnoreCase("hsp-expired")).thenReturn(Optional.of(h));

        TrialStatusResponse res = trialService.getTrialStatus("hsp-expired", null);

        assertNotNull(res);
        assertEquals("EXPIRED", res.getTrialStatus());
        assertTrue(res.isReadOnly());
        assertEquals(0, res.getDaysRemaining());
    }

    @Test
    void completeTour_marksUserTourCompleted() {
        User user = new User();
        user.setId("usr-123");
        user.setTourCompleted(0);

        when(userRepository.findById("usr-123")).thenReturn(Optional.of(user));

        boolean completed = trialService.completeTour("usr-123");

        assertTrue(completed);
        assertEquals(1, user.getTourCompleted());
        verify(userRepository).save(user);
    }
}
