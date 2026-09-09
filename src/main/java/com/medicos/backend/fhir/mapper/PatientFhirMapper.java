package com.medicos.backend.fhir.mapper;

import com.medicos.backend.entity.Patient;
import org.hl7.fhir.r4.model.*;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

/**
 * Maps the internal JPA {@link Patient} entity to a HAPI FHIR R4 {@link org.hl7.fhir.r4.model.Patient} resource.
 *
 * <p>Security invariants:
 * <ul>
 *   <li>{@code govtIdNumber} is AES-256-GCM encrypted at rest and is NOT included in FHIR output
 *       (it maps to nothing in the FHIR Patient resource — national identifiers are only surfaced
 *       via the dedicated ABHA identifier, not the raw government ID).</li>
 *   <li>{@code insuranceNumber} is similarly encrypted and excluded.</li>
 *   <li>{@code pastHistory} is encrypted and excluded (clinical narrative, not a FHIR Patient field).</li>
 *   <li>{@code password} is never mapped.</li>
 * </ul>
 */
@Component
public class PatientFhirMapper {

    private static final String SYSTEM_UHID       = "https://medbuilds.com/fhir/identifier/uhid";
    private static final String SYSTEM_ABHA        = "https://abha.abdm.gov.in/identifier";
    private static final String SYSTEM_BLOOD_GROUP = "http://terminology.hl7.org/CodeSystem/v3-BloodGroup";

