package com.medicos.backend.controller;

import com.medicos.backend.entity.Appointment;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.AppointmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping
    public ResponseEntity<?> getAppointments(@RequestParam(value = "patient_id", required = false) String patientId,
                                            @RequestParam(value = "doctor_id", required = false) String doctorId,
                                            @RequestParam(value = "date", required = false) String date) {
        List<Appointment> list = appointmentService.getAppointments(patientId, doctorId, date);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/today")
    public ResponseEntity<?> getTodayAppointments() {
        List<Appointment> list = appointmentService.getTodayAppointments();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> createAppointment(@RequestBody Appointment appt, @AuthenticationPrincipal User user) {
        Appointment saved = appointmentService.createAppointment(appt, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}/status")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')")
    public ResponseEntity<?> updateAppointmentStatus(@PathVariable("id") String id, @RequestBody Map<String, String> body) {
        Appointment saved = appointmentService.updateAppointmentStatus(id, body);
        return ResponseEntity.ok(saved);
    }
}
