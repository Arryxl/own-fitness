"use client";

import { Clock, Flag, Plus, Trophy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, ProgressBar, Sheet, TextArea } from "@/components/ui";
import { e1rm, exerciseHistory, workingSets } from "@/lib/analytics/strength";
import { formatWeight, round } from "@/lib/analytics/units";
import { newId, patchDoc, putDoc, removeDoc } from "@/lib/db/write";
import { fmtDuration, fmtNum } from "@/lib/format";
import { computeWeeklyStats } from "@/lib/stats";
import type { Exercise, SubstitutionReason, WeightUnit, Workout, WorkoutEntry } from "@/lib/types";
import { blankSet, planItemFor, suggestionFor, workoutProgress } from "@/lib/workout";
import { ExerciseCard } from "./ExerciseCard";
import { ExercisePicker } from "./ExercisePicker";
import { RestTimer, type RestState } from "./RestTimer";
import { SubstituteSheet, type AiSubstitute } from "./SubstituteSheet";

const BACKUP_KEY = "ironlog:active-workout";
const REST_KEY = "ironlog:rest";

function readJSON<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export function WorkoutLogger({ initial }: { initial: Workout }) {
  const data = useData();
  const toast = useToast();
  const router = useRouter();
  const [w, setW] = useState<Workout>(() => {
    // Prefer the local backup if it's newer than what Firestore has.
    const backup = readJSON<Workout>(BACKUP_KEY);
    return backup && backup.id === initial.id && backup.updatedAt > initial.updatedAt ? backup : initial;
  });
  const [expanded, setExpanded] = useState<number>(() => {
    const i = initial.entries.findIndex((e) => e.sets.some((s) => !s.done && !s.isWarmup));
    return i === -1 ? 0 : i;
  });
  const [rest, setRestState] = useState<RestState | null>(() => readJSON<RestState>(REST_KEY));
  const [subFor, setSubFor] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(false);
  const latest = useRef(w);
  useEffect(() => {
    latest.current = w;
  }, [w]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    putDoc(data.uid, "workouts", latest.current.id, { ...latest.current, updatedAt: Date.now() });
  }, [data.uid]);

  // Debounced autosave + local backup on every change.
  useEffect(() => {
    if (!dirty.current) return;
    writeJSON(BACKUP_KEY, { ...w, updatedAt: Date.now() });
    const t = setTimeout(flush, 600);
    return () => clearTimeout(t);
  }, [w, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  function update(next: Workout) {
    dirty.current = true;
    setW(next);
  }

  function setEntry(i: number, e: WorkoutEntry) {
    update({ ...w, entries: w.entries.map((x, j) => (j === i ? e : x)) });
  }

  function setRest(r: RestState | null) {
    setRestState(r);
    writeJSON(REST_KEY, r);
  }

  const others = useMemo(() => data.workouts.filter((x) => x.id !== w.id), [data.workouts, w.id]);

  function substitute(i: number, target: Exercise, reason: SubstitutionReason) {
    const old = w.entries[i];
    const item = planItemFor(data.activePlan, w.sessionKey, old.plannedExerciseId ?? old.exerciseId);
    const s = suggestionFor(item ?? { sets: old.sets.length, repMin: 8, repMax: 12, rirTarget: 2 }, target, others, data.records.get(target.id));
    setEntry(i, {
      exerciseId: target.id,
      plannedExerciseId: old.plannedExerciseId ?? old.exerciseId,
      substitutionReason: reason,
      nameSnapshot: target.name,
      notes: old.notes,
      sets: old.sets.map((_, k) => blankSet(k, target, s.weightKg)),
    });
  }

  function addExercise(ex: Exercise) {
    const s = suggestionFor({ sets: 3, repMin: 8, repMax: 12, rirTarget: 2 }, ex, others, data.records.get(ex.id));
    const entry: WorkoutEntry = {
      exerciseId: ex.id,
      plannedExerciseId: null,
      substitutionReason: null,
      nameSnapshot: ex.name,
      notes: "",
      sets: [0, 1, 2].map((k) => blankSet(k, ex, s.weightKg)),
    };
    update({ ...w, entries: [...w.entries, entry] });
    setExpanded(w.entries.length);
  }

  function changeUnit(ex: Exercise, u: WeightUnit) {
    patchDoc(data.uid, "exercises", ex.id, { displayUnit: u });
  }

  const progress = workoutProgress(w);
  const elapsed = now - w.startedAt;

  return (
    <div className="space-y-3">
      <Card className="sticky top-2 z-20 !p-3 lg:top-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight">{w.sessionName}</h1>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Clock className="size-3.5" /> {fmtDuration(elapsed)} · {progress.done}/{progress.total} series
            </p>
          </div>
          <Button size="sm" onClick={() => setFinishing(true)}>
            <Flag className="size-4" /> Terminar
          </Button>
        </div>
        <div className="mt-2">
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} label="Progreso de la sesión" />
        </div>
      </Card>

      {w.entries.map((entry, i) => {
        const ex = data.exerciseMap.get(entry.exerciseId);
        if (!ex) return null;
        const item = planItemFor(data.activePlan, w.sessionKey, entry.plannedExerciseId ?? entry.exerciseId);
        const effItem = item ?? { sets: entry.sets.length, repMin: 8, repMax: 12, rirTarget: 2, restSec: data.profile?.restTimerDefaultSec ?? 90, exerciseId: ex.id, notes: "" };
        const history = exerciseHistory(others, ex.id);
        return (
          <ExerciseCard
            key={`${i}-${entry.exerciseId}`}
            entry={entry}
            exercise={ex}
            item={item ? { ...item, sets: item.sets } : null}
            last={history.at(-1) ?? null}
            suggestion={suggestionFor(effItem, ex, others, data.records.get(ex.id))}
            expanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? -1 : i)}
            onChange={(e) => setEntry(i, e)}
            onSetDone={(sec) => {
              setRest({ endsAt: Date.now() + sec * 1000, total: sec });
              const after = entry.sets.filter((s) => !s.isWarmup && !s.done).length;
              // Last set of this exercise: open the next one.
              if (after <= 1 && i + 1 < w.entries.length) setTimeout(() => setExpanded(i + 1), 400);
            }}
            onUnitChange={(u) => changeUnit(ex, u)}
            onSubstitute={() => setSubFor(i)}
            onRemove={() => update({ ...w, entries: w.entries.filter((_, j) => j !== i) })}
          />
        );
      })}

      <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
        <Plus className="size-5" /> Añadir ejercicio
      </Button>

      <Card>
        <label className="text-sm font-semibold" htmlFor="session-notes">
          Notas de la sesión
        </label>
        <TextArea id="session-notes" className="mt-2" placeholder="¿Cómo te sentiste? Sueño, energía, molestias…" value={w.notes} onChange={(e) => update({ ...w, notes: e.target.value })} />
      </Card>

      <Button variant="danger" className="w-full" onClick={() => setDiscarding(true)}>
        <Trash2 className="size-4" /> Descartar sesión
      </Button>

      {rest && <div className="h-28" aria-hidden />}
      <RestTimer rest={rest} onChange={setRest} />

      <SubstituteSheet
        open={subFor !== null}
        onClose={() => setSubFor(null)}
        exercise={subFor !== null ? (data.exerciseMap.get(w.entries[subFor]?.exerciseId) ?? null) : null}
        exerciseMap={data.exerciseMap}
        allExercises={data.exercises}
        onPick={(target, reason) => subFor !== null && substitute(subFor, target, reason)}
        onSkip={(reason) => {
          if (subFor === null) return;
          const e = w.entries[subFor];
          update({
            ...w,
            entries: w.entries.filter((_, j) => j !== subFor),
            notes: `${w.notes}${w.notes ? "\n" : ""}Omitido: ${e.nameSnapshot} (${reason === "pain" ? "dolor" : reason}).`,
          });
        }}
        onMarkUnavailable={(ex) => patchDoc(data.uid, "exercises", ex.id, { available: false })}
        onCreateCustom={(s: AiSubstitute, reason) => {
          if (subFor === null) return;
          const base = data.exerciseMap.get(w.entries[subFor].exerciseId)!;
          const id = newId(data.uid, "exercises");
          const ex: Exercise = {
            ...base,
            id,
            name: s.name,
            cues: s.cues,
            available: true,
            spotterFree: true,
            custom: true,
            fallbackChain: [],
            equipment: base.equipment,
          };
          putDoc(data.uid, "exercises", id, ex);
          substitute(subFor, ex, reason);
        }}
      />

      <ExercisePicker open={picker} onClose={() => setPicker(false)} exercises={data.exercises.filter((e) => e.available)} onPick={addExercise} />

      <FinishSheet open={finishing} onClose={() => setFinishing(false)} workout={w} others={others} now={now} onSave={(effort) => {
        const done: Workout = { ...w, status: "completed", endedAt: Date.now(), effort, updatedAt: Date.now() };
        // Remove sets that were never touched so they don't pollute history.
        done.entries = done.entries
          .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done || s.reps != null).map((s, k) => ({ ...s, idx: k })) }))
          .filter((e) => e.sets.length > 0);
        dirty.current = false;
        putDoc(data.uid, "workouts", done.id, done);
        // First time doing an exercise = calibration: save it as the initial mark.
        for (const e of done.entries) {
          if (data.records.has(e.exerciseId) || exerciseHistory(others, e.exerciseId).length > 0) continue;
          const best = workingSets(e.sets).sort((a, b) => (e1rm(b.weightKg, b.reps) ?? 0) - (e1rm(a.weightKg, a.reps) ?? 0))[0];
          if (!best) continue;
          putDoc(data.uid, "personalRecords", e.exerciseId, {
            exerciseId: e.exerciseId,
            currentWeightKg: best.weightKg,
            enteredValue: best.enteredValue,
            enteredUnit: best.enteredUnit,
            reps: best.reps,
            perHand: data.exerciseMap.get(e.exerciseId)?.weightIsPerHand ?? null,
            updatedAt: Date.now(),
            note: `Calibración ${done.date}`,
          });
        }
        const stats = computeWeeklyStats(data, done.date, done);
        putDoc(data.uid, "weeklyStats", stats.id, stats);
        writeJSON(BACKUP_KEY, null);
        writeJSON(REST_KEY, null);
        toast("Sesión guardada 💪", "success");
        router.push("/");
      }} />

      <Sheet
        open={discarding}
        onClose={() => setDiscarding(false)}
        title="¿Descartar la sesión?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDiscarding(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                dirty.current = false;
                removeDoc(data.uid, "workouts", w.id);
                writeJSON(BACKUP_KEY, null);
                writeJSON(REST_KEY, null);
                router.push("/");
              }}
            >
              Descartar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Se borrarán las series registradas en esta sesión. No se puede deshacer.</p>
      </Sheet>
    </div>
  );
}

