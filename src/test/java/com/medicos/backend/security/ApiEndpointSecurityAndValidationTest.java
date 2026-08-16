package com.medicos.backend.security;

import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.repository.*;
import com.medicos.backend.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class ApiEndpointSecurityAndValidationTest {

    @Autowired
    private BillingService billingService;

    @Autowired
    private VitalService vitalService;

    @Autowired
    private PatientService patientService;

    @Autowired
    private BedService bedService;

    @Autowired
    private MedicineService medicineService;

    @Autowired
    private BillingRepository billingRepository;

    @Autowired
    private PatientRepository patientRepository;

    private User testUserHsp1;

    @BeforeEach
    void setUp() {
        testUserHsp1 = new User();
        testUserHsp1.setId("usr-test-01");
        testUserHsp1.setName("Test Doctor");
        testUserHsp1.setHospitalId("hsp-001");
        testUserHsp1.setRole("doctor");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Billing: createBill rejects missing patient_id")
    void testCreateBillMissingPatientId() {
        TenantContext.setTenantId("hsp-001");
        Billing bill = new Billing();
        bill.setTotalAmount(500.0);

        assertThrows(BadRequestException.class, () -> billingService.createBill(bill, testUserHsp1));
    }

    @Test
    @DisplayName("Billing: recordPayment rejects negative paid amount")
    void testRecordPaymentNegativeAmount() {
        TenantContext.setTenantId("hsp-001");
        Billing bill = new Billing();
        bill.setPatientId("pat-test-01");
        bill.setTotalAmount(1000.0);
        Billing saved = billingService.createBill(bill, testUserHsp1);

        assertThrows(BadRequestException.class, () -> 
            billingService.recordPayment(saved.getId(), Map.of("paid_amount", -250.0))
        );
    }

    @Test
    @DisplayName("Billing: recordPayment prevents cross-tenant modification")
    void testRecordPaymentCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");
        Billing bill = new Billing();
        bill.setPatientId("pat-test-02");
        bill.setTotalAmount(800.0);
        Billing saved = billingService.createBill(bill, testUserHsp1);

        // Attempt modification from hospital 2
        TenantContext.setTenantId("hsp-002");
        assertThrows(ResourceNotFoundException.class, () -> 
            billingService.recordPayment(saved.getId(), Map.of("paid_amount", 500.0))
        );
    }

    @Test
    @DisplayName("Vitals: recordVitals validates systolic BP range")
    void testRecordVitalsRangeValidation() {
        TenantContext.setTenantId("hsp-001");
        Vital vital = new Vital();
        vital.setPatientId("pat-test-01");
        vital.setBpSystolic(450); // Unrealistic BP > 300

        assertThrows(BadRequestException.class, () -> vitalService.recordVitals(vital, testUserHsp1));
    }

    @Test
    @DisplayName("Vitals: recordVitals validates SpO2 percentage range")
    void testRecordVitalsSpo2Validation() {
        TenantContext.setTenantId("hsp-001");
        Vital vital = new Vital();
        vital.setPatientId("pat-test-01");
        vital.setSpo2(150); // SpO2 > 100%

        assertThrows(BadRequestException.class, () -> vitalService.recordVitals(vital, testUserHsp1));
    }

    @Test
    @DisplayName("Patients: createPatient rejects invalid age > 150")
    void testCreatePatientInvalidAge() {
        TenantContext.setTenantId("hsp-001");
        Patient patient = new Patient();
        patient.setName("Invalid Age Patient");
        patient.setAge(220);

        assertThrows(BadRequestException.class, () -> patientService.createPatient(patient, testUserHsp1));
    }

    @Test
    @DisplayName("Bed: allocateBed prevents cross-tenant access")
    void testAllocateBedCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");
        com.medicos.backend.entity.Bed bed = new com.medicos.backend.entity.Bed();
        bed.setBedNumber("BED-SEC-01");
        bed.setWard("ICU");
        com.medicos.backend.entity.Bed saved = bedService.createBed(bed, testUserHsp1);

        // Attempt allocation from hospital 2
        TenantContext.setTenantId("hsp-002");
        assertThrows(ResourceNotFoundException.class, () ->
            bedService.allocateBed(saved.getId(), Map.of("patient_id", "pat-test-01"), testUserHsp1)
        );
    }
}
