import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { SeedSchema, seedReferenceErrors } from "../schema";

describe("rutinas_seed.json", () => {
  const parsed = SeedSchema.safeParse(raw);

  it("validates against the Zod schema", () => {
    expect(parsed.success ? [] : parsed.error.issues.slice(0, 5)).toEqual([]);
  });

  it("has valid cross references and weekday maps", () => {
    expect(parsed.success && seedReferenceErrors(parsed.data)).toEqual([]);
  });

  it("has the expected library size", () => {
    if (!parsed.success) return;
    expect(parsed.data.exercises.length).toBeGreaterThanOrEqual(130);
    expect(parsed.data.programTemplates.length).toBeGreaterThanOrEqual(36);
    const ids = parsed.data.programTemplates.map((t) => t.id);
    for (const id of ["H5", "H7", "H8", "H9", "H10", "H11", "H12", "H13", "H14", "F3", "F6", "F8", "F9", "F10", "F11", "A1", "S1", "S2", "S3", "S4"]) expect(ids).toContain(id);
  });

  it("covers every goal, category and training place", () => {
    if (!parsed.success) return;
    const t = parsed.data.programTemplates;
    expect(new Set(t.map((x) => x.goal))).toEqual(new Set(["hipertrofia", "fuerza", "definicion", "acondicionamiento", "salud"]));
    expect(new Set(t.map((x) => x.place))).toEqual(new Set(["gym", "home", "bodyweight"]));
    expect(t.every((x) => x.source.name.length > 0)).toBe(true);
  });

  it("every template has an explicit progression mechanism", () => {
    if (!parsed.success) return;
    for (const t of parsed.data.programTemplates) {
      const v2 = t.source.verification === "adaptacion";
      expect(v2 || (t.progressionRules?.length ?? 0) > 0, t.id).toBe(true);
    }
  });
});
