// Evidence-based review of a routine template (deep research, 2026-10-18:
// ACSM 2026, Pelland/Remmert 2025, Iversen 2021). The thresholds are
// heuristics derived from those studies; the app shows them as notes, never
// as hard blocks.
import type { Muscle, Plan, ProgramTemplate } from "@/lib/types";
import { SECONDARY_WEIGHT, planVolume, type MuscleCount } from "./volume";

type MuscleSource = { primaryMuscle: Muscle; secondaryMuscles: Muscle[] };

export const LIMITS = {
  minEffective: 4, // Iversen 2021: minimum effective dose
  hypertrophyFloor: 10, // ACSM 2026
  weeklyCeiling: 30, // Pelland/Remmert: no detectable extra benefit beyond ~31 fractional sets
  sessionCeiling: 11, // Remmert 2025 (preprint): per-session plateau
} as const;

/** Muscles the validator checks for a balanced hypertrophy program. */
const MAJOR: Muscle[] = ["chest", "back", "side_delts", "quads", "hamstrings", "glutes", "biceps", "triceps"];

export type ValidationLevel = "info" | "warn";
export interface ValidationNote {
  level: ValidationLevel;
  code: string;
  text: string;
}

type PlanLike = Pick<Plan, "sessions" | "rotation" | "scheduleDays">;

export function asPlanLike(t: ProgramTemplate): PlanLike {
  return {
    rotation: t.rotation ?? null,
    scheduleDays: t.schedule?.days ?? [],
    sessions: t.sessions.map((s) => ({ ...s, weekday: null })),
  };
}

/** Fractional sets per muscle in each lifting session. */
export function perSessionVolume(plan: PlanLike, exercises: Map<string, MuscleSource>): MuscleCount[] {
  return plan.sessions
    .filter((s) => s.kind === "lifting" && !s.optional && !s.floating)
    .map((s) => {
      const acc: MuscleCount = {};
      for (const it of s.items) {
        if (it.repUnit === "minutes") continue;
        const ex = exercises.get(it.exerciseId);
        if (!ex) continue;
        acc[ex.primaryMuscle] = (acc[ex.primaryMuscle] ?? 0) + it.sets;
        for (const m of ex.secondaryMuscles) if (m !== ex.primaryMuscle) acc[m] = (acc[m] ?? 0) + it.sets * SECONDARY_WEIGHT;
      }
      return acc;
    });
}

/** How many sessions per week train a muscle with at least 2 fractional sets. */
function weeklyFrequency(sessions: MuscleCount[], m: Muscle, rotationFactor: number): number {
  return sessions.filter((s) => (s[m] ?? 0) >= 2).length * rotationFactor;
}

export function validateTemplate(t: ProgramTemplate, exercises: Map<string, MuscleSource>, labels: Record<string, string>): ValidationNote[] {
  const notes: ValidationNote[] = [];
  const plan = asPlanLike(t);
  const lifting = plan.sessions.filter((s) => s.kind === "lifting" && !s.optional && !s.floating);
  if (lifting.length === 0) return notes; // pure conditioning: nothing to check here
  const weekly = planVolume(plan, exercises);
  const sessions = perSessionVolume(plan, exercises);
  const rot = plan.rotation === "alternate" && lifting.length ? plan.scheduleDays.length / lifting.length : 1;
  const name = (m: Muscle) => labels[m] ?? m;
  const growthGoal = t.goal === "hipertrofia" || t.goal === "definicion";

  if (growthGoal) {
    const low = MAJOR.filter((m) => (weekly[m] ?? 0) < LIMITS.hypertrophyFloor);
    if (low.length) notes.push({ level: "info", code: "below_floor", text: `Menos de ${LIMITS.hypertrophyFloor} series semanales en: ${low.map(name).join(", ")} (el ACSM 2026 sugiere ~10 para hipertrofia).` });
    // Direct sets only: rows hit the rear delts a little, but not enough on their own.
    const directRear = lifting.reduce((t, ses) => t + ses.items.filter((i) => exercises.get(i.exerciseId)?.primaryMuscle === "rear_delts").reduce((a, i) => a + i.sets, 0), 0) * rot;
    if (directRear < 2) notes.push({ level: "info", code: "no_rear_delts", text: "Casi no trabaja el deltoide posterior: añade face pulls o pájaros (2-3×15-20)." });
    if ((weekly.abs ?? 0) < 2) notes.push({ level: "info", code: "no_abs", text: "Sin trabajo de abdomen: añade 2-3 series si quieres." });
    const once = MAJOR.filter((m) => (weekly[m] ?? 0) >= LIMITS.hypertrophyFloor && weeklyFrequency(sessions, m, rot) < 2);
    if (once.length) notes.push({ level: "info", code: "freq_1", text: `${once.map(name).join(", ")}: 1 sesión por semana. Con volumen igualado rinde parecido, pero saltarte un día deja el músculo sin estímulo.` });
  } else {
    const tiny = (["chest", "back", "quads"] as Muscle[]).filter((m) => (weekly[m] ?? 0) < LIMITS.minEffective);
    if (tiny.length) notes.push({ level: "warn", code: "below_minimum", text: `Menos de ${LIMITS.minEffective} series semanales en ${tiny.map(name).join(", ")}: por debajo de la dosis mínima eficaz.` });
  }

  const high = (Object.keys(weekly) as Muscle[]).filter((m) => (weekly[m] ?? 0) > LIMITS.weeklyCeiling);
  if (high.length) notes.push({ level: "warn", code: "above_ceiling", text: `Más de ${LIMITS.weeklyCeiling} series semanales en ${high.map(name).join(", ")}: fuera de lo que la evidencia ha mostrado útil.` });

  const crowded = new Set<Muscle>();
  for (const s of sessions) for (const [m, v] of Object.entries(s) as [Muscle, number][]) if (v > LIMITS.sessionCeiling) crowded.add(m);
  if (crowded.size) notes.push({ level: "info", code: "session_crowded", text: `Más de ~${LIMITS.sessionCeiling} series de ${[...crowded].map(name).join(", ")} en una sesión: la evidencia (preliminar) sugiere repartirlas.` });

  if (t.goal === "fuerza") {
    const heavy = lifting.some((s) => s.items.some((i) => i.repUnit === "reps" && i.repMin <= 6));
    if (!heavy) notes.push({ level: "warn", code: "no_heavy", text: "Programa de fuerza sin series de 6 reps o menos: la fuerza responde mejor a cargas altas." });
  }
  return notes;
}

export { type MuscleCount };
