// "Mi semana": the plan laid out Monday → Sunday, plus the extra blocks
// (core at home, a walk, light cardio…) the user or the coach adds to a day.
// Pure helpers shared by the client UI and the coach tools on the server.
import { plannedSessionsForWeek, rotatingSessionFor } from "@/lib/analytics/attendance";
import { addDays } from "@/lib/analytics/dates";
import { workingSets } from "@/lib/analytics/strength";
import type { BlockPlace, Equipment, Exercise, Plan, PlanItem, PlanSession, ProposedBlock, RepUnit, Workout } from "@/lib/types";

export const BLOCK_PLACES: BlockPlace[] = ["gym", "home", "outdoor"];

export const PLACE_LABEL: Record<BlockPlace, string> = { gym: "Gimnasio", home: "Casa", outdoor: "Fuera" };

/** Equipment you can reasonably expect outside a gym. */
const PLACE_EQUIPMENT: Record<Exclude<BlockPlace, "gym">, Equipment[]> = {
  home: ["bodyweight", "dumbbell", "band", "bench", "pullup_bar"],
  outdoor: ["bodyweight", "band", "pullup_bar", "dip_bars"],
};

export function placeOf(s: Pick<PlanSession, "place">): BlockPlace {
  return s.place ?? "gym";
}

/** Can this exercise be done there? At the gym it depends on the user's equipment profile. */
export function exerciseFitsPlace(ex: Pick<Exercise, "equipment" | "available">, place: BlockPlace): boolean {
  if (place === "gym") return ex.available;
  return ex.equipment.every((e) => PLACE_EQUIPMENT[place].includes(e));
}

export interface WeekDay {
  /** ISO weekday 1 = Monday … 7 = Sunday. */
  weekday: number;
  date: string;
  /** Plan sessions that fall on this day (the ones that count as training). */
  sessions: PlanSession[];
  extras: PlanSession[];
  minutes: number;
}

/** The plan's week starting `monday`: rotating plans resolve which session falls on each date. */
export function weekSchedule(plan: Plan | null, monday: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const weekday = i + 1;
    const date = addDays(monday, i);
    const all = plan?.sessions ?? [];
    let sessions: PlanSession[];
    if (!plan) sessions = [];
    else if (plan.rotation === "alternate") {
      const s = rotatingSessionFor(plan, date);
      sessions = s ? [s] : [];
    } else sessions = all.filter((s) => !s.extra && s.weekday === weekday);
    const extras = all.filter((s) => s.extra && s.weekday === weekday);
    const minutes = [...sessions, ...extras].reduce((t, s) => t + (s.estimatedMinutes || 0), 0);
    return { weekday, date, sessions, extras, minutes };
  });
}

/** Sessions without a fixed day (optional, floating or unassigned), shown apart from the week. */
export function unscheduledSessions(plan: Plan | null): PlanSession[] {
  if (!plan || plan.rotation === "alternate") return plan?.sessions.filter((s) => s.extra && !s.weekday) ?? [];
  return plan.sessions.filter((s) => !s.weekday);
}

/** Next free key for a block: X1, X2… (template sessions use letters or A1-style keys). */
export function nextBlockKey(plan: Pick<Plan, "sessions">, taken: string[] = []): string {
  const used = new Set([...plan.sessions.map((s) => s.key), ...taken]);
  for (let n = 1; ; n++) if (!used.has(`X${n}`)) return `X${n}`;
}

export function itemFor(ex: Pick<Exercise, "id" | "isCompound" | "metric">, patch: Partial<PlanItem> = {}): PlanItem {
  const unit: RepUnit = patch.repUnit ?? ex.metric;
  const range =
    unit === "minutes"
      ? { repMin: 20, repMax: 30, restSec: 0, rirTarget: 4 }
      : unit === "seconds"
        ? { repMin: 30, repMax: 45, restSec: 45, rirTarget: 2 }
        : { repMin: 8, repMax: 12, restSec: ex.isCompound ? 120 : 75, rirTarget: 2 };
  return { exerciseId: ex.id, sets: unit === "minutes" ? 1 : 3, ...range, supersetGroup: null, notes: null, repUnit: unit, ...patch };
}

export interface BlockDraft {
  name: string;
  focus?: string;
  place: BlockPlace;
  kind: "lifting" | "cardio";
  weekday: number | null;
  estimatedMinutes: number;
  items: PlanItem[];
}

