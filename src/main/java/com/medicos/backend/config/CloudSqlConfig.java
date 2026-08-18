package com.medicos.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import javax.sql.DataSource;

@Configuration
@ConditionalOnProperty(name = "INSTANCE_CONNECTION_NAME")
public class CloudSqlConfig {

    private static final Logger log = LoggerFactory.getLogger(CloudSqlConfig.class);

    @Value("${INSTANCE_CONNECTION_NAME:${spring.cloud.gcp.sql.instance-connection-name:}}")
    private String instanceConnectionName;

    @Value("${DB_USER:${SPRING_DATASOURCE_USERNAME:${spring.datasource.username:postgres}}}")
    private String dbUser;

    @Value("${DB_PASS:${SPRING_DATASOURCE_PASSWORD:${spring.datasource.password:admin}}}")
    private String dbPass;

    @Value("${DB_NAME:${POSTGRES_DB:medbuild_java_mvp}}")
    private String dbName;

    @Bean
    @Primary
    public DataSource dataSource() {
        log.info("Configuring Cloud SQL Socket Factory DataSource for instance: {}", instanceConnectionName);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(String.format("jdbc:postgresql:///%s?prepareThreshold=0", dbName != null ? dbName : "medbuild_java_mvp"));
        config.setUsername(dbUser != null ? dbUser : "postgres");
        config.setPassword(dbPass != null ? dbPass : "");

        config.addDataSourceProperty("socketFactory", "com.google.cloud.sql.postgres.SocketFactory");
        config.addDataSourceProperty("cloudSqlInstance", instanceConnectionName);
        config.addDataSourceProperty("ipTypes", "PUBLIC,PRIVATE");
        config.addDataSourceProperty("cloudSqlRefreshStrategy", "lazy");

        config.setDriverClassName("org.postgresql.Driver");
        config.setPoolName("MedicosCloudSqlHikariCP");
        config.setMaximumPoolSize(20);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(10000);
        config.setIdleTimeout(30000);
        config.setMaxLifetime(1800000);
        config.setLeakDetectionThreshold(15000);

        return new HikariDataSource(config);
    }
}

