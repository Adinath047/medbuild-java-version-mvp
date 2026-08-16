package com.medicos.backend.service;

import com.medicos.backend.entity.Appointment;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.AppointmentRepository;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              UserRepository userRepository,
                              PatientRepository patientRepository) {
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
    }

    @Transactional
    public List<Appointment> getAppointments(String patientId, String doctorId, String date) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        List<Appointment> list;
        if (patientId != null && !patientId.isEmpty()) {
            list = isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndPatientIdOrderByDateDesc(hospitalId, patientId)
                    : appointmentRepository.findByPatientIdOrderByDateDesc(patientId);
        } else if (doctorId != null && !doctorId.isEmpty()) {
            list = isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndDoctorIdOrderByDateDesc(hospitalId, doctorId)
                    : appointmentRepository.findByDoctorIdOrderByDateDesc(doctorId);
        } else if (date != null && !date.isEmpty()) {
            list = isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndDate(hospitalId, date)
                    : appointmentRepository.findByDate(date);
        } else {
            list = isTenantScoped
                    ? appointmentRepository.findByHospitalIdOrderByDateDesc(hospitalId)
                    : appointmentRepository.findAll();
        }
        return processExpiredAppointments(list);
    }

    @Transactional
    public List<Appointment> getTodayAppointments() {
        String todayStr = LocalDate.now().toString();
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        List<Appointment> list;
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            list = appointmentRepository.findByHospitalIdAndDate(hospitalId, todayStr);
        } else {
            list = appointmentRepository.findByDate(todayStr);
        }
        return processExpiredAppointments(list);
    }

    /**
     * Automatically transitions any appointment to 'Cancelled' if 8 or more hours have elapsed
     * past its scheduled time (or creation time) without patient check-in.
     */
    @Transactional
    public List<Appointment> processExpiredAppointments(List<Appointment> list) {
        if (list == null || list.isEmpty()) return list;
        List<Appointment> toSave = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (Appointment a : list) {
            if (isExpiredWithoutCheckIn(a, now)) {
                a.setStatus("Cancelled");
                String noteSuffix = "Auto-cancelled: 8+ hours past appointment time without check-in";
                if (a.getNotes() == null || a.getNotes().isEmpty()) {
                    a.setNotes(noteSuffix);
                } else if (!a.getNotes().contains("Auto-cancelled")) {
                    a.setNotes(a.getNotes() + " | " + noteSuffix);
                }
                a.setUpdatedAt(now);
                toSave.add(a);
            }
        }

        if (!toSave.isEmpty()) {
            appointmentRepository.saveAll(toSave);
        }
        return list;
    }

    private boolean isExpiredWithoutCheckIn(Appointment appt, LocalDateTime now) {
        if (appt == null || appt.getStatus() == null) return false;
        String s = appt.getStatus().trim().toLowerCase();
        if (s.equals("checked-in") || s.equals("checked_in") || s.equals("completed") || s.equals("cancelled") || s.equals("no-show") || s.equals("no_show")) {
            return false;
        }

        // 1. Check 8 hours past scheduled slot (date + time)
        if (appt.getDate() != null && !appt.getDate().trim().isEmpty()) {
            try {
                LocalDate d = LocalDate.parse(appt.getDate().trim());
                java.time.LocalTime t = java.time.LocalTime.of(9, 0);
                if (appt.getTime() != null && !appt.getTime().trim().isEmpty()) {
                    String timeStr = appt.getTime().trim();
                    if (timeStr.length() == 5) {
                        t = java.time.LocalTime.parse(timeStr);
                    } else if (timeStr.length() == 8) {
                        t = java.time.LocalTime.parse(timeStr.substring(0, 5));
                    } else if (timeStr.length() == 4 && timeStr.charAt(1) == ':') {
                        t = java.time.LocalTime.parse("0" + timeStr);
                    }
                }
                LocalDateTime slotDateTime = LocalDateTime.of(d, t);
                // An appointment is only auto-cancelled if current time is >= 8 hours AFTER scheduled slot
                return slotDateTime.plusHours(8).isBefore(now);
            } catch (Exception ignored) {}
        }

        // 2. Only fallback to 8 hours past creation time if no scheduled date exists
        if (appt.getCreatedAt() != null && (appt.getDate() == null || appt.getDate().trim().isEmpty())) {
            return appt.getCreatedAt().plusHours(8).isBefore(now);
        }

        return false;
    }

    @CacheEvict(value = {"appointments", "today_appointments"}, allEntries = true)
    @Transactional
    public Appointment createAppointment(Appointment appt, User user) {
        Optional.ofNullable(appt.getDoctorId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("doctor_id is required."));

        Optional.ofNullable(appt.getDate())
                .filter(d -> !d.isEmpty())
                .orElseThrow(() -> new BadRequestException("date is required."));

        Optional.ofNullable(appt.getTime())
                .filter(t -> !t.isEmpty())
                .orElseThrow(() -> new BadRequestException("time is required."));

        // Doctor tenant lookup to enforce multi-tenant isolation
        User doctor = userRepository.findById(appt.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + appt.getDoctorId()));

        String targetHospitalId = Optional.ofNullable(doctor.getHospitalId())
                .filter(h -> !h.isEmpty())
                .orElseGet(() -> Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));

        appt.setHospitalId(targetHospitalId);

        String patientId = appt.getPatientId();
        if (patientId == null || patientId.isEmpty()) {
            if (user != null && user.getId() != null) {
                patientId = user.getId();
            } else {
                throw new BadRequestException("patient_id is required.");
            }
        }

        // Verify or auto-provision patient record within the target hospital tenant
        boolean patientExists = patientRepository.findById(patientId)
                .map(p -> targetHospitalId.equals(p.getHospitalId()))
                .orElse(false);

        if (!patientExists) {
            Patient newPatient = new Patient();
            newPatient.setId(patientId);
            newPatient.setUhid("UHID-" + (100000 + new Random().nextInt(900000)));
            newPatient.setHospitalId(targetHospitalId);
            newPatient.setName(user != null && user.getName() != null ? user.getName() : "Patient User");
            newPatient.setPhone(user != null ? user.getPhone() : "");
            newPatient.setIsActive(1);
            patientRepository.save(newPatient);
        }

        appt.setPatientId(patientId);

        if (appt.getId() == null || appt.getId().isEmpty()) {
            appt.setId("apt-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (appt.getBookedBy() == null || appt.getBookedBy().isEmpty()) {
            appt.setBookedBy(Optional.ofNullable(user).map(User::getId).orElse(patientId));
        }

        if (appt.getStatus() == null || appt.getStatus().isEmpty()) {
            appt.setStatus("confirmed");
        }

        if (appt.getCreatedAt() == null) appt.setCreatedAt(LocalDateTime.now());
        if (appt.getUpdatedAt() == null) appt.setUpdatedAt(LocalDateTime.now());

        return appointmentRepository.save(appt);
    }

    @CacheEvict(value = {"appointments", "today_appointments"}, allEntries = true)
    @Transactional
    public Appointment updateAppointmentStatus(String id, Map<String, String> body) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + id));

        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            if (appt.getHospitalId() != null && !hospitalId.equals(appt.getHospitalId())) {
                throw new ResourceNotFoundException("Appointment not found with ID: " + id);
            }
        }

        String newStatus = Optional.ofNullable(body.get("status"))
                .filter(s -> !s.trim().isEmpty())
                .orElseThrow(() -> new BadRequestException("status is required."));

        appt.setStatus(newStatus.trim());
        appt.setUpdatedAt(LocalDateTime.now());

        return appointmentRepository.save(appt);
    }
}
