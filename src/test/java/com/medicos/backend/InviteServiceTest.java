package com.medicos.backend;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.dto.InviteDTO;
import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import com.medicos.backend.service.AuditLogService;
import com.medicos.backend.service.InviteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InviteServiceTest {

    private UserRepository userRepository;
    private HospitalRepository hospitalRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider tokenProvider;
    private TenantSessionBinder tenantSessionBinder;
    private AuditLogService auditLogService;
    private com.medicos.backend.licensing.LicenseService licenseService;
    private InviteService inviteService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        hospitalRepository = mock(HospitalRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        tokenProvider = mock(JwtTokenProvider.class);
        tenantSessionBinder = mock(TenantSessionBinder.class);
        auditLogService = mock(AuditLogService.class);
        licenseService = mock(com.medicos.backend.licensing.LicenseService.class);

        when(passwordEncoder.encode(any())).thenReturn("$2a$12$mockEncodedPasswordForTestingOnly");
        when(tokenProvider.generateToken(any(), any(), any(), any())).thenReturn("mock.jwt.token");

        inviteService = new InviteService(
                userRepository,
                hospitalRepository,
                passwordEncoder,
                tokenProvider,
                tenantSessionBinder,
                auditLogService,
                licenseService
        );
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void sendInvite_generatesHashedTokenAndSets48HourExpiration() {
        User admin = new User();
        admin.setId("usr-admin-001");
        admin.setName("Admin Officer");
        admin.setHospitalId("hsp-001");
        admin.setRole("admin");

        Hospital hospital = new Hospital();
        hospital.setId("hsp-001");
        hospital.setName("Medbuilds General Hospital");

        when(hospitalRepository.findById("hsp-001")).thenReturn(Optional.of(hospital));
        when(userRepository.findByEmail("doctor.new@hospital.com")).thenReturn(Optional.empty());

        InviteDTO.SendInviteRequest req = new InviteDTO.SendInviteRequest();
        req.setEmail("doctor.new@hospital.com");
        req.setName("Dr. New Doctor");
        req.setRole("doctor");
        req.setHospitalId("hsp-001");
        req.setSpecialization("Cardiology");

        inviteService.sendInvite(req, admin);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();

        assertEquals("doctor.new@hospital.com", savedUser.getEmail());
        assertEquals("doctor", savedUser.getRole());
        assertEquals("hsp-001", savedUser.getHospitalId());
        assertEquals("Cardiology", savedUser.getSpecialization());
        assertTrue(savedUser.getIsInvited());
        assertNotNull(savedUser.getInviteTokenHash());
        assertEquals(64, savedUser.getInviteTokenHash().length()); // SHA-256 hex length
        assertNotNull(savedUser.getInviteTokenExpires());
        assertTrue(savedUser.getInviteTokenExpires().isAfter(OffsetDateTime.now().plusHours(47)));
        assertTrue(savedUser.getInviteTokenExpires().isBefore(OffsetDateTime.now().plusHours(49)));
    }

    @Test
    void validateToken_returnsValidDetailsForUnexpiredToken() {
        String rawToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";
        String tokenHash = sha256(rawToken);

        User user = new User();
        user.setId("usr-002");
        user.setName("Nurse Kelly");
        user.setEmail("kelly@hospital.com");
        user.setRole("nurse");
        user.setHospitalId("hsp-001");
        user.setInviteTokenHash(tokenHash);
        user.setInviteTokenExpires(OffsetDateTime.now().plusHours(24));

        Hospital hospital = new Hospital();
        hospital.setId("hsp-001");
        hospital.setName("Medbuilds City Clinic");

        when(userRepository.findByInviteTokenHash(tokenHash)).thenReturn(Optional.of(user));
        when(hospitalRepository.findById("hsp-001")).thenReturn(Optional.of(hospital));

        InviteDTO.ValidateResponse response = inviteService.validateToken(rawToken);

        assertTrue(response.isValid());
        assertEquals("kelly@hospital.com", response.getEmail());
        assertEquals("Nurse Kelly", response.getName());
        assertEquals("nurse", response.getRole());
        assertEquals("Medbuilds City Clinic", response.getHospitalName());
    }

    @Test
    void validateToken_returnsInvalidForExpiredToken() {
        String rawToken = "expiredtoken123456789abcdef0123456789abcdef0123456789abcdef0123456";
        String tokenHash = sha256(rawToken);

        User user = new User();
        user.setId("usr-003");
        user.setEmail("old@hospital.com");
        user.setInviteTokenHash(tokenHash);
        user.setInviteTokenExpires(OffsetDateTime.now().minusHours(2)); // Expired 2 hours ago

        when(userRepository.findByInviteTokenHash(tokenHash)).thenReturn(Optional.of(user));

        InviteDTO.ValidateResponse response = inviteService.validateToken(rawToken);

        assertFalse(response.isValid());
        assertTrue(response.getMessage().contains("expired"));
    }

    @Test
    void acceptInvite_setsPasswordAndClearsTokenForReplayPrevention() {
        String rawToken = "rawtokentoaccept123456789abcdef0123456789abcdef0123456789abcdef012";
        String tokenHash = sha256(rawToken);

        User user = new User();
        user.setId("usr-004");
        user.setName("Dr. John Smith");
        user.setEmail("john.smith@hospital.com");
        user.setRole("doctor");
        user.setHospitalId("hsp-001");
        user.setInviteTokenHash(tokenHash);
        user.setInviteTokenExpires(OffsetDateTime.now().plusHours(12));

        when(userRepository.findByInviteTokenHash(tokenHash)).thenReturn(Optional.of(user));

        InviteDTO.AcceptRequest req = new InviteDTO.AcceptRequest();
        req.setToken(rawToken);
        req.setPassword("SecureDoctorPass123!");

        InviteDTO.AcceptResponse response = inviteService.acceptInvite(req);

        assertNotNull(response.getToken());
        assertEquals("mock.jwt.token", response.getToken());
        assertEquals("john.smith@hospital.com", response.getUser().getEmail());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User updated = captor.getValue();

        // Token must be cleared to prevent replay attack
        assertNull(updated.getInviteTokenHash());
        assertNull(updated.getInviteTokenExpires());
        assertEquals(1, updated.getIsActive());
        assertEquals("$2a$12$mockEncodedPasswordForTestingOnly", updated.getPassword());
    }

    @Test
    void acceptInvite_throwsExceptionIfPasswordTooShort() {
        InviteDTO.AcceptRequest req = new InviteDTO.AcceptRequest();
        req.setToken("sometoken");
        req.setPassword("short");

        assertThrows(BadRequestException.class, () -> inviteService.acceptInvite(req));
    }

    @Test
    void onboardHospitalAndInviteAdmin_provisionsHospitalAndSendsAdminOnlyInvite() {
        User superAdmin = new User();
        superAdmin.setId("usr-super-001");
        superAdmin.setName("Platform Master");
        superAdmin.setRole("admin");
        superAdmin.setHospitalId("hsp-001");

        InviteDTO.OnboardHospitalRequest req = new InviteDTO.OnboardHospitalRequest();
        req.setHospitalName("Metro Specialist Hospital");
        req.setCity("Bengaluru");
        req.setPhone("+91-80-12345678");
        req.setAdminName("Dr. Vikram (Medical Director)");
        req.setAdminEmail("vikram@metrohospital.org");

        when(userRepository.findByEmail("vikram@metrohospital.org")).thenReturn(Optional.empty());
        when(hospitalRepository.save(any(Hospital.class))).thenAnswer(inv -> {
            Hospital h = inv.getArgument(0);
            when(hospitalRepository.findById(h.getId())).thenReturn(Optional.of(h));
            return h;
        });

        java.util.Map<String, Object> result = inviteService.onboardHospitalAndInviteAdmin(req, superAdmin);

        assertNotNull(result.get("hospital_id"));
        assertEquals("Metro Specialist Hospital", result.get("hospital_name"));
        assertEquals("vikram@metrohospital.org", result.get("admin_email"));

        // Verify Hospital saved
        ArgumentCaptor<Hospital> hCaptor = ArgumentCaptor.forClass(Hospital.class);
        verify(hospitalRepository).save(hCaptor.capture());
        Hospital savedHospital = hCaptor.getValue();
        assertEquals("Metro Specialist Hospital", savedHospital.getName());
        assertEquals("TRIAL", savedHospital.getSubscriptionPlan());

        // Verify User invited with role='admin'
        ArgumentCaptor<User> uCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(uCaptor.capture());
        User invitedAdmin = uCaptor.getValue();
        assertEquals("vikram@metrohospital.org", invitedAdmin.getEmail());
        assertEquals("admin", invitedAdmin.getRole());
        assertEquals(savedHospital.getId(), invitedAdmin.getHospitalId());
        assertTrue(invitedAdmin.getIsInvited());
    }
}
