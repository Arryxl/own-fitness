"use client";

import clsx from "clsx";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Clock, Sparkles, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { addDays, isoWeekday, todayISO } from "@/lib/analytics/dates";
import { newId, patchProfile, putDoc } from "@/lib/db/write";
import { GOAL_LABEL, MUSCLE_LABEL, WEEKDAY_LONG } from "@/lib/format";
import { VARIANT_LABEL, bestVariant, planFromTemplate, recommendTemplates, templateVariants, type TemplateAdvice } from "@/lib/plans";
import type { Muscle, ProgramTemplate } from "@/lib/types";

type GoalFilter = "all" | ProgramTemplate["goal"];

export default function RoutinesPage() {
  const data = useData();
  const p = data.profile;
  const [goal, setGoal] = useState<GoalFilter>("all");
  const [days, setDays] = useState<string>("all");
  const [using, setUsing] = useState<ProgramTemplate | null>(null);

  const rec = useMemo(
    () => recommendTemplates(data.templates, data.catalog.rules, { goal: p?.goal ?? null, level: p?.level ?? null, trainingDays: p?.trainingDays ?? [] }),
    [data.templates, data.catalog.rules, p],
  );
  const list = data.templates.filter((t) => (goal === "all" || t.goal === goal) && (days === "all" || t.daysPerWeek === Number(days)));
  const recommended = rec.ids.map((id) => data.templates.find((t) => t.id === id)).filter((t): t is ProgramTemplate => !!t);

  if (!data.catalog.ready) return <PageHeader title="Rutinas" subtitle="Cargando biblioteca…" />;
  if (data.templates.length === 0)
    return (
      <Card>
        <EmptyState title="La biblioteca de rutinas no está cargada">El administrador debe ejecutar el seed del catálogo (npm run seed).</EmptyState>
      </Card>
    );

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Rutinas" subtitle="10 programas reconocidos, adaptados para entrenar sin compañero. Tú decides." />

      {recommended.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-primary">
            <Sparkles className="size-4" /> Recomendadas para ti
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {recommended.map((t) => (
              <TemplateCard key={t.id} t={t} advice={rec.advice.get(t.id)!} onUse={() => setUsing(t)} activeTemplateId={data.activePlan?.sourceTemplateId ?? null} highlight />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Segmented
          label="Objetivo"
          value={goal}
          onChange={setGoal}
          className="flex-1"
          options={[{ value: "all", label: "Todos" }, ...(Object.keys(GOAL_LABEL) as ProgramTemplate["goal"][]).map((g) => ({ value: g, label: GOAL_LABEL[g] }))]}
        />
        <Segmented
          label="Días por semana"
          value={days}
          onChange={setDays}
          className="sm:w-80"
          options={[{ value: "all", label: "Días" }, ...["3", "4", "5", "6"].map((d) => ({ value: d, label: d }))]}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((t) => (
          <TemplateCard key={t.id} t={t} advice={rec.advice.get(t.id)!} onUse={() => setUsing(t)} activeTemplateId={data.activePlan?.sourceTemplateId ?? null} />
        ))}
      </div>

      {using && <UseTemplateSheet t={using} advice={rec.advice.get(using.id)!} onClose={() => setUsing(null)} />}
    </div>
  );
}

function TemplateCard({ t, advice, onUse, activeTemplateId, highlight }: { t: ProgramTemplate; advice: TemplateAdvice; onUse: () => void; activeTemplateId: string | null; highlight?: boolean }) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const active = activeTemplateId === t.id;
  const direct = Object.entries(t.weeklyVolume.directSets) as [Muscle, number][];
  return (
    <Card className={clsx(highlight && "ring-2 ring-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{GOAL_LABEL[t.goal]}</Badge>
            <Badge>{t.daysPerWeek} días</Badge>
            <Badge>{t.level}</Badge>
            {advice?.recommended && (
              <Badge tone="violet">
                <Star className="size-3" /> Para ti
              </Badge>
            )}
            {t.requiresWeekend && <Badge tone="amber">Incluye sábado</Badge>}
            {active && <Badge tone="primary">Tu plan actual</Badge>}
          </div>
          <h3 className="mt-2 text-lg font-extrabold leading-tight">
            <span className="text-muted">{t.id} · </span>
            {t.name}
          </h3>
          <p className="text-sm text-muted">{t.knownAs}</p>
        </div>
      </div>
      <p className="mt-2 text-sm">{t.bestFor}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <Clock className="size-3.5" /> {t.sessionMinutesRange[0]}-{t.sessionMinutesRange[1]} min por sesión
        {t.cardioMinutesPerWeek ? ` · ${t.cardioMinutesPerWeek} min de cardio/semana` : ""}
      </p>
      {advice?.note && <p className="mt-2 text-xs text-violet">{advice.note}</p>}
      {advice && (advice.warnings.length > 0 || advice.avoidReason) && (
        <ul className="mt-2 space-y-1">
          {[...(advice.avoidReason ? [advice.avoidReason] : []), ...advice.warnings].map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs text-amber">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">
        {open ? "Ocultar detalle" : "Ver detalle"} <ChevronDown className={clsx("size-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted">Series directas por semana</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {direct.map(([m, v]) => (
                <span key={m} className="rounded-full bg-sunken px-2.5 py-1 text-xs">
                  {MUSCLE_LABEL[m] ?? m} <b className="num">{v}</b>
                  {t.weeklyFrequencyDirect[m] ? <span className="text-muted"> · {t.weeklyFrequencyDirect[m]}×</span> : null}
                </span>
              ))}
            </div>
          </div>
          <p>
            <b>Por qué:</b> {t.rationale}
          </p>
          <p className="text-muted">
            <b className="text-ink">Comunidad:</b> {t.communityNote}
          </p>
          <p className="text-muted">
            <b className="text-ink">Ojo:</b> {t.caveats}
          </p>
          {t.progressionRules && (
            <div>
              <p className="font-semibold">Reglas de progresión</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {t.progressionRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {t.sessions.map((s) => (
            <div key={s.key} className="rounded-2xl bg-sunken p-3">
              <p className="font-semibold">
                {s.key} · {s.name}
                {s.optional && <span className="text-muted"> (opcional)</span>} <span className="text-xs text-muted">~{s.estimatedMinutes} min</span>
              </p>
              <ol className="mt-1 space-y-0.5 text-xs text-muted">
                {s.items.map((i, k) => (
                  <li key={k}>
                    {data.exerciseMap.get(i.exerciseId)?.name ?? i.exerciseId} · {i.sets}×{i.repMin === i.repMax ? i.repMin : `${i.repMin}-${i.repMax}`}
                    {i.repUnit === "seconds" ? " s" : i.repUnit === "minutes" ? " min" : ""}
                    {i.supersetGroup ? ` · superserie ${i.supersetGroup}` : ""}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <Button className="mt-4 w-full" variant={active ? "soft" : "primary"} onClick={onUse}>
        <Check className="size-4" /> {active ? "Volver a copiar esta rutina" : "Usar esta rutina"}
      </Button>
    </Card>
  );
}

function nextMonday(today: string): string {
  const wd = isoWeekday(today);
  return wd === 1 ? today : addDays(today, 8 - wd);
}

function UseTemplateSheet({ t, advice, onClose }: { t: ProgramTemplate; advice: TemplateAdvice; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const router = useRouter();
  const variants = templateVariants(t);
  const [variant, setVariant] = useState<string | null>(() => bestVariant(t, data.profile?.trainingDays ?? []));
  const [startDate, setStartDate] = useState(() => (t.rotation ? nextMonday(todayISO()) : todayISO()));
  const [weekendOk, setWeekendOk] = useState(!t.requiresWeekend);

  function use() {
    const id = newId(data.uid, "plans");
    const plan = planFromTemplate(t, { id, variant, startDate, now: Date.now() });
    putDoc(data.uid, "plans", id, plan);
    patchProfile(data.uid, { activePlanId: id });
    toast(`Plan «${t.name}» activado. Puedes editarlo en Planes.`, "success");
    router.push("/");
  }

  const map = variant ? t.weekdayMap[variant] : null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Usar ${t.id} · ${t.name}`}
      footer={
        <Button className="w-full" size="lg" onClick={use} disabled={!weekendOk}>
          Crear mi plan
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">Se crea una copia editable en tus planes: puedes cambiar ejercicios, series, orden y alternativas sin afectar la plantilla.</p>
        {data.activePlan && <p className="rounded-2xl bg-sunken px-3 py-2">Tu plan actual («{data.activePlan.name}») queda guardado en Planes.</p>}
        {(advice.avoidReason || advice.warnings.length > 0) && (
          <ul className="space-y-1 rounded-2xl bg-amber-soft p-3 text-amber">
            {[...(advice.avoidReason ? [advice.avoidReason] : []), ...advice.warnings].map((w) => (
              <li key={w} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        )}
        {t.requiresWeekend && (
          <label className="flex min-h-12 items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={weekendOk} onChange={(e) => setWeekendOk(e.target.checked)} />
            <span>Entiendo que esta rutina incluye entrenar el sábado.</span>
          </label>
        )}
        {variants.length > 1 && (
          <fieldset>
            <legend className="font-semibold">Calendario</legend>
            <div className="mt-2 space-y-2">
              {variants.map((v) => (
                <label key={v} className={clsx("flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-3", variant === v ? "border-primary bg-primary-soft/50" : "border-line")}>
                  <input type="radio" name="variant" className="size-5 accent-[var(--primary)]" checked={variant === v} onChange={() => setVariant(v)} />
                  <span>{VARIANT_LABEL[v] ?? v}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {map && (
          <ul className="space-y-1">
            {t.sessions.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <span className="w-24 capitalize text-muted">{map[s.key] ? WEEKDAY_LONG[map[s.key] - 1] : s.floating ? "flotante" : "opcional"}</span>
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        )}
        {t.rotation && (
          <>
            <p>
              Sesiones A y B alternadas los días {t.schedule?.days.map((d) => WEEKDAY_LONG[d - 1]).join(", ")} ({t.schedule?.pattern}).
            </p>
            <Field label="Empieza el">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
          </>
        )}
      </div>
    </Sheet>
  );
}

