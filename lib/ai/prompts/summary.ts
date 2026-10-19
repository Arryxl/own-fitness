import "server-only";
import { ageFromBirthDate } from "@/lib/analytics/energy";
import type { UserData } from "@/lib/server/userData";
import { buildCoachSystemPrompt } from "./coach.v3";

/** System prompt built from the verified user's profile (no name, email or birth date). */
export async function coachPromptFor(data: UserData): Promise<string> {
  const [p, plan] = await Promise.all([data.profile(), data.activePlan()]);
  return buildCoachSystemPrompt({
    ageYears: ageFromBirthDate(p?.birthDate ?? null, data.today),
    sex: p?.sex ?? null,
    heightCm: p?.heightCm ?? null,
    startWeightKg: p?.startWeightKg ?? null,
    goal: p?.goal ?? null,
    level: p?.level ?? null,
    trainingDays: p?.trainingDays.length ?? 0,
    injuries: p?.injuries ?? "",
    dietaryRestrictions: p?.dietaryRestrictions ?? [],
    planName: plan?.name ?? null,
    planTemplateId: plan?.sourceTemplateId ?? null,
    country: p?.country ?? "CO",
    currency: p?.currency ?? "COP",
    weeklyBudget: p?.weeklyBudget ?? null,
    today: data.today,
  });
}
