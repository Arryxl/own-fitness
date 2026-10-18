import type { Food, Meal } from "@/lib/types";
import { round } from "./units";

/** Protein range of 1.6-2.2 g per kg of body weight per day (section 2). */
export function proteinRange(weightKg: number | null | undefined): { min: number; max: number } | null {
  if (!weightKg || weightKg <= 0) return null;
  return { min: Math.round(weightKg * 1.6), max: Math.round(weightKg * 2.2) };
}

/** Daily target: user override, else the bottom of the range (the realistic minimum). */
export function proteinTarget(override: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (override && override > 0) return override;
  return proteinRange(weightKg)?.min ?? null;
}

export function proteinByDay(meals: Meal[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const meal of meals) m.set(meal.date, round((m.get(meal.date) ?? 0) + (meal.proteinG || 0), 1));
  return m;
}

export interface NutritionSummary {
  daysLogged: number;
  avgProteinG: number | null;
  daysHitTarget: number;
  hitRatePct: number | null;
  target: number | null;
}

export function nutritionSummary(meals: Meal[], target: number | null): NutritionSummary {
  const byDay = proteinByDay(meals);
  const values = [...byDay.values()];
  const hits = target ? values.filter((v) => v >= target).length : 0;
  return {
    daysLogged: values.length,
    avgProteinG: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 0) : null,
    daysHitTarget: hits,
    hitRatePct: target && values.length ? round((hits / values.length) * 100, 0) : null,
    target,
  };
}

/** COP for each 25 g of protein, from the price the user entered. Null when data is missing. */
export function copPer25gProtein(food: Pick<Food, "priceCop" | "priceQty" | "proteinG">): number | null {
  const { priceCop, priceQty, proteinG } = food;
  if (!priceCop || !proteinG || proteinG <= 0) return null;
  const qty = priceQty && priceQty > 0 ? priceQty : 1;
  return Math.round((priceCop / (qty * proteinG)) * 25);
}

/** Cheapest protein first; foods without price/protein go last (alphabetically). */
export function sortByProteinCost<T extends Pick<Food, "priceCop" | "priceQty" | "proteinG" | "name">>(foods: T[]): T[] {
  return [...foods].sort((a, b) => {
    const ca = copPer25gProtein(a);
    const cb = copPer25gProtein(b);
    if (ca == null && cb == null) return a.name.localeCompare(b.name, "es");
    if (ca == null) return 1;
    if (cb == null) return -1;
    return ca - cb;
  });
}
