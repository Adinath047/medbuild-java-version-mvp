package com.medicos.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.*;
import com.medicos.backend.service.SyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncServiceTest {

    @Mock private PatientRepository patientRepository;
    @Mock private EncounterRepository encounterRepository;
    @Mock private VitalRepository vitalRepository;
    @Mock private PrescriptionRepository prescriptionRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private BedRepository bedRepository;
    @Mock private BillingRepository billingRepository;
    @Mock private MedicineRepository medicineRepository;

    private SyncService syncService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        syncService = new SyncService(
                patientRepository, encounterRepository, vitalRepository,
                prescriptionRepository, appointmentRepository, bedRepository,
                billingRepository, medicineRepository, objectMapper
        );
    }

    @Test
    void pullData_ReturnsExpectedStructure() {
        User user = new User();
        user.setId("usr-001");
        user.setHospitalId("hsp-001");
        user.setRole("doctor");

        when(patientRepository.findByHospitalId("hsp-001")).thenReturn(Collections.emptyList());
        when(encounterRepository.findByHospitalIdOrderByCreatedAtDesc("hsp-001")).thenReturn(Collections.emptyList());
        when(vitalRepository.findByHospitalIdOrderByRecordedAtDesc("hsp-001")).thenReturn(Collections.emptyList());
        when(prescriptionRepository.findByHospitalIdOrderByCreatedAtDesc("hsp-001")).thenReturn(Collections.emptyList());
        when(appointmentRepository.findByHospitalIdOrderByDateDesc("hsp-001")).thenReturn(Collections.emptyList());
        when(billingRepository.findByHospitalIdOrderByCreatedAtDesc("hsp-001")).thenReturn(Collections.emptyList());
        when(medicineRepository.findByHospitalId("hsp-001")).thenReturn(Collections.emptyList());

        Map<String, Object> result = syncService.pullData(user, null, null);

        assertNotNull(result.get("serverTime"));
        assertNotNull(result.get("pulledAt"));
        assertTrue(result.containsKey("data"));
    }

    @Test
    void pushData_ProcessesValidRecord() {
        User user = new User();
        user.setId("usr-001");
        user.setHospitalId("hsp-001");

        Map<String, Object> payload = Map.of(
                "records", List.of(
                        Map.of(
                                "table", "vitals",
                                "operation", "insert",
                                "payload", Map.of("id", "vit-100", "hospital_id", "hsp-001", "patient_id", "pat-001", "bp_systolic", "120")
                        )
                )
        );

        Map<String, Object> response = syncService.pushData(payload, user);

        assertEquals(1, response.get("synced"));
        assertEquals(0, response.get("failed"));
        verify(vitalRepository, times(1)).save(any());
    }
}
