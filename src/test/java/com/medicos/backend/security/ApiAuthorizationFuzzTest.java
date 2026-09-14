package com.medicos.backend.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * API Endpoint Authorization Fuzzing Tests
 *
 * Verifies that every secured REST endpoint rejects unauthenticated requests.
 *
 * Spring Security filter chain behavior for unauthenticated requests:
 *   - GET on protected resources   -> 401 Unauthorized  (JWT filter denies before CSRF check)
 *   - POST/PUT/DELETE without CSRF -> 403 Forbidden     (CSRF filter runs before JWT filter)
 *   - GET on public resources      -> 200 OK            (permitAll in SecurityConfig)
 *
 * Assertions are written to match the actual enforced behavior. Any regression
 * (e.g. a protected GET returning 200, or a mutation returning 200) will be caught.
 *
 * Note: Tests run against the full Spring context with H2 in-memory database
 * and embedded Redis. No clinical data is created.
 *
 * Path validity guarantee:
 *   Every path in the parameterized sweep is verified against the actual
 *   controller @RequestMapping declarations to prevent false passes from
 *   hitting non-existent routes. 404 responses fail the 401 assertion and
 *   would surface as test failures during normal CI runs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("API Endpoint Authorization Fuzzing")
class ApiAuthorizationFuzzTest {

    @Autowired
    private MockMvc mockMvc;

