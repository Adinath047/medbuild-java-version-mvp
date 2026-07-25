package com.medicos.backend.controller;

import com.medicos.backend.entity.PatientUpload;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.PatientUploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patient-uploads")
public class PatientUploadController {

    private final PatientUploadService patientUploadService;

    public PatientUploadController(PatientUploadService patientUploadService) {
        this.patientUploadService = patientUploadService;
    }

    @GetMapping("/{patientId}")
    public ResponseEntity<?> getUploadsByPatientId(@PathVariable("patientId") String patientId) {
        List<PatientUpload> uploads = patientUploadService.getUploadsByPatientId(patientId);
        return ResponseEntity.ok(uploads);
    }

    @PostMapping
    public ResponseEntity<?> uploadDocument(@RequestBody PatientUpload upload, @AuthenticationPrincipal User user) {
        PatientUpload saved = patientUploadService.uploadDocument(upload, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
