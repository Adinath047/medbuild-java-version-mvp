package com.medicos.backend.repository;

import com.medicos.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    List<User> findByHospitalId(String hospitalId);
    List<User> findByRole(String role);
    List<User> findByHospitalIdAndRole(String hospitalId, String role);
    Optional<User> findByLicenseNumber(String licenseNumber);
    Optional<User> findByInviteTokenHash(String inviteTokenHash);
    List<User> findByRoleAndIsActive(String role, Integer isActive);
    List<User> findByRoleAndDistrictIgnoreCaseAndIsActive(String role, String district, Integer isActive);

    /**
     * Finds all users who were invited but never accepted the invite,
     * and whose invite token has now expired. Used by the nightly
     * InviteExpiryReminderJob to notify hospital admins.
     *
     * Runs under GLOBAL RLS context — must be called after bindTenant("GLOBAL").
     */
    @Query("SELECT u FROM User u WHERE u.isInvited = true AND u.isActive = 0 " +
           "AND u.inviteTokenExpires IS NOT NULL AND u.inviteTokenExpires < :now")
    List<User> findExpiredPendingInvites(@Param("now") OffsetDateTime now);
}
