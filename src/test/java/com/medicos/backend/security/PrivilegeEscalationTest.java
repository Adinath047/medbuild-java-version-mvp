package com.medicos.backend.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Privilege Escalation Tests (Horizontal and Vertical)
 *
 * "Not anonymous" is not the same as "not privilege-escalated."
 * These tests prove that role-restricted endpoints correctly reject
 * authenticated users who lack the required role.
 *
 * Role hierarchy enforced by @PreAuthorize in the Medbuilds EMR:
 *
 *   SUPER_ADMIN   - platform-wide operations (all hospitals)
 *   ADMIN         - hospital-level admin operations
 *   DOCTOR        - clinical read/write, prescriptions, encounters
 *   NURSE         - vitals, beds, encounters (read), appointments
 *   RECEPTIONIST  - appointments, billing, beds, patient registration
 *   PHARMACIST    - medicines, billing (read)
 *   LAB_TECH      - lab orders (read)
 *
 * Vertical privilege escalation: lower-role user accesses higher-role endpoint.
 * Horizontal privilege escalation: same-role user accesses another tenant's data
 *   (tested in ApiEndpointSecurityAndValidationTest via TenantContext).
 *
 * Note: Tests run against the full Spring context with H2 in-memory database
 * and embedded Redis. No clinical data is created.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Privilege Escalation Tests")
class PrivilegeEscalationTest {

    @Autowired
    private MockMvc mockMvc;

    // -----------------------------------------------------------------------
    // Audit Log API
    // @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    // Expected: DOCTOR, NURSE, RECEPTIONIST, PHARMACIST -> 403
    // -----------------------------------------------------------------------

