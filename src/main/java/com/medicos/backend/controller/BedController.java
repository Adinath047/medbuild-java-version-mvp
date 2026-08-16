package com.medicos.backend.controller;

import com.medicos.backend.entity.Bed;
import com.medicos.backend.entity.BedAdmission;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.BedService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/beds")
public class BedController {

    private final BedService bedService;

    public BedController(BedService bedService) {
        this.bedService = bedService;
    }

    @GetMapping
    public ResponseEntity<?> getAllBeds() {
        List<Bed> beds = bedService.getAllBeds();
        return ResponseEntity.ok(beds);
    }

    @GetMapping("/history")
    public ResponseEntity<?> getBedHistory() {
        List<?> admissions = bedService.getBedHistory();
        return ResponseEntity.ok(admissions);
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')")
    public ResponseEntity<?> createBed(@RequestBody Bed bed, @AuthenticationPrincipal User user) {
        Bed saved = bedService.createBed(bed, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @RequestMapping(value = "/{id}/allocate", method = {RequestMethod.POST, RequestMethod.PUT})
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')")
    public ResponseEntity<?> allocateBed(@PathVariable("id") String id, @RequestBody Map<String, String> body, @AuthenticationPrincipal User user) {
        Map<String, Object> result = bedService.allocateBed(id, body, user);
        return ResponseEntity.ok(result);
    }

    @RequestMapping(value = "/{id}/release", method = {RequestMethod.POST, RequestMethod.PUT})
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')")
    public ResponseEntity<?> releaseBed(@PathVariable("id") String id) {
        Map<String, Object> result = bedService.releaseBed(id);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')")
    public ResponseEntity<?> updateBed(@PathVariable("id") String id, @RequestBody Bed bed, @AuthenticationPrincipal User user) {
        Bed updated = bedService.updateBed(id, bed, user);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteBed(@PathVariable("id") String id) {
        bedService.deleteBed(id);
        return ResponseEntity.ok(Map.of("message", "Bed deleted successfully", "id", id));
    }
}
