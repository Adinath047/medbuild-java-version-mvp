package com.medicos.backend.exception;

import com.medicos.backend.dto.ErrorResponseDTO;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;

/**
 * Centralized exception handler.
 *
 * Security rules:
 *  - Known exceptions (404, 400, 401, 403) return the exception's own message — safe to expose.
 *  - Unknown/internal exceptions (500) NEVER return ex.getMessage() to the client.
 *    Raw messages from DB drivers, Hibernate, or internal APIs can reveal schema, table names,
 *    query structure, or stack frames that help attackers. We log the full detail server-side
 *    and return only a generic "An internal server error occurred." to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final com.medicos.backend.telemetry.TelemetryReporter telemetryReporter;

    public GlobalExceptionHandler(com.medicos.backend.telemetry.TelemetryReporter telemetryReporter) {
        this.telemetryReporter = telemetryReporter;
    }

    // ─── 404 Not Found ────────────────────────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponseDTO> handleNotFound(
            ResourceNotFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    // ─── 400 Bad Request ─────────────────────────────────────────────────────

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponseDTO> handleBadRequest(
            BadRequestException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponseDTO> handleIllegalArgument(
            IllegalArgumentException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    /** @Valid validation failures — returns field-level messages, safe to expose. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDTO> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return build(HttpStatus.BAD_REQUEST, message, request);
    }

    /** Malformed JSON request bodies. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponseDTO> handleMalformedJson(
            HttpMessageNotReadableException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Malformed or missing request body.", request);
    }

    /** Missing required @RequestParam. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponseDTO> handleMissingParam(
            MissingServletRequestParameterException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Missing required parameter: " + ex.getParameterName(), request);
    }

    /** Path variable type mismatch (e.g. non-numeric ID). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponseDTO> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Invalid value for parameter: " + ex.getName(), request);
    }

    // ─── 401 Unauthorized ─────────────────────────────────────────────────────

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponseDTO> handleUnauthorized(
            UnauthorizedException ex, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), request);
    }

    // ─── 403 Forbidden ────────────────────────────────────────────────────────

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponseDTO> handleForbidden(
            ForbiddenException ex, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage(), request);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponseDTO> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, "Access Denied: " + ex.getMessage(), request);
    }

    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<ErrorResponseDTO> handleAuthentication(
            org.springframework.security.core.AuthenticationException ex, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "Authentication failed: " + ex.getMessage(), request);
    }

    // ─── 500 Internal Server Error ────────────────────────────────────────────

    /**
     * SECURITY: Never expose ex.getMessage() for unknown exceptions.
     * Raw messages from Hibernate, PostgreSQL JDBC, or third-party libraries can
     * contain table names, column names, SQL query fragments, or stack frames —
     * all useful to an attacker. Log the full detail server-side only.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDTO> handleAll(
            Exception ex, HttpServletRequest request) {
        // Full detail logged for ops/debugging — never sent to client
        log.error("Unhandled exception on {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
        
        // CATCH #2: Dispatch request-level error telemetry to monitoring tool immediately
        if (telemetryReporter != null) {
            telemetryReporter.reportRequestError(request, ex, HttpStatus.INTERNAL_SERVER_ERROR.value());
        }

        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "An internal server error occurred. Please try again later.", request);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private ResponseEntity<ErrorResponseDTO> build(HttpStatus status, String message, HttpServletRequest request) {
        ErrorResponseDTO error = new ErrorResponseDTO(
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, status);
    }
}