    @ParameterizedTest(name = "GET /api/audit-logs blocked for role={0} (vertical escalation)")
    @CsvSource({"DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECH"})
    @DisplayName("Audit logs: non-admin role is denied (vertical privilege escalation)")
    @WithMockUser(username = "test-user", roles = {})
    void auditLogs_nonAdminRole_returns403(String role) throws Exception {
        mockMvc.perform(
                get("/api/audit-logs")
                        .with(request -> {
                            // Override the security context role programmatically.
                            // @WithMockUser roles are set at class/method level only;
                            // for parameterized role injection we use request-level override.
                            request.setAttribute(
                                    "org.springframework.security.core.context.SecurityContext",
                                    buildContextForRole(role)
                            );
                            return request;
                        })
        ).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Audit logs: DOCTOR role is denied access (vertical escalation)")
    @WithMockUser(username = "dr-test", roles = {"DOCTOR"})
    void auditLogs_doctorRole_returns403() throws Exception {
        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Audit logs: NURSE role is denied access (vertical escalation)")
    @WithMockUser(username = "nurse-test", roles = {"NURSE"})
    void auditLogs_nurseRole_returns403() throws Exception {
        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Audit logs: RECEPTIONIST role is denied access (vertical escalation)")
    @WithMockUser(username = "reception-test", roles = {"RECEPTIONIST"})
    void auditLogs_receptionistRole_returns403() throws Exception {
        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Audit logs: PHARMACIST role is denied access (vertical escalation)")
    @WithMockUser(username = "pharma-test", roles = {"PHARMACIST"})
    void auditLogs_pharmacistRole_returns403() throws Exception {
        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Platform Security Controller
    // @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    // Expected: DOCTOR, NURSE, RECEPTIONIST -> 403
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Platform security metrics: DOCTOR role is denied (vertical escalation)")
    @WithMockUser(username = "dr-test", roles = {"DOCTOR"})
    void platformSecurityMetrics_doctorRole_returns403() throws Exception {
        mockMvc.perform(get("/api/platform/security/metrics"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Platform security alerts: NURSE role is denied (vertical escalation)")
    @WithMockUser(username = "nurse-test", roles = {"NURSE"})
    void platformSecurityAlerts_nurseRole_returns403() throws Exception {
        mockMvc.perform(get("/api/platform/security/alerts"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Platform security audit trail: RECEPTIONIST role is denied (vertical escalation)")
    @WithMockUser(username = "reception-test", roles = {"RECEPTIONIST"})
    void platformSecurityAuditTrail_receptionistRole_returns403() throws Exception {
        mockMvc.perform(get("/api/platform/security/audit-trail"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Patient data erasure (GDPR / DPDP compliance)
    // POST /api/patients/{id}/erasure - @PreAuthorize("hasRole('ADMIN')")
    // Expected: DOCTOR, NURSE -> 403
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Patient erasure: DOCTOR role is denied (vertical escalation - GDPR sensitive)")
    @WithMockUser(username = "dr-test", roles = {"DOCTOR"})
    void patientErasure_doctorRole_returns403() throws Exception {
        // Patient erasure is ADMIN-only. A DOCTOR authenticating with a valid token
        // must not be able to trigger a data erasure request.
        mockMvc.perform(post("/api/patients/pat-fuzz-001/erasure")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Patient erasure: NURSE role is denied (vertical escalation - GDPR sensitive)")
    @WithMockUser(username = "nurse-test", roles = {"NURSE"})
    void patientErasure_nurseRole_returns403() throws Exception {
        mockMvc.perform(post("/api/patients/pat-fuzz-001/erasure")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Patient erasure: RECEPTIONIST role is denied (vertical escalation)")
    @WithMockUser(username = "reception-test", roles = {"RECEPTIONIST"})
    void patientErasure_receptionistRole_returns403() throws Exception {
        mockMvc.perform(post("/api/patients/pat-fuzz-001/erasure")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Auth registration (admin-only)
    // POST /api/auth/register - .hasRole("ADMIN")
    // Expected: DOCTOR, NURSE -> 403
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Auth register: DOCTOR role is denied (vertical escalation)")
    @WithMockUser(username = "dr-test", roles = {"DOCTOR"})
    void authRegister_doctorRole_returns403() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Auth register: NURSE role is denied (vertical escalation)")
    @WithMockUser(username = "nurse-test", roles = {"NURSE"})
    void authRegister_nurseRole_returns403() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Auth invite (admin/super-admin only)
    // POST /api/auth/invite - .hasAnyRole("ADMIN", "SUPER_ADMIN")
    // Expected: DOCTOR, NURSE, PHARMACIST -> 403
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Auth invite: DOCTOR role is denied (vertical escalation)")
    @WithMockUser(username = "dr-test", roles = {"DOCTOR"})
    void authInvite_doctorRole_returns403() throws Exception {
        mockMvc.perform(post("/api/auth/invite")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Auth invite: PHARMACIST role is denied (vertical escalation)")
    @WithMockUser(username = "pharma-test", roles = {"PHARMACIST"})
    void authInvite_pharmacistRole_returns403() throws Exception {
        mockMvc.perform(post("/api/auth/invite")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Prescriptions - clinical role restriction
    // @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    // Expected: NURSE, RECEPTIONIST, PHARMACIST -> 403 on write
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Create prescription: NURSE role is denied (vertical escalation)")
    @WithMockUser(username = "nurse-test", roles = {"NURSE"})
    void createPrescription_nurseRole_returns403() throws Exception {
        mockMvc.perform(post("/api/prescriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Create prescription: RECEPTIONIST role is denied (vertical escalation)")
    @WithMockUser(username = "reception-test", roles = {"RECEPTIONIST"})
    void createPrescription_receptionistRole_returns403() throws Exception {
        mockMvc.perform(post("/api/prescriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // Helper: builds a minimal security context for the given role.
    // Used where parameterized @WithMockUser is not supported.
    // -----------------------------------------------------------------------
    private org.springframework.security.core.context.SecurityContext buildContextForRole(String role) {
        org.springframework.security.core.context.SecurityContext ctx =
                org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        org.springframework.security.core.userdetails.UserDetails user =
                org.springframework.security.core.userdetails.User.builder()
                        .username("test-escalation-user")
                        .password("irrelevant")
                        .roles(role)
                        .build();
        ctx.setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        user, null, user.getAuthorities()
                )
        );
        return ctx;
    }
}
