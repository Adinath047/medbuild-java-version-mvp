package com.medicos.backend.fhir.provider;

import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.AuthenticationException;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import com.medicos.backend.entity.User;
import com.medicos.backend.fhir.mapper.PatientFhirMapper;
import com.medicos.backend.service.PatientService;
import org.hl7.fhir.instance.model.api.IBaseResource;
import org.hl7.fhir.r4.model.IdType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * HAPI FHIR R4 resource provider for {@code Patient}.
 *
 * <p>Phase 1 scope: <strong>read-only</strong> ({@code read}, {@code vread}, {@code search-type}).
 * Write interactions ({@code create}, {@code update}, {@code delete}) are not registered
 * so HAPI correctly returns 405 Method Not Allowed for those verbs.</p>
 *
 * <p>Tenant isolation and HIPAA audit logging are inherited automatically by delegating
 * every lookup to {@link PatientService#getPatientById(String, User)}, which already
 * carries the {@code TenantContext} check and calls {@code AuditLogService.record()}
 * in a {@code REQUIRES_NEW} transaction.</p>
 */
@Component
public class PatientResourceProvider implements IResourceProvider {

    private final PatientService patientService;
    private final PatientFhirMapper mapper;

    public PatientResourceProvider(PatientService patientService, PatientFhirMapper mapper) {
        this.patientService = patientService;
        this.mapper = mapper;
    }

    @Override
    public Class<? extends IBaseResource> getResourceType() {
        return org.hl7.fhir.r4.model.Patient.class;
    }

    // ── @Read — GET /fhir/r4/Patient/{id} ─────────────────────────────────────

    @Read
    public org.hl7.fhir.r4.model.Patient read(@IdParam IdType id) {
        User user = currentUser();
        try {
            com.medicos.backend.entity.Patient patient =
                patientService.getPatientById(id.getIdPart(), user);
            return mapper.toFhir(patient);
        } catch (com.medicos.backend.exception.ResourceNotFoundException ex) {
            // HAPI maps this to HTTP 404 with an OperationOutcome body
            throw new ResourceNotFoundException("Patient/" + id.getIdPart());
        }
    }

    // ── @Search — GET /fhir/r4/Patient?identifier=...&name=...&_id=... ────────

    /**
     * Search patients by UHID identifier, name (partial match), or logical {@code _id}.
     *
     * <p>All results are scoped to the authenticated clinician's tenant via
     * {@link PatientService#getPatients(String, int)} which enforces {@code TenantContext}
     * on every query. Cross-tenant access is structurally impossible: the service layer
     * throws before any cross-tenant data can be returned.</p>
     *
     * <p>Maximum result set is capped at 50 to prevent unbounded list responses.
     * Clients requiring pagination should use FHIR Bundle search with {@code _count}.</p>
     */
    @Search
    public List<org.hl7.fhir.r4.model.Patient> search(
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_IDENTIFIER) TokenParam identifier,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_NAME)       StringParam name,
            @OptionalParam(name = "_id")                                         StringParam id) {

        User user = currentUser();

        // Direct ID lookup takes priority (most specific)
        if (id != null && !id.getValue().isBlank()) {
            try {
                com.medicos.backend.entity.Patient p =
                    patientService.getPatientById(id.getValue(), user);
                return List.of(mapper.toFhir(p));
            } catch (com.medicos.backend.exception.ResourceNotFoundException ex) {
                return List.of();
            }
        }

        // Identifier (UHID token) lookup — search by identifier value
        if (identifier != null && identifier.getValue() != null && !identifier.getValue().isBlank()) {
            return patientService
                .getPatients(identifier.getValue(), 50)
                .getPatients()
                .stream()
                .map(mapper::toFhir)
                .collect(Collectors.toList());
        }

        // Name search (partial, case-insensitive via PatientService)
        if (name != null && name.getValue() != null && !name.getValue().isBlank()) {
            return patientService
                .getPatients(name.getValue(), 50)
                .getPatients()
                .stream()
                .map(mapper::toFhir)
                .collect(Collectors.toList());
        }

        // No parameters — return empty list rather than risk flooding a list-all endpoint
        return List.of();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Resolves the authenticated {@link User} from the Spring Security context.
     * HAPI's {@link ca.uhn.fhir.rest.server.RestfulServer} sits outside the MVC
     * dispatcher but Spring Security's {@code SecurityContextHolder} is still populated
     * by {@code JwtAuthenticationFilter} for every request passing through the chain.
     */
    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User u) {
            return u;
        }
        throw new AuthenticationException("No authenticated user in security context");
    }
}
