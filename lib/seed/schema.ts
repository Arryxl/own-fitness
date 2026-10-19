// Zod schema for data/seed/rutinas_seed.json (schemaVersion 2). The seed is
// validated in tests and before every build (`prebuild`), so a broken seed
// never ships.
import { z } from "zod";

export const MUSCLES = [
  "chest",
  "back",
  "side_delts",
  "rear_delts",
  "front_delts",
  "traps",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "cardio",
  "balance",
] as const;
export const MuscleSchema = z.enum(MUSCLES);

export const EQUIPMENT = ["machine", "dumbbell", "bench", "smith", "cable", "bodyweight", "band", "barbell", "rack", "pullup_bar", "dip_bars"] as const;
export const EquipmentSchema = z.enum(EQUIPMENT);

export const GoalSchema = z.enum(["hipertrofia", "fuerza", "definicion", "acondicionamiento", "salud"]);
export const PlaceSchema = z.enum(["gym", "home", "bodyweight"]);
export const CATEGORIES = ["fuerza_novato", "fuerza_intermedio", "hipertrofia", "definicion", "acondicionamiento", "salud", "calistenia", "mayores", "poco_tiempo", "casa"] as const;
export const CategorySchema = z.enum(CATEGORIES);
export const SourceSchema = z.object({
  name: z.string(),
  url: z.string().url().nullable(),
  /** primaria = author/official page · comunitaria = community transcription · sintesis = IronLog synthesis of guidelines · adaptacion = IronLog adaptation */
  verification: z.enum(["primaria", "comunitaria", "sintesis", "adaptacion"]),
});
export const TemplateLevelSchema = z.enum(["principiante", "principiante-intermedio", "intermedio", "avanzado"]);
export const RepUnitSchema = z.enum(["reps", "seconds", "minutes"]);

export const FallbackLinkSchema = z.object({ exerciseId: z.string(), when: z.string() });

export const CatalogExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(2),
  family: z.string(),
  primaryMuscle: MuscleSchema,
  secondaryMuscles: z.array(MuscleSchema),
  equipment: z.array(EquipmentSchema).min(1),
  spotterFree: z.boolean(),
  isCompound: z.boolean(),
  weightIsPerHand: z.boolean(),
  displayUnit: z.enum(["lb", "kg", "min"]),
  cues: z.string(),
  fallbackChain: z.array(FallbackLinkSchema),
  available: z.boolean(),
  source: z.literal("seed"),
});

export const TemplateItemSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1),
  repMin: z.number().min(0),
  repMax: z.number().min(0),
  restSec: z.number().min(0),
  rirTarget: z.number().min(0),
  supersetGroup: z.string().nullable(),
  notes: z.string().nullable(),
  repUnit: RepUnitSchema,
  /** Load prescription for %-based programs, e.g. "65/75/85 % del TM". */
  intensity: z.string().optional(),
  /** Last set is AMRAP (as many reps as possible with good form). */
  amrap: z.boolean().optional(),
});

export const TemplateSessionSchema = z.object({
  key: z.string(),
  name: z.string(),
  focus: z.string(),
  items: z.array(TemplateItemSchema).min(1),
  optional: z.boolean(),
  notes: z.string().nullable(),
  kind: z.enum(["lifting", "cardio"]),
  floating: z.boolean(),
  estimatedMinutes: z.number(),
  totalSets: z.number(),
  exerciseCount: z.number(),
});

export const ProgramTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: GoalSchema,
  daysPerWeek: z.number().int().min(2).max(7),
  level: TemplateLevelSchema,
  split: z.string(),
  recommendedForNovice: z.boolean(),
  priorities: z.array(z.string()),
  knownAs: z.string(),
  bestFor: z.string(),
  weekdayMap: z.record(z.string(), z.record(z.string(), z.number().int().min(1).max(7))),
  rationale: z.string(),
  communityNote: z.string(),
  caveats: z.string(),
  sessions: z.array(TemplateSessionSchema).min(1),
  requiresWeekend: z.boolean(),
  weeklyVolume: z
    .object({
      directSets: z.record(z.string(), z.number()),
      fractionalSets: z.record(z.string(), z.number()),
      note: z.string(),
    })
    .optional(),
  weeklyFrequencyDirect: z.record(z.string(), z.number()).optional(),
  category: CategorySchema,
  place: PlaceSchema,
  tags: z.array(z.string()),
  source: SourceSchema,
  deloadRules: z.array(z.string()).optional(),
  durationWeeks: z.number().int().positive().optional(),
  sessionMinutesRange: z.tuple([z.number(), z.number()]),
  cardioMinutesPerWeek: z.number(),
  sessionsPerWeek: z.number(),
  recommendedAddOns: z.array(z.string()).optional(),
  rotation: z.literal("alternate").optional(),
  schedule: z.object({ days: z.array(z.number().int().min(1).max(7)), pattern: z.string() }).optional(),
  progressionRules: z.array(z.string()).optional(),
  dailyStepsTarget: z.tuple([z.number(), z.number()]).optional(),
});

