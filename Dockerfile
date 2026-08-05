# Multi-stage Dockerfile for production-ready containerization

# --- Stage 1: Build the application ---
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Copy pom.xml and dependencies metadata to cache Maven layers
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy the entire project source and build static frontend & java package
COPY . .
RUN mvn clean package -DskipTests -B

# --- Stage 2: Create the lightweight runtime container ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as a non-privileged user for security hardening
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy the built JAR from the builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose HTTP port
EXPOSE 8080

# Configure JVM production memory limits and start application
ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
