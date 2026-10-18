import { describe, expect, it } from "vitest";
import { suggestNext, defaultIncrement } from "../progression";
import { bestSet, e1rm, exerciseHistory, exerciseTrend, performanceDroppedTwice } from "../strength";
import { kgToLb, lbToKg } from "../units";
import { entry, set, workout } from "./fixtures";

const item = { sets: 3, repMin: 8, repMax: 12, rirTarget: 2 };
const machineLb = { equipment: ["machine" as const], displayUnit: "lb" as const, weightIsPerHand: false, metric: "reps" as const };
const dbKg = { equipment: ["dumbbell" as const], displayUnit: "kg" as const, weightIsPerHand: true, metric: "reps" as const };

describe("e1rm / best set", () => {
  it("uses Epley and ignores unloaded sets", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(60, 10)).toBeCloseTo(80, 6);
    expect(e1rm(0, 10)).toBeNull();
    expect(e1rm(50, 0)).toBeNull();
  });

  it("skips warm-ups and undone sets", () => {
    const best = bestSet([set(12, 80, { isWarmup: true }), set(10, 60), set(8, 65), set(20, 90, { done: false })]);
    expect(best?.weightKg).toBe(65);
  });
});

describe("exercise history", () => {
  const ws = [
    workout("2026-10-05", [entry("db_incline_press", [set(10, 14), set(9, 14)])]),
    workout("2026-10-12", [entry("db_incline_press", [set(12, 14), set(11, 14)])]),
    // A substitution logs a different concrete exercise; it must not mix in.
    workout("2026-10-14", [entry("smith_incline_press", [set(10, 40)], { plannedExerciseId: "db_incline_press" })]),
  ];

  it("never mixes concrete exercises", () => {
    expect(exerciseHistory(ws, "db_incline_press")).toHaveLength(2);
    const smith = exerciseHistory(ws, "smith_incline_press");
    expect(smith).toHaveLength(1);
    expect(smith[0].substituted).toBe(true);
  });

  it("computes a trend", () => {
    const t = exerciseTrend(exerciseHistory(ws, "db_incline_press"));
    expect(t.sessions).toBe(2);
    expect(t.direction).toBe("up");
    expect(t.e1rmChangePct).toBeGreaterThan(0);
  });

  it("detects two consecutive drops", () => {
    const h = exerciseHistory(
      [
        workout("2026-09-01", [entry("x", [set(10, 50)])]),
        workout("2026-09-03", [entry("x", [set(9, 50)])]),
        workout("2026-09-05", [entry("x", [set(8, 50)])]),
      ],
      "x",
    );
    expect(performanceDroppedTwice(h)).toBe(true);
  });
});

describe("double progression (8.1)", () => {
  const hist = (sets: ReturnType<typeof set>[]) =>
    exerciseHistory([workout("2026-10-12", [entry("e", sets)])], "e").at(-1) ?? null;

  it("asks for calibration with no history and no record", () => {
    expect(suggestNext({ item, exercise: machineLb, last: null }).kind).toBe("calibrate");
  });

  it("uses the initial mark when present", () => {
    const s = suggestNext({
      item,
      exercise: machineLb,
      last: null,
      record: { exerciseId: "e", currentWeightKg: lbToKg(30), enteredUnit: "lb", updatedAt: 0, note: "" },
    });
    expect(s.kind).toBe("from_record");
    expect(s.message).toContain("30 lb");
  });

  it("increases load when every set hit the top with RIR ≥ 1", () => {
    const w = lbToKg(50);
    const s = suggestNext({ item, exercise: machineLb, last: hist([set(12, w, { rir: 1 }), set(12, w, { rir: 2 }), set(12, w)]) });
    expect(s.kind).toBe("increase");
    expect(kgToLb(s.weightKg!)).toBeCloseTo(55, 6);
    expect(s.targetReps).toBe(8);
  });

  it("does not increase when a set was taken to failure (RIR 0)", () => {
    const s = suggestNext({ item, exercise: machineLb, last: hist([set(12, 20, { rir: 0 }), set(12, 20), set(12, 20)]) });
    expect(s.kind).toBe("add_reps");
  });

  it("holds load and adds a rep otherwise", () => {
    const s = suggestNext({ item, exercise: dbKg, last: hist([set(10, 12), set(9, 12), set(8, 12)]) });
    expect(s.kind).toBe("add_reps");
    expect(s.weightKg).toBe(12);
    expect(s.targetReps).toBe(9);
  });

  it("needs all planned sets before increasing", () => {
    const s = suggestNext({ item, exercise: dbKg, last: hist([set(12, 12), set(12, 12)]) });
    expect(s.kind).toBe("add_reps");
  });

  it("suggests a harder variation for bodyweight work at the top", () => {
    const s = suggestNext({
      item: { sets: 3, repMin: 30, repMax: 45, rirTarget: 2 },
      exercise: { equipment: ["bodyweight"], displayUnit: "kg", weightIsPerHand: false, metric: "seconds" },
      last: hist([set(45, null), set(45, null), set(50, null)]),
    });
    expect(s.kind).toBe("progress_variation");
  });

  it("picks sensible default increments", () => {
    expect(defaultIncrement(machineLb)).toBe(5);
    expect(defaultIncrement(dbKg)).toBe(2);
    expect(defaultIncrement({ ...dbKg, equipment: ["smith"] })).toBe(2.5);
    expect(defaultIncrement({ ...dbKg, increment: 1 })).toBe(1);
  });
});
