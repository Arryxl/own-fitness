import { ageFromBirthDate } from "@/lib/analytics/energy";
import type { Profile } from "@/lib/types";

export const MIN_AGE = 18;

export const DIET_RESTRICTIONS = [
  { id: "vegetariano", label: "Vegetariano", excludesTags: ["carne", "pescado"] },
  { id: "vegano", label: "Vegano", excludesTags: ["carne", "pescado", "lacteo", "huevo"] },
  { id: "sin_lactosa", label: "Sin lactosa", excludesTags: ["lacteo"] },
  { id: "sin_gluten", label: "Sin gluten", excludesTags: ["gluten"] },
] as const;

export const COUNTRIES = [
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "MX", name: "México", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "PE", name: "Perú", currency: "PEN" },
  { code: "EC", name: "Ecuador", currency: "USD" },
  { code: "ES", name: "España", currency: "EUR" },
  { code: "US", name: "Estados Unidos", currency: "USD" },
  { code: "OTHER", name: "Otro", currency: "USD" },
] as const;

export function defaultProfile(displayName: string | null, now: number, today: string): Profile {
  return {
    schemaVersion: 2,
    displayName,
    birthDate: null,
    sex: null,
    heightCm: null,
    startWeightKg: null,
    goal: null,
    trainingDays: [],
    level: null,
    unavailableEquipment: [],
    injuries: "",
    country: "CO",
    currency: "COP",
    weeklyBudget: null,
    dietaryRestrictions: [],
    dietNotes: "",
    units: "mixed",
    healthAcceptedAt: null,
    privacyAcceptedAt: null,
    aiConsent: { accepted: false, at: null },
    onboardingStep: 0,
    onboardingCompletedAt: null,
    activePlanId: null,
    proteinTargetG: null,
    stepsTarget: 8000,
    stepsBaseline: null,
    startDate: today,
    restTimerDefaultSec: 90,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: now,
  };
}

export function isAdult(birthDate: string | null, today: string): boolean {
  const age = ageFromBirthDate(birthDate, today);
  return age != null && age >= MIN_AGE;
}

/** Tags a food must NOT have for the user's restrictions. */
export function excludedFoodTags(restrictions: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of DIET_RESTRICTIONS) if (restrictions.includes(r.id)) r.excludesTags.forEach((t) => out.add(t));
  return out;
}
