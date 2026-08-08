package com.medicos.backend.config;

import com.medicos.backend.entity.User;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionSystemException;

import javax.sql.DataSource;
import java.sql.Connection;
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
                try (Statement statement = connection.createStatement()) {
                    statement.execute("SET LOCAL app.current_hospital_id = '" + hospitalId + "'");
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
        if (authentication != null && authentication.isAuthenticated() && authentication.getPrincipal() instanceof User) {
            return ((User) authentication.getPrincipal()).getHospitalId();
        }
        return null;
    }
}
