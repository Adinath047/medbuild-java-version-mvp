package com.medicos.backend.config;

import com.medicos.backend.entity.*;
import com.medicos.backend.repository.*;
import com.medicos.backend.repository.HealthTipRepository;
import com.medicos.backend.repository.HospitalRepository;
import com.medicos.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
@Profile("!prod")
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
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public DataInitializer(HospitalRepository hospitalRepository,
                           UserRepository userRepository,
                           HealthTipRepository healthTipRepository,
                           com.medicos.backend.repository.PatientRepository patientRepository,
                           com.medicos.backend.repository.AppointmentRepository appointmentRepository,
                           com.medicos.backend.repository.BedRepository bedRepository,
                           com.medicos.backend.repository.VitalRepository vitalRepository,
                           PasswordEncoder passwordEncoder,
                           org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.healthTipRepository = healthTipRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.bedRepository = bedRepository;
        this.vitalRepository = vitalRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
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
        jdbcTemplate.execute("SELECT set_config('app.current_hospital_id', 'hsp-001', true);");
        createUserIfMissing("usr-doc-001", "Dr. Ananya Rao", "doctor@medicos.com", defaultPasswordHash, "doctor", "hsp-001", "STF-101", "Cardiology", "MBBS, MD (Cardiology)");
        createUserIfMissing("usr-doc-003", "Dr. Rajesh Sharma", "doctor2@medicos.com", defaultPasswordHash, "doctor", "hsp-001", "STF-103", "General Surgery", "MBBS, MS (General Surgery)");
        createUserIfMissing("usr-rec-001", "Rajesh Patel", "receptionist@medicos.com", defaultPasswordHash, "receptionist", "hsp-001", "STF-102", "Front Desk", "B.Com");
        createUserIfMissing("usr-nrs-001", "Sunita Deshmukh", "nurse@medicos.com", defaultPasswordHash, "nurse", "hsp-001", "STF-104", "Nursing", "B.Sc Nursing");
        createUserIfMissing("usr-lab-001", "Amit Kulkarni", "lab@medicos.com", defaultPasswordHash, "lab_technician", "hsp-001", "STF-105", "Pathology & Diagnostics", "DMLT");
        createUserIfMissing("usr-phm-001", "Suresh Mehta", "pharmacy@medicos.com", defaultPasswordHash, "pharmacist", "hsp-001", "STF-106", "Pharmacy", "B.Pharm");
        createUserIfMissing("usr-bil-001", "Pooja Verma", "billing@medicos.com", defaultPasswordHash, "billing", "hsp-001", "STF-107", "Insurance & Finance", "M.Com");
        createUserIfMissing("usr-adm-001", "Admin User", "admin@medicos.com", defaultPasswordHash, "admin", "hsp-001", "STF-100", "Hospital Management", "MBA Healthcare");

        // Staff for hsp-002 (City Care Specialty Clinic)
        jdbcTemplate.execute("SELECT set_config('app.current_hospital_id', 'hsp-002', true);");
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
            jdbcTemplate.execute("SELECT set_config('app.current_hospital_id', 'hsp-001', true);");
            setDoctorDistrict("usr-doc-001", "Mumbai", 4.8, 12, 320);
            setDoctorDistrict("usr-doc-003", "Mumbai", 4.7, 15, 450);

            jdbcTemplate.execute("SELECT set_config('app.current_hospital_id', 'hsp-002', true);");
            setDoctorDistrict("usr-doc-002", "Pune", 4.6, 8, 210);
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
            jdbcTemplate.execute("SELECT set_config('app.current_hospital_id', 'hsp-001', true);");
            
            // Seed Patients idempotently
            createPatientIfMissing("pat-c7757203", "UHID-001-000004", "hsp-001", "Rakesh Kuber", 56, "Male", "4354353484", "O+");
            createPatientIfMissing("pat-002", "UHID-001-000002", "hsp-001", "Sunita Sharma", 42, "Female", "9876543210", "A+");
            createPatientIfMissing("pat-003", "UHID-001-000003", "hsp-001", "Amit Verma", 65, "Male", "9123456789", "B+");

            // Seed Appointments idempotently
            String todayStr = java.time.LocalDate.now().toString();
            String tomorrowStr = java.time.LocalDate.now().plusDays(1).toString();

            createAppointmentIfMissing("appt-001", "hsp-001", "pat-c7757203", "usr-doc-001", todayStr, "10:30", 1, "Chest tightness & Cardiac Follow-up", "Checked-In");
            createAppointmentIfMissing("appt-002", "hsp-001", "pat-002", "usr-doc-001", todayStr, "11:45", 2, "Hypertension Checkup", "Scheduled");
            createAppointmentIfMissing("appt-003", "hsp-001", "pat-002", "usr-doc-003", todayStr, "11:15", 1, "Post-operative Surgery Follow-up", "Checked-In");
            createAppointmentIfMissing("appt-004", "hsp-001", "pat-003", "usr-doc-003", todayStr, "12:30", 2, "Abdominal Pain & Surgical Assessment", "Confirmed");
            createAppointmentIfMissing("appt-005", "hsp-001", "pat-c7757203", "usr-doc-003", tomorrowStr, "10:00", 1, "Post-op Suture Inspection", "Scheduled");

            // Seed Beds & Vitals idempotently
            createBedIfMissing("bed-icu-01", "hsp-001", "ICU-01", "ICU", "101", "ICU Bed", "Occupied", "pat-c7757203", "usr-doc-001");
            createBedIfMissing("bed-surg-01", "hsp-001", "SURG-102", "Surgery", "201", "General", "Occupied", "pat-002", "usr-doc-003");

            createVitalIfMissing("vit-c7757203", "hsp-001", "pat-c7757203", 155, 95, 104, 91, 99.8, 22, 145.0);
            createVitalIfMissing("vit-002", "hsp-001", "pat-002", 148, 92, 102, 93, 100.2, 20, 110.0);
        } catch (Exception e) {
            log.warn("Could not seed clinical data: {}", e.getMessage());
        }
    }

    private void createPatientIfMissing(String id, String uhid, String hospitalId, String name, int age, String sex, String phone, String bloodGroup) {
        if (patientRepository.findById(id).isEmpty() && patientRepository.findByUhid(uhid).isEmpty()) {
            Patient p = new Patient();
            p.setId(id);
            p.setUhid(uhid);
            p.setHospitalId(hospitalId);
            p.setName(name);
            p.setAge(age);
            p.setSex(sex);
            p.setPhone(phone);
            p.setBloodGroup(bloodGroup);
            p.setIsActive(1);
            p.setCreatedAt(LocalDateTime.now());
            p.setUpdatedAt(LocalDateTime.now());
            patientRepository.save(p);
        }
    }

    private void createAppointmentIfMissing(String id, String hospitalId, String patientId, String doctorId, String date, String time, int tokenNumber, String reason, String status) {
        if (appointmentRepository.findById(id).isEmpty()) {
            Appointment a = new Appointment();
            a.setId(id);
            a.setHospitalId(hospitalId);
            a.setPatientId(patientId);
            a.setDoctorId(doctorId);
            a.setDate(date);
            a.setTime(time);
            a.setTokenNumber(tokenNumber);
            a.setReason(reason);
            a.setStatus(status);
            a.setCreatedAt(LocalDateTime.now());
            a.setUpdatedAt(LocalDateTime.now());
            appointmentRepository.save(a);
        }
    }

    private void createBedIfMissing(String id, String hospitalId, String bedNumber, String ward, String room, String type, String status, String patientId, String doctorId) {
        if (bedRepository.findById(id).isEmpty()) {
            Bed b = new Bed();
            b.setId(id);
            b.setHospitalId(hospitalId);
            b.setBedNumber(bedNumber);
            b.setWard(ward);
            b.setRoom(room);
            b.setType(type);
            b.setStatus(status);
            b.setPatientId(patientId);
            b.setDoctorId(doctorId);
            b.setAdmittedAt(LocalDateTime.now().minusHours(4));
            bedRepository.save(b);
        }
    }

    private void createVitalIfMissing(String id, String hospitalId, String patientId, int sys, int dia, int hr, int spo2, double temp, int rr, double sugar) {
        if (vitalRepository.findById(id).isEmpty()) {
            Vital v = new Vital();
            v.setId(id);
            v.setHospitalId(hospitalId);
            v.setPatientId(patientId);
            v.setBpSystolic(sys);
            v.setBpDiastolic(dia);
            v.setHeartRate(hr);
            v.setSpo2(spo2);
            v.setTemperature(temp);
            v.setRespiratoryRate(rr);
            v.setBloodSugar(sugar);
            v.setRecordedBy("usr-doc-001");
            v.setRecordedAt(LocalDateTime.now());
            vitalRepository.save(v);
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