export function newBlock(plan: Pick<Plan, "sessions">, d: BlockDraft, takenKeys: string[] = []): PlanSession {
  return {
    key: nextBlockKey(plan, takenKeys),
    name: d.name.trim() || "Bloque extra",
    focus: d.focus?.trim() ?? "",
    kind: d.kind,
    weekday: d.weekday,
    optional: false,
    floating: false,
    notes: null,
    estimatedMinutes: Math.max(1, Math.round(d.estimatedMinutes)),
    items: d.items,
    place: d.place,
    extra: true,
  };
}

/** Ready-made blocks for the "Añadir" sheet. Every id exists in the seed catalog (checked in tests). */
export const BLOCK_PRESETS: { id: string; label: string; description: string; draft: Omit<BlockDraft, "weekday"> }[] = [
  {
    id: "core_home",
    label: "Core en casa",
    description: "3 ejercicios sin equipo · ~12 min",
    draft: {
      name: "Core en casa",
      focus: "Abdomen y estabilidad",
      place: "home",
      kind: "lifting",
      estimatedMinutes: 12,
      items: [
        {
          exerciseId: "dead_bug",
          sets: 3,
          repMin: 8,
          repMax: 12,
          restSec: 45,
          rirTarget: 2,
          supersetGroup: null,
          notes: "Por lado; espalda baja pegada al suelo",
          repUnit: "reps",
        },
        { exerciseId: "plank", sets: 3, repMin: 30, repMax: 45, restSec: 45, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "seconds" },
        { exerciseId: "reverse_crunch", sets: 2, repMin: 10, repMax: 15, restSec: 45, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "reps" },
      ],
    },
  },
  {
    id: "walk",
    label: "Caminata",
    description: "Caminata rápida al aire libre · 30 min",
    draft: {
      name: "Caminata rápida",
      focus: "Gasto calórico y pasos",
      place: "outdoor",
      kind: "cardio",
      estimatedMinutes: 30,
      items: [
        {
          exerciseId: "brisk_walk",
          sets: 1,
          repMin: 30,
          repMax: 40,
          restSec: 0,
          rirTarget: 4,
          supersetGroup: null,
          notes: "Ritmo en el que puedes hablar",
          repUnit: "minutes",
        },
      ],
    },
  },
  {
    id: "cardio_gym",
    label: "Cardio suave en el gym",
    description: "Caminata inclinada en cinta · 25 min",
    draft: {
      name: "Cardio suave",
      focus: "Cardio de baja intensidad",
      place: "gym",
      kind: "cardio",
      estimatedMinutes: 25,
      items: [
        {
          exerciseId: "incline_walk",
          sets: 1,
          repMin: 20,
          repMax: 30,
          restSec: 0,
          rirTarget: 4,
          supersetGroup: null,
          notes: "Puedes hablar sin ahogarte",
          repUnit: "minutes",
        },
      ],
    },
  },
  {
    id: "bodyweight_home",
    label: "Fuerza en casa",
    description: "Cuerpo completo con tu peso · ~25 min",
    draft: {
      name: "Fuerza en casa",
      focus: "Cuerpo completo sin equipo",
      place: "home",
      kind: "lifting",
      estimatedMinutes: 25,
      items: [
        { exerciseId: "bw_squat", sets: 3, repMin: 12, repMax: 20, restSec: 60, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "reps" },
        {
          exerciseId: "pushup",
          sets: 3,
          repMin: 6,
          repMax: 15,
          restSec: 60,
          rirTarget: 2,
          supersetGroup: null,
          notes: "Si no salen, apoya las manos en una mesa",
          repUnit: "reps",
        },
        { exerciseId: "glute_bridge", sets: 3, repMin: 12, repMax: 20, restSec: 60, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "reps" },
        { exerciseId: "plank", sets: 2, repMin: 30, repMax: 45, restSec: 45, rirTarget: 2, supersetGroup: null, notes: null, repUnit: "seconds" },
      ],
    },
  },
];

// ---------- Coach proposals for new blocks ----------

export interface BlockItemInput {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  unit?: RepUnit;
  restSec?: number;
  notes?: string;
}

export interface BlockInput {
  name: string;
  focus?: string;
  place: BlockPlace;
  kind: "lifting" | "cardio";
  weekdays: number[];
  minutes: number;
  items: BlockItemInput[];
}

