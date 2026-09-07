package com.medicos.backend.exception;

/**
 * Thrown when a security invariant is violated at the infrastructure level —
 * for example, when a non-admin principal carries a GLOBAL hospitalId claim,
 * indicating a corrupted or replayed security context.
 *
 * Maps to HTTP 403 (not 500) via GlobalExceptionHandler. The detail message
 * is logged server-side only; a generic "Access denied." is returned to the client.
 */
public class SecurityViolationException extends RuntimeException {

    public SecurityViolationException(String message) {
        super(message);
    }

    public SecurityViolationException(String message, Throwable cause) {
        super(message, cause);
    }
}
