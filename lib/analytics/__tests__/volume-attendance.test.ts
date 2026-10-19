import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { mergeExercises } from "@/lib/catalog";
import { planFromTemplate } from "@/lib/plans";
import { SeedSchema } from "@/lib/seed/schema";
import { plannedSessionsForWeek, sessionForDate, summarizeAttendance, weeklyAttendance } from "../attendance";
import { planVolume, setsByMuscle, volumeStatus } from "../volume";
import { entry, set, workout } from "./fixtures";

const seed = SeedSchema.parse(raw);
const exercises = new Map(mergeExercises(seed.exercises, [], { units: "mixed", unavailableEquipment: [] }).map((e) => [e.id, e]));
const tpl = (id: string) => seed.programTemplates.find((t) => t.id === id)!;
const plan = (id: string, variant: string | null, startDate = "2026-01-05") => planFromTemplate(tpl(id), { id: "p", variant, startDate, now: 0 });

describe("planned volume matches the seed's weeklyVolume", () => {
  for (const t of seed.programTemplates.filter((x) => x.weeklyVolume)) {
    it(t.id, () => {
      const v = planVolume(plan(t.id, Object.keys(t.weekdayMap)[0] ?? null), exercises);
      for (const [m, expected] of Object.entries(t.weeklyVolume!.fractionalSets)) {
        expect(v[m as keyof typeof v] ?? 0, `${t.id}/${m}`).toBeCloseTo(expected, 0);
      }
    });
  }
});

describe("volume", () => {
  it("counts hard sets with secondary muscles at half weight", () => {
    const w = workout("2026-10-12", [
      entry("chest_press_machine", [set(10, 40), set(10, 40), set(10, 40, { isWarmup: true }), set(12, 40, { rir: 6 })]),
    ]);
    const v = setsByMuscle([w], exercises);
    expect(v.chest).toBe(2);
    expect(v.triceps).toBe(1);
  });

  it("attributes substitutions to the planned exercise's muscles", () => {
    const w = workout("2026-10-12", [entry("pushup", [set(15, null)], { plannedExerciseId: "chest_press_machine" })]);
    expect(setsByMuscle([w], exercises).chest).toBe(1);
  });

  it("ignores cardio minutes", () => {
    const w = workout("2026-10-12", [entry("incline_walk", [set(30, null)], { repUnit: "minutes" })]);
    expect(setsByMuscle([w], exercises)).toEqual({});
  });

  it("classifies weekly volume", () => {
    expect(volumeStatus(8)).toBe("low");
    expect(volumeStatus(11)).toBe("near");
    expect(volumeStatus(15)).toBe("ok");
    expect(volumeStatus(21)).toBe("high");
    expect(volumeStatus(25)).toBe("excess");
  });
});

describe("attendance and calendars", () => {
  it("assigns weekdays from the chosen variant", () => {
    const p = plan("H2", "extraTuesday");
    expect(plannedSessionsForWeek(p, "2026-10-12").map((d) => d.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"]);
    expect(sessionForDate(p, "2026-10-13")?.key).toBe("L1");
  });

  it("does not count optional/floating or cardio sessions as scheduled training", () => {
    const p = plan("D1", "classic");
    const keys = plannedSessionsForWeek(p, "2026-10-12").map((d) => d.session.key);
    expect(keys).toEqual(["U1", "L1", "U2", "L2"]);
    expect(sessionForDate(p, "2026-10-14")?.kind).toBe("cardio"); // C1 on Wednesday in the classic calendar
  });

  it("alternates StrongLifts A/B: A-B-A then B-A-B", () => {
    const p = plan("F1", null, "2026-10-12");
    const w1 = plannedSessionsForWeek(p, "2026-10-12").map((d) => d.session.key);
    const w2 = plannedSessionsForWeek(p, "2026-10-19").map((d) => d.session.key);
    expect(w1).toEqual(["A", "B", "A"]);
    expect(w2).toEqual(["B", "A", "B"]);
    expect(plannedSessionsForWeek(p, "2026-10-05")).toEqual([]); // before the start date
  });

  it("computes weekly attendance, compliance and streak", () => {
    const p = plan("H1", "default");
    const done = (d: string) => workout(d, []);
    const workouts = [
      ...["2026-09-28", "2026-09-30", "2026-10-02"].map(done),
      ...["2026-10-05", "2026-10-07", "2026-10-09"].map(done),
      ...["2026-10-12"].map(done),
      workout("2026-10-13", [], { sessionKind: "cardio" }), // cardio: not a training day
    ];
    const weeks = weeklyAttendance({ plan: p, workouts, weekStarts: ["2026-09-28", "2026-10-05", "2026-10-12"], today: "2026-10-14" });
    expect(weeks.map((w) => w.attended)).toEqual([3, 3, 1]);
    expect(weeks[2].plannedToDate).toBe(2);
    const s = summarizeAttendance(weeks);
    expect(s.streakWeeks).toBe(2);
    expect(s.compliancePct).toBe(88);
  });

  it("ignores planned days before the user started", () => {
    const weeks = weeklyAttendance({ plan: plan("H1", "default"), workouts: [], weekStarts: ["2026-10-05", "2026-10-12"], today: "2026-10-18", startDate: "2026-10-14" });
    expect(weeks[0].planned).toBe(0);
    expect(weeks[1].planned).toBe(2);
  });
});
