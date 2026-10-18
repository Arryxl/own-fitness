// Local-calendar date helpers. Dates are stored as YYYY-MM-DD strings in the
// user's local time so "Monday" means the user's Monday, not UTC's.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(s: string): number {
  const day = parseISODate(s).getDay();
  return day === 0 ? 7 : day;
}

/** Monday of the ISO week containing `s`. */
export function weekStart(s: string): string {
  return addDays(s, 1 - isoWeekday(s));
}

/** ISO-8601 week key, e.g. "2026-W42". */
export function isoWeekKey(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  // Work in UTC to avoid DST drift; Thursday of this week decides the ISO year.
  const thursday = new Date(Date.UTC(y, m - 1, d));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoWeekday(s));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function tsToISODate(ts: number): string {
  return toISODate(new Date(ts));
}

/** Monday dates of the last `n` weeks ending with the week containing `today` (oldest first). */
export function lastWeekStarts(today: string, n: number): string[] {
  const current = weekStart(today);
  return Array.from({ length: n }, (_, i) => addDays(current, -7 * (n - 1 - i)));
}
