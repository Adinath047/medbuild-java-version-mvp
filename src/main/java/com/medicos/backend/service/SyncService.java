package com.medicos.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.*;
import com.medicos.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class SyncService {

    private final PatientRepository patientRepository;
    private final EncounterRepository encounterRepository;
    private final VitalRepository vitalRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final AppointmentRepository appointmentRepository;
    private final BedRepository bedRepository;
    private final BillingRepository billingRepository;
    private final MedicineRepository medicineRepository;
    private final ObjectMapper objectMapper;

    private static final Set<String> ALLOWED_TABLES = Set.of(
            "patients", "encounters", "vitals", "prescriptions", "appointments", "billing", "medicines"
    );

    public SyncService(PatientRepository patientRepository,
                       EncounterRepository encounterRepository,
                       VitalRepository vitalRepository,
                       PrescriptionRepository prescriptionRepository,
                       AppointmentRepository appointmentRepository,
                       BedRepository bedRepository,
                       BillingRepository billingRepository,
                       MedicineRepository medicineRepository,
                       ObjectMapper objectMapper) {
        this.patientRepository = patientRepository;
        this.encounterRepository = encounterRepository;
        this.vitalRepository = vitalRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.appointmentRepository = appointmentRepository;
        this.bedRepository = bedRepository;
        this.billingRepository = billingRepository;
        this.medicineRepository = medicineRepository;
        this.objectMapper = objectMapper.copy()
                .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .setPropertyNamingStrategy(com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> pullData(User user, String since, String tables) {
        String hospitalId = (user != null && !"super_admin".equalsIgnoreCase(user.getRole())) 
                ? user.getHospitalId() 
                : com.medicos.backend.security.TenantContext.getTenantId();
        
        if ("GLOBAL".equalsIgnoreCase(hospitalId) || (hospitalId != null && hospitalId.trim().isEmpty())) {
            hospitalId = null;
        }

        Set<String> requestedTables;
        if (tables != null && !tables.trim().isEmpty()) {
            requestedTables = new HashSet<>(Arrays.asList(tables.split(",")));
            requestedTables.retainAll(ALLOWED_TABLES);
        } else {
            requestedTables = ALLOWED_TABLES;
        }

        Map<String, Object> data = new HashMap<>();

        if (requestedTables.contains("patients")) {
            try {
                List<Patient> list = (hospitalId != null) ? patientRepository.findByHospitalId(hospitalId) : patientRepository.findAll();
                data.put("patients", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("patients", Collections.emptyList());
            }
        }
        if (requestedTables.contains("encounters")) {
            try {
                List<Encounter> list = (hospitalId != null) ? encounterRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId) : encounterRepository.findAll();
                data.put("encounters", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("encounters", Collections.emptyList());
            }
        }
        if (requestedTables.contains("vitals")) {
            try {
                List<Vital> list = (hospitalId != null) ? vitalRepository.findByHospitalIdOrderByRecordedAtDesc(hospitalId) : vitalRepository.findAll();
                data.put("vitals", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("vitals", Collections.emptyList());
            }
        }
        if (requestedTables.contains("prescriptions")) {
            try {
                List<Prescription> list = (hospitalId != null) ? prescriptionRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId) : prescriptionRepository.findAll();
                data.put("prescriptions", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("prescriptions", Collections.emptyList());
            }
        }
        if (requestedTables.contains("appointments")) {
            try {
                List<Appointment> list = (hospitalId != null) ? appointmentRepository.findByHospitalIdOrderByDateDesc(hospitalId) : appointmentRepository.findAll();
                data.put("appointments", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("appointments", Collections.emptyList());
            }
        }
        if (requestedTables.contains("billing")) {
            try {
                List<Billing> list = (hospitalId != null) ? billingRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId) : billingRepository.findAll();
                data.put("billing", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("billing", Collections.emptyList());
            }
        }
        if (requestedTables.contains("medicines")) {
            try {
                List<Medicine> list = (hospitalId != null) ? medicineRepository.findByHospitalId(hospitalId) : medicineRepository.findAll();
                data.put("medicines", list != null ? list : Collections.emptyList());
            } catch (Exception e) {
                data.put("medicines", Collections.emptyList());
            }
        }

        String nowIso = Instant.now().toString();

        Map<String, Object> response = new HashMap<>();
        response.put("serverTime", nowIso);
        response.put("pulledAt", nowIso);
        response.put("data", data);
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    @SuppressWarnings("unchecked")
    public Map<String, Object> pushData(Map<String, Object> payload, User user) {
        List<Map<String, Object>> records = (List<Map<String, Object>>) payload.getOrDefault("records", Collections.emptyList());
        String userHospitalId = user != null ? user.getHospitalId() : "hsp-001";
        boolean isSuperAdmin = user != null && "super_admin".equalsIgnoreCase(user.getRole());

        List<Map<String, Object>> results = new ArrayList<>();
        int synced = 0;
        int failed = 0;

        for (Map<String, Object> record : records) {
            String table = (String) record.get("table");
            String operation = Optional.ofNullable((String) record.get("operation")).orElse("insert").toLowerCase();
            Map<String, Object> rawItemPayload = (Map<String, Object>) record.get("payload");

            if (table == null || !ALLOWED_TABLES.contains(table)) {
                results.add(Map.of("id", rawItemPayload != null ? rawItemPayload.get("id") : null, "status", "rejected", "reason", "table not allowed"));
                failed++;
                continue;
            }

            if (rawItemPayload == null) {
                results.add(Map.of("id", null, "status", "rejected", "reason", "payload missing"));
                failed++;
                continue;
            }

            Map<String, Object> itemPayload = new HashMap<>(rawItemPayload);

            String recordHospitalId = (String) itemPayload.get("hospital_id");
            if (!isSuperAdmin && recordHospitalId != null && !recordHospitalId.equals(userHospitalId)) {
                results.add(Map.of("id", itemPayload.get("id"), "status", "rejected", "reason", "hospital mismatch"));
                failed++;
                continue;
            }

            if (!isSuperAdmin && recordHospitalId == null) {
                itemPayload.put("hospital_id", userHospitalId);
            }

            String recordId = (String) itemPayload.get("id");
            String nowIso = Instant.now().toString();

            try {
                switch (table) {
                    case "patients":
                        processPatientRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "encounters":
                        processEncounterRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "vitals":
                        processVitalRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "prescriptions":
                        processPrescriptionRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "appointments":
                        processAppointmentRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "billing":
                        processBillingRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                    case "medicines":
                        processMedicineRecord(recordId, operation, itemPayload, userHospitalId);
                        break;
                }
                results.add(Map.of("id", recordId, "status", "create".equals(operation) || "insert".equals(operation) ? "inserted" : operation.equals("delete") ? "deleted" : "updated", "serverUpdatedAt", nowIso));
                synced++;
            } catch (Exception e) {
                results.add(Map.of("id", recordId, "status", "error", "reason", e.getMessage() != null ? e.getMessage() : "Failed to process record"));
                failed++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("synced", synced);
        response.put("failed", failed);
        response.put("total", records.size());
        response.put("results", results);
        return response;
    }

    private void processPatientRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) throws Exception {
        if ("delete".equals(op)) {
            patientRepository.findById(id).ifPresent(p -> { p.setIsActive(0); patientRepository.save(p); });
            return;
        }
        Patient p = objectMapper.convertValue(map, Patient.class);
        if (p.getId() == null) p.setId(id != null ? id : "pat-" + UUID.randomUUID().toString().substring(0, 8));
        if (p.getHospitalId() == null) p.setHospitalId(defaultHospitalId);
        patientRepository.save(p);
    }

    private void processEncounterRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            encounterRepository.deleteById(id);
            return;
        }
        Encounter enc = objectMapper.convertValue(map, Encounter.class);
        if (enc.getId() == null) enc.setId(id != null ? id : "enc-" + UUID.randomUUID().toString().substring(0, 8));
        if (enc.getHospitalId() == null) enc.setHospitalId(defaultHospitalId);
        encounterRepository.save(enc);
    }

    private void processVitalRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            vitalRepository.deleteById(id);
            return;
        }
        Vital v = objectMapper.convertValue(map, Vital.class);
        if (v.getId() == null) v.setId(id != null ? id : "vit-" + UUID.randomUUID().toString().substring(0, 8));
        if (v.getHospitalId() == null) v.setHospitalId(defaultHospitalId);
        if (v.getPatientId() == null && map.containsKey("patient_id")) v.setPatientId(String.valueOf(map.get("patient_id")));
        if (v.getPatientId() == null) v.setPatientId("pat-001");
        if (v.getRecordedBy() == null && map.containsKey("recorded_by")) v.setRecordedBy(String.valueOf(map.get("recorded_by")));
        if (v.getRecordedBy() == null) v.setRecordedBy("system");
        if (v.getRecordedAt() == null) v.setRecordedAt(LocalDateTime.now());
        vitalRepository.save(v);
    }

    private void processPrescriptionRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            prescriptionRepository.deleteById(id);
            return;
        }
        Prescription rx = objectMapper.convertValue(map, Prescription.class);
        if (rx.getId() == null) rx.setId(id != null ? id : "rx-" + UUID.randomUUID().toString().substring(0, 8));
        if (rx.getHospitalId() == null) rx.setHospitalId(defaultHospitalId);
        if (rx.getCreatedAt() == null) rx.setCreatedAt(LocalDateTime.now());
        prescriptionRepository.save(rx);
    }

    private void processAppointmentRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            appointmentRepository.deleteById(id);
            return;
        }
        Appointment appt = objectMapper.convertValue(map, Appointment.class);
        if (appt.getId() == null) appt.setId(id != null ? id : "apt-" + UUID.randomUUID().toString().substring(0, 8));
        if (appt.getHospitalId() == null) appt.setHospitalId(defaultHospitalId);
        appointmentRepository.save(appt);
    }

    private void processBillingRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            billingRepository.deleteById(id);
            return;
        }
        Billing b = objectMapper.convertValue(map, Billing.class);
        if (b.getId() == null) b.setId(id != null ? id : "bil-" + UUID.randomUUID().toString().substring(0, 8));
        if (b.getHospitalId() == null) b.setHospitalId(defaultHospitalId);
        billingRepository.save(b);
    }

    private void processMedicineRecord(String id, String op, Map<String, Object> map, String defaultHospitalId) {
        if ("delete".equals(op)) {
            medicineRepository.deleteById(id);
            return;
        }
        Medicine m = objectMapper.convertValue(map, Medicine.class);
        if (m.getId() == null) m.setId(id != null ? id : "med-" + UUID.randomUUID().toString().substring(0, 8));
        if (m.getHospitalId() == null) m.setHospitalId(defaultHospitalId);
        medicineRepository.save(m);
    }
}
