package com.medicos.backend.security;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Transactional wrapper for user/patient lookup in the JWT authentication filter.
 *
 * Problem: JwtAuthenticationFilter calls repository.findById() before the request
 * is authenticated. RlsAwareJpaTransactionManager reads from SecurityContextHolder
 * to bind app.current_hospital_id — but SecurityContextHolder is empty at this point,
 * so the session variable is never set, RLS throws, and the exception is caught,
 * leaving the request unauthenticated.
 *
 * Solution: The hospitalId is already embedded in the JWT (put there at token generation
 * time). We extract it before the DB query and call TenantSessionBinder.bindTenant()
 * within the SAME @Transactional context as the findById() call. Both operations share
 * the same JDBC connection, so SET LOCAL takes effect before the RLS-guarded SELECT.
 *
 * This applies to both staff/doctor tokens and patient tokens — both embed hospitalId
 * in the JWT claim at generation time.
 */
@Service
public class JwtUserLookupService {

    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final TenantSessionBinder tenantSessionBinder;

    public JwtUserLookupService(UserRepository userRepository,
                                PatientRepository patientRepository,
                                TenantSessionBinder tenantSessionBinder) {
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.tenantSessionBinder = tenantSessionBinder;
    }

    /**
     * Looks up a staff/doctor User by ID within a transaction that first binds the RLS
     * tenant context using hospitalId extracted directly from the validated JWT claims.
     */
    @Transactional(readOnly = true)
    public Optional<User> findUserByIdWithTenant(String userId, String hospitalId) {
        if (hospitalId != null && !hospitalId.isBlank()) {
            tenantSessionBinder.bindTenant(hospitalId);
        }
        return userRepository.findById(userId);
    }

    /**
     * Looks up a Patient by ID within a transaction that first binds the RLS tenant context.
     * Patient JWTs include hospitalId at generation time (PatientAuthService.verifyOtp),
     * so the same pattern applies as for staff tokens.
     */
    @Transactional(readOnly = true)
    public Optional<Patient> findPatientByIdWithTenant(String patientId, String hospitalId) {
        if (hospitalId != null && !hospitalId.isBlank()) {
            tenantSessionBinder.bindTenant(hospitalId);
        }
        return patientRepository.findById(patientId);
    }
}
