/**
 * Date utility functions for timezone-safe calendar date handling
 * 
 * These helpers ensure dates are parsed and formatted in the user's local timezone
 * instead of UTC, preventing off-by-one day errors across different timezones.
 */

/**
 * Get current date in the user's local timezone, normalized to midnight
 * @returns Date object representing today's date at midnight in local timezone
 */
export function getTodayLocal(): Date {
  const now = new Date();
  // Normalize to midnight in local timezone to prevent off-by-one errors
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * @deprecated Use getTodayLocal() instead
 * Legacy function - internally calls getTodayLocal() for compatibility
 */
export function getTodayEDT(): Date {
  return getTodayLocal();
}

/**
 * Parse a YYYY-MM-DD string into a Date object in the user's local timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing the calendar date in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Format a Date object to YYYY-MM-DD string using local timezone
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compare if two dates are the same calendar day (ignores time)
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns true if dates represent the same calendar day
 */
export function isSameCalendarDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Compare if date1 is before date2 by calendar date (year/month/day)
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns true if date1 is before date2
 */
export function isBeforeCalendarDay(date1: Date, date2: Date): boolean {
  if (date1.getFullYear() !== date2.getFullYear()) {
    return date1.getFullYear() < date2.getFullYear();
  }
  if (date1.getMonth() !== date2.getMonth()) {
    return date1.getMonth() < date2.getMonth();
  }
  return date1.getDate() < date2.getDate();
}

/**
 * Compare if date1 is after date2 by calendar date (year/month/day)
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns true if date1 is after date2
 */
export function isAfterCalendarDay(date1: Date, date2: Date): boolean {
  if (date1.getFullYear() !== date2.getFullYear()) {
    return date1.getFullYear() > date2.getFullYear();
  }
  if (date1.getMonth() !== date2.getMonth()) {
    return date1.getMonth() > date2.getMonth();
  }
  return date1.getDate() > date2.getDate();
}
