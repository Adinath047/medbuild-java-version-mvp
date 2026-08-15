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

    @Cacheable(value = "appointments", key = "(T(com.medicos.backend.security.TenantContext).getTenantId() != null ? T(com.medicos.backend.security.TenantContext).getTenantId() : 'GLOBAL') + '_p_' + (#patientId != null ? #patientId : 'null') + '_d_' + (#doctorId != null ? #doctorId : 'null') + '_dt_' + (#date != null ? #date : 'null')")
    @Transactional(readOnly = true)
    public List<Appointment> getAppointments(String patientId, String doctorId, String date) {
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        boolean isTenantScoped = hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId);

        if (patientId != null && !patientId.isEmpty()) {
            return isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndPatientIdOrderByDateDesc(hospitalId, patientId)
                    : appointmentRepository.findByPatientIdOrderByDateDesc(patientId);
        } else if (doctorId != null && !doctorId.isEmpty()) {
            return isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndDoctorIdOrderByDateDesc(hospitalId, doctorId)
                    : appointmentRepository.findByDoctorIdOrderByDateDesc(doctorId);
        } else if (date != null && !date.isEmpty()) {
            return isTenantScoped
                    ? appointmentRepository.findByHospitalIdAndDate(hospitalId, date)
                    : appointmentRepository.findByDate(date);
        } else {
            return isTenantScoped
                    ? appointmentRepository.findByHospitalIdOrderByDateDesc(hospitalId)
                    : appointmentRepository.findAll();
        }
    }

    @Cacheable(value = "today_appointments", key = "(T(com.medicos.backend.security.TenantContext).getTenantId() != null ? T(com.medicos.backend.security.TenantContext).getTenantId() : 'GLOBAL') + '_' + T(java.time.LocalDate).now().toString()")
    @Transactional(readOnly = true)
    public List<Appointment> getTodayAppointments() {
        String todayStr = LocalDate.now().toString();
        String hospitalId = com.medicos.backend.security.TenantContext.getTenantId();
        if (hospitalId != null && !hospitalId.trim().isEmpty() && !"GLOBAL".equalsIgnoreCase(hospitalId)) {
            return appointmentRepository.findByHospitalIdAndDate(hospitalId, todayStr);
        }
        return appointmentRepository.findByDate(todayStr);
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

        String newStatus = Optional.ofNullable(body.get("status"))
                .filter(s -> !s.isEmpty())
                .orElseThrow(() -> new BadRequestException("status is required."));

        appt.setStatus(newStatus);
        appt.setUpdatedAt(LocalDateTime.now());

        return appointmentRepository.save(appt);
    }
}
