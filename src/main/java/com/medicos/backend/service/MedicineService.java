package com.medicos.backend.service;

import com.medicos.backend.entity.Medicine;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.MedicineRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class MedicineService {

    private final MedicineRepository medicineRepository;

    public MedicineService(MedicineRepository medicineRepository) {
        this.medicineRepository = medicineRepository;
    }

    @Cacheable(value = "medicines", key = "#search != null ? #search : 'ALL'")
    @Transactional(readOnly = true)
    public List<Medicine> getMedicines(String search) {
        return Optional.ofNullable(search)
                .filter(s -> !s.trim().isEmpty())
                .map(s -> medicineRepository.searchMedicines(s.trim()))
                .orElseGet(medicineRepository::findAll);
    }

    @CacheEvict(value = "medicines", allEntries = true)
    @Transactional
    public Medicine createMedicine(Medicine medicine, User user) {
        Optional.ofNullable(medicine.getName())
                .filter(n -> !n.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Medicine name is required."));

        if (medicine.getId() == null || medicine.getId().isEmpty()) {
            medicine.setId("med-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (medicine.getHospitalId() == null || medicine.getHospitalId().isEmpty()) {
            medicine.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        return medicineRepository.save(medicine);
    }
}
