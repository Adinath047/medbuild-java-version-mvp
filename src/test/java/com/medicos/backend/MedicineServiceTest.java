package com.medicos.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicos.backend.entity.Medicine;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.MedicineRepository;
import com.medicos.backend.repository.PrescriptionRepository;
import com.medicos.backend.service.MedicineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicineServiceTest {

    @Mock private MedicineRepository medicineRepository;
    @Mock private PrescriptionRepository prescriptionRepository;

    private MedicineService medicineService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        medicineService = new MedicineService(medicineRepository, prescriptionRepository, objectMapper);
    }

    @Test
    void searchMedicines_ShortQuery_ReturnsEmptyList() {
        List<Medicine> result = medicineService.searchMedicines("a");
        assertTrue(result.isEmpty());
        verifyNoInteractions(medicineRepository);
    }

    @Test
    void searchMedicines_ValidQuery_ReturnsMatches() {
        Medicine med = new Medicine();
        med.setId("med-001");
        med.setName("Paracetamol");
        when(medicineRepository.searchMedicines("Para")).thenReturn(List.of(med));

        List<Medicine> result = medicineService.searchMedicines("Para");

        assertEquals(1, result.size());
        assertEquals("Paracetamol", result.get(0).getName());
    }

    @Test
    void createMedicine_ValidInput_SavesMedicine() {
        User user = new User();
        user.setHospitalId("hsp-001");

        Medicine med = new Medicine();
        med.setName("Amoxicillin");

        when(medicineRepository.save(any(Medicine.class))).thenAnswer(i -> i.getArgument(0));

        Medicine saved = medicineService.createMedicine(med, user);

        assertNotNull(saved.getId());
        assertEquals("hsp-001", saved.getHospitalId());
        assertEquals("Amoxicillin", saved.getName());
    }
}