/**
 * Checks a block the coach wants to propose against the real plan and catalog.
 * Errors are written for the model so it can fix the call and try again.
 */
export function validateBlock(
  input: BlockInput,
  plan: Plan,
  exercises: Map<string, Exercise>,
  monday: string,
): { error: string } | { block: ProposedBlock; warnings: string[] } {
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  if (weekdays.length === 0 || weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
    return { error: "weekdays debe tener días del 1 (lunes) al 7 (domingo)." };
  if (input.items.length === 0) return { error: "El bloque necesita al menos un ejercicio." };
  const items: PlanItem[] = [];
  const misfit: string[] = [];
  for (const it of input.items) {
    const ex = exercises.get(it.exerciseId);
    if (!ex) return { error: `Ejercicio desconocido: ${it.exerciseId}. Busca ids reales con find_exercises.` };
    if (it.repMin > it.repMax) return { error: `${ex.name}: repMin (${it.repMin}) es mayor que repMax (${it.repMax}).` };
    if (!exerciseFitsPlace(ex, input.place)) misfit.push(`${ex.name} (${ex.equipment.join(", ")})`);
    items.push(
      itemFor(ex, {
        sets: it.sets,
        repMin: it.repMin,
        repMax: it.repMax,
        repUnit: it.unit ?? ex.metric,
        ...(it.restSec != null && { restSec: it.restSec }),
        notes: it.notes?.trim() || null,
      }),
    );
  }
  if (misfit.length)
    return { error: `No se pueden hacer en "${PLACE_LABEL[input.place]}": ${misfit.join("; ")}. Usa find_exercises con place="${input.place}".` };

  const warnings: string[] = [];
  const week = weekSchedule(plan, monday);
  for (const d of weekdays) {
    const day = week[d - 1];
    const sameName = day.extras.find((x) => x.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    if (sameName) warnings.push(`El día ${d} ya tiene un bloque llamado "${sameName.name}".`);
    if (day.minutes + input.minutes > 120) warnings.push(`El día ${d} pasaría de 2 h de entrenamiento planeado.`);
  }
  return {
    block: {
      name: input.name.trim(),
      focus: input.focus?.trim() ?? "",
      place: input.place,
      kind: input.kind,
      weekdays,
      estimatedMinutes: Math.round(input.minutes),
      items,
    },
    warnings,
  };
}

/** Adds one copy of the proposed block per weekday. */
export function addProposedBlock(plan: Plan, b: ProposedBlock): Plan {
  const added: PlanSession[] = [];
  for (const weekday of b.weekdays) {
    added.push(
      newBlock(
        plan,
        { name: b.name, focus: b.focus, place: b.place, kind: b.kind, weekday, estimatedMinutes: b.estimatedMinutes, items: b.items.map((i) => ({ ...i })) },
        added.map((s) => s.key),
      ),
    );
  }
  return { ...plan, sessions: [...plan.sessions, ...added] };
}

// ---------- What was done this week (home screen chart) ----------

export interface DayActivity {
  date: string;
  /** Working sets from plan sessions (gym days, free workouts). */
  sets: number;
  /** Working sets from extra blocks (core at home, walks…). */
  extraSets: number;
  /** A plan training session falls on this day. */
  planned: boolean;
  extrasPlanned: number;
  extrasDone: number;
}

/** Per-day activity for the week starting `monday`, keeping plan sessions and extra blocks apart. */
export function weekActivity(plan: Plan | null, workouts: Workout[], monday: string): DayActivity[] {
  const planned = new Set(plannedSessionsForWeek(plan, monday).map((p) => p.date));
  const schedule = weekSchedule(plan, monday);
  const count = (ws: Workout[]) => ws.reduce((t, w) => t + w.entries.reduce((a, e) => a + workingSets(e.sets).length, 0), 0);
  return schedule.map((d) => {
    const done = workouts.filter((w) => w.status === "completed" && w.date === d.date);
    return {
      date: d.date,
      sets: count(done.filter((w) => !w.extra)),
      extraSets: count(done.filter((w) => w.extra)),
      planned: planned.has(d.date),
      extrasPlanned: d.extras.length,
      extrasDone: d.extras.filter((x) => done.some((w) => w.extra && w.sessionKey === x.key)).length,
    };
  });
}
