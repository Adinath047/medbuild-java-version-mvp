package com.medicos.backend.fhir;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ResultSeverityEnum;
import ca.uhn.fhir.validation.ValidationResult;
import org.hl7.fhir.r4.model.CapabilityStatement;
import org.hl7.fhir.r4.model.Enumerations;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the FHIR R4 CapabilityStatement endpoint.
 *
 * <p>Uses {@link TestRestTemplate} (not MockMvc) because the HAPI {@code RestfulServer}
 * is registered as a raw servlet via {@code ServletRegistrationBean} and is NOT routed
 * through Spring's {@code DispatcherServlet}. Only the real embedded Tomcat can reach it.</p>
 *
 * <p>Verifies:
 * <ol>
 *   <li>/fhir/r4/metadata is accessible without authentication</li>
 *   <li>Response parses as a valid FHIR R4 CapabilityStatement</li>
 *   <li>Only Patient resource is declared (no ghost resources)</li>
 *   <li>Only read-only interactions declared (read, vread, search-type)</li>
 *   <li>SMART OAuth URIs present in security extension</li>
 *   <li>Publisher is "Medbuilds"</li>
 * </ol>
 * </p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class FhirCapabilityStatementTest {

    @LocalServerPort
    private int port;

    @Autowired
    private FhirContext fhirContext;

    private TestRestTemplate restTemplate;
    private IParser jsonParser;
    private String baseUrl;

    @BeforeEach
    void setUp() {
        restTemplate = new TestRestTemplate();
        jsonParser = fhirContext.newJsonParser();
        baseUrl = "http://localhost:" + port;
    }

    // ── 1. Unauthenticated access returns 200 ──────────────────────────────────

    @Test
    void metadata_isAccessibleWithoutAuthentication() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ── 2. Response is a valid FHIR R4 CapabilityStatement ────────────────────

    @Test
    void metadata_isValidFhirR4CapabilityStatement() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotBlank();

        CapabilityStatement cs = jsonParser.parseResource(
            CapabilityStatement.class, response.getBody());

        assertThat(cs).isNotNull();
        assertThat(cs.getResourceType().name()).isEqualTo("CapabilityStatement");
    }

    // ── 3. Patient-only resource declaration ──────────────────────────────────

    @Test
    void metadata_declaresOnlyPatientResource() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);

        CapabilityStatement cs = jsonParser.parseResource(
            CapabilityStatement.class, response.getBody());

        assertThat(cs.getRest()).isNotEmpty();
        var resources = cs.getRestFirstRep().getResource();

        assertThat(resources).hasSize(1);
        assertThat(resources.get(0).getType()).isEqualTo("Patient");
    }

    // ── 4. Read-only interactions only ────────────────────────────────────────

    @Test
    void metadata_patientResource_hasOnlyReadOnlyInteractions() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);

        CapabilityStatement cs = jsonParser.parseResource(
            CapabilityStatement.class, response.getBody());

        var interactionCodes = cs.getRestFirstRep().getResourceFirstRep()
            .getInteraction().stream()
            .map(i -> i.getCode().toCode())
            .toList();

        assertThat(interactionCodes).contains("read");
        assertThat(interactionCodes).doesNotContain("create", "update", "delete", "patch");
    }

    // ── 5. SMART OAuth URIs ────────────────────────────────────────────────────

    @Test
    void metadata_securityExtension_containsSmartOAuthUris() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);

        String body = response.getBody();
        assertThat(body).contains("http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris");
        assertThat(body).contains("/api/oauth/authorize");
        assertThat(body).contains("/api/oauth/token");
        assertThat(body).contains("/api/auth/introspect");
    }

    // ── 6. Publisher is "Medbuilds" ───────────────────────────────────────────

    @Test
    void metadata_publisherIs_Medbuilds() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl + "/fhir/r4/metadata", String.class);

        CapabilityStatement cs = jsonParser.parseResource(
            CapabilityStatement.class, response.getBody());

        assertThat(cs.getPublisher()).isEqualTo("Medbuilds");
        assertThat(cs.getStatus()).isEqualTo(Enumerations.PublicationStatus.ACTIVE);
    }
}
