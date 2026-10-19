// Shared builders for the catalog scripts (build-v3, build-women).

export const W_BUSY = "Si el equipo está ocupado más de ~3 min o no existe en tu gimnasio";
export const W_NEXT = "Si la opción anterior tampoco está disponible";
export const W_PAIN = "Si notas molestia articular: cambia ángulo o agarre";
export const W_SOLO = "Si entrenas solo y no hay rack con barras de seguridad";
export const chainOf = (ids, firstWhen = W_BUSY) => ids.map((exerciseId, i) => ({ exerciseId, when: i === 0 ? firstWhen : i === 1 ? W_NEXT : W_PAIN }));

export function ex(id, name, family, primaryMuscle, secondaryMuscles, equipment, o = {}) {
  return {
    id,
    name,
    family,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    spotterFree: o.spotterFree ?? true,
    isCompound: o.compound ?? false,
    weightIsPerHand: o.perHand ?? false,
    displayUnit: o.unit ?? "lb",
    cues: o.cues ?? "",
    fallbackChain: chainOf(o.chain ?? [], o.firstWhen),
    available: true,
    source: "seed",
  };
}

export function it(exerciseId, sets, repMin, repMax, o = {}) {
  return {
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec: o.rest ?? (repMax <= 6 ? 180 : 90),
    rirTarget: o.rir ?? (repMax <= 6 ? 2 : 1),
    supersetGroup: o.ss ?? null,
    notes: o.notes ?? null,
    repUnit: o.unit ?? "reps",
    ...(o.intensity ? { intensity: o.intensity } : {}),
    ...(o.amrap ? { amrap: true } : {}),
  };
}
export const amrap = (extra = "") => `Última serie AMRAP (máximas reps con buena técnica, parando a 1-2 RIR)${extra}`;

export function session(key, name, focus, items, o = {}) {
  const lifting = items.filter((i) => i.repUnit !== "minutes");
  const totalSets = lifting.reduce((t, i) => t + i.sets, 0);
  const est =
    o.minutes ??
    Math.round(
      items.reduce((t, i) => t + (i.repUnit === "minutes" ? i.repMax + (i.sets - 1) * (i.restSec / 60) : (i.sets * (45 + i.restSec)) / 60), 0) / 5,
    ) * 5;
  return {
    key,
    name,
    focus,
    items,
    optional: o.optional ?? false,
    notes: o.notes ?? null,
    kind: o.kind ?? (lifting.length ? "lifting" : "cardio"),
    floating: o.floating ?? false,
    estimatedMinutes: est,
    totalSets,
    exerciseCount: items.length,
  };
}

export function tpl(t) {
  const sessionsPerWeek = t.sessionsPerWeek ?? t.daysPerWeek;
  return {
    id: t.id,
    name: t.name,
    goal: t.goal,
    daysPerWeek: t.daysPerWeek,
    level: t.level,
    split: t.split,
    recommendedForNovice: t.recommendedForNovice,
    priorities: t.priorities ?? [],
    knownAs: t.knownAs,
    bestFor: t.bestFor,
    weekdayMap: t.weekdayMap ?? {},
    rationale: t.rationale,
    communityNote: t.communityNote,
    caveats: t.caveats,
    sessions: t.sessions,
    requiresWeekend: t.requiresWeekend ?? Object.values(t.weekdayMap ?? {}).some((m) => Object.values(m).some((d) => d >= 6)),
    sessionMinutesRange: t.sessionMinutesRange,
    cardioMinutesPerWeek: t.cardioMinutesPerWeek ?? 0,
    sessionsPerWeek,
    category: t.category,
    place: t.place ?? "gym",
    ...(t.emphasis ? { emphasis: t.emphasis } : {}),
    tags: t.tags ?? [],
    source: t.source,
    ...(t.progressionRules ? { progressionRules: t.progressionRules } : {}),
    ...(t.deloadRules ? { deloadRules: t.deloadRules } : {}),
    ...(t.rotation ? { rotation: t.rotation, schedule: t.schedule } : {}),
    ...(t.recommendedAddOns ? { recommendedAddOns: t.recommendedAddOns } : {}),
    ...(t.dailyStepsTarget ? { dailyStepsTarget: t.dailyStepsTarget } : {}),
    ...(t.durationWeeks ? { durationWeeks: t.durationWeeks } : {}),
  };
}
