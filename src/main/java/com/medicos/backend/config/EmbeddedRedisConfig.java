package com.medicos.backend.config;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import redis.embedded.RedisServer;

import java.io.IOException;
import java.net.Socket;

@Configuration
@ConditionalOnProperty(name = "spring.embedded.redis.enabled", havingValue = "true", matchIfMissing = true)
public class EmbeddedRedisConfig {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedRedisConfig.class);

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    private RedisServer redisServer;

    @PostConstruct
    public void startRedis() {
        // Skip in Cloud Run container environments where external services or in-memory caches are used
        if (System.getenv("K_SERVICE") != null || "false".equalsIgnoreCase(System.getenv("SPRING_EMBEDDED_REDIS_ENABLED"))) {
            log.info("ℹ️ Cloud Run / Production container detected. Skipping embedded Redis startup.");
            return;
        }

        if (isPortInUse(redisPort)) {
            log.info("ℹ️ Redis server is already active on port {}. Skipping embedded Redis startup.", redisPort);
            return;
        }

        try {
            redisServer = new RedisServer(redisPort);
            redisServer.start();
            log.info("======================================================================");
            log.info("🚀 EMBEDDED REDIS SERVER STARTED AUTOMATICALLY ON PORT {}!", redisPort);
            log.info("======================================================================");
        } catch (Throwable e) {
            log.warn("Could not start Embedded Redis Server on port {} (continuing without embedded Redis): {}", redisPort, e.getMessage());
        }
    }

    @PreDestroy
    public void stopRedis() {
        if (redisServer != null && redisServer.isActive()) {
            try {
                redisServer.stop();
                log.info("🛑 Embedded Redis Server stopped successfully.");
            } catch (Exception e) {
                log.warn("Error stopping Embedded Redis Server: {}", e.getMessage());
            }
        }
    }

    private boolean isPortInUse(int port) {
        try (Socket socket = new Socket("localhost", port)) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
