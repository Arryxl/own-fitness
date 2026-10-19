import { describe, expect, it } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { mergeExercises } from "@/lib/catalog";
import { planFromTemplate } from "@/lib/plans";
import { applyProposal } from "@/lib/proposals";
import { SeedSchema } from "@/lib/seed/schema";
import type { PlanChangeProposal } from "@/lib/types";
import { buildWorkout } from "@/lib/workout";
import {
  BLOCK_PRESETS,
  addProposedBlock,
  exerciseFitsPlace,
  newBlock,
  nextBlockKey,
  unscheduledSessions,
  validateBlock,
  weekActivity,
  weekSchedule,
  type BlockInput,
} from "@/lib/week";
import { extrasForDate, plannedSessionsForWeek, sessionForDate, weeklyAttendance } from "../attendance";
import { entry, set, workout } from "./fixtures";

const seed = SeedSchema.parse(raw);
const exercises = new Map(mergeExercises(seed.exercises, [], { units: "mixed", unavailableEquipment: [] }).map((e) => [e.id, e]));
const tpl = (id: string) => seed.programTemplates.find((t) => t.id === id)!;
const MONDAY = "2026-10-19";

const fullBody = () => planFromTemplate(tpl("H1"), { id: "p", variant: "default", startDate: "2026-10-01", now: 0 });
const coreTuesday = (plan = fullBody()) => newBlock(plan, { ...BLOCK_PRESETS.find((p) => p.id === "core_home")!.draft, weekday: 2 });

const proposal = (p: Partial<PlanChangeProposal>): PlanChangeProposal => ({
  id: "x",
  createdAt: 0,
  status: "pending",
  summary: "s",
  rationale: "r",
  planId: "p",
  sessionKey: "",
  op: "add_block",
  ...p,
});

const block = (over: Partial<BlockInput> = {}): BlockInput => ({
  name: "Core en casa",
  place: "home",
  kind: "lifting",
  weekdays: [4, 2],
  minutes: 12,
  items: [
    { exerciseId: "dead_bug", sets: 3, repMin: 8, repMax: 12, unit: "reps" },
    { exerciseId: "plank", sets: 3, repMin: 30, repMax: 45 },
  ],
  ...over,
});

describe("weekly schedule", () => {
  it("lays the plan out Monday to Sunday with extra blocks apart", () => {
    const plan = fullBody();
    const withCore = { ...plan, sessions: [...plan.sessions, coreTuesday(plan)] };
    const days = weekSchedule(withCore, MONDAY);
    expect(days.map((d) => d.sessions.map((s) => s.key))).toEqual([["S1"], [], ["S2"], [], ["S3"], [], []]);
    expect(days[1].extras.map((s) => s.name)).toEqual(["Core en casa"]);
    expect(days[1].date).toBe("2026-10-20");
    expect(days[1].minutes).toBe(12);
  });

  it("resolves the rotating session of each date in A/B plans", () => {
    const plan = planFromTemplate(tpl("F1"), { id: "p", variant: null, startDate: MONDAY, now: 0 });
    const days = weekSchedule(plan, MONDAY);
    expect(days.map((d) => d.sessions.map((s) => s.key).join(""))).toEqual(["A", "", "B", "", "A", "", ""]);
  });

  it("keeps optional and dayless sessions in their own list", () => {
    const plan = fullBody();
    plan.sessions[0] = { ...plan.sessions[0], weekday: null };
    expect(unscheduledSessions(plan).map((s) => s.key)).toEqual(["S1"]);
  });

  it("copies the template's place into the plan", () => {
    expect(fullBody().sessions.every((s) => s.place === "gym")).toBe(true);
    const home = seed.programTemplates.find((t) => t.place === "home" || t.place === "bodyweight")!;
    expect(planFromTemplate(home, { id: "p", variant: Object.keys(home.weekdayMap)[0] ?? null, startDate: MONDAY, now: 0 }).sessions[0].place).toBe("home");
  });

  it("gives every new block a free key", () => {
    const plan = fullBody();
    const a = coreTuesday(plan);
    expect(a.key).toBe("X1");
    expect(nextBlockKey({ sessions: [...plan.sessions, a] })).toBe("X2");
  });
});

