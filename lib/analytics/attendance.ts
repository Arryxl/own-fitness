import type { Plan, PlanSession, Workout } from "@/lib/types";
import { addDays, daysBetween, isoWeekKey, isoWeekday } from "./dates";
import { round } from "./units";

export interface PlannedDay {
  date: string;
  session: PlanSession;
}

/** Sessions that count as scheduled training (not optional, not floating, not cardio). */
export function scheduledSessions(plan: Plan): PlanSession[] {
  return plan.sessions.filter((s) => !s.optional && !s.floating && s.kind === "lifting");
}

/**
 * For rotating plans (e.g. StrongLifts A/B), which session falls on `date`:
 * count training days since the plan started and alternate.
 */
function rotatingSessionFor(plan: Plan, date: string): PlanSession | null {
  if (!plan.scheduleDays.includes(isoWeekday(date)) || date < plan.startDate) return null;
  const pool = scheduledSessions(plan);
  if (pool.length === 0) return null;
  let n = 0;
  const total = daysBetween(plan.startDate, date);
  for (let i = 0; i < total; i++) if (plan.scheduleDays.includes(isoWeekday(addDays(plan.startDate, i)))) n++;
  return pool[n % pool.length];
}

/** Scheduled sessions in the week starting `monday`. */
export function plannedSessionsForWeek(plan: Plan | null, monday: string): PlannedDay[] {
  if (!plan) return [];
  const out: PlannedDay[] = [];
  if (plan.rotation === "alternate") {
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      const s = rotatingSessionFor(plan, date);
      if (s) out.push({ date, session: s });
    }
    return out;
  }
  for (const s of scheduledSessions(plan)) if (s.weekday) out.push({ date: addDays(monday, s.weekday - 1), session: s });
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Any session with a fixed day on `date` (lifting or cardio), or the rotating session. */
export function sessionForDate(plan: Plan | null, date: string): PlanSession | null {
  if (!plan) return null;
  if (plan.rotation === "alternate") return rotatingSessionFor(plan, date);
  const wd = isoWeekday(date);
  return plan.sessions.find((s) => s.weekday === wd && !s.optional && s.kind === "lifting") ?? plan.sessions.find((s) => s.weekday === wd && !s.optional) ?? null;
}

export interface WeekAttendance {
  weekStart: string;
  weekKey: string;
  planned: number;
  /** Planned sessions whose date is on/before today. */
  plannedToDate: number;
  attended: number;
  attendedDates: string[];
  plannedDates: string[];
  met: boolean;
  closed: boolean;
}

/** Training attendance per week. Cardio-only sessions don't count as attended training days. */
export function weeklyAttendance(args: {
  plan: Plan | null;
  workouts: Workout[];
  weekStarts: string[];
  today: string;
  /** Planned days before this date (when the user started) are not counted as missed. */
  startDate?: string | null;
}): WeekAttendance[] {
  const { plan, workouts, weekStarts, today, startDate } = args;
  return weekStarts.map((ws) => {
    const planned = plannedSessionsForWeek(plan, ws).filter((p) => !startDate || p.date >= startDate);
    const end = addDays(ws, 6);
    const dates = new Set(
      workouts.filter((w) => w.status === "completed" && w.date >= ws && w.date <= end && w.sessionKind !== "cardio").map((w) => w.date),
    );
    const attendedDates = [...dates].sort();
    return {
      weekStart: ws,
      weekKey: isoWeekKey(ws),
      planned: planned.length,
      plannedToDate: planned.filter((p) => p.date <= today).length,
      attended: attendedDates.length,
      attendedDates,
      plannedDates: planned.map((p) => p.date),
      met: planned.length > 0 && attendedDates.length >= planned.length,
      closed: end < today,
    };
  });
}

export interface AttendanceSummary {
  compliancePct: number | null;
  streakWeeks: number;
  weeksWithAtLeast3: number;
  totalAttended: number;
  totalPlannedToDate: number;
}

export function summarizeAttendance(weeks: WeekAttendance[]): AttendanceSummary {
  const totalPlanned = weeks.reduce((a, w) => a + w.plannedToDate, 0);
  // Extra unplanned sessions don't push compliance over 100 %.
  const totalAttended = weeks.reduce((a, w) => a + Math.min(w.attended, w.plannedToDate), 0);
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.planned === 0 && w.closed) break;
    if (!w.closed) {
      if (w.met) streak++;
      continue; // an open week doesn't break the streak yet
    }
    if (w.met) streak++;
    else break;
  }
  return {
    compliancePct: totalPlanned > 0 ? round(Math.min(100, (totalAttended / totalPlanned) * 100), 0) : null,
    streakWeeks: streak,
    weeksWithAtLeast3: weeks.filter((w) => w.attended >= 3).length,
    totalAttended,
    totalPlannedToDate: totalPlanned,
  };
}

