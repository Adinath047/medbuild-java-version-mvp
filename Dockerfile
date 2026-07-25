# Multi-stage Dockerfile optimized for Google Cloud Run & GCP Container Registry / Artifact Registry
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy dependency descriptors first for layer caching
COPY pom.xml .
COPY frontend ./frontend
COPY src ./src

# Build production jar skipping tests for fast image builds
RUN mvn clean package -DskipTests

# Runtime stage using lightweight JRE Alpine
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Security: Create non-root user for Cloud Run compliance
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifact dynamically
COPY --from=build /app/target/*.jar app.jar
RUN chown -R appuser:appgroup /app

USER appuser

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

# Cloud Run requirement: Use 'exec' so SIGTERM is forwarded directly to the Java process
ENTRYPOINT ["sh", "-c", "exec java -Dserver.address=0.0.0.0 -Dserver.port=${PORT:-8080} -Djava.security.egd=file:/dev/./urandom -jar app.jar"]

