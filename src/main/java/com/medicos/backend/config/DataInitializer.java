package com.medicos.backend.config;

import com.medicos.backend.entity.Hospital;
import com.medicos.backend.entity.HealthTip;
import com.medicos.backend.entity.User;
import com.medicos.backend.repository.HealthTipRepository;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final HealthTipRepository healthTipRepository;
    private final com.medicos.backend.repository.PatientRepository patientRepository;
    private final com.medicos.backend.repository.AppointmentRepository appointmentRepository;
    private final com.medicos.backend.repository.BedRepository bedRepository;
    private final com.medicos.backend.repository.VitalRepository vitalRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(HospitalRepository hospitalRepository,
                           UserRepository userRepository,
                           HealthTipRepository healthTipRepository,
                           com.medicos.backend.repository.PatientRepository patientRepository,
                           com.medicos.backend.repository.AppointmentRepository appointmentRepository,
                           com.medicos.backend.repository.BedRepository bedRepository,
                           com.medicos.backend.repository.VitalRepository vitalRepository,
                           PasswordEncoder passwordEncoder) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.healthTipRepository = healthTipRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.bedRepository = bedRepository;
        this.vitalRepository = vitalRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Checking initial hospital and staff seed data...");

        // 1. Seed Hospital hsp-001 (Medicos Hospital & EMR Center)
        Hospital hsp1 = hospitalRepository.findById("hsp-001").orElseGet(() -> {
            Hospital h = new Hospital();
            h.setId("hsp-001");
            h.setName("Medicos Hospital & EMR Center");
            h.setType("Multispecialty Hospital");
            h.setAddress("100 Healthcare Boulevard, LAN Ward");
            h.setCity("Mumbai");
            h.setState("Maharashtra");
            h.setPincode("400001");
            h.setPhone("+91-22-5555-0100");
            h.setEmail("contact@medicoshospital.com");
            h.setIsActive(1);
            return hospitalRepository.save(h);
        });

        // 2. Seed Hospital hsp-002 (City Care Specialty Clinic)
        Hospital hsp2 = hospitalRepository.findById("hsp-002").orElseGet(() -> {
            Hospital h = new Hospital();
            h.setId("hsp-002");
            h.setName("City Care Specialty Clinic");
            h.setType("Specialty Clinic");
            h.setAddress("45 Metro Station Road, Sector 12");
            h.setCity("Pune");
            h.setState("Maharashtra");
            h.setPincode("411001");
            h.setPhone("+91-20-4444-0200");
            h.setEmail("info@citycareclinic.com");
            h.setIsActive(1);
            return hospitalRepository.save(h);
        });

        String defaultPasswordHash = passwordEncoder.encode("doctor123");

        // Staff for hsp-001 (Medicos Hospital)
        createUserIfMissing("usr-doc-001", "Dr. Ananya Rao", "doctor@medicos.com", defaultPasswordHash, "doctor", "hsp-001", "STF-101", "Cardiology", "MBBS, MD (Cardiology)");
        createUserIfMissing("usr-doc-003", "Dr. Rajesh Sharma", "doctor2@medicos.com", defaultPasswordHash, "doctor", "hsp-001", "STF-103", "General Surgery", "MBBS, MS (General Surgery)");
        createUserIfMissing("usr-rec-001", "Rajesh Patel", "receptionist@medicos.com", defaultPasswordHash, "receptionist", "hsp-001", "STF-102", "Front Desk", "B.Com");
        createUserIfMissing("usr-nrs-001", "Sunita Deshmukh", "nurse@medicos.com", defaultPasswordHash, "nurse", "hsp-001", "STF-104", "Nursing", "B.Sc Nursing");
        createUserIfMissing("usr-lab-001", "Amit Kulkarni", "lab@medicos.com", defaultPasswordHash, "lab_technician", "hsp-001", "STF-105", "Pathology & Diagnostics", "DMLT");
        createUserIfMissing("usr-phm-001", "Suresh Mehta", "pharmacy@medicos.com", defaultPasswordHash, "pharmacist", "hsp-001", "STF-106", "Pharmacy", "B.Pharm");
        createUserIfMissing("usr-bil-001", "Pooja Verma", "billing@medicos.com", defaultPasswordHash, "billing", "hsp-001", "STF-107", "Insurance & Finance", "M.Com");
        createUserIfMissing("usr-adm-001", "Admin User", "admin@medicos.com", defaultPasswordHash, "admin", "hsp-001", "STF-100", "Hospital Management", "MBA Healthcare");

        // Staff for hsp-002 (City Care Specialty Clinic)
        createUserIfMissing("usr-doc-002", "Dr. Vikram Seth", "doctor.city@medicos.com", defaultPasswordHash, "doctor", "hsp-002", "STF-201", "General Medicine", "MBBS, MD (Internal Medicine)");
        createUserIfMissing("usr-doc-004", "Dr. Meera Nair", "doctor2.city@medicos.com", defaultPasswordHash, "doctor", "hsp-002", "STF-203", "Pediatrics", "MBBS, DCH");
        createUserIfMissing("usr-rec-002", "Priya Sharma", "receptionist.city@medicos.com", defaultPasswordHash, "receptionist", "hsp-002", "STF-202", "Front Desk", "B.Sc");
        createUserIfMissing("usr-nrs-002", "Kavita Joshi", "nurse.city@medicos.com", defaultPasswordHash, "nurse", "hsp-002", "STF-204", "Nursing", "B.Sc Nursing");
        createUserIfMissing("usr-lab-002", "Deepak Gupta", "lab.city@medicos.com", defaultPasswordHash, "lab_technician", "hsp-002", "STF-205", "Diagnostics", "DMLT");
        createUserIfMissing("usr-phm-002", "Rohan Saxena", "pharmacy.city@medicos.com", defaultPasswordHash, "pharmacist", "hsp-002", "STF-206", "Pharmacy", "B.Pharm");
        createUserIfMissing("usr-bil-002", "Anil Kumar", "billing.city@medicos.com", defaultPasswordHash, "billing", "hsp-002", "STF-207", "Finance", "B.Com");
        createUserIfMissing("usr-adm-002", "City Admin", "admin.city@medicos.com", defaultPasswordHash, "admin", "hsp-002", "STF-200", "Clinic Management", "MHA");

        seedClinicalDataIfMissing();
        seedDoctorDistrictsIfMissing();
        seedHealthTipsIfMissing();

        log.info("Hospital and staff initial data check completed successfully.");
    }

    private void seedDoctorDistrictsIfMissing() {
        try {
            setDoctorDistrict("usr-doc-001", "Mumbai", 4.8, 12, 320);
            setDoctorDistrict("usr-doc-002", "Pune", 4.6, 8, 210);
            setDoctorDistrict("usr-doc-003", "Mumbai", 4.7, 15, 450);
            setDoctorDistrict("usr-doc-004", "Pune", 4.9, 10, 180);
        } catch (Exception e) {
            log.warn("Could not set doctor districts: {}", e.getMessage());
        }
    }

    private void setDoctorDistrict(String doctorId, String district, double rating, int experienceYears, int consultedCount) {
        userRepository.findById(doctorId).ifPresent(user -> {
            if (user.getDistrict() == null) {
                user.setDistrict(district);
                user.setRating(rating);
                user.setExperienceYears(experienceYears);
                user.setConsultedCount(consultedCount);
                userRepository.save(user);
                log.info("Set district [{}] for doctor [{}]", district, doctorId);
            }
        });
    }

    private void seedHealthTipsIfMissing() {
        try {
            if (healthTipRepository.count() == 0) {
                createHealthTip("tip-001", "Stay Hydrated", "Drink at least 8 glasses of water daily to maintain optimal body function and energy levels.", "💧", "Hydration");
                createHealthTip("tip-002", "Exercise Daily", "30 minutes of moderate exercise each day reduces risk of heart disease, diabetes, and depression.", "🏃", "Fitness");
                createHealthTip("tip-003", "Balanced Diet", "Include fruits, vegetables, whole grains, and lean proteins in every meal for complete nutrition.", "🥗", "Nutrition");
                createHealthTip("tip-004", "Quality Sleep", "Adults need 7–9 hours of quality sleep. Create a consistent bedtime routine for better rest.", "😴", "Sleep");
                createHealthTip("tip-005", "Manage Stress", "Practice mindfulness, deep breathing, or yoga to reduce chronic stress and improve mental health.", "🧘", "Mental Health");
                createHealthTip("tip-006", "Regular Checkups", "Schedule annual health screenings to detect conditions early when they're most treatable.", "🩺", "Prevention");
                createHealthTip("tip-007", "Hand Hygiene", "Wash hands with soap for 20 seconds before meals and after using the restroom to prevent infections.", "🧼", "Hygiene");
                createHealthTip("tip-008", "Limit Screen Time", "Take a 20-second break every 20 minutes looking at something 20 feet away to reduce eye strain.", "📵", "Eye Health");
                log.info("Seeded {} health tips.", 8);
            }
        } catch (Exception e) {
            log.warn("Could not seed health tips: {}", e.getMessage());
        }
    }

    private void createHealthTip(String id, String title, String subtitle, String image, String tag) {
        if (healthTipRepository.findById(id).isEmpty()) {
            HealthTip tip = new HealthTip();
            tip.setId(id);
            tip.setTitle(title);
            tip.setSubtitle(subtitle);
            tip.setImage(image);
            tip.setTag(tag);
            healthTipRepository.save(tip);
        }
    }

    private void seedClinicalDataIfMissing() {
        try {
            // Seed Patients
            if (patientRepository.count() == 0) {
                com.medicos.backend.entity.Patient p1 = new com.medicos.backend.entity.Patient();
                p1.setId("pat-c7757203");
                p1.setUhid("UHID-001-000001");
                p1.setHospitalId("hsp-001");
                p1.setName("Rakesh Kuber");
                p1.setAge(56);
                p1.setSex("Male");
                p1.setPhone("4354353484");
                p1.setBloodGroup("O+");
                patientRepository.save(p1);

                com.medicos.backend.entity.Patient p2 = new com.medicos.backend.entity.Patient();
                p2.setId("pat-002");
                p2.setUhid("UHID-001-000002");
                p2.setHospitalId("hsp-001");
                p2.setName("Sunita Sharma");
                p2.setAge(42);
                p2.setSex("Female");
                p2.setPhone("9876543210");
                p2.setBloodGroup("A+");
                patientRepository.save(p2);

                com.medicos.backend.entity.Patient p3 = new com.medicos.backend.entity.Patient();
                p3.setId("pat-003");
                p3.setUhid("UHID-001-000003");
                p3.setHospitalId("hsp-001");
                p3.setName("Amit Verma");
                p3.setAge(65);
                p3.setSex("Male");
                p3.setPhone("9123456789");
                p3.setBloodGroup("B+");
                patientRepository.save(p3);
            }

            // Seed Appointments
            if (appointmentRepository.count() == 0) {
                String todayStr = java.time.LocalDate.now().toString();
                String tomorrowStr = java.time.LocalDate.now().plusDays(1).toString();

                com.medicos.backend.entity.Appointment a1 = new com.medicos.backend.entity.Appointment();
                a1.setId("appt-001");
                a1.setHospitalId("hsp-001");
                a1.setPatientId("pat-c7757203");
                a1.setDoctorId("usr-doc-001");
                a1.setDate(todayStr);
                a1.setTime("10:30");
                a1.setTokenNumber(1);
                a1.setReason("Chest tightness & Cardiac Follow-up");
                a1.setStatus("Checked-In");
                appointmentRepository.save(a1);

                com.medicos.backend.entity.Appointment a2 = new com.medicos.backend.entity.Appointment();
                a2.setId("appt-002");
                a2.setHospitalId("hsp-001");
                a2.setPatientId("pat-002");
                a2.setDoctorId("usr-doc-001");
                a2.setDate(todayStr);
                a2.setTime("11:45");
                a2.setTokenNumber(2);
                a2.setReason("Hypertension Checkup");
                a2.setStatus("Scheduled");
                appointmentRepository.save(a2);

                com.medicos.backend.entity.Appointment a3 = new com.medicos.backend.entity.Appointment();
                a3.setId("appt-003");
                a3.setHospitalId("hsp-001");
                a3.setPatientId("pat-003");
                a3.setDoctorId("usr-doc-001");
                a3.setDate(tomorrowStr);
                a3.setTime("10:00");
                a3.setTokenNumber(1);
                a3.setReason("ECG & BP Monitoring");
                a3.setStatus("Scheduled");
                appointmentRepository.save(a3);
            }

            // Seed Critical Bed & Vitals
            if (bedRepository.count() == 0) {
                com.medicos.backend.entity.Bed b1 = new com.medicos.backend.entity.Bed();
                b1.setId("bed-icu-01");
                b1.setHospitalId("hsp-001");
                b1.setBedNumber("ICU-01");
                b1.setWard("ICU");
                b1.setRoom("101");
                b1.setType("ICU Bed");
                b1.setStatus("Occupied");
                b1.setPatientId("pat-c7757203");
                b1.setDoctorId("usr-doc-001");
                b1.setAdmittedAt(LocalDateTime.now().minusHours(4));
                bedRepository.save(b1);

                com.medicos.backend.entity.Vital v1 = new com.medicos.backend.entity.Vital();
                v1.setId("vit-c7757203");
                v1.setHospitalId("hsp-001");
                v1.setPatientId("pat-c7757203");
                v1.setBpSystolic(155);
                v1.setBpDiastolic(95);
                v1.setHeartRate(104);
                v1.setSpo2(91); // Critical low O2 saturation (<94%)
                v1.setTemperature(99.8);
                v1.setRecordedAt(LocalDateTime.now());
                vitalRepository.save(v1);
            }
        } catch (Exception e) {
            log.warn("Could not seed clinical data: {}", e.getMessage());
        }
    }

    private void createUserIfMissing(String id, String name, String email, String passwordHash,
                                     String role, String hospitalId, String staffId,
                                     String specialization, String qualification) {
        if (userRepository.findByEmail(email).isEmpty()) {
            User user = new User();
            user.setId(id);
            user.setName(name);
            user.setEmail(email);
            user.setPassword(passwordHash);
            user.setRole(role);
            user.setHospitalId(hospitalId);
            user.setStaffId(staffId);
            user.setSpecialization(specialization);
            user.setQualification(qualification);
            user.setIsActive(1);
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            log.info("Seeded new staff user [{}] under hospital [{}]", email, hospitalId);
        }
    }
}
