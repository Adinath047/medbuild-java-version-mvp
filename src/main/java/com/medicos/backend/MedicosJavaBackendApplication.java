package com.medicos.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MedicosJavaBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(MedicosJavaBackendApplication.class, args);
        System.out.println("\n" +
                "======================================================================\n" +
                "  🩺 MEDICOS HOSPITAL EMR — JAVA SPRING BOOT BACKEND STARTED         \n" +
                "  Database: PostgreSQL                                                \n" +
                "  Port    : 8080                                                      \n" +
                "  API Base: http://localhost:8080/api                                 \n" +
                "======================================================================\n");
    }
}
