package com.medicos.backend.exception;

/**
 * Thrown when a principal is authenticated but lacks permission for a specific resource.
 * Maps to HTTP 403 Forbidden (as opposed to 401 Unauthorized which means not authenticated).
 */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
