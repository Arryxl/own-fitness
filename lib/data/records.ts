// Initial marks (section 9.6). Only what the user actually reported; the rest is
// filled in over time. Values keep the unit the user said.
import type { PersonalRecord } from "@/lib/types";
import { lbToKg } from "@/lib/analytics/units";

export const SEED_RECORDS: Omit<PersonalRecord, "updatedAt">[] = [
  {
    exerciseId: "db_curl",
    currentWeightKg: 10,
    enteredValue: 10,
    enteredUnit: "kg",
    reps: 10,
    perHand: null,
    note: "10 kg, 10 repeticiones o menos. Pendiente: ¿por mano? series habituales.",
  },
  {
    exerciseId: "db_incline_press",
    currentWeightKg: lbToKg(30),
    enteredValue: 30,
    enteredUnit: "lb",
    reps: null,
    perHand: null,
    note: "30 lb. Pendiente: ¿por mancuerna? repeticiones y RIR.",
  },
  {
    exerciseId: "vertical_push_unknown",
    currentWeightKg: lbToKg(40),
    enteredValue: 40,
    enteredUnit: "lb",
    reps: null,
    perHand: null,
    note: "~40 lb, «creo». Pendiente: qué ejercicio exacto es, si es por mano o total, repeticiones.",
  },
];
