import type { WeightUnit } from "@/lib/types";

export const LB_TO_KG = 0.45359237;

export function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

export function kgToLb(kg: number): number {
  return kg / LB_TO_KG;
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? lbToKg(value) : value;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kgToLb(kg) : kg;
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Rounds to the nearest multiple of `step` (e.g. 2.5 kg plates, 5 lb dumbbells). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return round(Math.round(value / step) * step, 3);
}

/** Formats a canonical kg value in the unit the user prefers for that exercise. */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return "—";
  const v = fromKg(kg, unit);
  const shown = unit === "lb" ? round(v, 1) : round(v, 2);
  return `${Number.isInteger(shown) ? shown : shown.toString()} ${unit}`;
}
