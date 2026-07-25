package com.medicos.backend.repository;

import com.medicos.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    List<User> findByHospitalId(String hospitalId);
    List<User> findByRole(String role);
    List<User> findByHospitalIdAndRole(String hospitalId, String role);
    Optional<User> findByLicenseNumber(String licenseNumber);
}
