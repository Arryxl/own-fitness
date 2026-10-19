import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { equipmentAvailable, mergeExercises, mergeFoods } from "@/lib/catalog";
import { applyVariant, bestVariant, planFromTemplate, recommendTemplates } from "@/lib/plans";
import { SeedSchema } from "@/lib/seed/schema";
import { SAFETY_FLOOR_KCAL, ageFromBirthDate, bmrMifflin, energyTargets } from "../energy";

const seed = SeedSchema.parse(raw);
const tpl = (id: string) => seed.programTemplates.find((t) => t.id === id)!;
type G = "hipertrofia" | "fuerza" | "definicion" | "acondicionamiento" | "salud";
const rec = (goal: G, days: number[], level: "principiante" | "intermedio" | "avanzado", extra: { place?: "gym" | "home" | "bodyweight"; ageYears?: number } = {}) =>
  recommendTemplates(seed.programTemplates, seed.recommendationRules, { goal, trainingDays: days, level, ...extra });

describe("recommendation rules", () => {
  it("suggests H1 and Fierce 5 for a 3-day hypertrophy beginner", () => expect(rec("hipertrofia", [1, 3, 5], "principiante").ids).toEqual(["H1", "H14"]));
  it("drops H3 for a 4-day beginner but keeps H2", () => {
    const r = rec("hipertrofia", [1, 2, 4, 5], "principiante");
    expect(r.ids).toEqual(["H2"]);
    expect(r.advice.get("H3")?.avoidReason).toBeTruthy();
  });
  it("offers PHUL and H2 to a 4-day intermediate", () => expect(rec("hipertrofia", [1, 2, 4, 5], "intermedio").ids).toEqual(["H10", "H2"]));
  it("offers the beginner PPL to a 6-day beginner and keeps advanced splits out", () => {
    const r = rec("hipertrofia", [1, 2, 3, 4, 5, 6], "principiante");
    expect(r.ids).toEqual(["H7"]);
    expect(r.advice.get("H5")?.avoidReason).toBeTruthy();
  });
  it("warns (not hides) 6-day templates that need Saturday", () => {
    const r = rec("hipertrofia", [1, 2, 3, 4, 5], "intermedio");
    expect(r.advice.get("H5")?.warnings.join(" ")).toMatch(/sábado/);
    expect(r.advice.size).toBe(seed.programTemplates.length);
  });
  it("maps strength and cutting goals", () => {
    expect(rec("fuerza", [1, 3, 5], "principiante").ids).toEqual(["F3", "F1"]);
    expect(rec("fuerza", [1, 3, 5], "intermedio").ids).toEqual(["F8", "F9"]);
    expect(rec("fuerza", [1, 2, 4, 5], "principiante").ids).toEqual(["F2"]);
    expect(rec("definicion", [1, 3, 5], "principiante").ids).toEqual(["D2"]);
    expect(rec("definicion", [1, 2, 4, 5], "intermedio").ids).toEqual(["D1"]);
  });
  it("prioritizes where the user trains and age over the goal", () => {
    expect(rec("hipertrofia", [1, 3, 5], "principiante", { place: "bodyweight" }).ids[0]).toBe("S1");
    expect(rec("hipertrofia", [1, 3, 5], "principiante", { place: "home" }).ids[0]).toBe("S4");
    expect(rec("salud", [1, 3, 5], "principiante", { ageYears: 67 }).ids[0]).toBe("S2");
    // A gym template is never recommended to someone without a gym, only warned about.
    const home = rec("hipertrofia", [1, 3, 5], "principiante", { place: "home" });
    expect(home.ids).not.toContain("H1");
    expect(home.advice.get("H1")?.warnings.join(" ")).toMatch(/gimnasio/);
  });
  it("covers conditioning and general-health goals", () => {
    expect(rec("acondicionamiento", [1, 3, 5], "principiante").ids).toEqual(["A1", "A3"]);
    expect(rec("salud", [1, 4], "principiante").ids[0]).toBe("S3");
    expect(rec("acondicionamiento", [1, 3, 5], "principiante").advice.get("A4")?.avoidReason).toBeTruthy();
  });
  it("falls back to the closest template when no rule matches", () => {
    expect(rec("hipertrofia", [1, 2], "principiante").ids).toEqual(["H1"]);
  });
});

