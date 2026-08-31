package com.medicos.backend.repository;

import com.medicos.backend.entity.TenantSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantSubscriptionRepository extends JpaRepository<TenantSubscription, String> {
    Optional<TenantSubscription> findByTenantId(String tenantId);

    @Query(value = "SELECT * FROM tenant_subscriptions WHERE status != 'archived' AND status != 'paid' FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<TenantSubscription> findAllActiveForUpdate();
}
