# Multi-stage Dockerfile optimized for Google Cloud Run & GCP Container Registry / Artifact Registry
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy dependency descriptors first for layer caching
COPY pom.xml .
COPY frontend ./frontend
COPY src ./src

# Build production jar skipping tests for fast image builds
RUN mvn clean package -Dmaven.test.skip=true

# Runtime stage using lightweight JRE Alpine
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Security: Create non-root user for Cloud Run compliance
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built Spring Boot executable jar explicitly (avoids copying original-*.jar)
COPY --from=build /app/target/medicos-java-backend-1.0.0-SNAPSHOT.jar app.jar
RUN chown -R appuser:appgroup /app

USER appuser

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

# ── JVM / GC defaults ─────────────────────────────────────────────────────────
# G1GC with a 200 ms pause target, string deduplication (good for EMR text data).
# Cloud Run / k8s operators can override any flag via the JAVA_OPTS env variable
# without rebuilding the image, e.g.: --env JAVA_OPTS="-Xmx2g -XX:MaxGCPauseMillis=100"
ENV JAVA_OPTS="\
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UseStringDeduplication \
  -Xms256m \
  -Xmx1g \
  -XX:G1HeapRegionSize=4m \
  -XX:InitiatingHeapOccupancyPercent=45 \
  -XX:ConcGCThreads=2 \
  -XX:ParallelGCThreads=4 \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/app/heapdump.hprof"

# Cloud Run: exec so SIGTERM is forwarded directly to the Java process
ENTRYPOINT ["sh", "-c", "exec java \
  $JAVA_OPTS \
  -Dserver.address=0.0.0.0 \
  -Dserver.port=${PORT:-8080} \
  -Djava.security.egd=file:/dev/./urandom \
  -Dio.netty.noUnsafe=true \
  --add-opens=java.base/sun.misc=ALL-UNNAMED \
  -jar app.jar"]


