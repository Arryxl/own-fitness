// Double progression (section 8.1 of the spec). Heuristic, not a prescription.
import type { Exercise, PersonalRecord, PlanItem, RepUnit, WeightUnit } from "@/lib/types";
import type { ExerciseSession } from "./strength";
import { formatWeight, fromKg, round, toKg } from "./units";

export type SuggestionKind = "calibrate" | "from_record" | "increase" | "add_reps" | "progress_variation" | "cardio";

export interface ProgressionSuggestion {
  kind: SuggestionKind;
  weightKg: number | null;
  targetReps: number;
  message: string;
  warning?: string;
}

type ExerciseLike = Pick<Exercise, "equipment" | "displayUnit" | "weightIsPerHand" | "increment" | "metric">;

/** Smallest sensible load jump in the exercise's display unit. */
export function defaultIncrement(ex: ExerciseLike): number {
  if (ex.increment && ex.increment > 0) return ex.increment;
  if (ex.displayUnit === "lb") return 5;
  return ex.equipment.includes("dumbbell") ? 2 : 2.5;
}

function unitLabel(ex: ExerciseLike, unit: WeightUnit, kg: number): string {
  return `${formatWeight(kg, unit)}${ex.weightIsPerHand ? " por mano" : ""}`;
}

export function suggestNext(args: {
  item: Pick<PlanItem, "sets" | "repMin" | "repMax" | "rirTarget">;
  exercise: ExerciseLike;
  last: ExerciseSession | null;
  record?: PersonalRecord | null;
  droppedTwice?: boolean;
  /** The plan item's unit wins over the exercise default (a plank may be timed in one plan, reps in another). */
  repUnit?: RepUnit;
}): ProgressionSuggestion {
  const { item, exercise, last, record, droppedTwice } = args;
  const metric = args.repUnit ?? exercise.metric;
  const unit = exercise.displayUnit;
  const what = metric === "seconds" ? "s" : "reps";
  if (metric === "minutes") {
    return {
      kind: "cardio",
      weightKg: null,
      targetReps: item.repMin,
      message: `${item.repMin}-${item.repMax} min a ritmo conversacional (puedes hablar sin ahogarte). Anota los minutos que hiciste.`,
    };
  }
  const warning = droppedTwice
    ? "El rendimiento bajó 2 sesiones seguidas: revisa sueño, comida y fatiga antes de culpar al plan."
    : undefined;

  if (!last || last.sets.length === 0) {
    if (record?.currentWeightKg) {
      return {
        kind: "from_record",
        weightKg: record.currentWeightKg,
        targetReps: item.repMin,
        message: `Referencia: tu marca inicial (${unitLabel(exercise, unit, record.currentWeightKg)}). Ajusta para quedar a ~RIR 2 en ${item.repMin}-${item.repMax} ${what}.`,
        warning,
      };
    }
    return {
      kind: "calibrate",
      weightKg: null,
      targetReps: item.repMin,
      message: `Sesión de calibración: empieza ligero (RIR 3-4) y sube hasta una carga con ~2 repeticiones en reserva dentro de ${item.repMin}-${item.repMax} ${what}. La guardaremos como marca inicial.`,
      warning,
    };
  }

  const sets = last.sets;
  const enoughSets = sets.length >= item.sets;
  const allAtTop = sets.every((s) => (s.reps ?? 0) >= item.repMax && (s.rir == null || s.rir >= 1));
  const top = last.topWeightKg;
  const loaded = top != null && top > 0;

  if (enoughSets && allAtTop) {
    if (!loaded) {
      return {
        kind: "progress_variation",
        weightKg: null,
        targetReps: item.repMin,
        message:
          metric === "seconds"
            ? `Llegaste al tope (${item.repMax} s) en todas las series: usa una variante más difícil o añade carga.`
            : `Llegaste al tope en todas las series: usa una variante más difícil o añade lastre y vuelve a ${item.repMin} reps.`,
        warning,
      };
    }
    const inc = defaultIncrement(exercise);
    const nextDisplay = round(fromKg(top, unit) + inc, 1);
    const nextKg = toKg(nextDisplay, unit);
    return {
      kind: "increase",
      weightKg: nextKg,
      targetReps: item.repMin,
      message: `¡Tope del rango en todas las series! Sube a ${unitLabel(exercise, unit, nextKg)} y vuelve a ${item.repMin} reps (o usa el salto mínimo disponible).`,
      warning,
    };
  }

  const atTop = loaded ? sets.filter((s) => s.weightKg === top) : sets;
  const minReps = Math.min(...atTop.map((s) => s.reps ?? 0));
  const step = metric === "seconds" ? 5 : 1;
  const target = Math.min(item.repMax, Math.max(item.repMin, minReps + step));
  const plus = metric === "seconds" ? "+5 s" : "+1 repetición";
  return {
    kind: "add_reps",
    weightKg: loaded ? top : null,
    targetReps: target,
    message: loaded
      ? `Mantén ${unitLabel(exercise, unit, top)} e intenta ${plus} (meta: ${target} ${what} en cada serie).`
      : `Intenta ${plus} por serie (meta: ${target} ${what}).`,
    warning,
  };
}
