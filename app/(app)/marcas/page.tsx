"use client";

import { Plus, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Sheet, TextArea, Toggle, parseNum } from "@/components/ui";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { exerciseHistory, exerciseTrend } from "@/lib/analytics/strength";
import { formatWeight, fromKg, round, toKg } from "@/lib/analytics/units";
import { putDoc } from "@/lib/db/write";
import { fmtShortDate } from "@/lib/format";
import type { Exercise, PersonalRecord, WeightUnit } from "@/lib/types";

export default function MarksPage() {
  const data = useData();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [picking, setPicking] = useState(false);

  const rows = useMemo(() => {
    const ids = new Set<string>([...data.records.keys()]);
    for (const s of data.activePlan?.sessions ?? []) if (s.kind === "lifting") for (const it of s.items) ids.add(it.exerciseId);
    return [...ids]
      .map((id) => data.exerciseMap.get(id))
      .filter((e): e is Exercise => !!e)
      .map((ex) => {
        const hist = exerciseHistory(data.workouts, ex.id);
        return { ex, record: data.records.get(ex.id), trend: exerciseTrend(hist), last: hist.at(-1) };
      })
      .sort((a, b) => Number(!!b.record) - Number(!!a.record) || a.ex.name.localeCompare(b.ex.name, "es"));
  }, [data.records, data.activePlan, data.exerciseMap, data.workouts]);


  return (
    <div className="animate-rise space-y-4">
      <PageHeader
        title="Mis marcas"
        subtitle="Cargas iniciales y mejores registros. Puedes dejar campos vacíos y completarlos después."
        action={
          <Button variant="soft" onClick={() => setPicking(true)}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Marca</span>
          </Button>
        }
      />


      <Card>
        <CardHeader title="Ejercicios" subtitle="Inicial = lo que reportaste · Mejor e1RM = estimado de tus sesiones (Epley, heurística)" />
        {rows.length === 0 ? (
          <EmptyState icon={<Trophy className="size-6" />} title="Sin marcas todavía" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ ex, record, trend, last }) => (
              <li key={ex.id}>
                <button type="button" onClick={() => setEditing(ex)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{ex.name}</span>
                    <span className="block text-xs text-muted">
                      {record?.currentWeightKg
                        ? `Inicial: ${formatWeight(record.currentWeightKg, record.enteredUnit)}${record.reps ? ` × ${record.reps}` : ""}${record.perHand ? " por mano" : ""}`
                        : "Inicial: pendiente (primera sesión = calibración)"}
                    </span>
                    {last && (
                      <span className="block text-xs text-muted">
                        Última ({fmtShortDate(last.date)}): {last.topWeightKg ? formatWeight(last.topWeightKg, ex.displayUnit) : "peso corporal"} · {last.totalReps} reps totales
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    {trend.bestE1rmKg ? (
                      <>
                        <span className="num block font-bold">{formatWeight(trend.bestE1rmKg, ex.displayUnit)}</span>
                        <span className="block text-[0.7rem] text-muted">mejor e1RM</span>
                      </>
                    ) : record?.note?.includes("Pendiente") ? (
                      <Badge tone="amber">Por confirmar</Badge>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <RecordEditor key={editing.id} exercise={editing} record={data.records.get(editing.id)} onClose={() => setEditing(null)} />}
      <ExercisePicker open={picking} onClose={() => setPicking(false)} exercises={data.exercises} onPick={(e) => setEditing(e)} title="¿De qué ejercicio?" />
    </div>
  );
}


function RecordEditor({ exercise, record, onClose }: { exercise: Exercise; record?: PersonalRecord; onClose: () => void }) {
  const data = useData();
  const [unit, setUnit] = useState<WeightUnit>(record?.enteredUnit ?? exercise.displayUnit);
  const [value, setValue] = useState(
    record?.enteredValue != null ? String(record.enteredValue) : record?.currentWeightKg ? String(round(fromKg(record.currentWeightKg, unit), 1)) : "",
  );
  const [reps, setReps] = useState(record?.reps != null ? String(record.reps) : "");
  const [perHand, setPerHand] = useState<boolean | null>(record?.perHand ?? null);
  const [note, setNote] = useState(record?.note ?? "");

  return (
    <Sheet
      open
      onClose={onClose}
      title={exercise.name}
      footer={
        <Button
          className="w-full"
          onClick={() => {
            const v = parseNum(value);
            const r = parseNum(reps);
            putDoc(data.uid, "personalRecords", exercise.id, {
              exerciseId: exercise.id,
              currentWeightKg: v == null ? null : toKg(v, unit),
              enteredValue: v,
              enteredUnit: unit,
              reps: r == null ? null : Math.round(r),
              perHand,
              note,
              updatedAt: Date.now(),
            });
            onClose();
          }}
        >
          Guardar marca
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Peso">{(id) => <Input id={id} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Vacío si no lo sabes" />}</Field>
          <Field label="Unidad">
            {(id) => (
              <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)}>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Repeticiones">{(id) => <Input id={id} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Opcional" />}</Field>
        <div className="rounded-2xl bg-sunken px-3">
          <Toggle checked={perHand === true} onChange={(v) => setPerHand(v)} label="El peso es por mano / mancuerna" description={perHand === null ? "Sin confirmar" : undefined} />
        </div>
        <Field label="Notas">{(id) => <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </div>
    </Sheet>
  );
}
