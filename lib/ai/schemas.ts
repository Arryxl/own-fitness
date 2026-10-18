import { z } from "zod";

// Structured outputs. Each Zod schema doubles as the JSON Schema we send in
// `response_format`, and every model answer is validated with it before saving.

export const WeeklyReportSchema = z.object({
  verdict: z.enum(["on_track", "mixed", "off_track", "insufficient_data"]),
  summary: z.string().describe("2-4 frases en español, con números concretos"),
  signals: z
    .array(
      z.object({
        key: z.enum(["constancia", "sobrecarga", "volumen", "peso", "cintura", "proteina"]),
        status: z.enum(["good", "warn", "bad", "unknown"]),
        detail: z.string().describe("Una frase con el dato que lo respalda"),
      }),
    )
    .max(6),
  actions: z.array(z.string()).max(3).describe("Máximo 3 acciones priorizadas"),
  memory: z.string().optional().describe("Conclusión breve que valga la pena recordar para futuras semanas (opcional)"),
});
export type WeeklyReportOut = z.infer<typeof WeeklyReportSchema>;

export const MealEstimateSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string(),
        grams: z.number().nullable().describe("Gramos estimados o null"),
        proteinG: z.number(),
        kcal: z.number().nullable(),
      }),
    )
    .max(15),
  proteinG: z.number(),
  kcal: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().describe("Supuestos de porciones; aclarar que es una estimación"),
});
export type MealEstimateOut = z.infer<typeof MealEstimateSchema>;

export const MenuSchema = z.object({
  days: z
    .array(
      z.object({
        day: z.string(),
        meals: z.array(
          z.object({
            name: z.string(),
            items: z.array(z.object({ food: z.string(), qty: z.string() })),
            proteinG: z.number(),
            costCop: z.number().nullable(),
          }),
        ),
        proteinG: z.number(),
        costCop: z.number().nullable(),
      }),
    )
    .max(7),
  shoppingList: z.array(z.object({ food: z.string(), qty: z.string(), costCop: z.number().nullable() })),
  totalCostCop: z.number().nullable(),
  withinBudget: z.boolean().nullable(),
  shortfall: z.string().nullable().describe("Si no alcanza el presupuesto o la proteína: cuánto falta y qué hacer primero"),
  tips: z.array(z.string()).max(4),
});
export type MenuOut = z.infer<typeof MenuSchema>;

export const SubstituteSchema = z.object({
  name: z.string(),
  equipment: z.array(z.string()),
  cues: z.string(),
  rationale: z.string(),
});

/** JSON Schema for `response_format`, without keys the API doesn't need. */
export function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

/** Parses model JSON (tolerating ```json fences) and validates it. */
export function parseStructured<T>(schema: z.ZodType<T>, text: string | undefined): T | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    const r = schema.safeParse(JSON.parse(cleaned));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
