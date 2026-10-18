import type { Plan, PlanSession, Workout } from "@/lib/types";
import { addDays, isoWeekKey, isoWeekday, weekStart } from "./dates";
import { round } from "./units";

export interface PlannedDay {
  date: string;
  session: PlanSession;
}

/** Sessions planned in the week starting `monday`. The floating session only counts if activated that week. */
export function plannedSessionsForWeek(plan: Plan | null, monday: string, floatingWeekday: number | null): PlannedDay[] {
  if (!plan) return [];
  const out: PlannedDay[] = [];
  for (const s of plan.sessions) {
    if (s.kind === "gym" && s.weekday) out.push({ date: addDays(monday, s.weekday - 1), session: s });
    if (s.kind === "floating" && floatingWeekday) out.push({ date: addDays(monday, floatingWeekday - 1), session: s });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The session planned for a given date, if any. */
export function sessionForDate(plan: Plan | null, date: string, floatingWeekday: number | null): PlanSession | null {
  const planned = plannedSessionsForWeek(plan, weekStart(date), floatingWeekday);
  return planned.find((p) => p.date === date)?.session ?? null;
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

/** Gym attendance per week. Home sessions don't count as gym attendance. */
export function weeklyAttendance(args: {
  plan: Plan | null;
  workouts: Workout[];
  weekStarts: string[];
  floatingByWeek: Map<string, number | null>;
  today: string;
  /** Planned days before this date (when the user started) are not counted as missed. */
  startDate?: string | null;
}): WeekAttendance[] {
  const { plan, workouts, weekStarts, floatingByWeek, today, startDate } = args;
  const homeKeys = new Set(plan?.sessions.filter((s) => s.kind === "home").map((s) => s.key) ?? []);
  return weekStarts.map((ws) => {
    const key = isoWeekKey(ws);
    const planned = plannedSessionsForWeek(plan, ws, floatingByWeek.get(key) ?? null).filter((p) => !startDate || p.date >= startDate);
    const end = addDays(ws, 6);
    const dates = new Set(
      workouts
        .filter(
          (w) =>
            w.status === "completed" &&
            w.date >= ws &&
            w.date <= end &&
            !(w.sessionKey && homeKeys.has(w.sessionKey)),
        )
        .map((w) => w.date),
    );
    const attendedDates = [...dates].sort();
    const closed = end < today;
    return {
      weekStart: ws,
      weekKey: key,
      planned: planned.length,
      plannedToDate: planned.filter((p) => p.date <= today).length,
      attended: attendedDates.length,
      attendedDates,
      plannedDates: planned.map((p) => p.date),
      met: planned.length > 0 && attendedDates.length >= planned.length,
      closed,
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

export function isFloatingCandidate(plan: Plan | null, date: string): boolean {
  return !!plan?.sessions.some((s) => s.kind === "floating") && (plan.floatingWeekdays ?? [2, 4]).includes(isoWeekday(date));
}
