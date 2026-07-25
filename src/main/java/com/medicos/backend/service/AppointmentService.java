package com.medicos.backend.service;

import com.medicos.backend.entity.Appointment;
import com.medicos.backend.entity.User;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.AppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;

    public AppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional(readOnly = true)
    public List<Appointment> getAppointments(String patientId, String doctorId, String date) {
        if (patientId != null && !patientId.isEmpty()) {
            return appointmentRepository.findByPatientIdOrderByDateDesc(patientId);
        } else if (date != null && !date.isEmpty()) {
            return appointmentRepository.findByDate(date);
        } else if (doctorId != null && !doctorId.isEmpty()) {
            return appointmentRepository.findByDoctorIdOrderByDateDesc(doctorId);
        } else {
            return appointmentRepository.findAll();
        }
    }

    @Transactional(readOnly = true)
    public List<Appointment> getTodayAppointments() {
        String todayStr = LocalDate.now().toString();
        return appointmentRepository.findByDate(todayStr);
    }

    @Transactional
    public Appointment createAppointment(Appointment appt, User user) {
        Optional.ofNullable(appt.getPatientId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("patient_id is required."));

        Optional.ofNullable(appt.getDoctorId())
                .filter(id -> !id.isEmpty())
                .orElseThrow(() -> new BadRequestException("doctor_id is required."));

        Optional.ofNullable(appt.getDate())
                .filter(d -> !d.isEmpty())
                .orElseThrow(() -> new BadRequestException("date is required."));

        if (appt.getId() == null || appt.getId().isEmpty()) {
            appt.setId("apt-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (appt.getHospitalId() == null || appt.getHospitalId().isEmpty()) {
            appt.setHospitalId(Optional.ofNullable(user).map(User::getHospitalId).orElse("hsp-001"));
        }

        if (appt.getBookedBy() == null || appt.getBookedBy().isEmpty()) {
            appt.setBookedBy(Optional.ofNullable(user).map(User::getId).orElse("usr-admin-001"));
        }

        if (appt.getCreatedAt() == null) appt.setCreatedAt(LocalDateTime.now());
        if (appt.getUpdatedAt() == null) appt.setUpdatedAt(LocalDateTime.now());

        return appointmentRepository.save(appt);
    }

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
