import { beforeEach, describe, expect, it, vi } from "vitest";
import raw from "@/data/seed/rutinas_seed.json";
import { mergeExercises } from "@/lib/catalog";
import { planFromTemplate } from "@/lib/plans";
import { applyProposal } from "@/lib/proposals";
import { SeedSchema } from "@/lib/seed/schema";
import type { PlanChangeProposal } from "@/lib/types";

// The coach tools run on the server with the Admin SDK: replace it with an
// in-memory collection so we can see exactly what a proposal stores.
const stored: { path: string; data: Record<string, unknown> }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("../memory", () => ({ searchMemories: async () => [] }));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => ({
    collection: (path: string) => ({
      doc: () => ({ id: `doc${stored.length + 1}`, set: async (data: Record<string, unknown>) => void stored.push({ path, data }) }),
    }),
  }),
}));

const { runTool, toolDeclarations } = await import("../tools");

const seed = SeedSchema.parse(raw);
const exercises = mergeExercises(seed.exercises, [], { units: "mixed", unavailableEquipment: [] });
const plan = planFromTemplate(
  seed.programTemplates.find((t) => t.id === "H1")!,
  { id: "plan1", variant: "default", startDate: "2026-10-01", now: 0 },
);
const data = {
  uid: "u1",
  today: "2026-10-21",
  activePlan: async () => plan,
  exercises: async () => exercises,
  exerciseMap: async () => new Map(exercises.map((e) => [e.id, e])),
} as never;
const run = (name: string, args: unknown) => runTool(name, args, { data }) as Promise<Record<string, unknown>>;

beforeEach(() => {
  stored.length = 0;
});

describe("tool declarations sent to Gemini", () => {
  const decls = toolDeclarations();
  it("declare every new tool as an object schema", () => {
    for (const name of ["get_week_schedule", "find_exercises", "propose_week_block", "propose_plan_change"]) {
      const d = decls.find((x) => x.name === name);
      expect(d, name).toBeTruthy();
      expect(d!.parameters.type).toBe("object");
    }
  });
  it("describe the block items fully (no refs the API can't resolve)", () => {
    const p = decls.find((x) => x.name === "propose_week_block")!.parameters as {
      properties: Record<string, { type?: string; items?: { type?: string; properties?: object } }>;
      required: string[];
    };
    expect(JSON.stringify(p)).not.toContain("$ref");
    expect(p.properties.items.items?.type).toBe("object");
    expect(Object.keys(p.properties.items.items?.properties ?? {})).toEqual(expect.arrayContaining(["exerciseId", "sets", "repMin", "repMax", "unit"]));
    expect(p.properties.weekdays.type).toBe("array");
    expect(p.required).toEqual(expect.arrayContaining(["summary", "rationale", "name", "place", "weekdays", "minutes", "items"]));
  });
});

describe("get_week_schedule", () => {
  it("returns the seven days with the plan's sessions and today's weekday", async () => {
    const r = (await run("get_week_schedule", {})) as {
      today: { weekday: number };
      days: { weekday: number; day: string; rest: boolean; sessions: { key: string; countsAsTraining: boolean; place: string }[] }[];
    };
    expect(r.today.weekday).toBe(3);
    expect(r.days).toHaveLength(7);
    expect(r.days[0]).toMatchObject({ day: "lunes", rest: false, sessions: [{ key: "S1", countsAsTraining: true, place: "gym" }] });
    expect(r.days[1].rest).toBe(true);
  });
});

describe("find_exercises", () => {
  it("only returns abs exercises doable at home, with their unit", async () => {
    const r = (await run("find_exercises", { muscle: "abs", place: "home", limit: 30 })) as { exercises: { id: string; unit: string; equipment: string[] }[] };
    const ids = r.exercises.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["plank", "dead_bug", "reverse_crunch"]));
    expect(ids).not.toContain("cable_crunch");
    expect(r.exercises.find((e) => e.id === "plank")!.unit).toBe("seconds");
  });
  it("matches text without accents", async () => {
    const r = (await run("find_exercises", { query: "elevacion" })) as { exercises: { id: string }[] };
    expect(r.exercises.map((e) => e.id)).toContain("lying_leg_raise");
  });
});

