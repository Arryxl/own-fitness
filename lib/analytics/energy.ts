// Daily energy and macro targets as RANGES (estimates, never exact numbers).
// BMR: Mifflin-St Jeor. Activity: factor range by training days per week.
// Goal: small surplus to build, maintenance-ish for strength, moderate deficit to cut.
import type { Goal, Sex } from "@/lib/types";
import { round } from "./units";

export interface EnergyInput {
  sex: Sex | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  trainingDaysPerWeek: number;
  goal: Goal | null;
}

export interface Range {
  min: number;
  max: number;
}

export interface EnergyTargets {
  bmr: Range;
  maintenance: Range;
  calories: Range;
  proteinG: Range;
  fatG: Range;
  carbsG: Range;
  /** Warnings to show (unsafe/extreme results, missing data). */
  warnings: string[];
  /** True when the raw calculation went below the safety floor and was raised. */
  clampedToFloor: boolean;
}

/** Lowest daily intake the app will ever show as a target without professional supervision. */
export const SAFETY_FLOOR_KCAL = { male: 1500, female: 1200, other: 1350 } as const;
/** A deficit bigger than this per day is never suggested (≈ 0,5 kg/week). */
export const MAX_DEFICIT_KCAL = 500;

export function ageFromBirthDate(birthDate: string | null, today: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : sex === "female" ? base - 161 : base - 78; // "other": midpoint, shown with a wider range
}

function activityRange(days: number): Range {
  if (days <= 2) return { min: 1.3, max: 1.4 };
  if (days === 3) return { min: 1.375, max: 1.5 };
  if (days <= 5) return { min: 1.45, max: 1.6 };
  return { min: 1.55, max: 1.725 };
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function energyTargets(input: EnergyInput): EnergyTargets | null {
  const { sex, ageYears, heightCm, weightKg, trainingDaysPerWeek, goal } = input;
  if (!weightKg || !heightCm || !ageYears) return null;
  const warnings: string[] = [];
  const s: Sex = sex ?? "other";
  if (!sex || sex === "other") warnings.push("Sin sexo biológico la fórmula usa un punto medio: el rango es más amplio.");

  const bmrMid = bmrMifflin(s, weightKg, heightCm, ageYears);
  const spread = s === "other" ? 0.07 : 0.03; // formula uncertainty
  const bmr = { min: bmrMid * (1 - spread), max: bmrMid * (1 + spread) };
  const act = activityRange(trainingDaysPerWeek);
  const maintenance = { min: bmr.min * act.min, max: bmr.max * act.max };

  let cal: Range;
  switch (goal) {
    case "hipertrofia": // small surplus: +5 % to +10 %
      cal = { min: maintenance.min * 1.05, max: maintenance.max * 1.1 };
      break;
    case "definicion": {
      // moderate deficit: -10 % to -20 %, never more than MAX_DEFICIT_KCAL
      const deficitMax = Math.min(maintenance.max * 0.2, MAX_DEFICIT_KCAL);
      cal = { min: Math.max(maintenance.min * 0.8, maintenance.min - MAX_DEFICIT_KCAL), max: maintenance.max - Math.min(maintenance.max * 0.1, deficitMax) };
      break;
    }
    default: // strength / unknown: maintenance to +5 %
      cal = { min: maintenance.min, max: maintenance.max * 1.05 };
  }

  const floor = SAFETY_FLOOR_KCAL[s];
  let clamped = false;
  if (cal.min < floor) {
    clamped = true;
    warnings.push(`El cálculo daba menos de ${floor} kcal/día. No mostramos metas por debajo de ese umbral: consulta a un profesional de la salud o nutrición.`);
    cal = { min: floor, max: Math.max(cal.max, floor + 150) };
  }
  const bmi = weightKg / (heightCm / 100) ** 2;
  if (bmi < 18.5) warnings.push("Tu IMC está por debajo de 18,5: no se recomienda déficit. Consulta a un profesional.");
  if (bmi < 18.5 && goal === "definicion") cal = { min: Math.max(cal.min, maintenance.min), max: Math.max(cal.max, maintenance.max) };
  if (bmi >= 35) warnings.push("Con IMC alto las fórmulas son menos precisas; un profesional puede ajustar mejor tus metas.");

  // Protein 1.6-2.2 g/kg (section 2). Fat ≥ 0,6 g/kg up to ~1 g/kg. Carbs: the rest.
  const protein = { min: weightKg * 1.6, max: weightKg * 2.2 };
  const fat = { min: weightKg * 0.6, max: weightKg * 1.0 };
  const carbs = {
    min: Math.max(0, (cal.min - protein.max * 4 - fat.max * 9) / 4),
    max: Math.max(0, (cal.max - protein.min * 4 - fat.min * 9) / 4),
  };
  const r = (x: Range, step: number): Range => ({ min: roundTo(x.min, step), max: roundTo(x.max, step) });
  return {
    bmr: r(bmr, 10),
    maintenance: r(maintenance, 50),
    calories: r(cal, 50),
    proteinG: r(protein, 5),
    fatG: r(fat, 5),
    carbsG: r(carbs, 10),
    warnings,
    clampedToFloor: clamped,
  };
}

/** Kcal per day implied by the weekly weight trend; used to flag extreme deficits. */
export function impliedDailyDeficit(kgPerWeek: number | null): number | null {
  return kgPerWeek == null ? null : round((kgPerWeek * 7700) / 7, 0);
}