export const AddOnSchema = z.object({
  id: z.string(),
  name: z.string(),
  appliesTo: z.string(),
  items: z.array(TemplateItemSchema).min(1),
});

const ConditionSchema = z.object({
  goal: GoalSchema.optional(),
  daysPerWeek: z.number().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado"]).optional(),
  ageMin: z.number().int().optional(),
  place: PlaceSchema.optional(),
});

export const RecommendationRuleSchema = z.union([
  z.object({ if: ConditionSchema, recommend: z.array(z.string()), note: z.string().optional() }),
  z.object({ if: ConditionSchema, avoid: z.array(z.string()), why: z.string() }),
  z.object({ default: z.string() }),
]);

export const SeedSchema = z.object({
  schemaVersion: z.union([z.literal(2), z.literal(3)]),
  dataVersion: z.string(),
  language: z.literal("es"),
  currency: z.string(),
  goals: z.partialRecord(GoalSchema, z.string()),
  muscles: z.partialRecord(MuscleSchema, z.string()),
  exercises: z.array(CatalogExerciseSchema).min(1),
  programTemplates: z.array(ProgramTemplateSchema).min(1),
  addOns: z.array(AddOnSchema),
  recommendationRules: z.array(RecommendationRuleSchema).min(1),
});

export type Muscle = z.infer<typeof MuscleSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type RepUnit = z.infer<typeof RepUnitSchema>;
export type CatalogExercise = z.infer<typeof CatalogExerciseSchema>;
export type TemplateItem = z.infer<typeof TemplateItemSchema>;
export type TemplateSession = z.infer<typeof TemplateSessionSchema>;
export type ProgramTemplate = z.infer<typeof ProgramTemplateSchema>;
export type AddOn = z.infer<typeof AddOnSchema>;
export type RecommendationRule = z.infer<typeof RecommendationRuleSchema>;
export type Seed = z.infer<typeof SeedSchema>;

/** Cross-reference checks Zod can't express: every id referenced must exist. */
export function seedReferenceErrors(seed: Seed): string[] {
  const ids = new Set(seed.exercises.map((e) => e.id));
  const tpl = new Set(seed.programTemplates.map((t) => t.id));
  const addOns = new Set(seed.addOns.map((a) => a.id));
  const errors: string[] = [];
  if (ids.size !== seed.exercises.length) errors.push("ids de ejercicio duplicados");
  for (const e of seed.exercises)
    for (const l of e.fallbackChain) if (!ids.has(l.exerciseId)) errors.push(`${e.id}: alternativa desconocida ${l.exerciseId}`);
  for (const t of seed.programTemplates) {
    for (const s of t.sessions) for (const i of s.items) if (!ids.has(i.exerciseId)) errors.push(`${t.id}/${s.key}: ejercicio desconocido ${i.exerciseId}`);
    for (const a of t.recommendedAddOns ?? []) if (!addOns.has(a)) errors.push(`${t.id}: add-on desconocido ${a}`);
    const fixed = t.sessions.filter((s) => !s.floating && !s.optional).map((s) => s.key);
    if (t.rotation === "alternate") {
      if (!t.schedule?.days.length) errors.push(`${t.id}: rotación sin schedule.days`);
    } else {
      for (const [variant, map] of Object.entries(t.weekdayMap))
        for (const k of fixed) if (!(k in map)) errors.push(`${t.id}/${variant}: la sesión ${k} no tiene día`);
      if (Object.keys(t.weekdayMap).length === 0) errors.push(`${t.id}: weekdayMap vacío`);
    }
  }
  for (const a of seed.addOns) for (const i of a.items) if (!ids.has(i.exerciseId)) errors.push(`${a.id}: ejercicio desconocido ${i.exerciseId}`);
  for (const r of seed.recommendationRules) {
    const refs = "recommend" in r ? r.recommend : "avoid" in r ? r.avoid : [r.default];
    for (const id of refs) if (!tpl.has(id)) errors.push(`regla: plantilla desconocida ${id}`);
  }
  return errors;
}
