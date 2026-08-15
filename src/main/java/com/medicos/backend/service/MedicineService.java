package com.medicos.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.Medicine;
import com.medicos.backend.entity.Prescription;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.repository.MedicineRepository;
import com.medicos.backend.repository.PrescriptionRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MedicineService {

    private final MedicineRepository medicineRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final ObjectMapper objectMapper;

    public MedicineService(MedicineRepository medicineRepository,
                           PrescriptionRepository prescriptionRepository,
                           ObjectMapper objectMapper) {
        this.medicineRepository = medicineRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.objectMapper = objectMapper;
    }

    @Cacheable(value = "medicines", key = "(T(com.medicos.backend.security.TenantContext).getTenantId() != null ? T(com.medicos.backend.security.TenantContext).getTenantId() : 'GLOBAL') + '_' + (#search != null ? #search : 'ALL')")
    @Transactional(readOnly = true)
    public List<Medicine> getMedicines(String search) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        if (search != null && !search.trim().isEmpty()) {
            return isTenantScoped
                    ? medicineRepository.searchMedicinesByHospital(search.trim(), hospitalId)
                    : medicineRepository.searchMedicines(search.trim());
        } else {
            return isTenantScoped
                    ? medicineRepository.findByHospitalIdOrGlobal(hospitalId)
                    : medicineRepository.findAll();
        }
    }

    @Transactional(readOnly = true)
    public List<Medicine> searchMedicines(String q) {
        if (q == null || q.trim().length() < 2) {
            return Collections.emptyList();
        }
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        List<Medicine> results = isTenantScoped
                ? medicineRepository.searchMedicinesByHospital(q.trim(), hospitalId)
                : medicineRepository.searchMedicines(q.trim());

        if (results.size() > 20) {
            return results.subList(0, 20);
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<Object> getFrequentMedicines(User user) {
        if (user == null || user.getId() == null) {
            return Collections.emptyList();
        }
        List<Prescription> prescriptions = prescriptionRepository.findByDoctorIdOrderByCreatedAtDesc(user.getId());
        if (prescriptions.size() > 100) {
            prescriptions = prescriptions.subList(0, 100);
        }

        Map<String, Map<String, Object>> counts = new LinkedHashMap<>();
        for (Prescription rx : prescriptions) {
            if (rx.getMedicines() == null || rx.getMedicines().trim().isEmpty()) continue;
            try {
                Object parsed = objectMapper.readValue(rx.getMedicines(), Object.class);
                if (parsed instanceof List<?>) {
                    List<?> medsList = (List<?>) parsed;
                    for (Object medObj : medsList) {
                        if (medObj instanceof Map<?, ?>) {
                            Map<?, ?> medMap = (Map<?, ?>) medObj;
                            Object nameObj = medMap.get("name");
                            if (nameObj != null && !nameObj.toString().trim().isEmpty()) {
                                String name = nameObj.toString().trim();
                                String key = name.toLowerCase();
                                if (!counts.containsKey(key)) {
                                    Map<String, Object> entry = new HashMap<>();
                                    entry.put("name", name);
                                    entry.put("count", 1);
                                    entry.put("med", medMap);
                                    counts.put(key, entry);
                                } else {
                                    Map<String, Object> entry = counts.get(key);
                                    entry.put("count", ((Integer) entry.get("count")) + 1);
                                }
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        return counts.values().stream()
                .sorted((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")))
                .map(entry -> entry.get("med"))
                .limit(10)
                .collect(Collectors.toList());
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