describe("extra blocks never count as training", () => {
  const plan = fullBody();
  const withCore = { ...plan, sessions: [...plan.sessions, coreTuesday(plan), { ...coreTuesday(plan), key: "X2", weekday: 1 }] };

  it("are not planned sessions and don't replace the day's session", () => {
    expect(plannedSessionsForWeek(withCore, MONDAY).map((p) => p.session.key)).toEqual(["S1", "S2", "S3"]);
    expect(sessionForDate(withCore, MONDAY)?.key).toBe("S1");
    expect(sessionForDate(withCore, "2026-10-20")).toBeNull();
    expect(extrasForDate(withCore, "2026-10-20").map((s) => s.key)).toEqual(["X1"]);
  });

  it("workouts logged from them are marked and skipped by attendance", () => {
    const w = buildWorkout({
      id: "w",
      date: "2026-10-20",
      plan: withCore,
      session: withCore.sessions.find((s) => s.key === "X1")!,
      exercises,
      addOns: seed.addOns,
      workouts: [],
      records: new Map(),
    });
    expect(w.extra).toBe(true);
    expect(w.entries.map((e) => e.exerciseId)).toEqual(["dead_bug", "plank", "reverse_crunch"]); // no gym add-ons
    const att = weeklyAttendance({
      plan: withCore,
      workouts: [workout("2026-10-20", [entry("plank", [set(40, null)])], { extra: true }), workout(MONDAY, [entry("leg_press", [set(10, 100)])])],
      weekStarts: [MONDAY],
      today: "2026-10-25",
    })[0];
    expect(att.attendedDates).toEqual([MONDAY]);
    expect(att.planned).toBe(3);
  });
});

describe("block presets", () => {
  for (const p of BLOCK_PRESETS) {
    it(`${p.id} uses real exercises that fit ${p.draft.place}`, () => {
      for (const it of p.draft.items) {
        const ex = exercises.get(it.exerciseId);
        expect(ex, it.exerciseId).toBeTruthy();
        expect(exerciseFitsPlace(ex!, p.draft.place), it.exerciseId).toBe(true);
        expect(it.repMin).toBeLessThanOrEqual(it.repMax);
      }
    });
  }
});

