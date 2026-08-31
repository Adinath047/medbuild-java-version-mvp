package com.medicos.backend.licensing;

public enum LicenseState {
    TRIAL_ACTIVE,
    TRIAL_ENDING_SOON,
    GRACE_PERIOD,
    LOCKED,
    ARCHIVED,
    PAID
}
