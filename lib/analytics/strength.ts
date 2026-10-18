import type { Workout, WorkoutEntry, WorkoutSet } from "@/lib/types";
import { round } from "./units";

/** Sets that count as real work: completed, not warm-up, with reps logged. */
export function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.done && !s.isWarmup && (s.reps ?? 0) > 0);
}

/**
 * Estimated 1RM using the Epley formula (heuristic; loses accuracy above ~12 reps).
 * Returns null for bodyweight/unloaded sets.
 */
export function e1rm(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (!weightKg || weightKg <= 0 || !reps || reps <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function bestSet(sets: WorkoutSet[]): WorkoutSet | null {
  const work = workingSets(sets);
  if (work.length === 0) return null;
  return work.reduce((best, s) => {
    const a = e1rm(s.weightKg, s.reps) ?? 0;
    const b = e1rm(best.weightKg, best.reps) ?? 0;
    if (a !== b) return a > b ? s : best;
    return (s.reps ?? 0) > (best.reps ?? 0) ? s : best;
  });
}

export interface ExerciseSession {
  date: string;
  workoutId: string;
  substituted: boolean;
  sets: WorkoutSet[];
  best: WorkoutSet | null;
  e1rmKg: number | null;
  topWeightKg: number | null;
  totalReps: number;
  tonnageKg: number;
}

export function summarizeEntry(entry: WorkoutEntry, workout: Workout): ExerciseSession {
  const work = workingSets(entry.sets);
  const best = bestSet(entry.sets);
  const topWeightKg = work.reduce<number | null>(
    (m, s) => (s.weightKg != null && (m == null || s.weightKg > m) ? s.weightKg : m),
    null,
  );
  return {
    date: workout.date,
    workoutId: workout.id,
    substituted: !!entry.plannedExerciseId && entry.plannedExerciseId !== entry.exerciseId,
    sets: work,
    best,
    e1rmKg: best ? e1rm(best.weightKg, best.reps) : null,
    topWeightKg,
    totalReps: work.reduce((t, s) => t + (s.reps ?? 0), 0),
    tonnageKg: work.reduce((t, s) => t + (s.reps ?? 0) * (s.weightKg ?? 0), 0),
  };
}

/**
 * History of ONE concrete exercise (never mixes a machine press with a dumbbell
 * press, even when one substitutes the other). Oldest first.
 */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    for (const entry of w.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      const s = summarizeEntry(entry, w);
      if (s.sets.length > 0) out.push(s);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface ExerciseTrend {
  sessions: number;
  firstE1rmKg: number | null;
  lastE1rmKg: number | null;
  bestE1rmKg: number | null;
  e1rmChangePct: number | null;
  firstTopWeightKg: number | null;
  lastTopWeightKg: number | null;
  firstTotalReps: number | null;
  lastTotalReps: number | null;
  direction: "up" | "flat" | "down" | "unknown";
}

export function exerciseTrend(history: ExerciseSession[]): ExerciseTrend {
  if (history.length === 0) {
    return {
      sessions: 0,
      firstE1rmKg: null,
      lastE1rmKg: null,
      bestE1rmKg: null,
      e1rmChangePct: null,
      firstTopWeightKg: null,
      lastTopWeightKg: null,
      firstTotalReps: null,
      lastTotalReps: null,
      direction: "unknown",
    };
  }
  const first = history[0];
  const last = history[history.length - 1];
  const best = history.reduce<number | null>((m, h) => (h.e1rmKg != null && (m == null || h.e1rmKg > m) ? h.e1rmKg : m), null);
  let pct: number | null = null;
  let direction: ExerciseTrend["direction"] = "unknown";
  if (history.length >= 2) {
    if (first.e1rmKg && last.e1rmKg) {
      pct = ((last.e1rmKg - first.e1rmKg) / first.e1rmKg) * 100;
      direction = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
    } else {
      // Unloaded (bodyweight) exercise: compare total reps.
      const diff = last.totalReps - first.totalReps;
      direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    }
  }
  return {
    sessions: history.length,
    firstE1rmKg: first.e1rmKg != null ? round(first.e1rmKg, 1) : null,
    lastE1rmKg: last.e1rmKg != null ? round(last.e1rmKg, 1) : null,
    bestE1rmKg: best != null ? round(best, 1) : null,
    e1rmChangePct: pct != null ? round(pct, 1) : null,
    firstTopWeightKg: first.topWeightKg,
    lastTopWeightKg: last.topWeightKg,
    firstTotalReps: first.totalReps,
    lastTotalReps: last.totalReps,
    direction,
  };
}

/** True when the last two sessions each performed worse than the one before (rule 8.1). */
export function performanceDroppedTwice(history: ExerciseSession[]): boolean {
  if (history.length < 3) return false;
  const [a, b, c] = history.slice(-3);
  const score = (s: ExerciseSession) => s.e1rmKg ?? s.totalReps;
  return score(b) < score(a) && score(c) < score(b);
}
