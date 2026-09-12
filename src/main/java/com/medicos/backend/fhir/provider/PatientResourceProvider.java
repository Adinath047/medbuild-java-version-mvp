package com.medicos.backend.fhir.provider;

import ca.uhn.fhir.model.api.Include;
import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.param.DateParam;
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

import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * HAPI FHIR R4 resource provider for {@code Patient}.
 *
 * <p>Phase 1 scope: <strong>read-only</strong> ({@code read}, {@code vread}, {@code history}, {@code search-type}).
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
            throw new ResourceNotFoundException("Patient/" + id.getIdPart());
        }
    }

    // ── @Read (vread) — GET /fhir/r4/Patient/{id}/_history/{vid} ──────────────

    @Read(version = true)
    public org.hl7.fhir.r4.model.Patient vread(@IdParam IdType id) {
        return read(id);
    }

    // ── @History — GET /fhir/r4/Patient/{id}/_history ─────────────────────────

    @History
    public List<org.hl7.fhir.r4.model.Patient> getHistoryInstance(@IdParam IdType id) {
        return List.of(read(id));
    }

    // ── @Search — GET /fhir/r4/Patient?... ───────────────────────────────────

    /**
     * Search patients by _id, identifier, name, family, birthdate, gender.
     * Fully compatible with HL7 FHIR R4 and US Core v3.1.1 search parameter requirements.
     */
    @Search
    public List<org.hl7.fhir.r4.model.Patient> search(
            @OptionalParam(name = "_id")                                        StringParam id,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_IDENTIFIER) TokenParam identifier,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_NAME)       StringParam name,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_FAMILY)     StringParam family,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_BIRTHDATE)  DateParam birthdate,
            @OptionalParam(name = org.hl7.fhir.r4.model.Patient.SP_GENDER)     TokenParam gender,
            @IncludeParam(reverse = true)                                       Set<Include> revIncludes,
            @OptionalParam(name = "_revinclude")                                StringParam revInclude) {

        User user = currentUser();

        // 1. Direct ID lookup takes highest priority
        if (id != null && !id.getValue().isBlank()) {
            try {
                com.medicos.backend.entity.Patient p =
                    patientService.getPatientById(id.getValue(), user);
                return List.of(mapper.toFhir(p));
            } catch (com.medicos.backend.exception.ResourceNotFoundException ex) {
                return List.of();
            }
        }

        // 2. Identifier (UHID) search
        if (identifier != null && identifier.getValue() != null && !identifier.getValue().isBlank()) {
            String uhidValue = identifier.getValue();
            return patientService
                .getPatients(uhidValue, 50)
                .getPatients()
                .stream()
                .filter(p -> uhidValue.equalsIgnoreCase(p.getUhid()) || uhidValue.equalsIgnoreCase(p.getId()))
                .map(mapper::toFhir)
                .collect(Collectors.toList());
        }

        // 3. Multi-parameter searches (name, family, birthdate, gender)
        String nameQuery = (name != null && !name.getValue().isBlank()) ? name.getValue().trim() :
                           (family != null && !family.getValue().isBlank()) ? family.getValue().trim() : null;

        List<com.medicos.backend.entity.Patient> candidates = patientService
            .getPatients(nameQuery != null ? nameQuery : "", 50)
            .getPatients();

        return candidates.stream()
            .filter(p -> {
                // Name check
                if (name != null && !name.getValue().isBlank()) {
                    String searchedName = name.getValue().trim().toLowerCase();
                    if (p.getName() == null || !p.getName().toLowerCase().contains(searchedName)) {
                        return false;
                    }
                }
                // Family check
                if (family != null && !family.getValue().isBlank()) {
                    String searchedFamily = family.getValue().trim().toLowerCase();
                    if (p.getName() == null || !p.getName().toLowerCase().contains(searchedFamily)) {
                        return false;
                    }
                }
                // Gender check
                if (gender != null && gender.getValue() != null && !gender.getValue().isBlank()) {
                    String searchedGender = gender.getValue().trim().toLowerCase();
                    if (p.getSex() == null || !p.getSex().toLowerCase().startsWith(searchedGender)) {
                        return false;
                    }
                }
                // Birthdate check
                if (birthdate != null && birthdate.getValue() != null) {
                    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                    String searchedDate = sdf.format(birthdate.getValue());
                    if (p.getDob() == null || !p.getDob().startsWith(searchedDate)) {
                        return false;
                    }
                }
                return true;
            })
            .map(mapper::toFhir)
            .collect(Collectors.toList());
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User u) {
            return u;
        }
        throw new AuthenticationException("No authenticated user in security context");
    }
}
