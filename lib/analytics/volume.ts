import type { Exercise, Muscle, Plan, Workout } from "@/lib/types";
import { weekStart } from "./dates";
import { workingSets } from "./strength";
import { round } from "./units";

/** Heuristic: a set counts fully for the primary muscle and half for each secondary. */
export const SECONDARY_WEIGHT = 0.5;
export const VOLUME_TARGET = { min: 12, max: 20, low: 10, high: 22 } as const;
export const PRIORITY_MUSCLES: Muscle[] = ["chest", "back", "shoulders", "triceps"];
export const TRACKED_MUSCLES: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "rear_delts",
  "triceps",
  "biceps",
  "quads",
  "hamstrings",
  "glutes",
  "abs",
];

export type MuscleCount = Partial<Record<Muscle, number>>;

function add(acc: MuscleCount, m: Muscle, v: number) {
  acc[m] = round((acc[m] ?? 0) + v, 2);
}

function attribute(acc: MuscleCount, ex: Pick<Exercise, "primaryMuscle" | "secondaryMuscles">, sets: number) {
  add(acc, ex.primaryMuscle, sets);
  for (const m of ex.secondaryMuscles) if (m !== ex.primaryMuscle) add(acc, m, sets * SECONDARY_WEIGHT);
}

/** A "hard" set: working set, and if RIR was logged it was 4 or fewer. */
function hardSetCount(sets: Workout["entries"][number]["sets"]): number {
  return workingSets(sets).filter((s) => s.rir == null || s.rir <= 4).length;
}

/**
 * Hard sets per muscle for the given workouts. A substitution is attributed to
 * the planned exercise's muscles so it counts toward the same muscle group.
 */
export function setsByMuscle(workouts: Workout[], exercises: Map<string, Exercise>): MuscleCount {
  const acc: MuscleCount = {};
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    for (const e of w.entries) {
      const ex = exercises.get(e.plannedExerciseId ?? e.exerciseId) ?? exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = hardSetCount(e.sets);
      if (n > 0) attribute(acc, ex, n);
    }
  }
  return acc;
}

/** Kg moved (reps × load) per primary muscle. */
export function tonnageByMuscle(workouts: Workout[], exercises: Map<string, Exercise>): MuscleCount {
  const acc: MuscleCount = {};
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    for (const e of w.entries) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const t = workingSets(e.sets).reduce((s, x) => s + (x.reps ?? 0) * (x.weightKg ?? 0), 0);
      if (t > 0) add(acc, ex.primaryMuscle, t);
    }
  }
  return acc;
}

export function weeklySetsByMuscle(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  weekStarts: string[],
): { weekStart: string; sets: MuscleCount }[] {
  return weekStarts.map((ws) => ({
    weekStart: ws,
    sets: setsByMuscle(
      workouts.filter((w) => weekStart(w.date) === ws),
      exercises,
    ),
  }));
}

/** Planned weekly hard sets per muscle for a plan template. */
export function planVolume(
  plan: Plan,
  exercises: Map<string, Exercise>,
  opts: { includeFloating: boolean } = { includeFloating: true },
): MuscleCount {
  const acc: MuscleCount = {};
  for (const s of plan.sessions) {
    if (s.kind === "home") continue;
    if (s.kind === "floating" && !opts.includeFloating) continue;
    for (const it of s.items) {
      const ex = exercises.get(it.exerciseId);
      if (ex) attribute(acc, ex, it.sets);
    }
  }
  return acc;
}

export type VolumeStatus = "low" | "near" | "ok" | "high" | "excess";

export function volumeStatus(sets: number): VolumeStatus {
  if (sets < VOLUME_TARGET.low) return "low";
  if (sets < VOLUME_TARGET.min) return "near";
  if (sets <= VOLUME_TARGET.max) return "ok";
  if (sets <= VOLUME_TARGET.high) return "high";
  return "excess";
}
