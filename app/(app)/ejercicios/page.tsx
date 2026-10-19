"use client";

import { ArrowDown, ArrowUp, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Field, IconButton, Input, PageHeader, Select, Sheet, TextArea, Toggle, parseNum } from "@/components/ui";
import { ExerciseDemo, ExerciseThumb } from "@/components/workout/ExerciseDemo";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { putDoc, removeDoc } from "@/lib/db/write";
import { createCustomExercise, saveOverride } from "@/lib/db/overrides";
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from "@/lib/format";
import type { Equipment, Exercise, Muscle } from "@/lib/types";

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

export default function ExercisesPage() {
  const data = useData();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = data.exercises.filter((e) => (!t || e.name.toLowerCase().includes(t)) && (!onlyMissing || !e.available));
    const by = new Map<Muscle, Exercise[]>();
    for (const e of list) by.set(e.primaryMuscle, [...(by.get(e.primaryMuscle) ?? []), e]);
    return MUSCLES.filter((m) => by.has(m)).map((m) => ({ muscle: m, items: by.get(m)! }));
  }, [data.exercises, q, onlyMissing]);

  function blank(): Exercise {
    return {
      id: "",
      name: "",
      family: "otro",
      primaryMuscle: "chest",
      secondaryMuscles: [],
      equipment: ["machine"],
      spotterFree: true,
      isCompound: false,
      metric: "reps",
      cues: "",
      displayUnit: "lb",
      weightIsPerHand: false,
      available: true,
      fallbackChain: [],
      custom: true,
      overridden: true,
    };
  }

  return (
    <div className="animate-rise space-y-4">
      <PageHeader
        title="Ejercicios"
        subtitle="Marca qué equipo existe en tu gimnasio y edita las alternativas"
        action={
          <Button onClick={() => setEditing(blank())}>
            <Plus className="size-5" /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-10" aria-label="Buscar ejercicio" />
      </div>
      <Toggle checked={onlyMissing} onChange={setOnlyMissing} label="Solo los marcados como no disponibles" />

      {groups.map(({ muscle, items }) => (
        <section key={muscle}>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted">{MUSCLE_LABEL[muscle]}</h2>
          <ul className="glass divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
            {items.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing(e)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-sunken">
                  <ExerciseThumb exerciseId={e.id} />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${e.available ? "" : "text-muted line-through"}`}>{e.name}</span>
                    <span className="block text-xs text-muted">
                      {e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(", ")} · {e.fallbackChain.length} alternativas · {e.displayUnit}
                    </span>
                  </span>
                  {!e.spotterFree && <Badge tone="amber">Compañero</Badge>}
                  {e.custom && <Badge tone="violet">Propio</Badge>}
                  <ChevronRight className="size-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <ExerciseEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExerciseEditor({ initial, onClose }: { initial: Exercise; onClose: () => void }) {
  const data = useData();
  const [d, setD] = useState<Exercise>(initial);
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<Exercise>) => setD((x) => ({ ...x, ...patch }));
  const isNew = !initial.id;
  const custom = d.custom;
  const catalogEntry = data.catalog.exercises.find((c) => c.id === d.id);

  function persist() {
    const def = {
      name: d.name.trim(),
      family: d.family,
      primaryMuscle: d.primaryMuscle,
      secondaryMuscles: d.secondaryMuscles,
      equipment: d.equipment,
      spotterFree: d.spotterFree,
      isCompound: d.isCompound,
      weightIsPerHand: d.weightIsPerHand,
      displayUnit: d.displayUnit,
      cues: d.cues,
      fallbackChain: d.fallbackChain,
    };
    if (isNew) return void createCustomExercise(data.uid, def);
    if (custom) return void putDoc(data.uid, "exerciseOverrides", d.id, { id: d.id, userModified: true, custom: def, available: d.available, displayUnit: d.displayUnit, updatedAt: Date.now() });
    // Catalog exercise: store only what differs from the catalog entry.
    saveOverride(data.uid, d.id, {
      available: d.available,
      displayUnit: d.displayUnit,
      fallbackChain: d.fallbackChain,
      ...(d.name.trim() !== catalogEntry?.name ? { name: d.name.trim() } : {}),
      ...(d.cues !== catalogEntry?.cues ? { cues: d.cues } : {}),
      increment: d.increment ?? null,
    });
  }

  function moveLink(i: number, dir: -1 | 1) {
    const c = [...d.fallbackChain];
    const j = i + dir;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    set({ fallbackChain: c });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nuevo ejercicio" : "Editar ejercicio"}
      footer={
        <Button
          className="w-full"
          disabled={!d.name.trim()}
          onClick={() => {
            persist();
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        {!isNew && <ExerciseDemo exerciseId={d.id} name={d.name} />}
        {!custom && d.overridden && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              removeDoc(data.uid, "exerciseOverrides", d.id);
              onClose();
            }}
          >
            Restaurar valores originales del catálogo
          </Button>
        )}
        {!custom && <p className="text-xs text-muted">Ejercicio del catálogo: puedes cambiar nombre, unidad, disponibilidad, notas y alternativas. Músculos y equipo vienen del catálogo.</p>}
        <Field label="Nombre">{(id) => <Input id={id} value={d.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Músculo principal">
            {(id) => (
              <Select id={id} disabled={!custom} value={d.primaryMuscle} onChange={(e) => set({ primaryMuscle: e.target.value as Muscle })}>
                {MUSCLES.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_LABEL[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Unidad">
            {(id) => (
              <Select id={id} value={d.displayUnit} onChange={(e) => set({ displayUnit: e.target.value as "kg" | "lb" })}>
                <option value="lb">Libras (lb)</option>
                <option value="kg">Kilos (kg)</option>
              </Select>
            )}
          </Field>
        </div>
        <fieldset disabled={!custom} className="disabled:opacity-60">
          <legend className="text-sm font-semibold">Músculos secundarios</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== d.primaryMuscle).map((m) => {
              const on = d.secondaryMuscles.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ secondaryMuscles: on ? d.secondaryMuscles.filter((x) => x !== m) : [...d.secondaryMuscles, m] })}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ${on ? "bg-primary text-on-primary" : "bg-sunken text-muted"}`}
                >
                  {MUSCLE_LABEL[m]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset disabled={!custom} className="disabled:opacity-60">
          <legend className="text-sm font-semibold">Equipo</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EQUIPMENT.map((q) => {
              const on = d.equipment.includes(q);
              return (
                <button
                  key={q}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ equipment: on ? d.equipment.filter((x) => x !== q) : [...d.equipment, q] })}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ${on ? "bg-primary text-on-primary" : "bg-sunken text-muted"}`}
                >
                  {EQUIPMENT_LABEL[q]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="rounded-2xl bg-sunken px-3">
          <Toggle checked={d.available} onChange={(v) => set({ available: v })} label="Existe en mi gimnasio" />
          <Toggle checked={d.spotterFree} onChange={(v) => set({ spotterFree: v })} label="Seguro sin compañero" />
          <Toggle checked={d.weightIsPerHand} onChange={(v) => set({ weightIsPerHand: v })} label="Peso por mano (mancuernas)" />
          <Toggle checked={d.metric === "seconds"} onChange={(v) => set({ metric: v ? "seconds" : "reps" })} label="Se mide en segundos" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Salto mínimo (${d.displayUnit})`} hint="Vacío = automático">
            {(id) => <Input id={id} inputMode="decimal" value={d.increment ?? ""} onChange={(e) => set({ increment: parseNum(e.target.value) ?? undefined })} />}
          </Field>
          <Field label="Familia (patrón)">{(id) => <Input id={id} value={d.family} onChange={(e) => set({ family: e.target.value })} />}</Field>
        </div>
        <Field label="Notas técnicas">{(id) => <TextArea id={id} value={d.cues} onChange={(e) => set({ cues: e.target.value })} />}</Field>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Si no puedes este → prueba (en orden)</h3>
            <Button size="sm" variant="soft" onClick={() => setPicking(true)}>
              <Plus className="size-4" /> Añadir
            </Button>
          </div>
          <ol className="mt-2 space-y-2">
            {d.fallbackChain.map((l, i) => (
              <li key={`${l.exerciseId}-${i}`} className="rounded-2xl border border-line bg-surface-strong p-2">
                <div className="flex items-center gap-1">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{data.exerciseMap.get(l.exerciseId)?.name ?? l.exerciseId}</span>
                  <IconButton label="Subir" className="size-10" onClick={() => moveLink(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton label="Bajar" className="size-10" onClick={() => moveLink(i, 1)} disabled={i === d.fallbackChain.length - 1}>
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton label="Quitar" className="size-10 text-danger" onClick={() => set({ fallbackChain: d.fallbackChain.filter((_, j) => j !== i) })}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
                <Input
                  aria-label="Condición"
                  className="mt-2 min-h-10 text-sm"
                  value={l.when}
                  placeholder="Ej.: si la máquina está ocupada más de 3 min"
                  onChange={(e) => set({ fallbackChain: d.fallbackChain.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)) })}
                />
              </li>
            ))}
            {d.fallbackChain.length === 0 && <li className="text-sm text-muted">Sin alternativas todavía.</li>}
          </ol>
        </section>
      </div>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        exercises={data.exercises.filter((e) => e.id !== d.id && !d.fallbackChain.some((l) => l.exerciseId === e.id))}
        onPick={(e) => set({ fallbackChain: [...d.fallbackChain, { exerciseId: e.id, when: "Si el anterior no está disponible" }] })}
        title="Añadir alternativa"
      />
    </Sheet>
  );
}
