// Turning a read-only program template into the user's editable plan, and the
// recommendation engine that suggests templates from the user's profile.
import type { Level, Plan, PlanSession, Profile } from "@/lib/types";
import type { ProgramTemplate, RecommendationRule } from "@/lib/seed/schema";

export const VARIANT_LABEL: Record<string, string> = {
  default: "Calendario estándar",
  classic: "Clásico (lun-mar-jue-vie)",
  extraTuesday: "Con martes (lun-mar-mié-vie)",
  extraThursday: "Con jueves (lun-mié-jue-vie)",
};

export function templateVariants(t: ProgramTemplate): string[] {
  return Object.keys(t.weekdayMap);
}

/** Picks the calendar variant that best matches the days the user said they can train. */
export function bestVariant(t: ProgramTemplate, trainingDays: number[]): string | null {
  const variants = templateVariants(t);
  if (variants.length === 0) return null;
  const score = (v: string) => Object.values(t.weekdayMap[v]).filter((d) => trainingDays.includes(d)).length;
  return [...variants].sort((a, b) => score(b) - score(a))[0];
}

export function planFromTemplate(t: ProgramTemplate, opts: { id: string; variant: string | null; startDate: string; now: number }): Plan {
  const map = opts.variant ? (t.weekdayMap[opts.variant] ?? {}) : {};
  const sessions: PlanSession[] = t.sessions.map((s) => ({
    key: s.key,
    name: s.name,
    focus: s.focus,
    kind: s.kind,
    weekday: t.rotation === "alternate" ? null : (map[s.key] ?? null),
    optional: s.optional,
    floating: s.floating,
    notes: s.notes,
    estimatedMinutes: s.estimatedMinutes,
    items: s.items.map((i) => ({ ...i })),
  }));
  return {
    id: opts.id,
    name: t.name,
    sourceTemplateId: t.id,
    goal: t.goal,
    daysPerWeek: t.daysPerWeek,
    level: t.level,
    weekdayVariant: t.rotation === "alternate" ? null : opts.variant,
    rotation: t.rotation ?? null,
    scheduleDays: t.schedule?.days ?? [],
    startDate: opts.startDate,
    sessions,
    enabledAddOns: [],
    recommendedAddOns: t.recommendedAddOns ?? [],
    progressionRules: t.progressionRules ?? [],
    dailyStepsTarget: t.dailyStepsTarget ?? null,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** Re-applies a calendar variant to an existing plan (keeps the user's edits to exercises). */
export function applyVariant(plan: Plan, t: ProgramTemplate, variant: string): Plan {
  const map = t.weekdayMap[variant] ?? {};
  return { ...plan, weekdayVariant: variant, sessions: plan.sessions.map((s) => ({ ...s, weekday: map[s.key] ?? s.weekday })) };
}

function levelFits(templateLevel: string, level: Level | null): boolean {
  if (!level) return true;
  return templateLevel.split("-").includes(level);
}

export interface TemplateAdvice {
  recommended: boolean;
  avoidReason: string | null;
  warnings: string[];
  note: string | null;
}

export interface Recommendation {
  ids: string[];
  advice: Map<string, TemplateAdvice>;
}

type Who = Pick<Profile, "goal" | "level" | "trainingDays">;

/** Applies recommendationRules to the profile. Never hides templates: it only labels and warns. */
export function recommendTemplates(templates: ProgramTemplate[], rules: RecommendationRule[], who: Who): Recommendation {
  const days = who.trainingDays.length;
  const matches = (cond: { goal?: string; daysPerWeek?: number; level?: string }) =>
    (cond.goal === undefined || cond.goal === who.goal) && (cond.daysPerWeek === undefined || cond.daysPerWeek === days) && (cond.level === undefined || cond.level === who.level);

  let recommended: string[] = [];
  const notes = new Map<string, string>();
  const avoid = new Map<string, string>();
  let fallback: string | null = null;
  for (const r of rules) {
    if ("default" in r) {
      fallback = r.default;
      continue;
    }
    if (!matches(r.if)) continue;
    if ("recommend" in r) {
      recommended.push(...r.recommend);
      if (r.note) for (const id of r.recommend) notes.set(id, r.note);
    } else {
      for (const id of r.avoid) avoid.set(id, r.why);
    }
  }
  // Avoided templates drop out of the suggestion (they stay visible with a warning).
  recommended = [...new Set(recommended)].filter((id) => !avoid.has(id));
  if (recommended.length === 0) {
    // Same goal, closest number of days, not avoided.
    const sameGoal = templates
      .filter((t) => t.goal === who.goal && !avoid.has(t.id))
      .sort((a, b) => Math.abs(a.daysPerWeek - days) - Math.abs(b.daysPerWeek - days));
    recommended = sameGoal.slice(0, 1).map((t) => t.id);
    if (recommended.length === 0 && fallback) recommended = [fallback];
  }
  recommended = recommended.slice(0, 2);

  const advice = new Map<string, TemplateAdvice>();
  for (const t of templates) {
    const warnings: string[] = [];
    if (who.level === "principiante" && !t.recommendedForNovice) warnings.push("No está pensada para principiantes: más volumen o técnica de la que necesitas para progresar.");
    else if (!levelFits(t.level, who.level)) warnings.push(`Nivel de la plantilla: ${t.level}.`);
    if (t.requiresWeekend && !who.trainingDays.some((d) => d >= 6)) warnings.push("Requiere entrenar el sábado.");
    if (days && t.daysPerWeek !== days) warnings.push(`Son ${t.daysPerWeek} días por semana y marcaste ${days}.`);
    if (t.goal !== who.goal && who.goal) warnings.push("Su objetivo principal es otro.");
    advice.set(t.id, { recommended: recommended.includes(t.id), avoidReason: avoid.get(t.id) ?? null, warnings, note: notes.get(t.id) ?? null });
  }
  return { ids: recommended, advice };
}
