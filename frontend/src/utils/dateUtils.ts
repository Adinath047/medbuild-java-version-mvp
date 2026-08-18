/**
 * Date utility helpers ensuring timezone-safe local date operations.
 * Avoids UTC mismatch bugs where new Date().toISOString() returns yesterday's date in IST/ahead timezones.
 */

export function getLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPastDate(dateStr: string, referenceDateStr: string = getLocalDateStr()): boolean {
  if (!dateStr) return false;
  const cleanDate = dateStr.trim().substring(0, 10);
  return cleanDate < referenceDateStr;
}
