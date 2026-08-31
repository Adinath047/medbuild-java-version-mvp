package com.medicos.backend;

import com.medicos.backend.telemetry.TelemetryReporter;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableCaching
@EnableTransactionManagement
public class MedicosJavaBackendApplication {

    public static void main(String[] args) {
        System.setProperty("io.netty.noUnsafe", "true");

        // CATCH #1: Process-level safety net for unhandled thread exceptions and crashes
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            System.err.printf("[CRASH-SAFETY-NET] Uncaught exception in thread '%s': %s%n",
                    thread.getName(), throwable.getMessage());
            TelemetryReporter.reportFatalCrash(thread, throwable);
        });

        SpringApplication.run(MedicosJavaBackendApplication.class, args);
        System.out.println("\n" +
                "======================================================================\n" +
                "  🩺 MEDICOS HOSPITAL EMR — JAVA SPRING BOOT BACKEND STARTED         \n" +
                "  ACID Transactions : Enabled (Atomicity, Consistency, Isolation, Durability)\n" +
                "  Telemetry Safety Net: Active (Catch & Report Loop Connected)        \n" +
                "  Database         : PostgreSQL                                       \n" +
                "  Port             : 8080                                             \n" +
                "  API Base         : http://localhost:8080/api                        \n" +
                "  Swagger Docs     : http://localhost:8080/swagger-ui.html            \n" +
                "======================================================================\n");
    }
}
