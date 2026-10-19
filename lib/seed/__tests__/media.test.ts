import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import media from "@/data/exercise-media.json";
import raw from "@/data/seed/rutinas_seed.json";
import { exerciseMedia } from "@/lib/exerciseMedia";

const ids = new Set(raw.exercises.map((e) => e.id));
const entries = Object.entries(media.exercises);

describe("exercise demo photos", () => {
  it("only point to catalog exercises", () => {
    expect(entries.filter(([id]) => !ids.has(id)).map(([id]) => id)).toEqual([]);
  });

  it("have every frame file in public/ (1 for holds, 2 for movements)", () => {
    for (const [id, m] of entries) {
      expect(m.frames.length, id).toBeGreaterThanOrEqual(1);
      expect(m.frames.length, id).toBeLessThanOrEqual(2);
      for (const f of m.frames) expect(fs.existsSync(path.join(process.cwd(), "public", f)), `${id}: ${f}`).toBe(true);
    }
  });

  it("cover almost the whole catalog", () => {
    expect(entries.length / ids.size).toBeGreaterThan(0.9);
    expect(exerciseMedia("plank")?.frames).toHaveLength(1);
    expect(exerciseMedia("custom_x")).toBeNull();
  });
});
