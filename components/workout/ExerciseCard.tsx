"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Lightbulb,
  MessageSquare,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge, Button, IconButton, TextArea } from "@/components/ui";
import type { ProgressionSuggestion } from "@/lib/analytics/progression";
import type { ExerciseSession } from "@/lib/analytics/strength";
import { formatWeight, fromKg, round, toKg } from "@/lib/analytics/units";
import { REASON_LABEL } from "@/lib/format";
import type { Exercise, PlanItem, WeightUnit, WorkoutEntry, WorkoutSet } from "@/lib/types";

function shownValue(s: WorkoutSet, unit: WeightUnit): string {
  if (s.enteredValue != null && s.enteredUnit === unit) return String(s.enteredValue);
  if (s.weightKg == null) return "";
  return String(round(fromKg(s.weightKg, unit), 1));
}

function parse(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function lastLabel(last: ExerciseSession | null, ex: Exercise): string | null {
  if (!last || last.sets.length === 0) return null;
  const unit = ex.displayUnit;
  const parts = last.sets.map((s) => {
    const r = `${s.reps}${ex.metric === "seconds" ? " s" : ""}`;
    return s.weightKg ? `${r} × ${formatWeight(s.weightKg, unit).replace(` ${unit}`, "")}` : r;
  });
  return `${parts.join(" · ")}${last.topWeightKg ? ` ${unit}` : ""}`;
}

export function ExerciseCard({
  entry,
  exercise,
  item,
  last,
  suggestion,
  expanded,
  onToggle,
  onChange,
  onSetDone,
  onUnitChange,
  onSubstitute,
  onRemove,
}: {
  entry: WorkoutEntry;
  exercise: Exercise;
  item: PlanItem | null;
  last: ExerciseSession | null;
  suggestion: ProgressionSuggestion | null;
  expanded: boolean;
  onToggle: () => void;
  onChange: (e: WorkoutEntry) => void;
  onSetDone: (restSec: number) => void;
  onUnitChange: (u: WeightUnit) => void;
  onSubstitute: () => void;
  onRemove: () => void;
}) {
  const [showNotes, setShowNotes] = useState(!!entry.notes);
  const unit = exercise.displayUnit;
  const working = entry.sets.filter((s) => !s.isWarmup);
  const done = working.filter((s) => s.done).length;
  const complete = working.length > 0 && done === working.length;
  const substituted = !!entry.plannedExerciseId && entry.plannedExerciseId !== entry.exerciseId;
  const isTimed = exercise.metric === "seconds";
  const unloaded = exercise.equipment.includes("bodyweight") && !exercise.equipment.some((e) => e !== "bodyweight" && e !== "bench");
  const lastText = lastLabel(last, exercise);

  function setSet(i: number, patch: Partial<WorkoutSet>) {
    onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  function setWeight(i: number, v: string) {
    const n = parse(v);
    setSet(i, { enteredValue: n, enteredUnit: unit, weightKg: n == null ? null : toKg(n, unit) });
  }

  function toggleDone(i: number) {
    const s = entry.sets[i];
    const next = !s.done;
    // Marking done with empty reps fills in the target so one tap is enough.
    const reps = s.reps ?? (next ? suggestion?.targetReps ?? item?.repMin ?? null : null);
    setSet(i, { done: next, reps });
    if (next && !s.isWarmup) onSetDone(item?.restSec ?? 90);
  }

  function addSet(copyLast: boolean) {
    const prev = entry.sets.at(-1);
    const base: WorkoutSet =
      copyLast && prev
        ? { ...prev, idx: entry.sets.length, done: false }
        : { idx: entry.sets.length, reps: null, weightKg: prev?.weightKg ?? null, enteredValue: prev?.enteredValue ?? null, enteredUnit: prev?.enteredUnit ?? unit, rir: null, isWarmup: false, done: false };
    onChange({ ...entry, sets: [...entry.sets, base] });
  }

  function copyPrevInto(i: number) {
    const prev = entry.sets[i - 1];
    if (!prev) return;
    setSet(i, { reps: prev.reps, weightKg: prev.weightKg, enteredValue: prev.enteredValue, enteredUnit: prev.enteredUnit, rir: prev.rir });
  }

  return (
    <article className={clsx("glass overflow-hidden rounded-[var(--radius-card)] transition", complete && "opacity-90")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className={clsx(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold",
            complete ? "bg-primary text-on-primary" : "bg-primary-soft text-primary-strong",
          )}
        >
          {complete ? <Check className="size-5" /> : `${done}/${working.length}`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-tight">{exercise.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {item ? `${item.sets} × ${item.repMin}-${item.repMax}${isTimed ? " s" : ""} · RIR ${item.rirTarget}` : "Ejercicio añadido"}
            {lastText ? ` · Última: ${lastText}` : ""}
          </span>
        </span>
        {substituted && <Badge tone="violet">Sustituto</Badge>}
        <ChevronDown className={clsx("size-5 shrink-0 text-muted transition", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {substituted && entry.substitutionReason && (
            <p className="text-xs text-violet">Sustituye al plan por: {REASON_LABEL[entry.substitutionReason]}</p>
          )}
          {!exercise.spotterFree && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-soft px-3 py-2 text-sm text-amber">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Requiere compañero o topes de seguridad. Si entrenas solo, usa una alternativa.
            </p>
          )}
          {suggestion && (
            <div className="rounded-2xl bg-primary-soft px-3 py-2 text-sm text-primary-strong">
              <p className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0" />
                <span>{suggestion.message}</span>
              </p>
              {suggestion.warning && <p className="mt-1 pl-6 text-xs">{suggestion.warning}</p>}
            </div>
          )}
          {exercise.cues && <p className="text-xs text-muted">💡 {exercise.cues}</p>}

          {!unloaded && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">{exercise.weightIsPerHand ? "Peso por mano / mancuerna" : "Peso total"}</span>
              <div className="flex rounded-full bg-sunken p-0.5" role="group" aria-label="Unidad de peso">
                {(["lb", "kg"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => onUnitChange(u)}
                    className={clsx("min-h-9 min-w-12 rounded-full px-3 text-sm font-bold", unit === u ? "bg-surface-strong text-ink shadow-sm" : "text-muted")}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_3.25rem] items-center gap-2 px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              <span>Serie</span>
              <span>{unloaded ? "Lastre" : unit}</span>
              <span>{isTimed ? "Seg" : "Reps"}</span>
              <span>RIR</span>
              <span className="sr-only">Hecha</span>
            </div>
            {entry.sets.map((s, i) => (
              <div
                key={i}
                className={clsx(
                  "grid grid-cols-[2rem_1fr_1fr_3.5rem_3.25rem] items-center gap-2 rounded-2xl p-1 transition",
                  s.done && "bg-primary-soft/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSet(i, { isWarmup: !s.isWarmup })}
                  title="Tocar para marcar como calentamiento"
                  aria-label={s.isWarmup ? `Serie ${i + 1}: calentamiento. Tocar para marcar efectiva` : `Serie ${i + 1}. Tocar para marcar calentamiento`}
                  className={clsx("flex h-12 items-center justify-center rounded-xl text-sm font-bold", s.isWarmup ? "bg-amber-soft text-amber" : "text-muted")}
                >
                  {s.isWarmup ? "C" : i + 1 - entry.sets.slice(0, i).filter((x) => x.isWarmup).length}
                </button>
                <input
                  inputMode="decimal"
                  enterKeyHint="next"
                  aria-label={`Peso serie ${i + 1} en ${unit}`}
                  placeholder={suggestion?.weightKg ? String(round(fromKg(suggestion.weightKg, unit), 1)) : "—"}
                  value={shownValue(s, unit)}
                  onChange={(e) => setWeight(i, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="num h-12 w-full min-w-0 rounded-xl border border-line bg-surface-strong text-center text-lg font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  aria-label={`${isTimed ? "Segundos" : "Repeticiones"} serie ${i + 1}`}
                  placeholder={String(suggestion?.targetReps ?? item?.repMin ?? "")}
                  value={s.reps ?? ""}
                  onChange={(e) => {
                    const n = parse(e.target.value);
                    setSet(i, { reps: n == null ? null : Math.round(n) });
                  }}
                  onFocus={(e) => e.target.select()}
                  className="num h-12 w-full min-w-0 rounded-xl border border-line bg-surface-strong text-center text-lg font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <select
                  aria-label={`RIR serie ${i + 1} (repeticiones en reserva)`}
                  value={s.rir ?? ""}
                  onChange={(e) => setSet(i, { rir: e.target.value === "" ? null : Number(e.target.value) })}
                  className="num h-12 w-full appearance-none rounded-xl border border-line bg-surface-strong text-center text-base font-semibold outline-none focus:border-primary"
                >
                  <option value="">–</option>
                  {[0, 1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => toggleDone(i)}
                  aria-pressed={s.done}
                  aria-label={s.done ? `Serie ${i + 1} hecha. Tocar para desmarcar` : `Marcar serie ${i + 1} como hecha`}
                  className={clsx(
                    "flex h-12 items-center justify-center rounded-xl transition active:scale-95",
                    s.done ? "bg-primary text-on-primary" : "border-2 border-primary/40 text-primary",
                  )}
                >
                  <Check className="size-6" strokeWidth={3} />
                </button>
                {i > 0 && !s.done && s.reps == null && s.enteredValue == null && (
                  <button type="button" onClick={() => copyPrevInto(i)} className="col-span-5 -mt-1 flex items-center gap-1 justify-self-start px-2 text-xs font-semibold text-primary">
                    <Copy className="size-3.5" /> Copiar serie anterior
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" onClick={() => addSet(true)}>
              <Plus className="size-4" /> Serie
            </Button>
            {entry.sets.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => onChange({ ...entry, sets: entry.sets.slice(0, -1) })}>
                <Trash2 className="size-4" /> Quitar serie
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowNotes((v) => !v)}>
              <MessageSquare className="size-4" /> Nota
            </Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={onSubstitute}>
              <Repeat2 className="size-4" /> No puedo hacer este
            </Button>
          </div>
          {showNotes && (
            <TextArea
              aria-label="Notas del ejercicio"
              placeholder="Ej.: asiento en 4, agarre neutro, molestia leve en hombro…"
              value={entry.notes}
              onChange={(e) => onChange({ ...entry, notes: e.target.value })}
            />
          )}
          <div className="flex justify-end">
            <IconButton label="Quitar ejercicio de esta sesión" className="size-10 text-muted" onClick={onRemove}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>
      )}
    </article>
  );
}
