package com.medicos.backend.fhir.config;

import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Initializes a deterministic test clinician and patient for FHIR conformance and Inferno testing.
 * Runs on application startup if records are missing.
 */
@Component
public class FhirStagingDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FhirStagingDataInitializer.class);

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final PasswordEncoder passwordEncoder;

    public FhirStagingDataInitializer(HospitalRepository hospitalRepository,
                                       UserRepository userRepository,
                                       PatientRepository patientRepository,
                                       PasswordEncoder passwordEncoder) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        // 1. Ensure Hospital hsp-001
        if (hospitalRepository.findById("hsp-001").isEmpty()) {
            Hospital h = new Hospital();
            h.setId("hsp-001");
            h.setName("Medbuilds General Hospital");
            h.setType("General");
            h.setCity("Mumbai");
            h.setPhone("+91-22-12345678");
            h.setIsActive(1);
            hospitalRepository.save(h);
            log.info("[FhirStagingDataInitializer] Provisioned staging hospital hsp-001");
        }

        // 2. Ensure Doctor usr-fhir-clinician
        if (userRepository.findById("usr-fhir-clinician").isEmpty()) {
            User u = new User();
            u.setId("usr-fhir-clinician");
            u.setName("Dr. Inferno Clinician");
            u.setEmail("inferno.clinician@medbuilds.com");
            u.setPassword(passwordEncoder.encode("Password123!"));
            u.setRole("doctor");
            u.setHospitalId("hsp-001");
            u.setIsActive(1);
            userRepository.save(u);
            log.info("[FhirStagingDataInitializer] Provisioned staging clinician usr-fhir-clinician");
        }

        // 3. Ensure Test Patient pat-fhir-001
        if (patientRepository.findById("pat-fhir-001").isEmpty()) {
            Patient p = new Patient();
            p.setId("pat-fhir-001");
            p.setUhid("UHID-1001");
            p.setHospitalId("hsp-001");
            p.setName("John Smith");
            p.setSex("Male");
            p.setDob("1985-06-15");
            p.setPhone("+91-9876543210");
            p.setEmail("john.smith@example.com");
            p.setAddress("100 Healthcare Ave, Medical District");
            p.setBloodGroup("O+");
            p.setIsActive(1);
            patientRepository.save(p);
            log.info("[FhirStagingDataInitializer] Provisioned staging patient pat-fhir-001 (John Smith)");
        }
    }
}
