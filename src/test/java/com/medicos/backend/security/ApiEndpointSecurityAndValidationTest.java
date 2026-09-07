package com.medicos.backend.security;

import com.medicos.backend.entity.Billing;
import com.medicos.backend.entity.Medicine;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.entity.Vital;
import com.medicos.backend.exception.BadRequestException;
import com.medicos.backend.exception.ResourceNotFoundException;
import com.medicos.backend.exception.UnauthorizedException;
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
    private AppointmentService appointmentService;

    @Autowired
    private EncounterService encounterService;

    @Autowired
    private PrescriptionService prescriptionService;

    @Autowired
    private BillingRepository billingRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BedAdmissionRepository admissionRepository;

    @Autowired
    private EncounterRepository encounterRepository;

    private User testUserHsp1;

    @BeforeEach
    void setUp() {
        testUserHsp1 = new User();
        testUserHsp1.setId("usr-test-01");
        testUserHsp1.setName("Test Doctor");
        testUserHsp1.setHospitalId("hsp-001");
        testUserHsp1.setRole("doctor");

        if (!patientRepository.existsById("pat-test-01")) {
            Patient p1 = new Patient();
            p1.setId("pat-test-01");
            p1.setName("Test Patient 1");
            p1.setHospitalId("hsp-001");
            p1.setUhid("UHID-TEST-001");
            p1.setIsActive(1);
            patientRepository.save(p1);
        }

        if (!patientRepository.existsById("pat-test-02")) {
            Patient p2 = new Patient();
            p2.setId("pat-test-02");
            p2.setName("Test Patient 2");
            p2.setHospitalId("hsp-001");
            p2.setUhid("UHID-TEST-002");
            p2.setIsActive(1);
            patientRepository.save(p2);
        }

        if (!patientRepository.existsById("pat-test-hsp2")) {
            Patient p3 = new Patient();
            p3.setId("pat-test-hsp2");
            p3.setName("Foreign Hospital Patient");
            p3.setHospitalId("hsp-002");
            p3.setUhid("UHID-TEST-HSP2");
            p3.setIsActive(1);
            patientRepository.save(p3);
        }

        if (!userRepository.existsById("usr-doc-hsp1")) {
            User d1 = new User();
            d1.setId("usr-doc-hsp1");
            d1.setName("Doctor Hosp 1");
            d1.setEmail("doc1@hsp1.com");
            d1.setPassword("dummy");
            d1.setHospitalId("hsp-001");
            d1.setRole("doctor");
            userRepository.save(d1);
        }

        if (!userRepository.existsById("usr-doc-hsp2")) {
            User d2 = new User();
            d2.setId("usr-doc-hsp2");
            d2.setName("Doctor Hosp 2");
            d2.setEmail("doc2@hsp2.com");
            d2.setPassword("dummy");
            d2.setHospitalId("hsp-002");
            d2.setRole("doctor");
            userRepository.save(d2);
        }

        if (!admissionRepository.existsById("adm-test-hsp2")) {
            com.medicos.backend.entity.BedAdmission adm2 = new com.medicos.backend.entity.BedAdmission();
            adm2.setId("adm-test-hsp2");
            adm2.setHospitalId("hsp-002");
            adm2.setPatientId("pat-test-hsp2");
            adm2.setBedId("bed-test-01");
            adm2.setStatus("Admitted");
            admissionRepository.save(adm2);
        }

        if (!encounterRepository.existsById("enc-test-hsp2")) {
            com.medicos.backend.entity.Encounter enc2 = new com.medicos.backend.entity.Encounter();
            enc2.setId("enc-test-hsp2");
            enc2.setHospitalId("hsp-002");
            enc2.setPatientId("pat-test-hsp2");
            enc2.setDoctorId("usr-doc-hsp2");
            encounterRepository.save(enc2);
        }
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

    @Test
    @DisplayName("Bed: allocateBed prevents linking patient belonging to another hospital")
    void testAllocateBedCrossTenantPatientBlocked() {
        TenantContext.setTenantId("hsp-001");
        com.medicos.backend.entity.Bed bed = new com.medicos.backend.entity.Bed();
        bed.setBedNumber("BED-SEC-02");
        bed.setWard("General");
        com.medicos.backend.entity.Bed saved = bedService.createBed(bed, testUserHsp1);

        // Attempt allocating a patient belonging to hsp-002 to a bed in hsp-001
        assertThrows(ResourceNotFoundException.class, () ->
            bedService.allocateBed(saved.getId(), Map.of("patient_id", "pat-test-hsp2"), testUserHsp1)
        );
    }

    @Test
    @DisplayName("Billing: createBill prevents creating bill for patient of another hospital")
    void testCreateBillCrossTenantPatientBlocked() {
        TenantContext.setTenantId("hsp-001");
        Billing bill = new Billing();
        bill.setPatientId("pat-test-hsp2");
        bill.setTotalAmount(500.0);

        assertThrows(ResourceNotFoundException.class, () ->
            billingService.createBill(bill, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Vitals: recordVitals prevents recording vitals for patient of another hospital")
    void testRecordVitalsCrossTenantPatientBlocked() {
        TenantContext.setTenantId("hsp-001");
        Vital vital = new Vital();
        vital.setPatientId("pat-test-hsp2");
        vital.setBpSystolic(120);
        vital.setBpDiastolic(80);

        assertThrows(ResourceNotFoundException.class, () ->
            vitalService.recordVitals(vital, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Patients: getPatientSummary prevents cross-tenant access")
    void testGetPatientSummaryCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");
        // pat-test-hsp2 belongs to hsp-002
        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getPatientSummary("pat-test-hsp2")
        );
    }

    @Test
    @DisplayName("Patients: getVitalsHistory prevents cross-tenant access")
    void testGetVitalsHistoryCrossTenantBlocked() {
        TenantContext.setTenantId("hsp-001");
        // pat-test-hsp2 belongs to hsp-002
        assertThrows(ResourceNotFoundException.class, () ->
            patientService.getVitalsHistory("pat-test-hsp2")
        );
    }

    @Test
    @DisplayName("Appointments: createAppointment prevents cross-tenant doctor referencing")
    void testAppointmentCrossTenantDoctorBlocked() {
        TenantContext.setTenantId("hsp-001");
        com.medicos.backend.entity.Appointment appt = new com.medicos.backend.entity.Appointment();
        appt.setDoctorId("usr-doc-hsp2");
        appt.setPatientId("pat-test-01");
        appt.setDate(java.time.LocalDate.now().plusDays(1).toString());
        appt.setTime("10:00");

        assertThrows(ResourceNotFoundException.class, () ->
            appointmentService.createAppointment(appt, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Appointments: createAppointment prevents cross-tenant patient referencing")
    void testAppointmentCrossTenantPatientBlocked() {
        TenantContext.setTenantId("hsp-001");
        com.medicos.backend.entity.Appointment appt = new com.medicos.backend.entity.Appointment();
        appt.setDoctorId("usr-doc-hsp1");
        appt.setPatientId("pat-test-hsp2");
        appt.setDate(java.time.LocalDate.now().plusDays(1).toString());
        appt.setTime("10:00");

        assertThrows(ResourceNotFoundException.class, () ->
            appointmentService.createAppointment(appt, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Encounters: createEncounter prevents cross-tenant doctor referencing")
    void testEncounterCrossTenantDoctorBlocked() {
        TenantContext.setTenantId("hsp-001");
        com.medicos.backend.entity.Encounter enc = new com.medicos.backend.entity.Encounter();
        enc.setPatientId("pat-test-01");
        enc.setDoctorId("usr-doc-hsp2");

        assertThrows(ResourceNotFoundException.class, () ->
            encounterService.createEncounter(enc, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Prescriptions: createPrescriptionFromMap prevents cross-tenant doctor referencing")
    void testPrescriptionCrossTenantDoctorBlocked() {
        TenantContext.setTenantId("hsp-001");
        Map<String, Object> body = Map.of(
            "patient_id", "pat-test-01",
            "doctor_id", "usr-doc-hsp2"
        );

        assertThrows(ResourceNotFoundException.class, () ->
            prescriptionService.createPrescriptionFromMap(body, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Prescriptions: createPrescriptionFromMap prevents cross-tenant encounter referencing")
    void testPrescriptionCrossTenantEncounterBlocked() {
        TenantContext.setTenantId("hsp-001");
        Map<String, Object> body = Map.of(
            "patient_id", "pat-test-01",
            "doctor_id", "usr-doc-hsp1",
            "encounter_id", "enc-test-hsp2"
        );

        assertThrows(ResourceNotFoundException.class, () ->
            prescriptionService.createPrescriptionFromMap(body, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Billing: createBill prevents cross-tenant admission referencing")
    void testBillingCrossTenantAdmissionBlocked() {
        TenantContext.setTenantId("hsp-001");
        Billing bill = new Billing();
        bill.setPatientId("pat-test-01");
        bill.setAdmissionId("adm-test-hsp2");
        bill.setTotalAmount(500.0);

        assertThrows(ResourceNotFoundException.class, () ->
            billingService.createBill(bill, testUserHsp1)
        );
    }

    @Test
    @DisplayName("Patients: updatePatient prevents cross-tenant primaryDoctorId referencing")
    void testPatientUpdateCrossTenantPrimaryDoctorBlocked() {
        TenantContext.setTenantId("hsp-001");
        Patient update = new Patient();
        update.setPrimaryDoctorId("usr-doc-hsp2");

        assertThrows(ResourceNotFoundException.class, () ->
            patientService.updatePatient("pat-test-01", update)
        );
    }

    @Test
    @DisplayName("Medicines: hospital staff cannot write into the global formulary catalog")
    void testHospitalStaffCannotCreateGlobalMedicine() {
        TenantContext.setTenantId("hsp-001");
        Medicine med = new Medicine();
        med.setName("Custom Amoxicillin 500");
        med.setHospitalId(null); // attempt to create a global entry

        Medicine saved = medicineService.createMedicine(med, testUserHsp1);
        assertEquals("hsp-001", saved.getHospitalId(), "Hospital staff creation must force hospital tenant scoping");
    }

    @Test
    @DisplayName("Medicines: super admin can publish to the shared global formulary")
    void testSuperAdminCanCreateGlobalMedicine() {
        TenantContext.setTenantId("GLOBAL");
        User superAdmin = new User();
        superAdmin.setId("usr-super-admin");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setHospitalId("GLOBAL");

        Medicine med = new Medicine();
        med.setName("Global Paracetamol 650");
        med.setHospitalId(null);

        Medicine saved = medicineService.createMedicine(med, superAdmin);
        assertEquals("GLOBAL", saved.getHospitalId(), "Super Admin must be able to publish global medicines with GLOBAL tenant sentinel");
    }

    @Test
    @DisplayName("Medicines: non-super-admin without hospital context is rejected from creating global medicines")
    void testNonSuperAdminWithGlobalContextCannotCreateMedicine() {
        TenantContext.setTenantId("GLOBAL");
        User doctorWithNoHospital = new User();
        doctorWithNoHospital.setId("usr-doc-orphaned");
        doctorWithNoHospital.setRole("doctor");
        doctorWithNoHospital.setHospitalId(null);

        Medicine med = new Medicine();
        med.setName("Unauthorized Global Drug");

        assertThrows(UnauthorizedException.class, () ->
            medicineService.createMedicine(med, doctorWithNoHospital)
        );
    }
}
