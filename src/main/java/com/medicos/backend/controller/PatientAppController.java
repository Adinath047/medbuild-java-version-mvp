package com.medicos.backend.controller;

import com.medicos.backend.dto.PatientAppDTO;
import com.medicos.backend.entity.HealthTip;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.UnauthorizedException;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.service.PatientAppService;
import com.medicos.backend.service.PatientAuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for the patient-facing mobile app.
 * All routes are under /api/mobile/ to avoid conflicts with existing EMR controllers
 * that already own /api/appointments, /api/prescriptions, /api/doctors, etc.
 *
 * Frontend api.ts BASE URL: http://localhost:8080
 * Patient app endpoints use path /api/mobile/*
 */
@RestController
public class PatientAppController {

    private final PatientAppService patientAppService;
    private final PatientAuthService patientAuthService;
    private final PatientRepository patientRepository;

    public PatientAppController(PatientAppService patientAppService,
                                PatientAuthService patientAuthService,
                                PatientRepository patientRepository) {
        this.patientAppService = patientAppService;
        this.patientAuthService = patientAuthService;
        this.patientRepository = patientRepository;
    }

    // ─── Patient Profile ──────────────────────────────────────────────────────

    /**
     * GET /api/mobile/patient
     * Returns the authenticated patient's profile.
     */
    @GetMapping("/api/mobile/patient")
    public ResponseEntity<PatientAppDTO.PatientProfile> getPatient(@AuthenticationPrincipal Object principal) {
        String patientId = resolvePatientId(principal);
        PatientAppDTO.PatientProfile profile = patientAuthService.getProfile(patientId);
        return ResponseEntity.ok(profile);
    }

    /**
     * PUT /api/mobile/patient
     * Updates the authenticated patient's profile.
     */
    @PutMapping("/api/mobile/patient")
    public ResponseEntity<PatientAppDTO.PatientProfile> updatePatient(
            @AuthenticationPrincipal Object principal,
            @RequestBody PatientAppDTO.PatientUpdateRequest request) {
        String patientId = resolvePatientId(principal);
        PatientAppDTO.PatientProfile profile = patientAuthService.updateProfile(patientId, request);
        return ResponseEntity.ok(profile);
    }

    // ─── Doctors ──────────────────────────────────────────────────────────────

    /**
     * GET /api/mobile/doctors?district=...
     * Lists active doctors, optionally filtered by district.
     * Public endpoint (no auth required).
     */
    @GetMapping("/api/mobile/doctors")
    public ResponseEntity<List<PatientAppDTO.DoctorView>> getDoctors(
            @RequestParam(value = "district", required = false) String district) {
        List<PatientAppDTO.DoctorView> doctors = patientAppService.getDoctors(district);
        return ResponseEntity.ok(doctors);
    }

    /**
     * GET /api/mobile/doctors/{id}
     * Returns a single doctor by ID.
     * Public endpoint (no auth required).
     */
    @GetMapping("/api/mobile/doctors/{id}")
    public ResponseEntity<PatientAppDTO.DoctorView> getDoctor(@PathVariable("id") String id) {
        PatientAppDTO.DoctorView doctor = patientAppService.getDoctor(id);
        return ResponseEntity.ok(doctor);
    }

    // ─── Appointments ─────────────────────────────────────────────────────────

    /**
     * GET /api/mobile/appointments?doctor_id=...
     * Returns appointments for the authenticated patient.
     */
    @GetMapping("/api/mobile/appointments")
    public ResponseEntity<List<PatientAppDTO.AppointmentView>> getAppointments(
            @AuthenticationPrincipal Object principal,
            @RequestParam(value = "doctor_id", required = false) String doctorId) {
        String patientId = resolvePatientId(principal);
        List<PatientAppDTO.AppointmentView> appointments = patientAppService.getAppointments(patientId, doctorId);
        return ResponseEntity.ok(appointments);
    }

    /**
     * POST /api/mobile/appointments
     * Books a new appointment for the authenticated patient.
     * Body: { "doctor_id": "...", "date": "2025-01-15", "time": "10:00", "reason": "...", "type": "Consultation" }
     */
    @PostMapping("/api/mobile/appointments")
    public ResponseEntity<PatientAppDTO.AppointmentView> createAppointment(
            @AuthenticationPrincipal Object principal,
            @RequestBody PatientAppDTO.CreateAppointmentRequest request) {
        String patientId = resolvePatientId(principal);
        PatientAppDTO.AppointmentView appointment = patientAppService.createAppointment(patientId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(appointment);
    }

    // ─── Prescriptions ────────────────────────────────────────────────────────

    /**
     * GET /api/mobile/prescriptions?doctor_id=...
     * Returns prescriptions for the authenticated patient.
     */
    @GetMapping("/api/mobile/prescriptions")
    public ResponseEntity<List<PatientAppDTO.PrescriptionView>> getPrescriptions(
            @AuthenticationPrincipal Object principal,
            @RequestParam(value = "doctor_id", required = false) String doctorId) {
        String patientId = resolvePatientId(principal);
        List<PatientAppDTO.PrescriptionView> prescriptions = patientAppService.getPrescriptions(patientId, doctorId);
        return ResponseEntity.ok(prescriptions);
    }

    /**
     * GET /api/mobile/prescriptions/{id}
     * Returns a single prescription by ID.
     */
    @GetMapping("/api/mobile/prescriptions/{id}")
    public ResponseEntity<PatientAppDTO.PrescriptionView> getPrescription(
            @AuthenticationPrincipal Object principal,
            @PathVariable("id") String id) {
        String patientId = resolvePatientId(principal);
        PatientAppDTO.PrescriptionView prescription = patientAppService.getPrescription(id, patientId);
        return ResponseEntity.ok(prescription);
    }

    // ─── Health Tips ──────────────────────────────────────────────────────────

    /**
     * GET /api/mobile/health-tips
     * Returns health tips. Public endpoint.
     */
    @GetMapping("/api/mobile/health-tips")
    public ResponseEntity<List<HealthTip>> getHealthTips() {
        List<HealthTip> tips = patientAppService.getHealthTips();
        return ResponseEntity.ok(tips);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    /**
     * Extracts the patient ID from the Spring Security principal.
     * The JwtAuthenticationFilter stores either a Patient or User entity as the principal.
     * For patient-app routes, we expect a Patient entity.
     */
    private String resolvePatientId(Object principal) {
        if (principal instanceof Patient patient) {
            return patient.getId();
        }
        if (principal instanceof User user && "patient".equalsIgnoreCase(user.getRole())) {
            return user.getId();
        }
        throw new UnauthorizedException("Authentication required. Please log in.");
    }
}
