// Turning a read-only program template into the user's editable plan, and the
// recommendation engine that suggests templates from the user's profile.
import type { Level, Plan, PlanSession, Profile } from "@/lib/types";
import type { Emphasis, Place, ProgramTemplate, RecommendationRule } from "@/lib/seed/schema";

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
    place: (t.place ?? "gym") === "gym" ? "gym" : "home",
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

type Who = Pick<Profile, "goal" | "level" | "trainingDays"> & {
  /** Where the user trains; defaults to a full gym. */
  place?: Place | null;
  ageYears?: number | null;
  sex?: Profile["sex"];
  /** Body area to prioritise; defaults to balanced. */
  emphasis?: Emphasis | null;
};

interface Condition {
  goal?: string;
  daysPerWeek?: number;
  level?: string;
  ageMin?: number;
  place?: Place;
  emphasis?: Emphasis;
  sex?: "female" | "male";
}

/**
 * Programs for older adults come first; place and the chosen emphasis describe
 * the person more than the goal does, so those rules win ties.
 */
function specificity(c: Condition): number {
  return (c.ageMin ? 7 : 0) + (c.place ? 3 : 0) + (c.emphasis ? 3 : 0) + (c.sex ? 1 : 0) + (c.goal ? 1 : 0) + (c.daysPerWeek ? 1 : 0) + (c.level ? 1 : 0);
}

/** Can this template be done where the user trains? */
export function placeFits(templatePlace: Place | undefined, userPlace: Place | null | undefined): boolean {
  const u = userPlace ?? "gym";
  const t = templatePlace ?? "gym";
  if (u === "gym") return true;
  if (u === "home") return t !== "gym";
  return t === "bodyweight";
}

const PLACE_TEXT: Record<Place, string> = { gym: "un gimnasio", home: "mancuernas o bandas", bodyweight: "solo tu peso corporal" };

/** Applies recommendationRules to the profile. Never hides templates: it only labels and warns. */
export function recommendTemplates(templates: ProgramTemplate[], rules: RecommendationRule[], who: Who): Recommendation {
  const days = who.trainingDays.length;
  const place = who.place ?? "gym";
  const emphasis = who.emphasis ?? "equilibrado";
  const matches = (c: Condition) =>
    (c.goal === undefined || c.goal === who.goal) &&
    (c.daysPerWeek === undefined || c.daysPerWeek === days) &&
    (c.level === undefined || c.level === who.level) &&
    (c.ageMin === undefined || (who.ageYears != null && who.ageYears >= c.ageMin)) &&
    (c.place === undefined || c.place === place) &&
    (c.emphasis === undefined || c.emphasis === emphasis) &&
    (c.sex === undefined || c.sex === who.sex);

  const notes = new Map<string, string>();
  const avoid = new Map<string, string>();
  let fallback: string | null = null;
  const matched: { score: number; ids: string[] }[] = [];
  for (const r of rules) {
    if ("default" in r) {
      fallback = r.default;
      continue;
    }
    if (!matches(r.if)) continue;
    if ("recommend" in r) {
      matched.push({ score: specificity(r.if), ids: r.recommend });
      if (r.note) for (const id of r.recommend) if (!notes.has(id)) notes.set(id, r.note);
    } else {
      for (const id of r.avoid) avoid.set(id, r.why);
    }
  }
  const byId = new Map(templates.map((t) => [t.id, t]));
  // Most specific rules first (stable for equal scores), then drop avoided or impossible-here templates.
  let recommended = [...new Set(matched.sort((a, b) => b.score - a.score).flatMap((m) => m.ids))].filter(
    (id) => !avoid.has(id) && placeFits(byId.get(id)?.place, place),
  );
  if (recommended.length === 0) {
    // Same goal, doable here, closest number of days, not avoided.
    const sameGoal = templates
      .filter((t) => t.goal === who.goal && !avoid.has(t.id) && placeFits(t.place, place))
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
    if (!placeFits(t.place, place)) warnings.push(`Necesita ${PLACE_TEXT[t.place ?? "gym"]} y marcaste que entrenas con ${PLACE_TEXT[place]}.`);
    if (t.goal !== who.goal && who.goal) warnings.push("Su objetivo principal es otro.");
    advice.set(t.id, { recommended: recommended.includes(t.id), avoidReason: avoid.get(t.id) ?? null, warnings, note: notes.get(t.id) ?? null });
  }
  return { ids: recommended, advice };
}
