package com.medicos.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.dto.PrescriptionDTO;
import com.medicos.backend.entity.*;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import com.medicos.backend.dto.PrescriptionPdfData;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final EncounterRepository encounterRepository;
    private final VitalRepository vitalRepository;
    private final PrescriptionPdfService prescriptionPdfService;
    private final ObjectMapper objectMapper;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                               PatientRepository patientRepository,
                               UserRepository userRepository,
                               EncounterRepository encounterRepository,
                               VitalRepository vitalRepository,
                               PrescriptionPdfService prescriptionPdfService,
                               ObjectMapper objectMapper) {
        this.prescriptionRepository = prescriptionRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.encounterRepository = encounterRepository;
        this.vitalRepository = vitalRepository;
        this.prescriptionPdfService = prescriptionPdfService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PrescriptionDTO> getPrescriptions(String patientId) {
        List<Prescription> list = Optional.ofNullable(patientId)
                .filter(id -> !id.trim().isEmpty())
                .map(prescriptionRepository::findByPatientIdOrderByCreatedAtDesc)
                .orElseGet(prescriptionRepository::findAll);

        return list.stream().map(this::enrichPrescription).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PrescriptionDTO getPrescriptionById(String id) {
        Prescription rx = prescriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription not found with ID: " + id));
        return enrichPrescription(rx);
    }

    @Transactional(readOnly = true)
    public PrescriptionDTO getPrescriptionBySlipToken(String token) {
        Prescription rx = prescriptionRepository.findBySlipToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid or expired prescription slip token."));
        return enrichPrescription(rx);
    }

    @Transactional
    public PrescriptionDTO createPrescriptionFromMap(Map<String, Object> body, User user) {
        String patientId = getString(body, "patient_id", "patientId");
        if (patientId == null || patientId.trim().isEmpty()) {
            throw new BadRequestException("patient_id is required.");
        }

        Prescription rx = new Prescription();
        String id = getString(body, "id");
        if (id == null || id.trim().isEmpty()) {
            id = "rx-" + UUID.randomUUID().toString().substring(0, 8);
        }
        rx.setId(id);

        String hospitalId = getString(body, "hospital_id", "hospitalId");
        if (hospitalId == null || hospitalId.trim().isEmpty()) {
            hospitalId = Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001");
        }
        rx.setHospitalId(hospitalId);

        rx.setPatientId(patientId);

        String doctorId = getString(body, "doctor_id", "doctorId");
        if (doctorId == null || doctorId.trim().isEmpty()) {
            doctorId = Optional.ofNullable(user).map(User::getId).orElse("usr-doc-001");
        }
        rx.setDoctorId(doctorId);

        rx.setEncounterId(getString(body, "encounter_id", "encounterId"));

        // Medicines parsing
        Object medsObj = body.get("medicines");
        if (medsObj instanceof String) {
            rx.setMedicines((String) medsObj);
        } else if (medsObj != null) {
            try {
                rx.setMedicines(objectMapper.writeValueAsString(medsObj));
            } catch (Exception e) {
                rx.setMedicines("[]");
            }
        } else {
            rx.setMedicines("[]");
        }

        rx.setAdvice(getString(body, "advice"));
        rx.setFollowUpDate(getString(body, "follow_up_date", "followUpDate"));
        rx.setPatientWeight(getString(body, "patient_weight", "patientWeight"));

        String slipToken = getString(body, "slip_token", "slipToken");
        if (slipToken == null || slipToken.trim().isEmpty()) {
            slipToken = UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        }
        rx.setSlipToken(slipToken);

        String role = getString(body, "created_by_role", "createdByRole");
        if (role == null || role.trim().isEmpty()) {
            role = Optional.ofNullable(user).map(User::getRole).orElse("doctor");
        }
        rx.setCreatedByRole(role);
        rx.setCreatedAt(LocalDateTime.now());

        Prescription saved = prescriptionRepository.save(rx);
        return enrichPrescription(saved);
    }

    @Transactional
    public PrescriptionDTO updatePrescription(String id, Map<String, Object> body) {
        Prescription rx = prescriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription not found with ID: " + id));

        if (body.containsKey("medicines")) {
            Object medsObj = body.get("medicines");
            if (medsObj instanceof String) {
                rx.setMedicines((String) medsObj);
            } else if (medsObj != null) {
                try {
                    rx.setMedicines(objectMapper.writeValueAsString(medsObj));
                } catch (Exception e) {
                    rx.setMedicines("[]");
                }
            }
        }

        if (body.containsKey("advice")) {
            rx.setAdvice(getString(body, "advice"));
        }
        if (body.containsKey("follow_up_date") || body.containsKey("followUpDate")) {
            rx.setFollowUpDate(getString(body, "follow_up_date", "followUpDate"));
        }
        if (body.containsKey("patient_weight") || body.containsKey("patientWeight")) {
            rx.setPatientWeight(getString(body, "patient_weight", "patientWeight"));
        }
        if (body.containsKey("is_printed") || body.containsKey("isPrinted")) {
            Object val = body.containsKey("is_printed") ? body.get("is_printed") : body.get("isPrinted");
            if (val instanceof Boolean) {
                rx.setIsPrinted(((Boolean) val) ? 1 : 0);
            } else if (val instanceof Number) {
                rx.setIsPrinted(((Number) val).intValue());
            }
        }

        Prescription updated = prescriptionRepository.save(rx);
        return enrichPrescription(updated);
    }

    public PrescriptionDTO enrichPrescription(Prescription rx) {
        if (rx == null) return null;
        PrescriptionDTO dto = new PrescriptionDTO();
        dto.setId(rx.getId());
        dto.setHospitalId(rx.getHospitalId());
        dto.setPatientId(rx.getPatientId());
        dto.setDoctorId(rx.getDoctorId());
        dto.setEncounterId(rx.getEncounterId());

        if (rx.getMedicines() != null && !rx.getMedicines().trim().isEmpty()) {
            try {
                Object medsParsed = objectMapper.readValue(rx.getMedicines(), Object.class);
                dto.setMedicines(medsParsed);
            } catch (Exception e) {
                dto.setMedicines(Collections.emptyList());
            }
        } else {
            dto.setMedicines(Collections.emptyList());
        }

        dto.setAdvice(rx.getAdvice());
        dto.setFollowUpDate(rx.getFollowUpDate());
        dto.setPatientWeight(rx.getPatientWeight());
        dto.setSlipToken(rx.getSlipToken());
        dto.setIsPrinted(rx.getIsPrinted());
        dto.setCreatedByRole(rx.getCreatedByRole());
        dto.setCreatedAt(rx.getCreatedAt() != null ? rx.getCreatedAt().toString() : null);

        // Patient details
        if (rx.getPatientId() != null) {
            patientRepository.findById(rx.getPatientId()).ifPresent(p -> {
                dto.setPatientName(p.getName());
                dto.setUhid(p.getUhid());
                dto.setAge(p.getAge());
                dto.setSex(p.getSex());
                dto.setBloodGroup(p.getBloodGroup());
                dto.setWeight(p.getWeight());
                if (p.getAllergies() != null) {
                    dto.setAllergies(p.getAllergies());
                }
            });
        }

        // Doctor details
        if (rx.getDoctorId() != null) {
            userRepository.findById(rx.getDoctorId()).ifPresent(u -> {
                dto.setDoctorName(u.getName());
                dto.setDoctorPhone(u.getPhone());
                dto.setDoctorEmail(u.getEmail());
                dto.setDoctorRole(u.getRole());
                dto.setDoctorQualification(u.getSpecialization());
                dto.setDoctorRegistrationNumber(u.getLicenseNumber());
                dto.setDoctorShowDiagnosisOnPrint(u.getShowDiagnosisOnPrint());
                dto.setDoctorShowInvestigationsOnPrint(u.getShowInvestigationsOnPrint());
                dto.setDoctorShowVitalsOnPrint(u.getShowVitalsOnPrint());
                dto.setDoctorPrintMarginTop(u.getPrintMarginTop());
                dto.setDoctorPrintMarginBottom(u.getPrintMarginBottom());
                dto.setDoctorPrintMarginLeftRight(u.getPrintMarginLeftRight());
                dto.setDoctorPrintFontSize(u.getPrintFontSize());
            });
        }

        // Encounter details
        Encounter enc = null;
        if (rx.getEncounterId() != null) {
            enc = encounterRepository.findById(rx.getEncounterId()).orElse(null);
        }
        if (enc == null && rx.getPatientId() != null) {
            List<Encounter> encounters = encounterRepository.findByPatientIdOrderByCreatedAtDesc(rx.getPatientId());
            if (!encounters.isEmpty()) {
                enc = encounters.get(0);
            }
        }
        if (enc != null) {
            dto.setChiefComplaint(enc.getChiefComplaint());
            dto.setHistory(enc.getHistory());
            dto.setPastHistory(enc.getPastHistory());
            dto.setExamination(enc.getExamination());
            dto.setEncounterDiagnosis(enc.getDiagnosis());
            dto.setImpression(enc.getImpression());
        }

        // Vitals details
        Vital vit = null;
        if (rx.getPatientId() != null) {
            vit = vitalRepository.findFirstByPatientIdOrderByRecordedAtDesc(rx.getPatientId()).orElse(null);
        }
        if (vit != null) {
            dto.setBpSystolic(vit.getBpSystolic());
            dto.setBpDiastolic(vit.getBpDiastolic());
            dto.setHeartRate(vit.getHeartRate());
            dto.setTemperature(vit.getTemperature());
            dto.setTemperatureUnit(vit.getTemperatureUnit());
            dto.setSpo2(vit.getSpo2());
            dto.setVitWeight(vit.getWeight());
            dto.setVitWeightUnit(vit.getWeightUnit());
            dto.setVitHeight(vit.getHeight());
            dto.setBmi(vit.getBmi());
        }

        return dto;
    }

    @Transactional(readOnly = true)
    public byte[] generatePrescriptionPdf(String id) {
        PrescriptionDTO dto = getPrescriptionById(id);
        PrescriptionPdfData data = mapToPdfData(dto);
        try {
            return prescriptionPdfService.generatePdf(data);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PDF for prescription " + id + ": " + e.getMessage(), e);
        }
    }

    public PrescriptionPdfData mapToPdfData(PrescriptionDTO dto) {
        PrescriptionPdfData data = new PrescriptionPdfData();
        data.setHospitalName("Medicos Hospital");
        data.setHospitalTagline("Compassionate Care · Advanced Medicine");
        data.setHospitalAddress("LAN Ward, Main Building, Healthcare Complex");
        data.setHospitalPhone(dto.getDoctorPhone() != null ? dto.getDoctorPhone() : "+91-XXXX-XXXXXX");

        String docName = dto.getDoctorName();
        if (docName != null && !docName.trim().isEmpty()) {
            if (!docName.toLowerCase().startsWith("dr.") && !docName.toLowerCase().startsWith("dr ")) {
                docName = "Dr. " + docName;
            }
        } else {
            docName = "Dr. Attending Physician";
        }
        data.setDoctorName(docName);
        data.setDoctorQualification(dto.getDoctorQualification() != null ? dto.getDoctorQualification() : "MBBS, MD");

        data.setPatientName(dto.getPatientName() != null ? dto.getPatientName() : "Patient");
        StringBuilder meta = new StringBuilder();
        if (dto.getAge() != null) meta.append(dto.getAge()).append(" yrs");
        if (dto.getSex() != null) {
            if (meta.length() > 0) meta.append(" / ");
            meta.append(dto.getSex());
        }
        if (dto.getUhid() != null) {
            if (meta.length() > 0) meta.append(" / ");
            meta.append("UHID-").append(dto.getUhid());
        }
        data.setPatientMeta(meta.length() > 0 ? meta.toString() : null);

        data.setVisitDateTime(dto.getCreatedAt() != null ? dto.getCreatedAt() : LocalDateTime.now().toString());

        if (dto.getBpSystolic() != null && dto.getBpDiastolic() != null) {
            data.setBp(dto.getBpSystolic() + "/" + dto.getBpDiastolic() + " mmHg");
        }
        if (dto.getHeartRate() != null) data.setPulse(dto.getHeartRate() + " bpm");
        if (dto.getVitHeight() != null) data.setHeightCm(dto.getVitHeight() + " cm");
        if (dto.getVitWeight() != null) data.setWeightKg(dto.getVitWeight() + " kg");
        else if (dto.getPatientWeight() != null) data.setWeightKg(dto.getPatientWeight() + " kg");
        if (dto.getBmi() != null) data.setBmi(dto.getBmi() + " Kg/m²");

        if (dto.getChiefComplaint() != null && !dto.getChiefComplaint().trim().isEmpty()) {
            List<String> list = Arrays.stream(dto.getChiefComplaint().split("\n"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
            data.setComplaints(list);
        }
        data.setHistory(dto.getHistory());
        data.setDiagnosis(dto.getEncounterDiagnosis());
        data.setSystemicExamination(dto.getExamination());

        // Map Medicines List
        List<PrescriptionPdfData.MedicineItem> pdfMeds = new ArrayList<>();
        if (dto.getMedicines() instanceof List) {
            List<?> rawList = (List<?>) dto.getMedicines();
            for (Object obj : rawList) {
                if (obj instanceof Map) {
                    Map<?, ?> m = (Map<?, ?>) obj;
                    String name = m.containsKey("name") && m.get("name") != null ? String.valueOf(m.get("name")) : "";
                    String str = m.containsKey("strength") && m.get("strength") != null ? String.valueOf(m.get("strength")) : "";
                    if (!str.isEmpty()) name += " (" + str + ")";
                    String comp = m.containsKey("composition") && m.get("composition") != null ? String.valueOf(m.get("composition")) : "";
                    String dose = m.containsKey("dose") && m.get("dose") != null ? String.valueOf(m.get("dose")) : (m.containsKey("dosage") && m.get("dosage") != null ? String.valueOf(m.get("dosage")) : "1 tablet");
                    String freq = m.containsKey("frequency") && m.get("frequency") != null ? String.valueOf(m.get("frequency")) : "Once daily";
                    String dur = m.containsKey("duration") && m.get("duration") != null ? String.valueOf(m.get("duration")) : "5 days";
                    String timing = m.containsKey("instructions") && m.get("instructions") != null ? String.valueOf(m.get("instructions")) : "After meals";
                    String qty = m.containsKey("qty") && m.get("qty") != null ? String.valueOf(m.get("qty")) : "";

                    pdfMeds.add(new PrescriptionPdfData.MedicineItem(
                            name, comp.isEmpty() ? null : comp, dose, freq + " (" + dur + ")", timing.isEmpty() ? null : timing, qty
                    ));
                }
            }
        }
        data.setMedicines(pdfMeds);

        data.setAdvice(dto.getAdvice());
        data.setFollowUp(dto.getFollowUpDate());
        data.setDoctorSignName(docName);
        data.setDoctorSignQualification(data.getDoctorQualification());

        return data;
    }

    private String getString(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) {
                return String.valueOf(map.get(key));
            }
        }
        return null;
    }
}
