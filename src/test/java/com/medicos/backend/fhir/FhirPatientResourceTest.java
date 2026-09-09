package com.medicos.backend.fhir;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ResultSeverityEnum;
import ca.uhn.fhir.validation.ValidationResult;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.User;
import com.medicos.backend.fhir.mapper.PatientFhirMapper;
import com.medicos.backend.repository.AuditLogRepository;
import com.medicos.backend.repository.PatientRepository;
import com.medicos.backend.repository.UserRepository;
import com.medicos.backend.security.JwtTokenProvider;
import com.medicos.backend.security.TenantContext;
import org.hl7.fhir.r4.model.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the FHIR R4 Patient resource endpoint.
 *
 * <p>Uses {@link TestRestTemplate} (not MockMvc) because the HAPI {@code RestfulServer}
 * is a raw servlet registered via {@code ServletRegistrationBean}, not routed through
 * Spring's DispatcherServlet. Only real embedded Tomcat can reach it.</p>
 *
 * <p>Verifies:
 * <ol>
 *   <li>Unauthenticated read returns 401</li>
 *   <li>Authenticated clinician reads their patient — valid FHIR R4 Patient returned</li>
 *   <li>HAPI FhirValidator passes schema validation on the response</li>
 *   <li>Cross-tenant read returns 404</li>
 *   <li>HIPAA audit log entry created on successful read</li>
 *   <li>Encrypted sensitive fields (govtIdNumber, insuranceNumber) absent from FHIR output</li>
 *   <li>UHID identifier present in FHIR Patient</li>
 *   <li>PatientFhirMapper unit test: gender mapping</li>
 * </ol>
 * </p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FhirPatientResourceTest {

    @LocalServerPort
    private int port;

    @Autowired FhirContext fhirContext;
    @Autowired PatientFhirMapper mapper;
    @Autowired PatientRepository patientRepository;
    @Autowired UserRepository userRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired JwtTokenProvider tokenProvider;

    private TestRestTemplate restTemplate;
    private IParser jsonParser;
    private FhirValidator validator;
    private String baseUrl;

    private User doctorHsp1;
    private User doctorHsp2;
    private Patient patientHsp1;
    private Patient patientHsp2;

    private String tokenHsp1;
    private String tokenHsp2;

    @BeforeEach
    void setUp() {
        restTemplate = new TestRestTemplate();
        jsonParser  = fhirContext.newJsonParser();
        validator   = fhirContext.newValidator();
        baseUrl     = "http://localhost:" + port;

        // ── Hospital 1 ─────────────────────────────────────────────────────────
        doctorHsp1 = new User();
        doctorHsp1.setId("usr-fhir-doc-hsp1");
        doctorHsp1.setName("Dr. FHIR HSP1");
        doctorHsp1.setEmail("fhir.doc.hsp1@hospital.com");
        doctorHsp1.setPassword("hashedpass");
        doctorHsp1.setRole("doctor");
        doctorHsp1.setHospitalId("fhir-hsp-001");
        userRepository.save(doctorHsp1);

        patientHsp1 = new Patient();
        patientHsp1.setId("pat-fhir-hsp1");
        patientHsp1.setUhid("UHID-FHIR-001");
        patientHsp1.setHospitalId("fhir-hsp-001");
        patientHsp1.setName("Alice FHIR");
        patientHsp1.setSex("Female");
        patientHsp1.setDob("1990-05-15");
        patientHsp1.setPhone("+91-9876543210");
        patientHsp1.setEmail("alice.fhir@example.com");
        patientHsp1.setBloodGroup("O+");
        patientRepository.save(patientHsp1);

        // ── Hospital 2 ─────────────────────────────────────────────────────────
        doctorHsp2 = new User();
        doctorHsp2.setId("usr-fhir-doc-hsp2");
        doctorHsp2.setName("Dr. FHIR HSP2");
        doctorHsp2.setEmail("fhir.doc.hsp2@hospital.com");
        doctorHsp2.setPassword("hashedpass");
        doctorHsp2.setRole("doctor");
        doctorHsp2.setHospitalId("fhir-hsp-002");
        userRepository.save(doctorHsp2);

        patientHsp2 = new Patient();
        patientHsp2.setId("pat-fhir-hsp2");
        patientHsp2.setUhid("UHID-FHIR-002");
        patientHsp2.setHospitalId("fhir-hsp-002");
        patientHsp2.setName("Bob FHIR");
        patientHsp2.setSex("Male");
        patientRepository.save(patientHsp2);

        tokenHsp1 = tokenProvider.generateToken(
            doctorHsp1.getId(), doctorHsp1.getEmail(),
            doctorHsp1.getRole(), doctorHsp1.getHospitalId());
        tokenHsp2 = tokenProvider.generateToken(
            doctorHsp2.getId(), doctorHsp2.getEmail(),
            doctorHsp2.getRole(), doctorHsp2.getHospitalId());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        auditLogRepository.deleteAll();
        patientRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ── 1. Unauthenticated access is rejected ─────────────────────────────────

    @Test
    @Order(1)
    void patientRead_withoutToken_returns401() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── 2. Authenticated read returns valid FHIR R4 Patient ───────────────────

    @Test
    @Order(2)
    void patientRead_withValidToken_returnsValidFhirR4Patient() {
        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotBlank();

        org.hl7.fhir.r4.model.Patient fhirPatient =
            jsonParser.parseResource(org.hl7.fhir.r4.model.Patient.class, response.getBody());

        assertThat(fhirPatient.getIdPart()).isEqualTo("pat-fhir-hsp1");
        assertThat(fhirPatient.getNameFirstRep().getText()).isEqualTo("Alice FHIR");
        assertThat(fhirPatient.getGender().toCode()).isEqualTo("female");

        // Assert ABDM Patient Profile conformance
        assertThat(fhirPatient.getMeta().getProfile())
            .extracting(CanonicalType::getValue)
            .contains("https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient");
    }

    // ── 3. HAPI schema validation passes ─────────────────────────────────────

    @Test
    @Order(3)
    void patientRead_response_passesHapiFhirSchemaValidation() {
        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        org.hl7.fhir.r4.model.Patient fhirPatient =
            jsonParser.parseResource(org.hl7.fhir.r4.model.Patient.class, response.getBody());

        ValidationResult result = validator.validateWithResult(fhirPatient);
        long errorCount = result.getMessages().stream()
            .filter(m -> m.getSeverity() == ResultSeverityEnum.ERROR
                      || m.getSeverity() == ResultSeverityEnum.FATAL)
            .count();

        assertThat(errorCount)
            .as("FHIR validation errors: %s",
                result.getMessages().stream()
                    .filter(m -> m.getSeverity() == ResultSeverityEnum.ERROR
                              || m.getSeverity() == ResultSeverityEnum.FATAL)
                    .map(Object::toString).toList())
            .isZero();
    }

    // ── 4. Cross-tenant read returns 404 ─────────────────────────────────────

    @Test
    @Order(4)
    void patientRead_crossTenant_returns404() {
        HttpHeaders headers = bearerHeaders(tokenHsp2);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── 5. HIPAA audit log is written on successful read ──────────────────────

    @Test
    @Order(5)
    void patientRead_createsHipaaAuditLogEntry() throws Exception {
        auditLogRepository.deleteAll();

        HttpHeaders headers = bearerHeaders(tokenHsp1);
        restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        Thread.sleep(150); // allow REQUIRES_NEW tx to commit

        var logs = auditLogRepository.findByPatientIdOrderByTimestampDesc("pat-fhir-hsp1");
        assertThat(logs).isNotEmpty();
        assertThat(logs.get(0).getActionType()).isEqualTo("READ_PATIENT_PHI");
        assertThat(logs.get(0).getHospitalId()).isEqualTo("fhir-hsp-001");
        assertThat(logs.get(0).getUserId()).isEqualTo("usr-fhir-doc-hsp1");
    }

    // ── 6. Sensitive encrypted fields absent from FHIR output ─────────────────

    @Test
    @Order(6)
    void patientRead_doesNotExposeEncryptedSensitiveFields() {
        patientHsp1.setGovtIdNumber("AADHAAR-1234-5678-9012");
        patientHsp1.setInsuranceNumber("INS-SECRET-987");
        patientRepository.save(patientHsp1);

        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        assertThat(body).doesNotContain("AADHAAR-1234-5678-9012");
        assertThat(body).doesNotContain("INS-SECRET-987");
        assertThat(body).doesNotContain("hashedpass");
        assertThat(body).doesNotContain("\"password\"");
    }

    // ── 7. UHID identifier conforms to ABDM / NRCeS specification ───────────

    @Test
    @Order(7)
    void patientRead_includesUhidIdentifierConformingToAbdm() {
        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        org.hl7.fhir.r4.model.Patient fhirPatient =
            jsonParser.parseResource(org.hl7.fhir.r4.model.Patient.class, response.getBody());

        assertThat(fhirPatient.getIdentifier()).isNotEmpty();
        Identifier uhid = fhirPatient.getIdentifierFirstRep();
        assertThat(uhid.getSystem()).isEqualTo("https://medbuilds.com/fhir/identifier/uhid");
        assertThat(uhid.getValue()).isEqualTo("UHID-FHIR-001");
        assertThat(uhid.getType().getCodingFirstRep().getSystem()).isEqualTo("http://terminology.hl7.org/CodeSystem/v2-0203");
        assertThat(uhid.getType().getCodingFirstRep().getCode()).isEqualTo("MR");
    }

    // ── 8. PatientFhirMapper unit test: gender mapping ────────────────────────

    @Test
    @Order(8)
    void mapper_mapsGenderCorrectly() {
        Patient male = makePatient("test-m", "Male");
        assertThat(mapper.toFhir(male).getGender().toCode()).isEqualTo("male");

        Patient female = makePatient("test-f", "Female");
        assertThat(mapper.toFhir(female).getGender().toCode()).isEqualTo("female");

        Patient other = makePatient("test-o", "Other");
        assertThat(mapper.toFhir(other).getGender().toCode()).isEqualTo("other");
    }

    // ── 9. ABHA identifier mapped per ABDM ValueSet binding ──────────────────

    @Test
    @Order(9)
    void patientRead_withAbhaNumber_mapsAbhaIdentifierPerAbdmSpec() {
        patientHsp1.setAbhaNumber("14-9876-5432-1098");
        patientRepository.save(patientHsp1);

        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        org.hl7.fhir.r4.model.Patient fhirPatient =
            jsonParser.parseResource(org.hl7.fhir.r4.model.Patient.class, response.getBody());

        Identifier abhaId = fhirPatient.getIdentifier().stream()
            .filter(id -> "https://healthid.ndhm.gov.in".equals(id.getSystem()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("ABHA identifier missing from ABDM Patient resource"));

        assertThat(abhaId.getValue()).isEqualTo("14-9876-5432-1098");
        assertThat(abhaId.getType().getCodingFirstRep().getSystem())
            .isEqualTo("https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code");
        assertThat(abhaId.getType().getCodingFirstRep().getCode()).isEqualTo("ABHA");
    }

    // ── 10. DPDP Act compliance: Zero US Core census extensions ──────────────

    @Test
    @Order(10)
    void patientRead_omitsUsCoreCensusExtensions_dpdpCompliance() {
        HttpHeaders headers = bearerHeaders(tokenHsp1);
        ResponseEntity<String> response = restTemplate.exchange(
            baseUrl + "/fhir/r4/Patient/pat-fhir-hsp1",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        org.hl7.fhir.r4.model.Patient fhirPatient =
            jsonParser.parseResource(org.hl7.fhir.r4.model.Patient.class, response.getBody());

        // Strictly verify zero US Core OMB race, ethnicity, or birthsex extensions
        for (Extension ext : fhirPatient.getExtension()) {
            assertThat(ext.getUrl())
                .as("Patient resource must not contain US Core extensions")
                .doesNotContain("us-core");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Patient makePatient(String id, String sex) {
        Patient p = new Patient();
        p.setId(id); p.setUhid("U-" + id);
        p.setHospitalId("h1"); p.setName("Test " + sex);
        p.setSex(sex);
        return p;
    }
}
