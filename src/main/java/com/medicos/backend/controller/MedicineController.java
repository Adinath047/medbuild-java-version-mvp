package com.medicos.backend.controller;

import com.medicos.backend.entity.Medicine;
import com.medicos.backend.entity.User;
import com.medicos.backend.service.MedicineService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    private final MedicineService medicineService;

    public MedicineController(MedicineService medicineService) {
        this.medicineService = medicineService;
    }

    @GetMapping
    public ResponseEntity<?> getMedicines(@RequestParam(value = "search", required = false) String search) {
        List<Medicine> list = medicineService.getMedicines(search);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchMedicines(@RequestParam(value = "q", required = false) String q,
                                            @RequestParam(value = "search", required = false) String search) {
        String query = q != null ? q : search;
        List<Medicine> list = medicineService.searchMedicines(query);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/frequent")
    public ResponseEntity<?> getFrequentMedicines(@AuthenticationPrincipal User user) {
        List<Object> list = medicineService.getFrequentMedicines(user);
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> createMedicine(@RequestBody Medicine medicine, @AuthenticationPrincipal User user) {
        Medicine saved = medicineService.createMedicine(medicine, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
