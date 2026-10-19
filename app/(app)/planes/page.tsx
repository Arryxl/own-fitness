"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { VolumeBars } from "@/components/charts/VolumeBars";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, Input, LinkButton, PageHeader, Select, Sheet, Toggle } from "@/components/ui";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { planVolume } from "@/lib/analytics/volume";
import { patchProfile, removeDoc, savePlan } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import { VARIANT_LABEL, applyVariant, templateVariants } from "@/lib/plans";
import type { Plan, PlanItem, PlanSession, RepUnit } from "@/lib/types";

export default function PlansPage() {
  const data = useData();
  const [planId, setPlanId] = useState(data.activePlan?.id ?? data.plans[0]?.id ?? "");
  const plan = data.plans.find((p) => p.id === planId) ?? data.plans[0] ?? null;
  const [editing, setEditing] = useState<PlanSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const template = data.templates.find((t) => t.id === plan?.sourceTemplateId) ?? null;

  const volume = useMemo(() => (plan ? planVolume(plan, data.exerciseMap) : {}), [plan, data.exerciseMap]);

  if (!plan)
    return (
      <div className="animate-rise">
        <PageHeader title="Planes" />
        <Card>
          <EmptyState title="Aún no tienes planes" action={<LinkButton href="/rutinas">Elegir una rutina</LinkButton>}>
            Copia una de las plantillas de la biblioteca y edítala a tu gusto.
          </EmptyState>
        </Card>
      </div>
    );
  const isActive = data.activePlan?.id === plan.id;
  const save = (next: Plan) => savePlan(data.uid, next);

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Planes" subtitle="Tus copias editables; el volumen se recalcula al instante" action={<LinkButton href="/rutinas" variant="soft">Biblioteca</LinkButton>} />
      {data.plans.length > 1 && (
        <Select aria-label="Plan" value={plan.id} onChange={(e) => setPlanId(e.target.value)}>
          {data.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === data.activePlan?.id ? " (activo)" : ""}
            </option>
          ))}
        </Select>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {isActive ? <Badge tone="primary">Plan activo</Badge> : <Badge>Inactivo</Badge>}
              {plan.sourceTemplateId && <Badge>Plantilla {plan.sourceTemplateId}</Badge>}
              {plan.rotation === "alternate" && <Badge tone="violet">Rotación A/B desde {plan.startDate}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {!isActive && (
              <Button onClick={() => patchProfile(data.uid, { activePlanId: plan.id })}>
                <Check className="size-4" /> Usar este plan
              </Button>
            )}
            <IconButton label="Borrar plan" className="text-danger" onClick={() => setDeleting(true)}>
              <Trash2 className="size-5" />
            </IconButton>
          </div>
        </div>
        {template && templateVariants(template).length > 1 && (
          <div className="mt-4">
            <label className="text-sm font-semibold" htmlFor="variant">
              Calendario
            </label>
            <Select id="variant" className="mt-1" value={plan.weekdayVariant ?? ""} onChange={(e) => save(applyVariant(plan, template, e.target.value))}>
              {templateVariants(template).map((v) => (
                <option key={v} value={v}>
                  {VARIANT_LABEL[v] ?? v}
                </option>
              ))}
            </Select>
          </div>
        )}
        {data.addOns.length > 0 && (
          <div className="mt-4 rounded-2xl bg-sunken px-3">
            {data.addOns.map((a) => (
              <Toggle
                key={a.id}
                label={`${a.name}${plan.recommendedAddOns.includes(a.id) ? " · recomendado" : ""}`}
                description={a.appliesTo}
                checked={plan.enabledAddOns.includes(a.id)}
                onChange={(on) => save({ ...plan, enabledAddOns: on ? [...plan.enabledAddOns, a.id] : plan.enabledAddOns.filter((x) => x !== a.id) })}
              />
            ))}
          </div>
        )}
        {plan.progressionRules.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Reglas de progresión</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              {plan.progressionRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          {plan.sessions.map((s) => (
            <Card key={s.key}>
              <CardHeader
                title={`${s.key} · ${s.name}`}
                subtitle={
                  s.weekday ? WEEKDAY_LONG[s.weekday - 1] : plan.rotation === "alternate" ? "Alterna con la otra sesión" : s.optional || s.floating ? "Opcional / sin día fijo" : "Sin día asignado"
                }
                action={
                  <Button size="sm" variant="soft" onClick={() => setEditing(s)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                }
              />
              <ol className="space-y-1 text-sm">
                {s.items.map((it, i) => {
                  const ex = data.exerciseMap.get(it.exerciseId);
                  return (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 text-muted">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        {ex?.name ?? it.exerciseId}
                        {ex && !ex.available && <span className="text-xs text-amber"> · no disponible (se usará su alternativa)</span>}
                      </span>
                      <span className="num shrink-0 text-muted">
                        {it.sets}×{it.repMin === it.repMax ? it.repMin : `${it.repMin}-${it.repMax}`}
                        {it.repUnit === "seconds" ? "s" : it.repUnit === "minutes" ? " min" : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ))}
        </div>
        <Card className="h-fit lg:sticky lg:top-8">
          <CardHeader title="Volumen semanal planeado" subtitle="Series por músculo (secundarios cuentan ½)" />
          <VolumeBars sets={volume} />
        </Card>
      </div>

      {editing && <SessionEditor key={editing.key} plan={plan} session={editing} onClose={() => setEditing(null)} />}
      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="¿Borrar este plan?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                removeDoc(data.uid, "plans", plan.id);
                if (isActive) patchProfile(data.uid, { activePlanId: null });
                setDeleting(false);
                setPlanId("");
              }}
            >
              Borrar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Tus entrenamientos registrados no se borran. Siempre puedes volver a copiar la plantilla.</p>
      </Sheet>
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
            savePlan(data.uid, { ...plan, sessions: plan.sessions.map((s) => (s.key === d.key ? d : s)) });
            onClose();
          }}
        >
          Guardar sesión
        </Button>
      }
    >
      <div className="space-y-3">
        <Input aria-label="Nombre de la sesión" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        {plan.rotation !== "alternate" && (
          <Select aria-label="Día" value={d.weekday ?? ""} onChange={(e) => setD({ ...d, weekday: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin día fijo</option>
            {WEEKDAY_LONG.map((w, i) => (
              <option key={w} value={i + 1}>
                {w}
              </option>
            ))}
          </Select>
        )}
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
            <Select aria-label="Unidad del rango" className="mt-2 min-h-10 text-sm" value={it.repUnit} onChange={(e) => setItem(i, { repUnit: e.target.value as RepUnit })}>
              <option value="reps">Repeticiones</option>
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
            </Select>
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
          else
            setD((x) => ({
              ...x,
              items: [...x.items, { exerciseId: e.id, sets: 3, repMin: 8, repMax: 12, restSec: e.isCompound ? 120 : 75, rirTarget: 2, supersetGroup: null, notes: null, repUnit: e.metric }],
            }));
        }}
      />
    </Sheet>
  );
}
