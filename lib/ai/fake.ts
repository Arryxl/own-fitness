import "server-only";
// Deterministic stand-in for Gemini used by end-to-end tests (AI_FAKE=1).
// Never active in production builds.
import { MealEstimateSchema, MenuSchema, SubstituteSchema, WeeklyReportSchema } from "./schemas";

export const AI_FAKE = process.env.AI_FAKE === "1" && process.env.NODE_ENV !== "production";

export function fakeStructured(schema: unknown): unknown {
  if (schema === WeeklyReportSchema)
    return {
      verdict: "insufficient_data",
      summary: "Informe de prueba: aún hay pocos datos para evaluar la tendencia.",
      signals: [{ key: "constancia", status: "unknown", detail: "Menos de 2 semanas registradas." }],
      actions: ["Registra todas tus sesiones esta semana.", "Pésate 3 veces por semana.", "Anota tu proteína diaria."],
    };
  if (schema === MealEstimateSchema) return { items: [{ name: "Huevo", grams: 100, proteinG: 12, kcal: 140 }], proteinG: 12, kcal: 140, confidence: "medium", notes: "Estimación de prueba." };
  if (schema === MenuSchema)
    return { days: [{ day: "Día 1", meals: [{ name: "Almuerzo", items: [{ food: "Lentejas", qty: "1 taza" }], proteinG: 18, costCop: null }], proteinG: 18, costCop: null }], shoppingList: [{ food: "Lentejas", qty: "500 g", costCop: null }], totalCostCop: null, withinBudget: null, shortfall: null, tips: ["Menú de prueba."] };
  if (schema === SubstituteSchema) return { name: "Ejercicio de prueba", equipment: ["machine"], cues: "Controla la bajada.", rationale: "Mismo patrón de movimiento." };
  throw new Error("fake: unknown schema");
}

export const FAKE_CHAT_REPLY = "Respuesta de prueba del coach: revisé tus datos y vas por buen camino. Esto no es consejo médico.";