describe("plans from templates", () => {
  it("copies sessions and picks the calendar that fits the user's days", () => {
    expect(bestVariant(tpl("H2"), [1, 3, 4, 5])).toBe("extraThursday");
    const p = planFromTemplate(tpl("H2"), { id: "x", variant: "classic", startDate: "2026-10-19", now: 1 });
    expect(p.sourceTemplateId).toBe("H2");
    expect(p.sessions.map((s) => s.weekday)).toEqual([1, 2, 4, 5]);
    expect(applyVariant(p, tpl("H2"), "extraTuesday").sessions.map((s) => s.weekday)).toEqual([1, 2, 3, 5]);
  });
  it("keeps progression rules and recommended add-ons", () => {
    const p = planFromTemplate(tpl("F2"), { id: "x", variant: "classic", startDate: "2026-10-19", now: 1 });
    expect(p.progressionRules.length).toBeGreaterThan(0);
    expect(p.recommendedAddOns).toEqual(["AO_ARMS", "AO_DELTS"]);
  });
});

describe("catalog merge", () => {
  const ex = mergeExercises(seed.exercises, [{ id: "lat_pulldown", userModified: true, available: false, displayUnit: "kg", updatedAt: 0 }], { units: "mixed", unavailableEquipment: ["barbell", "rack"] });
  const by = new Map(ex.map((e) => [e.id, e]));
  it("applies overrides", () => {
    expect(by.get("lat_pulldown")?.available).toBe(false);
    expect(by.get("lat_pulldown")?.displayUnit).toBe("kg");
    expect(by.get("lat_pulldown")?.overridden).toBe(true);
  });
  it("marks exercises needing unavailable equipment as unavailable", () => {
    expect(by.get("barbell_back_squat")?.available).toBe(false);
    expect(by.get("pushup")?.available).toBe(true);
    expect(equipmentAvailable(["bodyweight"], ["machine"])).toBe(true);
  });
  it("derives metric from the catalog", () => {
    expect(by.get("plank")?.metric).toBe("seconds");
    expect(by.get("incline_walk")?.metric).toBe("minutes");
  });
  it("honors the user's unit preference", () => {
    const kg = mergeExercises(seed.exercises, [], { units: "kg", unavailableEquipment: [] });
    expect(kg.every((e) => e.displayUnit === "kg")).toBe(true);
  });
  it("merges food prices and custom foods", () => {
    const f = mergeFoods([{ id: "egg", name: "Huevo", portionLabel: "1 u", proteinG: 6 }], [{ id: "egg", name: "Huevo", portionLabel: "1 u", priceCop: 18000, priceQty: 30 }, { id: "x", name: "Tofu", portionLabel: "100 g", proteinG: 12 }]);
    expect(f.find((x) => x.id === "egg")?.priceCop).toBe(18000);
    expect(f.find((x) => x.id === "x")?.custom).toBe(true);
  });
});

describe("energy targets", () => {
  it("computes age correctly around birthdays", () => {
    expect(ageFromBirthDate("2000-10-19", "2026-10-18")).toBe(25);
    expect(ageFromBirthDate("2000-10-18", "2026-10-18")).toBe(26);
  });
  it("matches Mifflin-St Jeor", () => {
    expect(bmrMifflin("male", 74, 182, 26)).toBeCloseTo(1752.5, 1);
    expect(bmrMifflin("female", 60, 165, 30)).toBeCloseTo(1320.25, 1);
  });
  it("returns ranges with a small surplus to build and a moderate deficit to cut", () => {
    const base = { sex: "male" as const, ageYears: 26, heightCm: 182, weightKg: 74, trainingDaysPerWeek: 4 };
    const bulk = energyTargets({ ...base, goal: "hipertrofia" })!;
    const cut = energyTargets({ ...base, goal: "definicion" })!;
    expect(bulk.calories.min).toBeGreaterThan(bulk.maintenance.min);
    expect(bulk.calories.max).toBeLessThanOrEqual(Math.round(bulk.maintenance.max * 1.1 / 50) * 50 + 50);
    expect(cut.calories.max).toBeLessThan(cut.maintenance.max);
    expect(cut.maintenance.min - cut.calories.min).toBeLessThanOrEqual(500);
    expect(bulk.proteinG).toEqual({ min: 120, max: 165 });
  });
  it("never shows targets below the safety floor", () => {
    const t = energyTargets({ sex: "female", ageYears: 60, heightCm: 145, weightKg: 42, trainingDaysPerWeek: 2, goal: "definicion" })!;
    expect(t.calories.min).toBeGreaterThanOrEqual(SAFETY_FLOOR_KCAL.female);
    expect(t.clampedToFloor || t.warnings.length > 0).toBe(true);
  });
  it("needs weight, height and age", () => {
    expect(energyTargets({ sex: "male", ageYears: null, heightCm: 180, weightKg: 80, trainingDaysPerWeek: 3, goal: "fuerza" })).toBeNull();
  });
});
