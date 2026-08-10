package com.medicos.backend.security;

import com.medicos.backend.config.TenantSessionBinder;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Transactional wrapper for user lookup in the JWT authentication filter.
 *
 * Problem: JwtAuthenticationFilter calls userRepository.findById() before the user
 * is authenticated. RlsAwareJpaTransactionManager reads from SecurityContextHolder
 * to bind app.current_hospital_id — but SecurityContextHolder is empty at this point,
 * so the session variable is never set, RLS throws, and the exception is silently caught,
 * leaving the request unauthenticated.
 *
 * Solution: The hospitalId is already embedded in the JWT (put there at token generation
 * time). We extract it before the DB query and call TenantSessionBinder.bindTenant()
 * within the SAME @Transactional context as the findById() call. Both operations share
 * the same JDBC connection, so SET LOCAL takes effect before the RLS-guarded SELECT.
 */
@Service
public class JwtUserLookupService {

    private final UserRepository userRepository;
    private final TenantSessionBinder tenantSessionBinder;

    public JwtUserLookupService(UserRepository userRepository, TenantSessionBinder tenantSessionBinder) {
        this.userRepository = userRepository;
        this.tenantSessionBinder = tenantSessionBinder;
    }

    /**
     * Looks up a User by ID within a transaction that first binds the RLS tenant context
     * using the hospitalId extracted directly from the validated JWT claims.
     *
     * This breaks the circular dependency: we don't need the authenticated user to know
     * the hospitalId (it's in the token), and we don't need the DB to authenticate the user.
     */
    @Transactional(readOnly = true)
    public Optional<User> findUserByIdWithTenant(String userId, String hospitalId) {
        if (hospitalId != null && !hospitalId.isBlank()) {
            tenantSessionBinder.bindTenant(hospitalId);
        }
        return userRepository.findById(userId);
    }
}