    /**
     * Converts a JPA {@link Patient} to a FHIR R4 {@link org.hl7.fhir.r4.model.Patient}.
     *
     * @param p the internal patient entity (never null)
     * @return a populated FHIR Patient resource safe for external serialization
     */
    public org.hl7.fhir.r4.model.Patient toFhir(Patient p) {
        org.hl7.fhir.r4.model.Patient fhir = new org.hl7.fhir.r4.model.Patient();

        // ── Resource id ────────────────────────────────────────────────────────
        fhir.setId(p.getId());

        // ── Identifiers ────────────────────────────────────────────────────────
        // UHID (Unique Hospital ID) — primary internal identifier
        fhir.addIdentifier()
            .setSystem(SYSTEM_UHID)
            .setValue(p.getUhid())
            .setUse(Identifier.IdentifierUse.OFFICIAL);

        // ABHA number (Ayushman Bharat Health Account) — national identifier if present
        if (p.getAbhaNumber() != null && !p.getAbhaNumber().isBlank()) {
            fhir.addIdentifier()
                .setSystem(SYSTEM_ABHA)
                .setValue(p.getAbhaNumber())
                .setUse(Identifier.IdentifierUse.OFFICIAL);
        }

        // ── Active status ──────────────────────────────────────────────────────
        fhir.setActive(p.getIsActive() != null && p.getIsActive() == 1);

        // ── Name ───────────────────────────────────────────────────────────────
        if (p.getName() != null) {
            HumanName name = new HumanName()
                .setUse(HumanName.NameUse.OFFICIAL)
                .setText(p.getName());
            // If the name has a space, split into given + family heuristically
            String[] parts = p.getName().trim().split("\\s+", 2);
            if (parts.length == 2) {
                name.setFamily(parts[1]);
                name.addGiven(parts[0]);
            }
            fhir.addName(name);
        }

        // ── Telecom ────────────────────────────────────────────────────────────
        if (p.getPhone() != null && !p.getPhone().isBlank()) {
            fhir.addTelecom()
                .setSystem(ContactPoint.ContactPointSystem.PHONE)
                .setValue(p.getPhone())
                .setUse(ContactPoint.ContactPointUse.MOBILE);
        }
        if (p.getEmail() != null && !p.getEmail().isBlank()) {
            fhir.addTelecom()
                .setSystem(ContactPoint.ContactPointSystem.EMAIL)
                .setValue(p.getEmail())
                .setUse(ContactPoint.ContactPointUse.HOME);
        }

        // ── Gender ─────────────────────────────────────────────────────────────
        if (p.getSex() != null) {
            fhir.setGender(mapGender(p.getSex()));
        }

        // ── Date of birth ──────────────────────────────────────────────────────
        if (p.getDob() != null && !p.getDob().isBlank()) {
            try {
                LocalDate dob = LocalDate.parse(p.getDob());  // expects ISO-8601 yyyy-MM-dd
                fhir.setBirthDate(Date.from(dob.atStartOfDay(ZoneId.of("UTC")).toInstant()));
            } catch (Exception ignored) {
                // unparseable DOB — skip rather than error; age is available separately
            }
        }

        // ── Address ────────────────────────────────────────────────────────────
        if (p.getAddress() != null && !p.getAddress().isBlank()) {
            fhir.addAddress()
                .setText(p.getAddress())
                .setUse(Address.AddressUse.HOME);
        }

        // ── Emergency contact (next of kin) ───────────────────────────────────
        if (p.getEcName() != null && !p.getEcName().isBlank()) {
            org.hl7.fhir.r4.model.Patient.ContactComponent contact =
                new org.hl7.fhir.r4.model.Patient.ContactComponent();
            contact.setName(new HumanName().setText(p.getEcName()));
            if (p.getEcPhone() != null && !p.getEcPhone().isBlank()) {
                contact.addTelecom()
                    .setSystem(ContactPoint.ContactPointSystem.PHONE)
                    .setValue(p.getEcPhone());
            }
            if (p.getEcRelation() != null && !p.getEcRelation().isBlank()) {
                contact.addRelationship()
                    .setText(p.getEcRelation());
            }
            fhir.addContact(contact);
        }

        // ── Extensions: allergies, chronic conditions, current medications ─────
        // These don't map to core FHIR Patient fields; use AllergyIntolerance /
        // Condition resources in future phases. For Phase 1 we expose them as
        // simple string extensions under Medbuilds' own extension URL so the data
        // isn't lost at the patient-read level.
        List<String> allergies = p.getAllergies();
        if (allergies != null) {
            for (String allergy : allergies) {
                if (allergy != null && !allergy.isBlank()) {
                    fhir.addExtension(
                        "https://medbuilds.com/fhir/extension/allergy",
                        new StringType(allergy));
                }
            }
        }

        List<String> chronic = p.getChronicConditions();
        if (chronic != null) {
            for (String cond : chronic) {
                if (cond != null && !cond.isBlank()) {
                    fhir.addExtension(
                        "https://medbuilds.com/fhir/extension/chronic-condition",
                        new StringType(cond));
                }
            }
        }

        // Blood group — extension (no standard FHIR Patient field for this)
        if (p.getBloodGroup() != null && !p.getBloodGroup().isBlank()) {
            fhir.addExtension(
                "https://medbuilds.com/fhir/extension/blood-group",
                new StringType(p.getBloodGroup()));
        }

        // ── Photo URL ──────────────────────────────────────────────────────────
        // Only included if it's an absolute https URL (not a raw file path)
        if (p.getPhotoUrl() != null && p.getPhotoUrl().startsWith("https://")) {
            Attachment photo = new Attachment();
            photo.setUrl(p.getPhotoUrl());
            photo.setContentType("image/jpeg");
            fhir.addPhoto(photo);
        }

        return fhir;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Enumerations.AdministrativeGender mapGender(String sex) {
        if (sex == null) return Enumerations.AdministrativeGender.UNKNOWN;
        return switch (sex.toLowerCase()) {
            case "male", "m"   -> Enumerations.AdministrativeGender.MALE;
            case "female", "f" -> Enumerations.AdministrativeGender.FEMALE;
            case "other"       -> Enumerations.AdministrativeGender.OTHER;
            default            -> Enumerations.AdministrativeGender.UNKNOWN;
        };
    }
}
