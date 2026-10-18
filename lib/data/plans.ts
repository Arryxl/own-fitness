// Seed plan templates (sections 9.1 and 9.2). Editable from the app.
import type { Plan, PlanItem, PlanSession } from "@/lib/types";

/** sets × repMin-repMax; compounds rest 120 s, isolation 75 s; RIR target 2 (range 1-3). */
function it(exerciseId: string, sets: number, repMin: number, repMax: number, opts: Partial<PlanItem> = {}): PlanItem {
  return { exerciseId, sets, repMin, repMax, restSec: 75, rirTarget: 2, notes: "", ...opts };
}
const C = { restSec: 120 }; // compound rest

const MON: PlanSession = {
  key: "mon",
  name: "Torso A + pierna",
  weekday: 1,
  kind: "gym",
  focus: "Pecho y espalda horizontales, brazos, prensa",
  items: [
    it("machine_chest_press", 3, 8, 12, C),
    it("lat_pulldown", 3, 8, 12, C),
    it("db_incline_press", 3, 8, 12, C),
    it("seated_cable_row", 3, 10, 12, C),
    it("db_lateral_raise", 3, 12, 20),
    it("cable_overhead_ext", 3, 10, 12),
    it("db_incline_curl", 3, 10, 12),
    it("leg_press", 3, 10, 12, C),
    it("plank", 3, 30, 45, { restSec: 60 }),
  ],
};

const WED: PlanSession = {
  key: "wed",
  name: "Torso B + pierna",
  weekday: 3,
  kind: "gym",
  focus: "Pecho superior, hombros, bisagra de cadera",
  items: [
    it("smith_incline_press", 3, 8, 12, C),
    it("neutral_pulldown", 3, 8, 12, C),
    it("db_shoulder_press", 3, 8, 12, C),
    it("chest_supported_row", 3, 10, 12, C),
    it("cable_fly", 2, 12, 15),
    it("rope_pushdown", 3, 10, 15),
    it("hammer_curl", 3, 10, 12),
    it("db_rdl", 3, 10, 12, C),
    it("hanging_knee_raise", 3, 10, 15, { restSec: 60 }),
  ],
};

const FRI: PlanSession = {
  key: "fri",
  name: "Torso C + pierna",
  weekday: 5,
  kind: "gym",
  focus: "Pecho, espalda, deltoide posterior, sentadilla",
  items: [
    it("machine_chest_press", 3, 8, 15, { ...C, notes: "O flexiones (pies elevados/lastre al progresar)." }),
    it("lat_pulldown", 3, 8, 12, C),
    it("db_lateral_raise", 3, 12, 20),
    it("one_arm_db_row", 3, 10, 12, C),
    it("assisted_dip", 3, 8, 12, C),
    it("db_curl", 3, 8, 12),
    it("goblet_squat", 3, 8, 12, C),
    it("face_pull", 3, 12, 20),
    it("cable_crunch", 3, 10, 15, { restSec: 60 }),
  ],
};

const HOME: PlanSession = {
  key: "home",
  name: "Sesión en casa (20-30 min)",
  weekday: null,
  kind: "home",
  focus: "Caminata + core, opcional en días sin gimnasio",
  items: [
    it("push_up", 3, 8, 15, { restSec: 60 }),
    it("glute_bridge", 2, 12, 20, { restSec: 45 }),
    it("dead_bug", 3, 8, 12, { restSec: 45 }),
    it("plank", 3, 30, 45, { restSec: 45 }),
    it("floor_crunch", 2, 10, 15, { restSec: 45, notes: "Termina con 15-20 min de caminata." }),
  ],
};

const FLOATING: PlanSession = {
  key: "float",
  name: "Brazos + hombros + pecho superior",
  weekday: null,
  kind: "floating",
  focus: "Día flotante (martes o jueves), ~45 min",
  items: [
    it("db_incline_press", 3, 8, 12, C),
    it("db_lateral_raise", 4, 12, 20),
    it("cable_overhead_ext", 3, 10, 12),
    it("db_incline_curl", 3, 10, 12),
    it("rope_pushdown", 2, 12, 15),
    it("hammer_curl", 2, 10, 12),
    it("face_pull", 3, 12, 20),
    it("cable_crunch", 3, 10, 15, { restSec: 60 }),
  ],
};

/** Removes or trims items so the 4-day week stays inside 12-20 sets for priority muscles. */
function trim(session: PlanSession, changes: Record<string, number>): PlanSession {
  return {
    ...session,
    items: session.items
      .map((i) => (i.exerciseId in changes ? { ...i, sets: changes[i.exerciseId] } : i))
      .filter((i) => i.sets > 0),
  };
}

export const SEED_PLANS: Plan[] = [
  {
    id: "plan_3d",
    name: "3 días (L-M-V) · cuerpo completo, énfasis torso",
    daysPerWeek: 3,
    sessions: [MON, WED, FRI, HOME],
  },
  {
    id: "plan_4d",
    name: "4 días (L-M-V + flotante mar/jue)",
    daysPerWeek: 4,
    floatingWeekdays: [2, 4],
    sessions: [
      // Arm and lateral work moves to the floating day, so L-M-V lose some of it.
      trim(MON, { db_incline_curl: 0, db_lateral_raise: 2, cable_overhead_ext: 2 }),
      trim(WED, { hammer_curl: 2, rope_pushdown: 2 }),
      trim(FRI, { db_lateral_raise: 2, db_curl: 2, face_pull: 2, assisted_dip: 2 }),
      FLOATING,
      HOME,
    ],
  },
];
