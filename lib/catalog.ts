// Pure helpers that turn the global catalog + a user's overrides/profile into
// the effective data the app uses. Shared by client and server.
import type { Equipment, CatalogExercise, Exercise, ExerciseOverride, Food, RepUnit, UnitsPref, WeightUnit } from "@/lib/types";

/** Equipment the user can't use makes an exercise unavailable (bodyweight never does). */
export function equipmentAvailable(equipment: Equipment[], unavailable: Equipment[]): boolean {
  return equipment.every((e) => e === "bodyweight" || !unavailable.includes(e));
}

function metricFor(e: Pick<CatalogExercise, "displayUnit" | "family" | "primaryMuscle">): RepUnit {
  if (e.displayUnit === "min" || e.primaryMuscle === "cardio") return "minutes";
  if (e.family === "core_estatico") return "seconds";
  return "reps";
}

function unitFor(seedUnit: CatalogExercise["displayUnit"], pref: UnitsPref): WeightUnit {
  if (pref === "kg" || pref === "lb") return pref;
  return seedUnit === "kg" ? "kg" : "lb";
}

export function mergeExercises(
  catalog: CatalogExercise[],
  overrides: ExerciseOverride[],
  profile: { units: UnitsPref; unavailableEquipment: Equipment[] },
): Exercise[] {
  const byId = new Map(overrides.map((o) => [o.id, o]));
  const out: Exercise[] = catalog.map((c) => {
    const o = byId.get(c.id);
    return {
      id: c.id,
      name: o?.name ?? c.name,
      family: c.family,
      primaryMuscle: c.primaryMuscle,
      secondaryMuscles: c.secondaryMuscles,
      equipment: c.equipment,
      spotterFree: c.spotterFree,
      isCompound: c.isCompound,
      weightIsPerHand: c.weightIsPerHand,
      displayUnit: o?.displayUnit ?? unitFor(c.displayUnit, profile.units),
      metric: metricFor(c),
      cues: o?.cues ?? c.cues,
      fallbackChain: o?.fallbackChain ?? c.fallbackChain,
      available: o?.available ?? (c.available && equipmentAvailable(c.equipment, profile.unavailableEquipment)),
      increment: o?.increment ?? null,
      custom: false,
      overridden: !!o,
    };
  });
  for (const o of overrides) {
    if (!o.custom || catalog.some((c) => c.id === o.id)) continue;
    const c = o.custom;
    out.push({
      id: o.id,
      name: o.name ?? c.name,
      family: c.family,
      primaryMuscle: c.primaryMuscle,
      secondaryMuscles: c.secondaryMuscles,
      equipment: c.equipment,
      spotterFree: c.spotterFree,
      isCompound: c.isCompound,
      weightIsPerHand: c.weightIsPerHand,
      displayUnit: o.displayUnit ?? unitFor(c.displayUnit, profile.units),
      metric: metricFor(c),
      cues: o.cues ?? c.cues,
      fallbackChain: o.fallbackChain ?? c.fallbackChain,
      available: o.available ?? true,
      increment: o.increment ?? null,
      custom: true,
      overridden: true,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Catalog foods merged with the user's prices/edits, plus custom foods; hidden ones removed. */
export function mergeFoods(catalog: Food[], userFoods: Food[]): Food[] {
  const byId = new Map(userFoods.map((f) => [f.id, f]));
  const merged = catalog.map((c) => ({ ...c, ...(byId.get(c.id) ?? {}) }));
  for (const f of userFoods) if (!catalog.some((c) => c.id === f.id)) merged.push({ ...f, custom: true });
  return merged.filter((f) => !f.hidden);
}
