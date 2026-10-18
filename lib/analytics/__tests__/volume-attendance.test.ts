import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/lib/data/exercises";
import { SEED_PLANS } from "@/lib/data/plans";
import { plannedSessionsForWeek, sessionForDate, summarizeAttendance, weeklyAttendance } from "../attendance";
import { PRIORITY_MUSCLES, VOLUME_TARGET, planVolume, setsByMuscle, volumeStatus } from "../volume";
import { entry, set, workout } from "./fixtures";

const exercises = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const [plan3, plan4] = SEED_PLANS;

describe("seed data integrity", () => {
  it("every plan and fallback exercise exists", () => {
    for (const p of SEED_PLANS)
      for (const s of p.sessions) for (const i of s.items) expect(exercises.has(i.exerciseId), i.exerciseId).toBe(true);
    for (const e of SEED_EXERCISES)
      for (const l of e.fallbackChain) expect(exercises.has(l.exerciseId), `${e.id} → ${l.exerciseId}`).toBe(true);
  });

  it("every plan exercise has a fallback chain", () => {
    for (const p of SEED_PLANS)
      for (const s of p.sessions.filter((x) => x.kind !== "home"))
        for (const i of s.items) expect(exercises.get(i.exerciseId)!.fallbackChain.length, i.exerciseId).toBeGreaterThan(0);
  });

  it("barbell bench is not spotter-free", () => {
    expect(exercises.get("barbell_bench_press")!.spotterFree).toBe(false);
  });

  it("both plans keep priority muscles inside 12-20 weekly sets", () => {
    for (const p of SEED_PLANS) {
      const v = planVolume(p, exercises);
      for (const m of PRIORITY_MUSCLES) {
        expect(v[m], `${p.id}/${m}`).toBeGreaterThanOrEqual(VOLUME_TARGET.min);
        expect(v[m], `${p.id}/${m}`).toBeLessThanOrEqual(VOLUME_TARGET.max);
      }
    }
  });
});

describe("volume", () => {
  it("counts hard sets with secondary muscles at half weight", () => {
    const w = workout("2026-10-12", [
      entry("machine_chest_press", [set(10, 40), set(10, 40), set(10, 40, { isWarmup: true }), set(12, 40, { rir: 6 })]),
    ]);
    const v = setsByMuscle([w], exercises);
    expect(v.chest).toBe(2);
    expect(v.triceps).toBe(1);
  });

  it("attributes substitutions to the planned exercise's muscles", () => {
    const w = workout("2026-10-12", [entry("push_up", [set(15, null)], { plannedExerciseId: "machine_chest_press" })]);
    expect(setsByMuscle([w], exercises).chest).toBe(1);
  });

  it("classifies weekly volume", () => {
    expect(volumeStatus(8)).toBe("low");
    expect(volumeStatus(11)).toBe("near");
    expect(volumeStatus(15)).toBe("ok");
    expect(volumeStatus(21)).toBe("high");
    expect(volumeStatus(25)).toBe("excess");
  });
});

describe("attendance", () => {
  it("plans L-M-V and the floating day only when activated", () => {
    expect(plannedSessionsForWeek(plan3, "2026-10-12", null).map((p) => p.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(plannedSessionsForWeek(plan4, "2026-10-12", null)).toHaveLength(3);
    expect(plannedSessionsForWeek(plan4, "2026-10-12", 4).map((p) => p.date)).toContain("2026-10-15");
    expect(sessionForDate(plan4, "2026-10-13", 2)?.kind).toBe("floating");
    expect(sessionForDate(plan3, "2026-10-17", null)).toBeNull();
  });

  it("computes weekly attendance, compliance and streak", () => {
    const ws = ["2026-09-28", "2026-10-05", "2026-10-12"];
    const done = (d: string) => workout(d, []);
    const workouts = [
      ...["2026-09-28", "2026-09-30", "2026-10-02"].map(done),
      ...["2026-10-05", "2026-10-07", "2026-10-09"].map(done),
      ...["2026-10-12"].map(done),
      workout("2026-10-13", [], { sessionKey: "home" }), // home session: not gym attendance
    ];
    const weeks = weeklyAttendance({ plan: plan3, workouts, weekStarts: ws, floatingByWeek: new Map(), today: "2026-10-14" });
    expect(weeks.map((w) => w.attended)).toEqual([3, 3, 1]);
    expect(weeks[2].plannedToDate).toBe(2);
    expect(weeks[2].closed).toBe(false);
    const s = summarizeAttendance(weeks);
    expect(s.streakWeeks).toBe(2);
    expect(s.compliancePct).toBe(88); // 7 of 8 planned-to-date
  });
});

describe("attendance before the start date", () => {
  it("does not count planned days before the user started", () => {
    const weeks = weeklyAttendance({ plan: plan3, workouts: [], weekStarts: ["2026-10-05", "2026-10-12"], floatingByWeek: new Map(), today: "2026-10-18", startDate: "2026-10-14" });
    expect(weeks[0].planned).toBe(0);
    expect(weeks[1].planned).toBe(2); // Wed 14 and Fri 16
  });
});