describe("coach block proposals", () => {
  it("accepts a valid block, sorts the days and uses each exercise's unit", () => {
    const r = validateBlock(block(), fullBody(), exercises, MONDAY);
    if ("error" in r) throw new Error(r.error);
    expect(r.block.weekdays).toEqual([2, 4]);
    expect(r.block.items.map((i) => i.repUnit)).toEqual(["reps", "seconds"]);
    expect(r.warnings).toEqual([]);
  });

  it("rejects unknown ids, inverted ranges and gym machines at home", () => {
    const plan = fullBody();
    expect(validateBlock(block({ items: [{ exerciseId: "abs_magic", sets: 3, repMin: 8, repMax: 12 }] }), plan, exercises, MONDAY)).toMatchObject({
      error: expect.stringContaining("find_exercises"),
    });
    expect(validateBlock(block({ items: [{ exerciseId: "plank", sets: 3, repMin: 60, repMax: 30 }] }), plan, exercises, MONDAY)).toMatchObject({
      error: expect.stringContaining("repMin"),
    });
    expect(validateBlock(block({ items: [{ exerciseId: "cable_crunch", sets: 3, repMin: 10, repMax: 15 }] }), plan, exercises, MONDAY)).toMatchObject({
      error: expect.stringContaining("Casa"),
    });
    expect(validateBlock(block({ weekdays: [8] }), plan, exercises, MONDAY)).toMatchObject({ error: expect.stringContaining("weekdays") });
  });

  it("warns about duplicates on the same day", () => {
    const plan = fullBody();
    const withCore = { ...plan, sessions: [...plan.sessions, coreTuesday(plan)] };
    const r = validateBlock(block(), withCore, exercises, MONDAY);
    expect("warnings" in r && r.warnings[0]).toContain("Core en casa");
  });

  it("an approved block adds one copy per day", () => {
    const r = validateBlock(block(), fullBody(), exercises, MONDAY);
    if ("error" in r) throw new Error(r.error);
    const next = applyProposal(fullBody(), proposal({ op: "add_block", block: r.block }))!;
    const extras = next.sessions.filter((s) => s.extra);
    expect(extras.map((s) => [s.key, s.weekday, s.place])).toEqual([
      ["X1", 2, "home"],
      ["X2", 4, "home"],
    ]);
    expect(addProposedBlock(fullBody(), r.block).sessions).toHaveLength(5);
  });

  it("moves sessions and removes only extra blocks", () => {
    const plan = fullBody();
    const withCore = { ...plan, sessions: [...plan.sessions, coreTuesday(plan)] };
    expect(applyProposal(withCore, proposal({ op: "move_session", sessionKey: "X1", weekday: 6 }))!.sessions.find((s) => s.key === "X1")!.weekday).toBe(6);
    expect(
      applyProposal(withCore, proposal({ op: "move_session", sessionKey: "S2", weekday: null }))!.sessions.find((s) => s.key === "S2")!.weekday,
    ).toBeNull();
    expect(applyProposal(withCore, proposal({ op: "remove_session", sessionKey: "X1" }))!.sessions.some((s) => s.key === "X1")).toBe(false);
    expect(applyProposal(withCore, proposal({ op: "remove_session", sessionKey: "S1" }))).toBeNull();
  });

  it("won't move a rotating plan's own sessions", () => {
    const plan = planFromTemplate(tpl("F1"), { id: "p", variant: null, startDate: MONDAY, now: 0 });
    expect(applyProposal(plan, proposal({ op: "move_session", sessionKey: "A", weekday: 2 }))).toBeNull();
  });

  it("adds a timed exercise with its own unit", () => {
    const next = applyProposal(
      fullBody(),
      proposal({ op: "add_exercise", sessionKey: "S1", newExerciseId: "plank", sets: 3, repMin: 30, repMax: 45, repUnit: "seconds" }),
    )!;
    expect(next.sessions[0].items.at(-1)).toMatchObject({ exerciseId: "plank", repUnit: "seconds" });
  });
});

describe("week activity for the home chart", () => {
  it("separates plan sets from extra-block sets and counts extras done", () => {
    const plan = fullBody();
    const withCore = { ...plan, sessions: [...plan.sessions, coreTuesday(plan), { ...coreTuesday(plan), key: "X2", weekday: 4 }] };
    const days = weekActivity(
      withCore,
      [
        workout(MONDAY, [entry("leg_press", [set(10, 100), set(10, 100)])], { sessionKey: "S1" }),
        workout("2026-10-20", [entry("plank", [set(40, null), set(40, null)]), entry("dead_bug", [set(10, null)])], { sessionKey: "X1", extra: true }),
        workout("2026-10-22", [entry("plank", [set(40, null)])], { sessionKey: "X2", extra: true, status: "in_progress" }),
      ],
      MONDAY,
    );
    expect(days[0]).toMatchObject({ sets: 2, extraSets: 0, planned: true, extrasPlanned: 0 });
    expect(days[1]).toMatchObject({ sets: 0, extraSets: 3, planned: false, extrasPlanned: 1, extrasDone: 1 });
    expect(days[3]).toMatchObject({ sets: 0, extraSets: 0, extrasPlanned: 1, extrasDone: 0 }); // still in progress
  });
});
