package com.medicos.backend.repository;

import com.medicos.backend.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, String> {
    List<Appointment> findByPatientIdOrderByDateDesc(String patientId);
    List<Appointment> findByDoctorIdOrderByDateDesc(String doctorId);
    List<Appointment> findByDate(String date);
    List<Appointment> findByHospitalIdOrderByDateDesc(String hospitalId);
}
