package com.medicos.backend;

import com.medicos.backend.dto.ErrorResponseDTO;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.GlobalExceptionHandler;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.exception.UnauthorizedException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class GlobalExceptionAndOptionalTest {

    private final GlobalExceptionHandler exceptionHandler = new GlobalExceptionHandler();

    @Test
    public void testOptionalOrElseThrowResourceNotFound() {
        Optional<String> emptyOptional = Optional.empty();

        ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class, () -> {
            emptyOptional.orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: pat-999"));
        });

        assertEquals("Patient not found with ID: pat-999", ex.getMessage());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/patients/pat-999");
        ResponseEntity<ErrorResponseDTO> response = exceptionHandler.handleNotFound(ex, request);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(404, response.getBody().getStatus());
        assertEquals("Patient not found with ID: pat-999", response.getBody().getMessage());
        assertEquals("/api/patients/pat-999", response.getBody().getPath());
    }

    @Test
    public void testOptionalOrElseThrowBadRequest() {
        Optional<String> invalidField = Optional.empty();

        BadRequestException ex = assertThrows(BadRequestException.class, () -> {
            invalidField.orElseThrow(() -> new BadRequestException("patient_id is required."));
        });

        assertEquals("patient_id is required.", ex.getMessage());

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/vitals");
        ResponseEntity<ErrorResponseDTO> response = exceptionHandler.handleBadRequest(ex, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(400, response.getBody().getStatus());
        assertEquals("patient_id is required.", response.getBody().getMessage());
        assertEquals("/api/vitals", response.getBody().getPath());
    }

    @Test
    public void testGlobalFallbackExceptionHandler() {
        Exception unhandledException = new RuntimeException("Unexpected database connection crash");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/system/crash");
        ResponseEntity<ErrorResponseDTO> response = exceptionHandler.handleAll(unhandledException, request);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(500, response.getBody().getStatus());
        assertEquals("An internal server error occurred. Please try again later.", response.getBody().getMessage());
        assertEquals("/api/system/crash", response.getBody().getPath());
    }
}