function FinishSheet({
  open,
  onClose,
  workout,
  others,
  now,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  workout: Workout;
  others: Workout[];
  now: number;
  onSave: (effort: number | null) => void;
}) {
  const data = useData();
  const [effort, setEffort] = useState<number | null>(workout.effort);
  const summary = useMemo(() => {
    let sets = 0;
    let tonnage = 0;
    const prs: string[] = [];
    for (const e of workout.entries) {
      const ws = workingSets(e.sets);
      sets += ws.length;
      tonnage += ws.reduce((t, s) => t + (s.reps ?? 0) * (s.weightKg ?? 0), 0);
      const best = Math.max(0, ...ws.map((s) => e1rm(s.weightKg, s.reps) ?? 0));
      const hist = exerciseHistory(others, e.exerciseId);
      const prev = Math.max(0, ...hist.map((h) => h.e1rmKg ?? 0));
      if (best > 0 && hist.length > 0 && best > prev) {
        const ex = data.exerciseMap.get(e.exerciseId);
        prs.push(`${e.nameSnapshot}: e1RM ${formatWeight(best, ex?.displayUnit ?? "kg")}`);
      }
    }
    return { sets, tonnage: round(tonnage, 0), prs };
  }, [workout, others, data.exerciseMap]);
  const pending = workout.entries.reduce((t, e) => t + e.sets.filter((s) => !s.done && !s.isWarmup).length, 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Terminar sesión"
      footer={
        <Button size="lg" className="w-full" onClick={() => onSave(effort)}>
          Guardar sesión
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-sunken p-3">
          <div className="num text-xl font-extrabold">{summary.sets}</div>
          <div className="text-xs text-muted">series</div>
        </div>
        <div className="rounded-2xl bg-sunken p-3">
          <div className="num text-xl font-extrabold">{fmtNum(summary.tonnage, 0)}</div>
          <div className="text-xs text-muted">kg movidos</div>
        </div>
        <div className="rounded-2xl bg-sunken p-3">
          <div className="num text-xl font-extrabold">{fmtDuration(now - workout.startedAt)}</div>
          <div className="text-xs text-muted">duración</div>
        </div>
      </div>
      {pending > 0 && <p className="mt-3 rounded-2xl bg-amber-soft px-3 py-2 text-sm text-amber">Quedan {pending} series sin marcar; las vacías no se guardarán.</p>}
      {summary.prs.length > 0 && (
        <div className="mt-3 rounded-2xl bg-primary-soft p-3 text-sm text-primary-strong">
          <p className="flex items-center gap-2 font-bold">
            <Trophy className="size-4" /> ¡Nuevos mejores estimados!
          </p>
          <ul className="mt-1 list-inside list-disc">
            {summary.prs.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-sm font-semibold">Esfuerzo de la sesión (1-10)</p>
      <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Esfuerzo de la sesión">
        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={effort === n}
            onClick={() => setEffort(n)}
            className={`num h-12 rounded-xl text-base font-bold ${effort === n ? "bg-primary text-on-primary" : "bg-sunken"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
