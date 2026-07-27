package com.medicos.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableCaching
@EnableTransactionManagement
public class MedicosJavaBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(MedicosJavaBackendApplication.class, args);
        System.out.println("\n" +
                "======================================================================\n" +
                "  🩺 MEDICOS HOSPITAL EMR — JAVA SPRING BOOT BACKEND STARTED         \n" +
                "  ACID Transactions : Enabled (Atomicity, Consistency, Isolation, Durability)\n" +
                "  Database         : PostgreSQL                                       \n" +
                "  Port             : 8080                                             \n" +
                "  API Base         : http://localhost:8080/api                        \n" +
                "  Swagger Docs     : http://localhost:8080/swagger-ui.html            \n" +
                "======================================================================\n");
    }
}
