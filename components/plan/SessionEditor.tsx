"use client";

import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { Button, Field, IconButton, Input, Segmented, Select, Sheet, Toggle } from "@/components/ui";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { savePlan } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import type { BlockPlace, Plan, PlanItem, PlanSession, RepUnit } from "@/lib/types";
import { BLOCK_PLACES, PLACE_LABEL, exerciseFitsPlace, itemFor, placeOf } from "@/lib/week";

function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

/**
 * Edits one session of a plan, or a new extra block when `isNew`. Changes are
 * saved to the plan only on "Guardar".
 */
export function SessionEditor({ plan, session, isNew = false, onClose }: { plan: Plan; session: PlanSession; isNew?: boolean; onClose: () => void }) {
  const data = useData();
  const [d, setD] = useState<PlanSession>(session);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; index: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const place = placeOf(d);
  const rotating = plan.rotation === "alternate";
  // In a rotating plan the plan's own sessions have no weekday: only extra blocks get one.
  const canPickDay = !rotating || !!d.extra;
  const pickable = useMemo(() => data.exercises.filter((e) => place === "gym" || exerciseFitsPlace(e, place)), [data.exercises, place]);

  const setItem = (i: number, patch: Partial<PlanItem>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i: number, dir: -1 | 1) =>
    setD((x) => {
      const items = [...x.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return x;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...x, items };
    });

  function save() {
    const next = { ...d, name: d.name.trim() || "Bloque extra" };
    const sessions = isNew ? [...plan.sessions, next] : plan.sessions.map((s) => (s.key === next.key ? next : s));
    savePlan(data.uid, { ...plan, sessions });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nuevo bloque" : `Editar: ${session.name}`}
      footer={
        <div className="flex gap-2">
          {!isNew && d.extra && (
            <Button
              variant="danger"
              onClick={() =>
                confirmDelete ? (savePlan(data.uid, { ...plan, sessions: plan.sessions.filter((s) => s.key !== d.key) }), onClose()) : setConfirmDelete(true)
              }
            >
              <Trash2 className="size-4" /> {confirmDelete ? "¿Seguro?" : "Quitar"}
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={d.items.length === 0}>
            {isNew ? "Añadir a mi semana" : "Guardar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">{(id) => <Input id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          {canPickDay && (
            <Field label="Día">
              {(id) => (
                <Select id={id} value={d.weekday ?? ""} onChange={(e) => setD({ ...d, weekday: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sin día fijo</option>
                  {WEEKDAY_LONG.map((w, i) => (
                    <option key={w} value={i + 1}>
                      {w}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Minutos aprox.">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                value={d.estimatedMinutes}
                onChange={(e) => setD({ ...d, estimatedMinutes: num(e.target.value, d.estimatedMinutes) })}
              />
            )}
          </Field>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Dónde</p>
          <Segmented<BlockPlace>
            label="Dónde"
            value={place}
            onChange={(v) => setD({ ...d, place: v })}
            options={BLOCK_PLACES.map((p) => ({ value: p, label: PLACE_LABEL[p] }))}
          />
          {place !== "gym" && (
            <p className="mt-1 text-xs text-muted">
              Al añadir ejercicios solo verás los que se pueden hacer en{" "}
              {place === "home" ? "casa (peso corporal, mancuernas, bandas)" : "la calle o un parque"}.
            </p>
          )}
        </div>
        {d.extra && (
          <div>
            <p className="mb-1 text-sm font-semibold">Tipo</p>
            <Segmented<"lifting" | "cardio">
              label="Tipo"
              value={d.kind}
              onChange={(v) => setD({ ...d, kind: v })}
              options={[
                { value: "lifting", label: "Fuerza / core" },
                { value: "cardio", label: "Cardio" },
              ]}
            />
          </div>
        )}
        {!rotating && (
          <div className="rounded-2xl bg-sunken px-3">
            <Toggle
              label="Cuenta como día de entrenamiento"
              description="Si está activo, suma a tu asistencia y racha. Los bloques extra cortos normalmente no."
              checked={!d.extra}
              onChange={(on) => setD({ ...d, extra: !on })}
            />
          </div>
        )}

        <p className="pt-1 text-sm font-semibold">Ejercicios</p>
        {d.items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface-strong p-3">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-semibold">{data.exerciseMap.get(it.exerciseId)?.name ?? it.exerciseId}</span>
              <IconButton label="Cambiar ejercicio" className="size-10" onClick={() => setPicker({ mode: "swap", index: i })}>
                <RefreshCw className="size-4" />
              </IconButton>
              <IconButton label="Subir" className="size-10" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Bajar" className="size-10" onClick={() => move(i, 1)} disabled={i === d.items.length - 1}>
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton label="Quitar" className="size-10 text-danger" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[0.7rem] font-semibold text-muted">
              {(
                [
                  ["Series", "sets"],
                  ["Mín", "repMin"],
                  ["Máx", "repMax"],
                  ["RIR", "rirTarget"],
                  ["Desc. s", "restSec"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex flex-col gap-1">
                  {label}
                  <input
                    inputMode="numeric"
                    value={it[key]}
                    onChange={(e) => setItem(i, { [key]: num(e.target.value, it[key]) } as Partial<PlanItem>)}
                    className="num h-11 rounded-xl border border-line bg-surface text-center text-base font-bold text-ink outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <Select
              aria-label="Unidad del rango"
              className="mt-2 min-h-10 text-sm"
              value={it.repUnit}
              onChange={(e) => setItem(i, { repUnit: e.target.value as RepUnit })}
            >
              <option value="reps">Repeticiones</option>
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
            </Select>
          </div>
        ))}
        {d.items.length === 0 && <p className="text-sm text-muted">Añade al menos un ejercicio.</p>}
        <Button variant="outline" className="w-full" onClick={() => setPicker({ mode: "add" })}>
          <Plus className="size-4" /> Añadir ejercicio
        </Button>
      </div>
      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        exercises={pickable}
        onPick={(e) => {
          if (picker?.mode === "swap") setItem(picker.index, { exerciseId: e.id });
          else setD((x) => ({ ...x, items: [...x.items, itemFor(e)] }));
        }}
      />
    </Sheet>
  );
}
