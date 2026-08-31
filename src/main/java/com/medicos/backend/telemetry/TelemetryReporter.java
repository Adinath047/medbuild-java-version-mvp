package com.medicos.backend.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.security.TenantContext;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * TelemetryReporter — Core "Catch and Report" loop for Medicos EMR.
 * Dispatches real-time incident reports to the Command Center monitoring tool.
 */
@Component
public class TelemetryReporter {

    private static final Logger log = LoggerFactory.getLogger(TelemetryReporter.class);
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private static final ObjectMapper mapper = new ObjectMapper();

    private static String staticMonitoringUrl = "http://localhost:4000/api/telemetry";

    @Value("${monitoring.telemetry.url:http://localhost:4000/api/telemetry}")
    private String monitoringUrl;

    @PostConstruct
    public void init() {
        staticMonitoringUrl = this.monitoringUrl;
        log.info("TelemetryReporter initialized. Monitoring endpoint: {}", staticMonitoringUrl);
    }

    /**
     * CATCH #1: Outright application crash or uncaught fatal thread exception.
     */
    public static void reportFatalCrash(Thread thread, Throwable throwable) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "PROCESS_CRASH");
            payload.put("severity", "CRITICAL");
            payload.put("service", "medicos-java-backend");
            payload.put("threadName", thread != null ? thread.getName() : "main");
            payload.put("threadId", thread != null ? thread.getId() : 1);
            payload.put("exceptionClass", throwable.getClass().getName());
            payload.put("message", throwable.getMessage());
            payload.put("stackTrace", getStackTraceAsString(throwable));
            payload.put("occurredAt", Instant.now().toString());

            Map<String, Object> sysInfo = new HashMap<>();
            sysInfo.put("availableProcessors", Runtime.getRuntime().availableProcessors());
            sysInfo.put("freeMemoryBytes", Runtime.getRuntime().freeMemory());
            sysInfo.put("totalMemoryBytes", Runtime.getRuntime().totalMemory());
            payload.put("systemState", sysInfo);

            String json = mapper.writeValueAsString(payload);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(staticMonitoringUrl + "/crash"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(3))
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            // Synchronous block on crash to guarantee delivery before JVM exits
            httpClient.send(req, HttpResponse.BodyHandlers.discarding());
            log.info("Sent crash telemetry report to {}", staticMonitoringUrl + "/crash");
        } catch (Throwable t) {
            log.error("Failed to dispatch crash report to monitoring tool: {}", t.getMessage());
        }
    }

    /**
     * CATCH #2: A specific request fails upstream (Controller / Service / DB level).
     */
    public void reportRequestError(HttpServletRequest request, Exception ex, int statusCode) {
        CompletableFuture.runAsync(() -> {
            try {
                String tenantId = TenantContext.getTenantId();
                if (tenantId == null && request != null) {
                    tenantId = request.getHeader("X-Tenant-ID");
                }

                Map<String, Object> payload = new HashMap<>();
                payload.put("type", "REQUEST_FAILURE");
                payload.put("severity", statusCode >= 500 ? "ERROR" : "WARN");
                payload.put("service", "medicos-java-backend");
                payload.put("statusCode", statusCode);
                payload.put("path", request != null ? request.getRequestURI() : "/");
                payload.put("method", request != null ? request.getMethod() : "GET");
                payload.put("queryString", request != null ? request.getQueryString() : null);
                payload.put("tenantId", tenantId != null ? tenantId : "GLOBAL");
                payload.put("clientIp", request != null ? request.getRemoteAddr() : "unknown");
                payload.put("exceptionClass", ex.getClass().getName());
                payload.put("message", ex.getMessage());
                payload.put("stackTrace", getStackTraceAsString(ex));
                payload.put("occurredAt", Instant.now().toString());

                String json = mapper.writeValueAsString(payload);

                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(monitoringUrl + "/errors"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(3))
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build();

                httpClient.sendAsync(req, HttpResponse.BodyHandlers.discarding())
                        .thenAccept(res -> {
                            if (res.statusCode() >= 400) {
                                log.warn("Monitoring tool returned {} when logging request error", res.statusCode());
                            }
                        })
                        .exceptionally(t -> {
                            log.debug("Telemetry dispatch error: {}", t.getMessage());
                            return null;
                        });
            } catch (Exception e) {
                log.debug("Failed to build telemetry request error payload: {}", e.getMessage());
            }
        });
    }

    /**
     * CATCH #3 (Pulse helper): Proactive heartbeat packet.
     */
    public void sendHeartbeat(Map<String, Object> healthInfo) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("type", "HEARTBEAT");
                payload.put("service", "medicos-java-backend");
                payload.put("status", "UP");
                payload.put("timestamp", Instant.now().toString());
                payload.put("health", healthInfo);

                String json = mapper.writeValueAsString(payload);

                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(monitoringUrl + "/heartbeat"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(2))
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build();

                httpClient.sendAsync(req, HttpResponse.BodyHandlers.discarding());
            } catch (Exception ignored) {
            }
        });
    }

    private static String getStackTraceAsString(Throwable throwable) {
        if (throwable == null) return "";
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        throwable.printStackTrace(pw);
        return sw.toString();
    }
}
