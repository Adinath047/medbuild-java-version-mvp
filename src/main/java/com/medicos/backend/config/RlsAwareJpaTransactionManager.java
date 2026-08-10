package com.medicos.backend.config;

import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Patient;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionSystemException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.SQLException;

public class RlsAwareJpaTransactionManager extends JpaTransactionManager {

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {
        super.doBegin(transaction, definition);

        String hospitalId = getCurrentHospitalId();
        if (hospitalId != null && !hospitalId.trim().isEmpty()) {
            DataSource dataSource = getDataSource();
            if (dataSource != null) {
                Connection connection = DataSourceUtils.getConnection(dataSource);
                try (PreparedStatement ps = connection.prepareStatement("SELECT set_config('app.current_hospital_id', ?, true)")) {
                    ps.setString(1, hospitalId);
                    ps.execute();
                } catch (SQLException e) {
                    throw new TransactionSystemException("Could not set RLS tenant context for transaction", e);
                } finally {
                    DataSourceUtils.releaseConnection(connection, dataSource);
                }
            }
        }
    }

    private String getCurrentHospitalId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof User) {
                return ((User) principal).getHospitalId();
            } else if (principal instanceof Patient) {
                return ((Patient) principal).getHospitalId();
            }
        }
        return null;
    }
}
