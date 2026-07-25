// client/src/utils/validation.ts
// ── Shared client-side validation utilities ────────────────────────────────

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^[+]?[\d\s\-().]{7,15}$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());
export const isValidPhone = (v: string) => PHONE_RE.test(v.trim());
export const isValidDate  = (v: string) => DATE_RE.test(v) && !isNaN(Date.parse(v));

export function validateEmail(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  return isValidEmail(v) ? null : 'Please enter a valid email address';
}

export function validatePhone(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  return isValidPhone(v) ? null : 'Phone must be 7–15 digits (e.g. +91 98765 43210)';
}

export function validatePassword(v: string): string | null {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(v)) return 'Must include at least one uppercase letter';
  if (!/[a-z]/.test(v)) return 'Must include at least one lowercase letter';
  if (!/\d/.test(v))    return 'Must include at least one number';
  return null;
}

export function validateRequired(v: string | undefined, fieldName = 'This field'): string | null {
  return (!v || !v.trim()) ? `${fieldName} is required` : null;
}

export function validateDate(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  if (!isValidDate(v)) return 'Please enter a valid date (YYYY-MM-DD)';
  return null;
}

export function validateNotFutureDate(v: string | undefined, fieldName = 'Date'): string | null {
  if (!v) return null;
  const err = validateDate(v);
  if (err) return err;
  if (new Date(v) > new Date()) return `${fieldName} cannot be in the future`;
  return null;
}

export function validateRange(
  v: string | number | undefined,
  min: number,
  max: number,
  label: string
): string | null {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v));
  if (isNaN(n)) return `${label}: must be a number`;
  if (n < min || n > max) return `${label}: must be between ${min} and ${max}`;
  return null;
}

/** Collect all non-null errors from a map of { field: errorStringOrNull } */
export function collectErrors(
  checks: Record<string, string | null>
): FieldErrors {
  const errs: FieldErrors = {};
  for (const [k, v] of Object.entries(checks)) {
    if (v) errs[k] = v;
  }
  return errs;
}

/** Returns true if errors object has no keys */
export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Extract server validation error into a user-friendly string */
export function extractServerError(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;
  if (!data) return 'Network error. Please try again.';
  if (data.message) return data.message;   // flattened validation message
  if (data.error)   return data.error;
  return 'An unexpected error occurred.';
}
