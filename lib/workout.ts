// Building and summarizing workout sessions on the client.
import { exerciseHistory, performanceDroppedTwice } from "@/lib/analytics/strength";
import { suggestNext, type ProgressionSuggestion } from "@/lib/analytics/progression";
import { fromKg, round } from "@/lib/analytics/units";
import type { Exercise, PersonalRecord, Plan, PlanItem, PlanSession, Workout, WorkoutEntry, WorkoutSet } from "@/lib/types";

export function suggestionFor(
  item: Pick<PlanItem, "sets" | "repMin" | "repMax" | "rirTarget">,
  exercise: Exercise,
  workouts: Workout[],
  record: PersonalRecord | undefined,
  excludeWorkoutId?: string,
): ProgressionSuggestion {
  const history = exerciseHistory(
    workouts.filter((w) => w.id !== excludeWorkoutId),
    exercise.id,
  );
  return suggestNext({
    item,
    exercise,
    last: history.at(-1) ?? null,
    record,
    droppedTwice: performanceDroppedTwice(history),
  });
}

export function blankSet(idx: number, ex: Exercise, weightKg: number | null): WorkoutSet {
  return {
    idx,
    reps: null,
    weightKg,
    enteredValue: weightKg == null ? null : round(fromKg(weightKg, ex.displayUnit), 1),
    enteredUnit: ex.displayUnit,
    rir: null,
    isWarmup: false,
    done: false,
  };
}

export function entryFor(item: PlanItem, ex: Exercise, workouts: Workout[], record: PersonalRecord | undefined, plannedExerciseId?: string): WorkoutEntry {
  const s = suggestionFor(item, ex, workouts, record);
  return {
    exerciseId: ex.id,
    plannedExerciseId: plannedExerciseId ?? ex.id,
    substitutionReason: null,
    nameSnapshot: ex.name,
    notes: "",
    sets: Array.from({ length: item.sets }, (_, i) => blankSet(i, ex, s.weightKg)),
  };
}

export function buildWorkout(args: {
  id: string;
  date: string;
  plan: Plan | null;
  session: PlanSession | null;
  exercises: Map<string, Exercise>;
  workouts: Workout[];
  records: Map<string, PersonalRecord>;
}): Workout {
  const { id, date, plan, session, exercises, workouts, records } = args;
  const now = Date.now();
  const entries: WorkoutEntry[] = [];
  for (const item of session?.items ?? []) {
    const ex = exercises.get(item.exerciseId);
    if (!ex) continue;
    entries.push(entryFor(item, ex, workouts, records.get(ex.id)));
  }
  return {
    id,
    date,
    planId: plan?.id ?? null,
    sessionKey: session?.key ?? null,
    sessionName: session?.name ?? "Entrenamiento libre",
    status: "in_progress",
    startedAt: now,
    endedAt: null,
    effort: null,
    notes: "",
    entries,
    updatedAt: now,
  };
}

export function planItemFor(plan: Plan | null, sessionKey: string | null, exerciseId: string): PlanItem | null {
  const s = plan?.sessions.find((x) => x.key === sessionKey);
  return s?.items.find((i) => i.exerciseId === exerciseId) ?? null;
}

export function workoutProgress(w: Workout): { done: number; total: number } {
  const all = w.entries.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  return { done: all.filter((s) => s.done).length, total: all.length };
}

/** Rough duration estimate: ~45 s per set + rest. */
export function estimateMinutes(session: PlanSession): number {
  const sec = session.items.reduce((t, i) => t + i.sets * (45 + i.restSec), 0);
  return Math.round(sec / 60 / 5) * 5;
}
