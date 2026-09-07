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

        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, Map<?, ?>> rawMeds = new LinkedHashMap<>();
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
                                counts.put(key, counts.getOrDefault(key, 0) + 1);
                                rawMeds.putIfAbsent(key, medMap);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        List<String> topKeys = counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(10)
                .map(Map.Entry::getKey)
                .toList();

        List<Object> result = new ArrayList<>();
        for (String key : topKeys) {
            Map<?, ?> raw = rawMeds.get(key);
            String medName = raw != null && raw.get("name") != null ? raw.get("name").toString().trim() : key;
            List<Medicine> match = medicineRepository.searchMedicines(medName);
            if (!match.isEmpty()) {
                result.add(match.get(0));
            } else {
                Medicine m = new Medicine();
                m.setId("frequent-" + UUID.randomUUID().toString().substring(0, 8));
                m.setName(medName);
                m.setCategory("General");
                m.setDefaultDose(raw != null && raw.get("dose") != null ? raw.get("dose").toString().trim() : "1 tablet");
                String strength = raw != null && raw.get("strength") != null ? raw.get("strength").toString().trim() : "";
                m.setStrengths(!strength.isEmpty() ? "[\"" + strength + "\"]" : "[]");
                m.setGenerics("[\"" + medName + "\"]");
                result.add(m);
            }
        }
        return result;
    }

    @CacheEvict(value = "medicines", allEntries = true)
    @Transactional
    public Medicine createMedicine(Medicine medicine, User user) {
        Optional.ofNullable(medicine.getName())
                .filter(n -> !n.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("Medicine name is required."));

        if (medicine.getName().trim().length() < 2) {
            throw new BadRequestException("Medicine name must be at least 2 characters.");
        }

        if (medicine.getId() == null || medicine.getId().isEmpty()) {
            medicine.setId("med-" + UUID.randomUUID().toString().substring(0, 8));
        }

        boolean isSuperAdmin = user != null && ("SUPER_ADMIN".equalsIgnoreCase(user.getRole()) || "super_admin".equalsIgnoreCase(user.getRole()));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
            hospitalId = Optional.ofNullable(user).map(User::getHospitalId).orElse(null);
        }

        if (isSuperAdmin) {
            // Platform Super Admin can publish into the shared global catalog ('GLOBAL' sentinel)
            // or explicitly target a specific hospital if provisioning on behalf of a tenant.
            String targetHospitalId = medicine.getHospitalId();
            if (targetHospitalId != null && !targetHospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(targetHospitalId)) {
                medicine.setHospitalId(targetHospitalId.trim());
            } else {
                medicine.setHospitalId("GLOBAL");
            }
        } else {
            // Regular hospital staff (Doctor, Pharmacist, Hospital Admin) CANNOT write to the global tier.
            // All custom additions are strictly forced to their own hospital tenant.
            if (hospitalId == null || hospitalId.trim().isEmpty() || "GLOBAL".equalsIgnoreCase(hospitalId)) {
                throw new com.medicos.backend.exception.UnauthorizedException("Access Denied: Only platform SUPER_ADMIN can create global formulary entries.");
            }
            medicine.setHospitalId(hospitalId);
        }

        return medicineRepository.save(medicine);
    }
}
