import type { Plan, PlanChangeProposal } from "@/lib/types";
import { addProposedBlock } from "@/lib/week";

/** Applies an approved coach proposal to a plan. Returns null if it no longer applies. */
export function applyProposal(plan: Plan, p: PlanChangeProposal): Plan | null {
  if (p.op === "add_block") return p.block ? { ...addProposedBlock(plan, p.block), updatedAt: Date.now() } : null;
  const session = plan.sessions.find((s) => s.key === p.sessionKey);
  if (!session) return null;
  if (p.op === "move_session") {
    // Rotating plans place their sessions by counting training days, not by weekday.
    if (plan.rotation === "alternate" && !session.extra) return null;
    const weekday = p.weekday ?? null;
    if (weekday !== null && (weekday < 1 || weekday > 7)) return null;
    return { ...plan, updatedAt: Date.now(), sessions: plan.sessions.map((s) => (s.key === session.key ? { ...s, weekday } : s)) };
  }
  if (p.op === "remove_session") {
    if (!session.extra) return null;
    return { ...plan, updatedAt: Date.now(), sessions: plan.sessions.filter((s) => s.key !== session.key) };
  }
  let items = [...session.items];
  const idx = p.exerciseId ? items.findIndex((i) => i.exerciseId === p.exerciseId) : -1;
  switch (p.op) {
    case "replace_exercise":
      if (idx < 0 || !p.newExerciseId) return null;
      items[idx] = { ...items[idx], exerciseId: p.newExerciseId };
      break;
    case "change_sets":
      if (idx < 0 || !p.sets) return null;
      items[idx] = { ...items[idx], sets: p.sets };
      break;
    case "change_reps":
      if (idx < 0 || !p.repMin || !p.repMax || p.repMin > p.repMax) return null;
      items[idx] = { ...items[idx], repMin: p.repMin, repMax: p.repMax };
      break;
    case "add_exercise": {
      const id = p.newExerciseId ?? p.exerciseId;
      if (!id) return null;
      items.push({ exerciseId: id, sets: p.sets ?? 3, repMin: p.repMin ?? 8, repMax: p.repMax ?? 12, restSec: 90, rirTarget: 2, supersetGroup: null, repUnit: p.repUnit ?? "reps", notes: "Añadido por propuesta del coach" });
      break;
    }
    case "remove_exercise":
      if (idx < 0) return null;
      items = items.filter((_, i) => i !== idx);
      break;
  }
  return { ...plan, updatedAt: Date.now(), sessions: plan.sessions.map((s) => (s.key === session.key ? { ...s, items } : s)) };
}