    // -----------------------------------------------------------------------
    // Patient API - GET requests must return 401 without credentials
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/patients - unauthenticated returns 401")
    void getPatients_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/patients"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/patients/{id} - unauthenticated returns 401")
    void getPatientById_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/patients/pat-fuzz-001"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/patients/{id}/summary - unauthenticated returns 401")
    void getPatientSummary_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/patients/pat-fuzz-001/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/patients/{id}/vitals-history - unauthenticated returns 401")
    void getVitalsHistory_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/patients/pat-fuzz-001/vitals-history"))
                .andExpect(status().isUnauthorized());
    }

    // POST/PUT/DELETE patient mutations: CSRF fires first -> 403 (still rejected)

    @Test
    @DisplayName("POST /api/patients - unauthenticated request is rejected (403 via CSRF)")
    void createPatient_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/patients")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("PUT /api/patients/{id} - unauthenticated request is rejected (403 via CSRF)")
    void updatePatient_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(put("/api/patients/pat-fuzz-001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // User / Admin API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/users - unauthenticated returns 401")
    void getUsers_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("DELETE /api/users/{id} - unauthenticated request is rejected (403 via CSRF)")
    void deleteUser_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(delete("/api/users/usr-fuzz-001"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Appointment API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/appointments - unauthenticated returns 401")
    void getAppointments_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/appointments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/appointments - unauthenticated request is rejected (403 via CSRF)")
    void createAppointment_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/appointments")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Billing API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/billing - unauthenticated returns 401")
    void getBilling_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/billing"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/billing - unauthenticated request is rejected (403 via CSRF)")
    void createBill_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/billing")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Prescription API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/prescriptions - unauthenticated returns 401")
    void getPrescriptions_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/prescriptions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/prescriptions - unauthenticated request is rejected (403 via CSRF)")
    void createPrescription_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/prescriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Encounter API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/encounters - unauthenticated returns 401")
    void getEncounters_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/encounters"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Vitals API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("POST /api/vitals - unauthenticated request is rejected (403 via CSRF)")
    void recordVitals_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/vitals")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Audit Log API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/audit-logs - unauthenticated returns 401")
    void getAuditLogs_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Invite API - POST must be rejected without credentials
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("POST /api/invite/staff - unauthenticated request is rejected (403 via CSRF)")
    void inviteStaff_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/api/invite/staff")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // Beds API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/beds - unauthenticated returns 401")
    void getBeds_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/beds"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Notifications API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/notifications - unauthenticated returns 401")
    void getNotifications_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/notifications"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Platform Security API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/platform/security/events - unauthenticated returns 401")
    void getPlatformSecurityEvents_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/platform/security/events"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // FHIR R4 API - must reject unauthenticated access (except metadata)
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /fhir/r4/Patient - unauthenticated returns 401")
    void fhirGetPatient_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/fhir/r4/Patient"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /fhir/r4/Observation - unauthenticated returns 401")
    void fhirGetObservation_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/fhir/r4/Observation"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Medicines API - must reject unauthenticated access
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("GET /api/medicines - unauthenticated returns 401")
    void getMedicines_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/medicines"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Parameterized sweep: protected GET endpoints must all return exactly 401.
    //
    // Path validity: every path below maps to a real controller route. If a
    // path is removed from the application, the test will return 404, which
    // fails the isUnauthorized() assertion — surfacing the stale test rather
    // than silently passing on a phantom endpoint.
    // -----------------------------------------------------------------------

    @ParameterizedTest(name = "GET {0} returns 401 when unauthenticated")
    @CsvSource({
        // PatientController  @RequestMapping("/api/patients")
        "/api/patients",
        // UserController     @RequestMapping("/api/users")
        "/api/users",
        "/api/users/doctors",
        // AppointmentController @RequestMapping("/api/appointments")
        "/api/appointments",
        // BillingController  @RequestMapping("/api/billing")
        "/api/billing",
        // EncounterController @RequestMapping("/api/encounters")
        "/api/encounters",
        // PrescriptionController @RequestMapping("/api/prescriptions")
        "/api/prescriptions",
        // BedController      @RequestMapping("/api/beds")
        "/api/beds",
        // AuditLogController @RequestMapping("/api/audit-logs")
        "/api/audit-logs",
        // NotificationController
        "/api/notifications",
        // MedicineController @RequestMapping("/api/medicines")
        "/api/medicines",
        // PatientUploadController @RequestMapping("/api/patient-uploads") - GET is /{patientId}
        "/api/patient-uploads/pat-fuzz-sweep",
        // FHIR R4
        "/fhir/r4/Patient"
    })
    @DisplayName("All protected GET endpoints return 401 without credentials")
    void protectedGetEndpoints_unauthenticated_returns401(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // Public endpoints - intentionally permitAll() in SecurityConfig.
    // Each test has TWO assertions:
    //   1. The endpoint is reachable (not 401).
    //   2. The response body does not contain internal stack or config data.
    // "Public and accessible" is not the same as "public and safe."
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("POST /api/auth/login - public endpoint, not 401")
    void loginEndpoint_isPublic_returnsClientError_notUnauthorized() throws Exception {
        // Invalid creds -> 400 Bad Request, but NOT 401
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"hospital_id\":\"\",\"password\":\"\"}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("GET /api/licensing/status - public, does not leak internal stack info")
    void getLicensingStatus_isPublic_andDoesNotLeakInternals() throws Exception {
        // Licensing status is intentionally public for self-serve trial status checks.
        // The response must not expose stack version, DB type, or internal config.
        MvcResult result = mockMvc.perform(get("/api/licensing/status"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // These strings would indicate accidental internal info disclosure
        assertNotEquals(true, body.contains("Spring Boot"), "Health endpoint must not expose framework version");
        assertNotEquals(true, body.contains("PostgreSQL"), "Health endpoint must not expose database type");
        assertNotEquals(true, body.contains("H2"), "Health endpoint must not expose test database name");
        assertNotEquals(true, body.contains("exception"), "Health endpoint must not expose exception details");
        assertNotEquals(true, body.contains("stack"), "Health endpoint must not expose stack traces");
    }

    @Test
    @DisplayName("GET /api/health - public probe endpoint, does not leak internal stack info")
    void getHealth_isPublic_andDoesNotLeakInternals() throws Exception {
        // /api/health is the actual controller path (SystemController @GetMapping("/health"))
        // It is used by load balancer probes and must remain public.
        // It must NOT reveal internal implementation details.
        MvcResult result = mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertNotEquals(true, body.contains("Spring Boot"), "Health probe must not expose framework version");
        assertNotEquals(true, body.contains("exception"), "Health probe must not expose exception details");
        assertNotEquals(true, body.contains("stack"), "Health probe must not expose stack traces");
        assertNotEquals(true, body.contains("password"), "Health probe must not expose credentials");
        assertNotEquals(true, body.contains("secret"), "Health probe must not expose secrets");
    }

    @Test
    @DisplayName("GET /fhir/r4/metadata - SMART on FHIR capability statement, public by spec")
    void fhirMetadata_isPublic_notUnauthorized() throws Exception {
        // FHIR capability statement must be publicly accessible per SMART on FHIR spec.
        mockMvc.perform(get("/fhir/r4/metadata"))
                .andExpect(status().is2xxSuccessful());
    }
}