describe("propose_week_block", () => {
  const args = {
    summary: "Core en casa martes y jueves",
    rationale: "Complementa el plan; la grasa abdominal baja con déficit, no con abdominales.",
    name: "Core en casa",
    place: "home",
    weekdays: ["2", 4], // models sometimes send numbers as strings
    minutes: "12",
    items: [
      { exerciseId: "dead_bug", sets: 3, repMin: 8, repMax: 12, unit: "reps" },
      { exerciseId: "plank", sets: "3", repMin: 30, repMax: 45 },
    ],
  };

  it("stores a pending proposal that applies to the plan", async () => {
    const r = await run("propose_week_block", args);
    expect(r).toMatchObject({ ok: true, days: ["martes", "jueves"] });
    expect(stored).toHaveLength(1);
    expect(stored[0].path).toBe("users/u1/proposals");
    const p = { ...(stored[0].data as unknown as PlanChangeProposal), id: "x" };
    expect(p).toMatchObject({ op: "add_block", status: "pending", planId: "plan1", sessionKey: "" });
    expect(p.block!.items[1]).toMatchObject({ exerciseId: "plank", repUnit: "seconds", sets: 3 });
    const next = applyProposal(plan, p)!;
    expect(next.sessions.filter((s) => s.extra).map((s) => s.weekday)).toEqual([2, 4]);
  });

  it("returns a fixable error and stores nothing for a gym machine at home", async () => {
    const r = await run("propose_week_block", { ...args, items: [{ exerciseId: "cable_crunch", sets: 3, repMin: 10, repMax: 15 }] });
    expect(r.error).toMatch(/find_exercises/);
    expect(stored).toHaveLength(0);
  });

  it("rejects malformed arguments", async () => {
    const r = await run("propose_week_block", { ...args, weekdays: [] });
    expect(r.error).toBe("Argumentos inválidos");
    expect(stored).toHaveLength(0);
  });
});

describe("propose_plan_change", () => {
  it("moves a session to another day", async () => {
    const r = await run("propose_plan_change", {
      summary: "Pasar S3 al sábado",
      rationale: "Viernes ocupado",
      sessionKey: "S3",
      op: "move_session",
      weekday: 6,
    });
    expect(r.ok).toBe(true);
    expect(stored[0].data).toMatchObject({ op: "move_session", sessionKey: "S3", weekday: 6 });
  });
  it("needs a weekday to move and refuses to delete plan sessions", async () => {
    expect((await run("propose_plan_change", { summary: "Mover S3", rationale: "razón", sessionKey: "S3", op: "move_session" })).error).toMatch(/weekday/);
    expect((await run("propose_plan_change", { summary: "Quitar S1", rationale: "razón", sessionKey: "S1", op: "remove_session" })).error).toMatch(
      /bloques extra/,
    );
    expect(stored).toHaveLength(0);
  });
  it("adds a timed exercise with the right unit", async () => {
    await run("propose_plan_change", {
      summary: "Plancha al final",
      rationale: "Core 2 veces/semana",
      sessionKey: "S2",
      op: "add_exercise",
      newExerciseId: "plank",
      sets: 3,
      repMin: 30,
      repMax: 45,
    });
    expect(stored[0].data).toMatchObject({ repUnit: "seconds" });
  });
  it("refuses changes that wouldn't apply", async () => {
    const r = await run("propose_plan_change", {
      summary: "Cambiar series",
      rationale: "razón",
      sessionKey: "S1",
      op: "change_sets",
      exerciseId: "dead_bug",
      sets: 4,
    }); // not in S1
    expect(r.error).toMatch(/no se puede aplicar/);
  });
});
