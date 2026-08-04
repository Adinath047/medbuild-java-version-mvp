package com.medicos.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.dto.PatientAppDTO;
import com.medicos.backend.entity.*;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Core service for all patient-facing mobile app operations.
 * Handles doctors, appointments, prescriptions, and health tips.
 */
@Service
public class PatientAppService {

    private static final String[] DOCTOR_COLORS = {
            "#4F46E5", "#0891B2", "#059669", "#D97706",
            "#DC2626", "#7C3AED", "#DB2777", "#EA580C"
    };

    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final AppointmentRepository appointmentRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final HealthTipRepository healthTipRepository;
    private final ObjectMapper objectMapper;

    public PatientAppService(UserRepository userRepository,
                             HospitalRepository hospitalRepository,
                             AppointmentRepository appointmentRepository,
                             PrescriptionRepository prescriptionRepository,
                             PatientRepository patientRepository,
                             HealthTipRepository healthTipRepository,
                             ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.appointmentRepository = appointmentRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.patientRepository = patientRepository;
        this.healthTipRepository = healthTipRepository;
        this.objectMapper = objectMapper;
    }

    // ─── Doctors ──────────────────────────────────────────────────────────────

    /**
     * Returns a list of active doctors, optionally filtered by district.
     */
    @Transactional(readOnly = true)
    public List<PatientAppDTO.DoctorView> getDoctors(String district) {
        List<User> doctors;
        if (district != null && !district.trim().isEmpty()) {
            doctors = userRepository.findByRoleAndDistrictIgnoreCaseAndIsActive("doctor", district.trim(), 1);
        } else {
            doctors = userRepository.findByRoleAndIsActive("doctor", 1);
        }
        return doctors.stream()
                .map(this::mapToDoctor)
                .collect(Collectors.toList());
    }

