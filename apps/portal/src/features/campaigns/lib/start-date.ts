/**
 * Mirrors the API's start-date-rules: start dates are calendar days in India
 * (IST), whatever timezone this browser is set to — so the date picker's
 * limits always agree with what the server accepts.
 */
const istDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const MAX_START_DAYS_AHEAD = 365;

/** Today in India, as YYYY-MM-DD (what <input type="date"> uses). */
export function todayInIndia(now: Date = new Date()): string {
  return istDay.format(now);
}

/** The latest start date allowed (12 months from today in India). */
export function latestStartDate(now: Date = new Date()): string {
  const d = new Date(`${todayInIndia(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + MAX_START_DAYS_AHEAD);
  return d.toISOString().slice(0, 10);
}

function dayNumber(day: string): number | null {
  const m = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  return Number(m[1]) * 10_000 + Number(m[2]) * 100 + Number(m[3]);
}

/** A message to show under the field, or null when the date is fine.
 * Empty is not an error here — the Next button handles "required". */
export function startDateProblem(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) return null;
  const day = dayNumber(value);
  if (day === null) return "Enter a valid date";
  if (day < dayNumber(todayInIndia(now))!) return "Start date can't be in the past — choose today or a later date";
  if (day > dayNumber(latestStartDate(now))!) return "Start date must be within the next 12 months";
  return null;
}
