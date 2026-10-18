"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { VolumeBars } from "@/components/charts/VolumeBars";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, IconButton, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { planVolume } from "@/lib/analytics/volume";
import { patchProfile, putDoc } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import type { Plan, PlanItem, PlanSession } from "@/lib/types";

export default function PlansPage() {
  const data = useData();
  const [planId, setPlanId] = useState(data.activePlan?.id ?? data.plans[0]?.id ?? "");
  const plan = data.plans.find((p) => p.id === planId) ?? null;
  const [editing, setEditing] = useState<PlanSession | null>(null);
  const hasFloating = !!plan?.sessions.some((s) => s.kind === "floating");
  const [withFloat, setWithFloat] = useState<"yes" | "no">("yes");

  const volume = useMemo(
    () => (plan ? planVolume(plan, data.exerciseMap, { includeFloating: withFloat === "yes" }) : {}),
    [plan, data.exerciseMap, withFloat],
  );

  if (!plan) return <PageHeader title="Planes" subtitle="No hay planes" />;
  const isActive = data.activePlan?.id === plan.id;

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Planes" subtitle="Plantillas editables; el volumen se recalcula al instante" />
      <Segmented label="Plan" value={planId} onChange={setPlanId} options={data.plans.map((p) => ({ value: p.id, label: `${p.daysPerWeek} días` }))} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{plan.name}</h2>
            {isActive ? <Badge tone="primary">Plan activo</Badge> : <Badge>Inactivo</Badge>}
          </div>
          {!isActive && (
            <Button onClick={() => patchProfile(data.uid, { activePlanId: plan.id })}>
              <Check className="size-4" /> Usar este plan
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          {plan.sessions.map((s) => (
            <Card key={s.key}>
              <CardHeader
                title={s.name}
                subtitle={s.weekday ? WEEKDAY_LONG[s.weekday - 1] : s.kind === "floating" ? "Flotante: martes o jueves" : "Opcional en casa"}
                action={
                  <Button size="sm" variant="soft" onClick={() => setEditing(s)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                }
              />
              <ol className="space-y-1 text-sm">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-5 text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1">{data.exerciseMap.get(it.exerciseId)?.name ?? it.exerciseId}</span>
                    <span className="num shrink-0 text-muted">
                      {it.sets}×{it.repMin}-{it.repMax}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
        <Card className="h-fit lg:sticky lg:top-8">
          <CardHeader title="Volumen semanal planeado" subtitle="Series duras por músculo" />
          {hasFloating && (
            <Segmented
              className="mb-3"
              label="Incluir día flotante"
              value={withFloat}
              onChange={setWithFloat}
              options={[
                { value: "yes", label: "Con día extra" },
                { value: "no", label: "Solo L-M-V" },
              ]}
            />
          )}
          <VolumeBars sets={volume} />
        </Card>
      </div>

      {editing && <SessionEditor key={editing.key} plan={plan} session={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function SessionEditor({ plan, session, onClose }: { plan: Plan; session: PlanSession; onClose: () => void }) {
  const data = useData();
  const [d, setD] = useState<PlanSession>(session);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; index: number } | null>(null);
  const setItem = (i: number, patch: Partial<PlanItem>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i: number, dir: -1 | 1) =>
    setD((x) => {
      const items = [...x.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return x;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...x, items };
    });

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Editar: ${session.name}`}
      footer={
        <Button
          className="w-full"
          onClick={() => {
            putDoc(data.uid, "plans", plan.id, { ...plan, sessions: plan.sessions.map((s) => (s.key === d.key ? d : s)) });
            onClose();
          }}
        >
          Guardar sesión
        </Button>
      }
    >
      <div className="space-y-3">
        <Input aria-label="Nombre de la sesión" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
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
          </div>
        ))}
        <Button variant="outline" className="w-full" onClick={() => setPicker({ mode: "add" })}>
          <Plus className="size-4" /> Añadir ejercicio
        </Button>
      </div>
      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        exercises={data.exercises}
        onPick={(e) => {
          if (picker?.mode === "swap") setItem(picker.index, { exerciseId: e.id });
          else setD((x) => ({ ...x, items: [...x.items, { exerciseId: e.id, sets: 3, repMin: 8, repMax: 12, restSec: e.isCompound ? 120 : 75, rirTarget: 2, notes: "" }] }));
        }}
      />
    </Sheet>
  );
}
