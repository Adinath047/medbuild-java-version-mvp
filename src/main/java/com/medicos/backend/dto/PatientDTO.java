package com.medicos.backend.dto;

import com.medicos.backend.entity.Encounter;
import com.medicos.backend.entity.Patient;
import com.medicos.backend.entity.Prescription;
import com.medicos.backend.entity.Vital;

import java.util.List;

public class PatientDTO {

    public static class PatientListResponse {
        private List<Patient> patients;
        private long total;

        public PatientListResponse(List<Patient> patients, long total) {
            this.patients = patients;
            this.total = total;
        }

        public List<Patient> getPatients() { return patients; }
        public void setPatients(List<Patient> patients) { this.patients = patients; }

        public long getTotal() { return total; }
        public void setTotal(long total) { this.total = total; }
    }

    public static class PatientSummaryResponse {
        private Patient patient;
        private List<Encounter> encounters;
        private Vital latestVitals;
        private int rxCount;
        private List<Prescription> prescriptions;
        private List<Object> apptUpcoming;

        public PatientSummaryResponse() {}

        public Patient getPatient() { return patient; }
        public void setPatient(Patient patient) { this.patient = patient; }

        public List<Encounter> getEncounters() { return encounters; }
        public void setEncounters(List<Encounter> encounters) { this.encounters = encounters; }

        public Vital getLatestVitals() { return latestVitals; }
        public void setLatestVitals(Vital latestVitals) { this.latestVitals = latestVitals; }

        public int getRxCount() { return rxCount; }
        public void setRxCount(int rxCount) { this.rxCount = rxCount; }

        public List<Prescription> getPrescriptions() { return prescriptions; }
        public void setPrescriptions(List<Prescription> prescriptions) { this.prescriptions = prescriptions; }

        public List<Object> getApptUpcoming() { return apptUpcoming; }
        public void setApptUpcoming(List<Object> apptUpcoming) { this.apptUpcoming = apptUpcoming; }
    }
}
