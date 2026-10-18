// Derived weekly snapshot stored in weeklyStats/{isoWeek}. Computed on the
// client when a workout is saved (works offline); the AI tools recompute from
// raw data on the server, so this is a convenience cache, not a source of truth.
import { addDays, isoWeekKey, tsToISODate, weekStart } from "@/lib/analytics/dates";
import { dailyMeans, movingAverage7d } from "@/lib/analytics/bodyweight";
import { proteinByDay } from "@/lib/analytics/nutrition";
import { plannedSessionsForWeek } from "@/lib/analytics/attendance";
import { round } from "@/lib/analytics/units";
import { setsByMuscle, tonnageByMuscle } from "@/lib/analytics/volume";
import type { AppData } from "@/components/providers/DataProvider";
import type { WeeklyStats, Workout } from "@/lib/types";

export function computeWeeklyStats(data: Pick<AppData, "activePlan" | "workouts" | "exerciseMap" | "bodyMetrics" | "meals" | "weekPlans">, date: string, extra?: Workout): WeeklyStats {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  const key = isoWeekKey(date);
  const all = extra ? [...data.workouts.filter((w) => w.id !== extra.id), extra] : data.workouts;
  const week = all.filter((w) => w.status === "completed" && w.date >= ws && w.date <= we);
  const ma = movingAverage7d(dailyMeans(data.bodyMetrics, "weightKg")).filter((d) => d.date <= we);
  const waist = data.bodyMetrics.filter((m) => m.waistCm && tsToISODate(m.ts) <= we).at(-1)?.waistCm ?? null;
  const prot = [...proteinByDay(data.meals.filter((m) => m.date >= ws && m.date <= we)).values()];
  return {
    id: key,
    attended: new Set(week.map((w) => w.date)).size,
    planned: plannedSessionsForWeek(data.activePlan, ws, data.weekPlans.get(key) ?? null).length,
    setsByMuscle: setsByMuscle(week, data.exerciseMap),
    tonnageByMuscle: tonnageByMuscle(week, data.exerciseMap),
    avgWeight7d: ma.at(-1)?.value ?? null,
    waistCm: waist,
    proteinAvg: prot.length ? round(prot.reduce((a, b) => a + b, 0) / prot.length, 0) : null,
    updatedAt: Date.now(),
  };
}
