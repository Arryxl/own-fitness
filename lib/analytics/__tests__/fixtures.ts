import type { Workout, WorkoutEntry, WorkoutSet } from "@/lib/types";

export function set(reps: number, weightKg: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { idx: 0, reps, weightKg, enteredValue: weightKg, enteredUnit: "kg", isWarmup: false, done: true, rir: null, ...extra };
}

export function entry(exerciseId: string, sets: WorkoutSet[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return { exerciseId, nameSnapshot: exerciseId, notes: "", sets: sets.map((s, i) => ({ ...s, idx: i })), ...extra };
}

let n = 0;
export function workout(date: string, entries: WorkoutEntry[], extra: Partial<Workout> = {}): Workout {
  n++;
  return {
    id: `w${n}`,
    date,
    planId: "p",
    sessionKey: "mon",
    sessionName: "Torso A",
    status: "completed",
    startedAt: 0,
    endedAt: 1,
    effort: 7,
    notes: "",
    entries,
    updatedAt: 0,
    ...extra,
  };
}
