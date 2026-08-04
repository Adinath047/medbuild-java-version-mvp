package com.medicos.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import javax.sql.DataSource;

@Configuration
@ConditionalOnProperty(name = "INSTANCE_CONNECTION_NAME")
public class CloudSqlConfig {

    private static final String INSTANCE_CONNECTION_NAME = System.getenv("INSTANCE_CONNECTION_NAME");
    private static final String DB_USER = System.getenv("DB_USER");
    private static final String DB_PASS = System.getenv("DB_PASS");
    private static final String DB_NAME = System.getenv("DB_NAME");

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        config.setJdbcUrl(String.format("jdbc:postgresql:///%s?prepareThreshold=0", DB_NAME));
        config.setUsername(DB_USER);
        config.setPassword(DB_PASS);

        config.addDataSourceProperty("socketFactory", "com.google.cloud.sql.postgres.SocketFactory");
        config.addDataSourceProperty("cloudSqlInstance", INSTANCE_CONNECTION_NAME);
        config.addDataSourceProperty("ipTypes", "PUBLIC,PRIVATE");
        config.addDataSourceProperty("cloudSqlRefreshStrategy", "lazy");

        config.setDriverClassName("org.postgresql.Driver");

        return new HikariDataSource(config);
    }
}
