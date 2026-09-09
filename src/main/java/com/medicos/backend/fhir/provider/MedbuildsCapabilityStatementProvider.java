package com.medicos.backend.fhir.provider;

import ca.uhn.fhir.rest.annotation.Metadata;
import ca.uhn.fhir.rest.api.server.RequestDetails;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.RestfulServer;
import ca.uhn.fhir.rest.server.provider.ServerCapabilityStatementProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.hl7.fhir.instance.model.api.IBaseConformance;
import org.hl7.fhir.r4.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Provides a SMART App Launch–compliant FHIR R4 CapabilityStatement for Medbuilds EMR.
 *
 * <p>Extends {@link ServerCapabilityStatementProvider} which requires a {@link RestfulServer}
 * at construction time. To avoid a circular Spring dependency (Config creates Server which
 * needs Provider which needs Server), this class is NOT a {@code @Component}-managed bean;
 * instead it is constructed manually inside {@link com.medicos.backend.fhir.config.FhirServerConfig}
 * after the {@code RestfulServer} is built.</p>
 *
 * <p>Key invariants:
 * <ul>
 *   <li>Only {@code Patient} is declared — no ghost resources that would cause Inferno 404s.</li>
 *   <li>Read-only interactions only: {@code read}, {@code vread}, {@code search-type}.</li>
 *   <li>SMART OAuth URIs: {@code authorize}, {@code token}, {@code introspect}.</li>
 * </ul>
 * </p>
 */
public class MedbuildsCapabilityStatementProvider extends ServerCapabilityStatementProvider {

    private static final String SMART_EXTENSION_URL =
        "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";

    private final String baseUrl;

    public MedbuildsCapabilityStatementProvider(RestfulServer server, String baseUrl) {
        super(server);
        this.baseUrl = baseUrl;
    }

    @Override
    @Metadata
    public IBaseConformance getServerConformance(HttpServletRequest theRequest,
                                                 RequestDetails theRequestDetails) {
        // Start from HAPI's auto-generated CapabilityStatement
        CapabilityStatement cs = (CapabilityStatement)
            super.getServerConformance(theRequest, theRequestDetails);

        // ── Publisher metadata ─────────────────────────────────────────────────
        cs.setTitle("Medbuilds EMR FHIR R4 API");
        cs.setPublisher("Medbuilds");
        cs.setDescription(
            "FHIR R4 read-only Patient API for Medbuilds EMR. " +
            "Phase 1: Patient resource. Requires SMART App Launch authentication.");
        cs.setStatus(Enumerations.PublicationStatus.ACTIVE);
        cs.setSoftware(new CapabilityStatement.CapabilityStatementSoftwareComponent()
            .setName("Medbuilds EMR").setVersion("1.0.0"));
        cs.setImplementation(new CapabilityStatement.CapabilityStatementImplementationComponent()
            .setDescription("Medbuilds EMR FHIR R4 endpoint")
            .setUrl(baseUrl + "/fhir/r4"));

        // ── SMART App Launch security extension ────────────────────────────────
        if (!cs.getRest().isEmpty()) {
            CapabilityStatement.CapabilityStatementRestComponent rest = cs.getRestFirstRep();

            CapabilityStatement.CapabilityStatementRestSecurityComponent security =
                rest.hasSecurity() ? rest.getSecurity()
                    : new CapabilityStatement.CapabilityStatementRestSecurityComponent();

            security.addService(new CodeableConcept().addCoding(
                new Coding()
                    .setSystem("http://terminology.hl7.org/CodeSystem/restful-security-service")
                    .setCode("SMART-on-FHIR")
                    .setDisplay("SMART-on-FHIR")));

            Extension smartExt = new Extension().setUrl(SMART_EXTENSION_URL);
            smartExt.addExtension(new Extension("authorize",
                new UriType(baseUrl + "/api/oauth/authorize")));
            smartExt.addExtension(new Extension("token",
                new UriType(baseUrl + "/api/oauth/token")));
            smartExt.addExtension(new Extension("introspect",
                new UriType(baseUrl + "/api/auth/introspect")));
            security.addExtension(smartExt);
            rest.setSecurity(security);

            // Scope to Patient-only and read-only interactions
            rest.setResource(
                rest.getResource().stream()
                    .filter(r -> "Patient".equals(r.getType()))
                    .peek(r -> r.setInteraction(
                        r.getInteraction().stream()
                            .filter(i -> {
                                String code = i.getCode() == null ? "" : i.getCode().toCode();
                                return code.equals("read")
                                    || code.equals("vread")
                                    || code.equals("search-type");
                            })
                            .toList()
                    ))
                    .toList()
            );
        }

        return cs;
    }
}
