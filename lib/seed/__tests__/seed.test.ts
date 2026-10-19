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
    expect(parsed.data.exercises).toHaveLength(93);
    expect(parsed.data.programTemplates.map((t) => t.id).sort()).toEqual(["D1", "D2", "F1", "F2", "H1", "H2", "H3", "H4", "H5", "H6"]);
  });
});
