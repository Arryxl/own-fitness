import { SEED_EXERCISES } from "@/lib/data/exercises";
import { SEED_FOODS } from "@/lib/data/foods";
import { SEED_PLANS } from "@/lib/data/plans";
import { SEED_RECORDS } from "@/lib/data/records";
import { todayISO } from "@/lib/analytics/dates";
import type { Profile } from "@/lib/types";
import { batchPut, newId } from "./write";

export const SEED_VERSION = 1;

export interface OnboardingInput {
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  planId: string;
  weeklyBudget: number | null;
  stepsBaseline: number | null;
}

/** Writes the seed catalog, plans, foods and initial marks plus the profile. */
export function seedUser(uid: string, input: OnboardingInput): Promise<void> {
  const now = Date.now();
  const today = todayISO();
  const profile: Profile = {
    heightCm: input.heightCm,
    goal: "Recomposición: ganar músculo (prioridad torso y brazos) y reducir grasa abdominal",
    units: "kg",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weeklyBudget: input.weeklyBudget,
    currency: "COP",
    country: "CO",
    activePlanId: input.planId,
    proteinTargetG: null,
    stepsTarget: input.stepsBaseline ? Math.min(10000, Math.max(8000, input.stepsBaseline + 2500)) : 8000,
    stepsBaseline: input.stepsBaseline,
    startDate: today,
    startWeightKg: input.weightKg,
    restTimerDefaultSec: 90,
    seededVersion: SEED_VERSION,
    createdAt: now,
  };

  const items: Parameters<typeof batchPut>[1] = [
    ...SEED_EXERCISES.map(({ id, ...data }) => ({ col: "exercises" as const, id, data })),
    ...SEED_PLANS.map(({ id, ...data }) => ({ col: "plans" as const, id, data })),
    ...SEED_FOODS.map(({ id, ...data }) => ({ col: "foods" as const, id, data })),
    ...SEED_RECORDS.map((r) => ({ col: "personalRecords" as const, id: r.exerciseId, data: { ...r, updatedAt: now } })),
  ];
  if (input.weightKg || input.waistCm) {
    items.push({
      col: "bodyMetrics",
      id: newId(uid, "bodyMetrics"),
      data: { ts: now, weightKg: input.weightKg, waistCm: input.waistCm, notes: "Medida inicial" },
    });
  }
  // Profile last: its existence marks onboarding as done.
  items.push({ col: null, data: profile as unknown as Record<string, unknown>, merge: true });
  return batchPut(uid, items);
}