    /**
     * Returns a single doctor by ID.
     */
    @Transactional(readOnly = true)
    public PatientAppDTO.DoctorView getDoctor(String doctorId) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + doctorId));
        if (!"doctor".equalsIgnoreCase(doctor.getRole())) {
            throw new ResourceNotFoundException("No doctor found with ID: " + doctorId);
        }
        return mapToDoctor(doctor);
    }

    // ─── Appointments ─────────────────────────────────────────────────────────

    /**
     * Returns appointments for a patient, optionally filtered by doctor.
     */
    @Transactional(readOnly = true)
    public List<PatientAppDTO.AppointmentView> getAppointments(String patientId, String doctorId) {
        List<Appointment> appointments;
        if (doctorId != null && !doctorId.trim().isEmpty()) {
            // Filter by patient + doctor
            appointments = appointmentRepository.findByPatientIdOrderByDateDesc(patientId).stream()
                    .filter(a -> doctorId.equals(a.getDoctorId()))
                    .collect(Collectors.toList());
        } else {
            appointments = appointmentRepository.findByPatientIdOrderByDateDesc(patientId);
        }
        return appointments.stream()
                .map(this::mapToAppointment)
                .collect(Collectors.toList());
    }

    /**
     * Books a new appointment for the authenticated patient.
     * Auto-provisions a patient record in the doctor's hospital if needed.
     */
    @Transactional
    public PatientAppDTO.AppointmentView createAppointment(String patientId, PatientAppDTO.CreateAppointmentRequest req) {
        if (req.getDoctorId() == null || req.getDoctorId().trim().isEmpty()) {
            throw new BadRequestException("doctor_id is required.");
        }
        if (req.getDate() == null || req.getDate().trim().isEmpty()) {
            throw new BadRequestException("date is required.");
        }
        if (req.getTime() == null || req.getTime().trim().isEmpty()) {
            throw new BadRequestException("time is required.");
        }

        User doctor = userRepository.findById(req.getDoctorId().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + req.getDoctorId()));

        String hospitalId = Optional.ofNullable(doctor.getHospitalId()).orElse("hsp-001");

        // Ensure patient record exists in the doctor's hospital
        Patient patient = patientRepository.findById(patientId).orElse(null);
        if (patient == null) {
            patient = new Patient();
            patient.setId(patientId);
            patient.setUhid("UHID-" + (100000 + new Random().nextInt(900000)));
            patient.setHospitalId(hospitalId);
            patient.setName("Patient");
            patient.setIsActive(1);
            patientRepository.save(patient);
        } else if (!hospitalId.equals(patient.getHospitalId())) {
            // Patient is in a different hospital tenant — update to doctor's hospital
            patient.setHospitalId(hospitalId);
            patientRepository.save(patient);
        }

        Appointment appt = new Appointment();
        appt.setId("apt-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10));
        appt.setPatientId(patientId);
        appt.setDoctorId(req.getDoctorId().trim());
        appt.setHospitalId(hospitalId);
        appt.setDate(req.getDate().trim());
        appt.setTime(req.getTime().trim());
        appt.setReason(req.getReason());
        appt.setStatus("Pending");
        appt.setBookedBy(patientId);
        appt.setCreatedAt(LocalDateTime.now());
        appt.setUpdatedAt(LocalDateTime.now());

        // Set appointment type (default "Consultation")
        String type = (req.getType() != null && !req.getType().trim().isEmpty())
                ? req.getType().trim() : "Consultation";
        appt.setNotes(type); // Re-using notes to carry type info until a `type` column is added

        Appointment saved = appointmentRepository.save(appt);
        PatientAppDTO.AppointmentView view = mapToAppointment(saved);
        view.setType(type);
        return view;
    }

    // ─── Prescriptions ────────────────────────────────────────────────────────

    /**
     * Returns prescriptions for a patient, optionally filtered by doctor.
     */
    @Transactional(readOnly = true)
    public List<PatientAppDTO.PrescriptionView> getPrescriptions(String patientId, String doctorId) {
        List<Prescription> prescriptions;
        if (doctorId != null && !doctorId.trim().isEmpty()) {
            prescriptions = prescriptionRepository
                    .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctorId.trim());
        } else {
            prescriptions = prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        }
        return prescriptions.stream()
                .map(p -> mapToPrescription(p, null))
                .collect(Collectors.toList());
    }

    /**
     * Returns a single prescription by ID.
     */
    @Transactional(readOnly = true)
    public PatientAppDTO.PrescriptionView getPrescription(String prescriptionId, String patientId) {
        Prescription prescription = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription not found with ID: " + prescriptionId));

        // Security: ensure prescription belongs to the requesting patient
        if (!patientId.equals(prescription.getPatientId())) {
            throw new ResourceNotFoundException("Prescription not found with ID: " + prescriptionId);
        }

        User doctor = userRepository.findById(prescription.getDoctorId()).orElse(null);
        return mapToPrescription(prescription, doctor);
    }

    // ─── Health Tips ──────────────────────────────────────────────────────────

    /**
     * Returns all health tips.
     */
    @Transactional(readOnly = true)
    public List<HealthTip> getHealthTips() {
        return healthTipRepository.findAll();
    }

    // ─── Mappers ──────────────────────────────────────────────────────────────

    public PatientAppDTO.DoctorView mapToDoctor(User user) {
        PatientAppDTO.DoctorView view = new PatientAppDTO.DoctorView();
        view.setId(user.getId());
        view.setName(user.getName() != null ? user.getName() : "");
        view.setSpecialty(user.getSpecialization() != null ? user.getSpecialization() : "General");
        view.setAvatar(user.getPhotoUrl());
        view.setDistrict(user.getDistrict() != null ? user.getDistrict() : "");
        view.setRating(user.getRating() != null ? user.getRating() : 0.0);
        view.setExperienceYears(user.getExperienceYears() != null ? user.getExperienceYears() : 0);
        view.setConsultedCount(user.getConsultedCount() != null ? user.getConsultedCount() : 0);
        view.setFee(user.getConsultationFee() != null ? user.getConsultationFee() : 0.0);

        // Derive hospital name from hospitalId
        String hospitalName = "Medicos Clinic";
        if (user.getHospitalId() != null) {
            try {
                hospitalName = hospitalRepository.findById(user.getHospitalId())
                        .map(Hospital::getName)
                        .orElse("Medicos Clinic");
            } catch (Exception ignored) {}
        }
        view.setHospital(hospitalName);

        // Generate initials from name
        String name = user.getName() != null ? user.getName() : "";
        String[] parts = name.trim().split("\\s+");
        String initials = parts.length >= 2
                ? String.valueOf(parts[0].charAt(0)) + parts[parts.length - 1].charAt(0)
                : (parts.length == 1 && !parts[0].isEmpty() ? String.valueOf(parts[0].charAt(0)) : "?");
        view.setInitials(initials.toUpperCase());

        // Assign a stable color from the palette based on user ID hash
        int colorIndex = Math.abs(user.getId().hashCode()) % DOCTOR_COLORS.length;
        view.setColor(DOCTOR_COLORS[colorIndex]);

        return view;
    }

    public PatientAppDTO.AppointmentView mapToAppointment(Appointment appt) {
        PatientAppDTO.AppointmentView view = new PatientAppDTO.AppointmentView();
        view.setId(appt.getId());
        view.setDoctorId(appt.getDoctorId());
        view.setPatientId(appt.getPatientId());
        view.setDate(appt.getDate());
        view.setTime(appt.getTime());
        view.setStatus(appt.getStatus());
        view.setReason(appt.getReason());
        // Type is stored in notes for now — default to "Consultation" if absent
        view.setType(appt.getNotes() != null ? appt.getNotes() : "Consultation");
        return view;
    }

    public PatientAppDTO.PrescriptionView mapToPrescription(Prescription rx, User doctor) {
        PatientAppDTO.PrescriptionView view = new PatientAppDTO.PrescriptionView();
        view.setId(rx.getId());
        view.setDoctorId(rx.getDoctorId());
        view.setPatientId(rx.getPatientId());
        view.setDate(rx.getCreatedAt() != null ? rx.getCreatedAt().toLocalDate().toString() : "");
        view.setAdvice(rx.getAdvice() != null ? rx.getAdvice() : "");

        // Diagnosis — stored in a separate field on newer versions; fall back gracefully
        view.setDiagnosis("");

        // Title = "Dr. <Name>'s Prescription"
        String doctorName = doctor != null ? doctor.getName() : "Doctor";
        view.setTitle("Dr. " + doctorName + "'s Prescription");

        // Parse medicines JSON
        List<PatientAppDTO.MedicineItem> medicines = new ArrayList<>();
        try {
            if (rx.getMedicines() != null && !rx.getMedicines().isBlank()) {
                medicines = objectMapper.readValue(rx.getMedicines(),
                        new TypeReference<List<PatientAppDTO.MedicineItem>>() {});
            }
        } catch (Exception ignored) {
            // Return empty list if medicines JSON is malformed
        }
        view.setMedicines(medicines);

        return view;
    }
}
