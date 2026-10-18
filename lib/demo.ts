// Local preview mode (NEXT_PUBLIC_DEMO_MODE=1, development only): an in-memory
// store with sample data replaces Firestore so the UI can be explored without
// a Firebase project. Never enabled in production builds.
import { addDays, todayISO, weekStart } from "@/lib/analytics/dates";
import { lbToKg } from "@/lib/analytics/units";
import { SEED_EXERCISES } from "@/lib/data/exercises";
import { SEED_FOODS } from "@/lib/data/foods";
import { SEED_PLANS } from "@/lib/data/plans";
import { SEED_RECORDS } from "@/lib/data/records";
import type { Profile, Workout, WorkoutEntry } from "@/lib/types";

export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1" && process.env.NODE_ENV !== "production";
export const DEMO_UID = "demo";

type Doc = Record<string, unknown> & { id: string };
type Store = { profile: Record<string, unknown> | null; cols: Record<string, Map<string, Doc>> };

const listeners = new Set<() => void>();
let store: Store | null = null;
const KEY = "ironlog:demo-store:v2";

function sampleWorkouts(): Workout[] {
  const today = todayISO();
  const mon = weekStart(today);
  const out: Workout[] = [];
  const plan = SEED_PLANS[0];
  // Four past weeks with mostly-complete attendance and slowly rising loads.
  for (let w = 4; w >= 0; w--) {
    const ws = addDays(mon, -7 * w);
    for (const s of plan.sessions.filter((x) => x.kind === "gym")) {
      if (w === 3 && s.key === "fri") continue; // one missed day
      const date = addDays(ws, (s.weekday ?? 1) - 1);
      if (date >= today) continue;
      const prog = 4 - w;
      const entries: WorkoutEntry[] = s.items.map((it) => {
        const ex = SEED_EXERCISES.find((e) => e.id === it.exerciseId)!;
        const base =
          ex.metric === "seconds" || ex.equipment.includes("bodyweight")
            ? null
            : ex.displayUnit === "lb"
              ? lbToKg((ex.equipment.includes("dumbbell") ? 20 : 60) + prog * 5)
              : (ex.equipment.includes("dumbbell") ? 8 : 30) + prog * 2;
        return {
          exerciseId: it.exerciseId,
          plannedExerciseId: it.exerciseId,
          nameSnapshot: ex.name,
          notes: "",
          sets: Array.from({ length: it.sets }, (_, i) => ({
            idx: i,
            reps: Math.min(it.repMax, it.repMin + prog - (i === 2 ? 1 : 0)),
            weightKg: base,
            enteredValue: base == null ? null : ex.displayUnit === "lb" ? Math.round(base / 0.45359237) : base,
            enteredUnit: ex.displayUnit,
            rir: 2,
            isWarmup: false,
            done: true,
          })),
        };
      });
      out.push({
        id: `demo-${date}`,
        date,
        planId: plan.id,
        sessionKey: s.key,
        sessionName: s.name,
        status: "completed",
        startedAt: new Date(`${date}T18:00:00`).getTime(),
        endedAt: new Date(`${date}T19:05:00`).getTime(),
        effort: 7,
        notes: "",
        entries,
        updatedAt: Date.now(),
      });
    }
  }
  return out;
}

function initial(): Store {
  const now = Date.now();
  const today = todayISO();
  const profile: Profile = {
    heightCm: 182,
    goal: "Recomposición",
    units: "kg",
    timezone: "America/Bogota",
    weeklyBudget: null,
    currency: "COP",
    country: "CO",
    activePlanId: "plan_3d",
    proteinTargetG: null,
    stepsTarget: 8500,
    stepsBaseline: 6000,
    startDate: addDays(today, -30),
    startWeightKg: 74,
    restTimerDefaultSec: 90,
    seededVersion: 1,
    createdAt: now,
  };
  const cols: Store["cols"] = {};
  const put = (col: string, d: Doc) => (cols[col] ??= new Map()).set(d.id, d);
  SEED_EXERCISES.forEach((e) => put("exercises", e as unknown as Doc));
  SEED_PLANS.forEach((p) => put("plans", p as unknown as Doc));
  SEED_FOODS.forEach((f) => put("foods", f as unknown as Doc));
  SEED_RECORDS.forEach((r) => put("personalRecords", { ...r, id: r.exerciseId, updatedAt: now } as unknown as Doc));
  sampleWorkouts().forEach((w) => put("workouts", w as unknown as Doc));
  for (let i = 28; i >= 0; i--) {
    const d = addDays(today, -i);
    const ts = new Date(`${d}T07:00:00`).getTime();
    const wobble = Math.sin(i * 1.7) * 0.35;
    put("bodyMetrics", { id: `bm-${d}`, ts, weightKg: Math.round((74 - (28 - i) * 0.012 + wobble) * 10) / 10, waistCm: i % 7 === 0 ? 89 - (28 - i) * 0.04 : null, notes: "" });
    put("activity", { id: `act-${d}`, date: d, steps: 5500 + Math.round(Math.abs(Math.sin(i)) * 4500), walkMinutes: null, notes: "" });
    put("meals", { id: `meal-${d}-1`, ts, date: d, text: "Huevos con arepa", items: [], proteinG: 24, source: "manual" });
    put("meals", { id: `meal-${d}-2`, ts: ts + 6 * 3600000, date: d, text: "Arroz, lentejas y pollo", items: [], proteinG: 48 + (i % 3) * 12, source: "manual" });
  }
  return { profile: profile as unknown as Record<string, unknown>, cols };
}

function load(): Store {
  if (store) return store;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { profile: Store["profile"]; cols: Record<string, Doc[]> };
      store = { profile: parsed.profile, cols: Object.fromEntries(Object.entries(parsed.cols).map(([k, v]) => [k, new Map(v.map((d) => [d.id, d]))])) };
      return store;
    }
  } catch {
    /* ignore */
  }
  store = initial();
  return store;
}

function persist() {
  try {
    const s = load();
    localStorage.setItem(KEY, JSON.stringify({ profile: s.profile, cols: Object.fromEntries(Object.entries(s.cols).map(([k, v]) => [k, [...v.values()]])) }));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function demoSubscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function demoProfile(): Record<string, unknown> | null {
  return load().profile;
}

export function demoCollection(col: string): Doc[] {
  return [...(load().cols[col]?.values() ?? [])];
}

export function demoPut(col: string | null, id: string, data: Record<string, unknown>, merge: boolean) {
  const s = load();
  if (col == null) {
    s.profile = merge ? { ...(s.profile ?? {}), ...data } : data;
  } else {
    const m = (s.cols[col] ??= new Map());
    const prev = m.get(id);
    m.set(id, { ...(merge && prev ? prev : {}), ...data, id } as Doc);
  }
  persist();
}

export function demoPatch(col: string, id: string, data: Record<string, unknown>) {
  const m = (load().cols[col] ??= new Map());
  const prev = m.get(id);
  if (!prev) return;
  const next: Doc = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    // Support dotted paths used by updateDoc ("a.b": v).
    const parts = k.split(".");
    let o: Record<string, unknown> = next;
    for (const p of parts.slice(0, -1)) o = (o[p] = { ...((o[p] as object) ?? {}) }) as Record<string, unknown>;
    o[parts[parts.length - 1]] = v;
  }
  m.set(id, next);
  persist();
}

export function demoRemove(col: string, id: string) {
  load().cols[col]?.delete(id);
  persist();
}

export function demoReset() {
  store = initial();
  persist();
}

let seq = 0;
export function demoId(): string {
  return `d${Date.now().toString(36)}${(seq++).toString(36)}`;
}
