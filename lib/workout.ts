// Building and summarizing workout sessions on the client.
import { exerciseHistory, exerciseTrend, performanceDroppedTwice } from "@/lib/analytics/strength";
import { formatWeight } from "@/lib/analytics/units";
import { suggestNext, type ProgressionSuggestion } from "@/lib/analytics/progression";
import { fromKg, round } from "@/lib/analytics/units";
import type { AddOn, Exercise, PersonalRecord, Plan, PlanItem, PlanSession, RepUnit, Workout, WorkoutEntry, WorkoutSet } from "@/lib/types";

export const DEFAULT_ITEM: Omit<PlanItem, "exerciseId"> = { sets: 3, repMin: 8, repMax: 12, restSec: 90, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "reps" };

export function suggestionFor(
  item: Pick<PlanItem, "sets" | "repMin" | "repMax" | "rirTarget"> & { repUnit?: RepUnit; intensity?: string },
  exercise: Exercise,
  workouts: Workout[],
  record: PersonalRecord | undefined,
): ProgressionSuggestion {
  const history = exerciseHistory(workouts, exercise.id);
  if (item.intensity) {
    // %-based programs (5/3/1, nSuns, Madcow…): load comes from a training max.
    const best = exerciseTrend(history).bestE1rmKg ?? record?.currentWeightKg ?? null;
    const tm = best ? best * 0.9 : null;
    return {
      kind: "percent",
      weightKg: null,
      targetReps: item.repMin,
      message: `Carga por porcentaje: ${item.intensity}.${tm ? ` Tu máximo de entrenamiento (TM, 90 % de tu mejor e1RM) ≈ ${formatWeight(tm, exercise.displayUnit)}.` : " Registra una serie pesada para estimar tu TM."}`,
    };
  }
  return suggestNext({ item, exercise, last: history.at(-1) ?? null, record, droppedTwice: performanceDroppedTwice(history), repUnit: item.repUnit });
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

export function entryFor(item: PlanItem, ex: Exercise, workouts: Workout[], record: PersonalRecord | undefined): WorkoutEntry {
  const s = suggestionFor(item, ex, workouts, record);
  return {
    exerciseId: ex.id,
    plannedExerciseId: ex.id,
    substitutionReason: null,
    nameSnapshot: ex.name,
    repUnit: item.repUnit,
    notes: "",
    sets: Array.from({ length: item.sets }, (_, i) => blankSet(i, ex, s.weightKg)),
  };
}

/** Plan items of a session plus the add-ons the user enabled (lifting sessions only). */
export function sessionItems(session: PlanSession, plan: Plan | null, addOns: AddOn[]): PlanItem[] {
  if (!plan || session.kind !== "lifting") return session.items;
  const extra = plan.enabledAddOns.flatMap((id) => addOns.find((a) => a.id === id)?.items ?? []);
  return [...session.items, ...extra.filter((x) => !session.items.some((i) => i.exerciseId === x.exerciseId))];
}

/** If the planned exercise isn't available, use the first available link of its fallback chain. */
export function resolveAvailable(ex: Exercise, exercises: Map<string, Exercise>): { exercise: Exercise; substituted: boolean } {
  if (ex.available) return { exercise: ex, substituted: false };
  for (const l of ex.fallbackChain) {
    const alt = exercises.get(l.exerciseId);
    if (alt?.available) return { exercise: alt, substituted: true };
  }
  return { exercise: ex, substituted: false };
}

export function buildWorkout(args: {
  id: string;
  date: string;
  plan: Plan | null;
  session: PlanSession | null;
  exercises: Map<string, Exercise>;
  addOns: AddOn[];
  workouts: Workout[];
  records: Map<string, PersonalRecord>;
}): Workout {
  const { id, date, plan, session, exercises, addOns, workouts, records } = args;
  const now = Date.now();
  const entries: WorkoutEntry[] = [];
  for (const item of session ? sessionItems(session, plan, addOns) : []) {
    const planned = exercises.get(item.exerciseId);
    if (!planned) continue;
    const { exercise, substituted } = resolveAvailable(planned, exercises);
    const e = entryFor(item, exercise, workouts, records.get(exercise.id));
    entries.push(substituted ? { ...e, plannedExerciseId: planned.id, substitutionReason: "missing" } : e);
  }
  return {
    id,
    date,
    planId: plan?.id ?? null,
    sessionKey: session?.key ?? null,
    sessionName: session?.name ?? "Entrenamiento libre",
    sessionKind: session?.kind ?? "lifting",
    status: "in_progress",
    startedAt: now,
    endedAt: null,
    effort: null,
    notes: "",
    entries,
    updatedAt: now,
  };
}

export function planItemFor(plan: Plan | null, sessionKey: string | null, exerciseId: string, addOns: AddOn[] = []): PlanItem | null {
  const s = plan?.sessions.find((x) => x.key === sessionKey);
  return s?.items.find((i) => i.exerciseId === exerciseId) ?? addOns.flatMap((a) => a.items).find((i) => i.exerciseId === exerciseId && plan?.enabledAddOns.length) ?? null;
}

export function workoutProgress(w: Workout): { done: number; total: number } {
  const all = w.entries.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  return { done: all.filter((s) => s.done).length, total: all.length };
}

export function estimateMinutes(session: PlanSession): number {
  if (session.estimatedMinutes) return session.estimatedMinutes;
  const sec = session.items.reduce((t, i) => t + i.sets * (45 + i.restSec), 0);
  return Math.round(sec / 60 / 5) * 5;
}
