import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { mergeExercises } from "@/lib/catalog";
import { MUSCLE_LABEL } from "@/lib/format";
import { SeedSchema } from "@/lib/seed/schema";
import { validateTemplate } from "../validate";

const seed = SeedSchema.parse(raw);
const ex = new Map(mergeExercises(seed.exercises, [], { units: "mixed", unavailableEquipment: [] }).map((e) => [e.id, e]));
const notes = (id: string) => validateTemplate(seed.programTemplates.find((t) => t.id === id)!, ex, MUSCLE_LABEL).map((n) => n.code);

describe("template validator (evidence rules)", () => {
  it("flags missing rear delts and low arm volume in PHUL, as the research found", () => {
    const n = notes("H10");
    expect(n).toContain("no_rear_delts");
    expect(n).toContain("below_floor");
  });
  it("flags once-a-week frequency in the bro split", () => {
    expect(notes("H13")).toContain("freq_1");
  });
  it("accepts strength programs with heavy sets", () => {
    for (const id of ["F1", "F3", "F8", "F9", "F10"]) expect(notes(id)).not.toContain("no_heavy");
  });
  it("skips pure conditioning templates", () => {
    expect(notes("A1")).toEqual([]);
  });
  it("warns about nSuns' very high bench volume and keeps the rest under the ceiling", () => {
    expect(notes("F10")).toContain("above_ceiling");
    for (const t of seed.programTemplates.filter((x) => x.id !== "F10")) expect(notes(t.id), t.id).not.toContain("above_ceiling");
  });
});
