import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { mergeExercises } from "@/lib/catalog";
import { MUSCLE_LABEL } from "@/lib/format";
import { recommendTemplates } from "@/lib/plans";
import { SeedSchema, type Emphasis } from "@/lib/seed/schema";
import { asPlanLike, validateTemplate } from "../validate";
import { planVolume } from "../volume";

const seed = SeedSchema.parse(raw);
const ex = new Map(mergeExercises(seed.exercises, [], { units: "mixed", unavailableEquipment: [] }).map((e) => [e.id, e]));
const women = seed.programTemplates.filter((t) => t.category === "mujeres");
const volume = (id: string) => planVolume(asPlanLike(women.find((t) => t.id === id)!), ex);

type G = "hipertrofia" | "fuerza" | "definicion";
const rec = (o: { goal?: G; days: number[]; level?: "principiante" | "intermedio"; sex?: "female" | "male"; emphasis?: Emphasis; place?: "gym" | "home" }) =>
  recommendTemplates(seed.programTemplates, seed.recommendationRules, {
    goal: o.goal ?? "hipertrofia",
    trainingDays: o.days,
    level: o.level ?? "principiante",
    sex: o.sex ?? "female",
    emphasis: o.emphasis,
    place: o.place,
  }).ids;
const D3 = [1, 3, 5];
const D4 = [1, 2, 4, 5];
const D5 = [1, 2, 3, 4, 5];

describe("routines for women", () => {
  it("has one template per emphasis, all with an emphasis and a source", () => {
    expect(women.map((t) => t.id)).toEqual(["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]);
    for (const t of women) {
      expect(t.emphasis, t.id).toBeTruthy();
      expect(t.source.url, t.id).toBeTruthy();
    }
    expect(new Set(women.map((t) => t.emphasis))).toEqual(new Set(["gluteo_pierna", "pierna", "equilibrado", "torso"]));
  });

  it("stays inside the evidence limits (no weekly ceiling or crowded sessions)", () => {
    for (const t of women) {
      const codes = validateTemplate(t, ex, MUSCLE_LABEL).map((n) => n.code);
      expect(codes, t.id).not.toContain("above_ceiling");
      expect(codes, t.id).not.toContain("session_crowded");
      expect(codes, t.id).not.toContain("no_rear_delts");
    }
  });

  it("gives glutes the priority in the glute templates and keeps every leg muscle trained", () => {
    for (const id of ["M1", "M2", "M3", "M7"]) {
      const v = volume(id);
      expect(v.glutes ?? 0, id).toBeGreaterThanOrEqual(14);
      expect(v.glutes ?? 0, id).toBeGreaterThan(v.chest ?? 0);
      expect(v.hamstrings ?? 0, id).toBeGreaterThanOrEqual(6);
    }
    const legs = volume("M4");
    for (const m of ["quads", "hamstrings", "glutes"] as const) expect(legs[m] ?? 0, m).toBeGreaterThanOrEqual(10);
    expect(legs.calves ?? 0).toBeGreaterThanOrEqual(6);
  });

  it("keeps the whole-body templates balanced and the upper-body one upper-first", () => {
    for (const id of ["M5", "M6"]) {
      const v = volume(id);
      for (const m of ["chest", "back", "quads", "glutes"] as const) expect(v[m] ?? 0, `${id} ${m}`).toBeGreaterThanOrEqual(8);
    }
    const up = volume("M8");
    expect(up.back ?? 0).toBeGreaterThan(up.quads ?? 0);
    expect(up.side_delts ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("recommends by emphasis and days", () => {
    expect(rec({ days: D3, emphasis: "gluteo_pierna" })).toEqual(["M1", "M5"]);
    expect(rec({ days: D4, emphasis: "gluteo_pierna" })).toEqual(["M2", "M4"]);
    expect(rec({ days: D5, emphasis: "gluteo_pierna", level: "intermedio" })).toEqual(["M3", "M2"]);
    expect(rec({ days: D4, emphasis: "pierna" })).toEqual(["M4", "M2"]);
    expect(rec({ days: D4, emphasis: "torso" })[0]).toBe("M8");
  });

  it("keeps the 5-day glute template away from beginners", () => {
    expect(rec({ days: D5, emphasis: "gluteo_pierna" })).not.toContain("M3");
  });

  it("suggests the home glute routine to someone training at home", () => {
    expect(rec({ days: D3, emphasis: "gluteo_pierna", place: "home" })[0]).toBe("M7");
  });

  it("recommends the whole-body women's templates by default and leaves men and strength goals as before", () => {
    expect(rec({ days: D3 })).toEqual(["M5", "H1"]);
    expect(rec({ days: D4 })[0]).toBe("M6");
    expect(rec({ days: D3, sex: "male" })).toEqual(["H1", "H14"]);
    expect(rec({ days: D3, goal: "fuerza" })).toEqual(["F3", "F1"]);
  });
});
