package com.medicos.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.dto.PrescriptionDTO;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.Prescription;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.*;
import com.medicos.backend.service.PrescriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class PrescriptionServiceTest {

    private PrescriptionRepository prescriptionRepository;
    private PatientRepository patientRepository;
    private UserRepository userRepository;
    private EncounterRepository encounterRepository;
    private VitalRepository vitalRepository;
    private ObjectMapper objectMapper;
    private PrescriptionService prescriptionService;

    @BeforeEach
    public void setUp() {
        prescriptionRepository = mock(PrescriptionRepository.class);
        patientRepository = mock(PatientRepository.class);
        userRepository = mock(UserRepository.class);
        encounterRepository = mock(EncounterRepository.class);
        vitalRepository = mock(VitalRepository.class);
        objectMapper = new ObjectMapper();

        prescriptionService = new PrescriptionService(
                prescriptionRepository,
                patientRepository,
                userRepository,
                encounterRepository,
                vitalRepository,
                objectMapper
        );
    }

    @Test
    public void testCreateAndEnrichPrescription() {
        Patient patient = new Patient();
        patient.setId("pat-001");
        patient.setName("Aarav Sharma");
        patient.setUhid("UHID-1001");
        patient.setAge(35);
        patient.setSex("Male");

        User doctor = new User();
        doctor.setId("usr-doc-001");
        doctor.setName("Dr. Ananya Rao");
        doctor.setRole("doctor");

        when(patientRepository.findById("pat-001")).thenReturn(Optional.of(patient));
        when(userRepository.findById("usr-doc-001")).thenReturn(Optional.of(doctor));

        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(invocation -> {
            Prescription p = invocation.getArgument(0);
            return p;
        });

        Map<String, Object> body = new HashMap<>();
        body.put("patient_id", "pat-001");
        body.put("doctor_id", "usr-doc-001");
        body.put("advice", "Drink 3L water daily");
        body.put("follow_up_date", "2026-08-10");
        body.put("medicines", List.of(
                Map.of("name", "Amoxicillin 500mg", "dose", "1 cap", "frequency", "1-0-1", "duration", "5 days")
        ));

        PrescriptionDTO dto = prescriptionService.createPrescriptionFromMap(body, doctor);

        assertNotNull(dto);
        assertEquals("pat-001", dto.getPatientId());
        assertEquals("usr-doc-001", dto.getDoctorId());
        assertEquals("Aarav Sharma", dto.getPatientName());
        assertEquals("UHID-1001", dto.getUhid());
        assertEquals("Dr. Ananya Rao", dto.getDoctorName());
        assertEquals("Drink 3L water daily", dto.getAdvice());
        assertNotNull(dto.getMedicines());
        assertTrue(dto.getMedicines() instanceof List);
    }
}
