"use client";

import clsx from "clsx";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Clock, ExternalLink, Info, Microscope, Sparkles, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { addDays, isoWeekday, todayISO } from "@/lib/analytics/dates";
import { ageFromBirthDate } from "@/lib/analytics/energy";
import { asPlanLike, validateTemplate } from "@/lib/analytics/validate";
import { TRACKED_MUSCLES, planVolume } from "@/lib/analytics/volume";
import { newId, patchProfile, putDoc } from "@/lib/db/write";
import { CATEGORY_LABEL, GOAL_LABEL, MUSCLE_LABEL, PLACE_LABEL, VERIFICATION_LABEL, WEEKDAY_LONG, fmtNum } from "@/lib/format";
import { VARIANT_LABEL, bestVariant, planFromTemplate, recommendTemplates, templateVariants, type TemplateAdvice } from "@/lib/plans";
import type { Goal, Place, ProgramTemplate } from "@/lib/types";

type GoalFilter = "all" | Goal;
type PlaceFilter = "all" | Place;

function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition", value === o.value ? "bg-primary text-on-primary" : "bg-sunken text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function RoutinesPage() {
  const data = useData();
  const p = data.profile;
  const [goal, setGoal] = useState<GoalFilter>("all");
  const [days, setDays] = useState<string>("all");
  const [place, setPlace] = useState<PlaceFilter>("all");
  const [using, setUsing] = useState<ProgramTemplate | null>(null);

  const rec = useMemo(
    () =>
      recommendTemplates(data.templates, data.catalog.rules, {
        goal: p?.goal ?? null,
        level: p?.level ?? null,
        trainingDays: p?.trainingDays ?? [],
        place: p?.trainingPlace ?? "gym",
        ageYears: ageFromBirthDate(p?.birthDate ?? null, todayISO()),
      }),
    [data.templates, data.catalog.rules, p],
  );
  const list = data.templates.filter(
    (t) => (goal === "all" || t.goal === goal) && (days === "all" || t.daysPerWeek === Number(days) || (days === "6" && t.daysPerWeek >= 6)) && (place === "all" || t.place === place),
  );
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
      <PageHeader title="Rutinas" subtitle={`${data.templates.length} programas reconocidos o basados en guías, con su fuente. Tú decides.`} />

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

      <div className="space-y-2">
        <Chips label="Objetivo" value={goal} onChange={setGoal} options={[{ value: "all", label: "Todos" }, ...(Object.keys(GOAL_LABEL) as Goal[]).map((g) => ({ value: g, label: GOAL_LABEL[g] }))]} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Segmented label="Días por semana" value={days} onChange={setDays} className="sm:flex-1" options={[{ value: "all", label: "Días" }, ...["2", "3", "4", "5", "6"].map((d) => ({ value: d, label: d === "6" ? "6+" : d }))]} />
          <Chips label="Lugar" value={place} onChange={setPlace} options={[{ value: "all", label: "Cualquier lugar" }, ...(Object.keys(PLACE_LABEL) as Place[]).map((x) => ({ value: x, label: PLACE_LABEL[x].split(" (")[0] }))]} />
        </div>
        <p className="px-1 text-xs text-muted">{list.length} rutinas</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((t) => (
          <TemplateCard key={t.id} t={t} advice={rec.advice.get(t.id)!} onUse={() => setUsing(t)} activeTemplateId={data.activePlan?.sourceTemplateId ?? null} />
        ))}
        {list.length === 0 && (
          <Card className="lg:col-span-2">
            <EmptyState title="Ninguna rutina con esos filtros">Prueba con otro número de días o lugar.</EmptyState>
          </Card>
        )}
      </div>

      {using && <UseTemplateSheet t={using} advice={rec.advice.get(using.id)!} onClose={() => setUsing(null)} />}
    </div>
  );
}

function TemplateCard({ t, advice, onUse, activeTemplateId, highlight }: { t: ProgramTemplate; advice: TemplateAdvice; onUse: () => void; activeTemplateId: string | null; highlight?: boolean }) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const active = activeTemplateId === t.id;
  const verification = VERIFICATION_LABEL[t.source?.verification ?? "adaptacion"];
  // Weekly fractional sets computed by the app (same counting the validator uses).
  const volume = useMemo(() => (open ? planVolume(asPlanLike(t), data.exerciseMap) : {}), [open, t, data.exerciseMap]);
  const review = useMemo(() => (open ? validateTemplate(t, data.exerciseMap, MUSCLE_LABEL) : []), [open, t, data.exerciseMap]);
  const warnings = advice ? [...(advice.avoidReason ? [advice.avoidReason] : []), ...advice.warnings] : [];

  return (
    <Card className={clsx(highlight && "ring-2 ring-primary")}>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="primary">{GOAL_LABEL[t.goal]}</Badge>
        <Badge>{t.daysPerWeek} días</Badge>
        <Badge>{t.level}</Badge>
        {t.category && <Badge>{CATEGORY_LABEL[t.category]}</Badge>}
        {t.place !== "gym" && <Badge tone="violet">{PLACE_LABEL[t.place].split(" (")[0]}</Badge>}
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
      <p className="mt-2 text-sm">{t.bestFor}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {t.sessionMinutesRange[0]}-{t.sessionMinutesRange[1]} min
        </span>
        {t.cardioMinutesPerWeek ? <span>{t.cardioMinutesPerWeek} min de cardio/semana</span> : null}
        {t.durationWeeks ? <span>{t.durationWeeks} semanas</span> : null}
        {verification && <Badge tone={verification.tone}>{verification.text}</Badge>}
      </p>
      {advice?.note && <p className="mt-2 text-xs text-violet">{advice.note}</p>}
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs text-amber">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 flex min-h-10 items-center gap-1 text-sm font-semibold text-primary">
        {open ? "Ocultar detalle" : "Ver detalle"} <ChevronDown className={clsx("size-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-3 text-sm">
          {t.source && (
            <p className="text-xs text-muted">
              Fuente: {t.source.name}
              {t.source.url && (
                <a href={t.source.url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-0.5 font-semibold text-primary">
                  ver <ExternalLink className="size-3" />
                </a>
              )}
            </p>
          )}
          {Object.keys(volume).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted">Series por semana (calculadas; secundarios cuentan ½)</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TRACKED_MUSCLES.filter((m) => (volume[m] ?? 0) > 0).map((m) => (
                  <span key={m} className="rounded-full bg-sunken px-2.5 py-1 text-xs">
                    {MUSCLE_LABEL[m]} <b className="num">{fmtNum(volume[m], 1)}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
          {review.length > 0 && (
            <div className="rounded-2xl bg-sunken p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold">
                <Microscope className="size-4 text-primary" /> Revisión según la evidencia
              </p>
              <ul className="mt-1.5 space-y-1">
                {review.map((n) => (
                  <li key={n.code} className={clsx("flex items-start gap-1.5 text-xs", n.level === "warn" ? "text-amber" : "text-muted")}>
                    {n.level === "warn" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0" />} {n.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              <p className="font-semibold">Progresión</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {t.progressionRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {t.deloadRules && (
            <div>
              <p className="font-semibold">Descarga</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {t.deloadRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {t.sessions.map((s) => (
            <div key={s.key} className="rounded-2xl bg-sunken p-3">
              <p className="font-semibold">
                {s.name}
                {s.optional && <span className="text-muted"> (opcional)</span>} <span className="text-xs text-muted">~{s.estimatedMinutes} min</span>
              </p>
              <ol className="mt-1 space-y-0.5 text-xs text-muted">
                {s.items.map((i, k) => (
                  <li key={k}>
                    {data.exerciseMap.get(i.exerciseId)?.name ?? i.exerciseId} · {i.sets}×{i.repMin === i.repMax ? i.repMin : `${i.repMin}-${i.repMax}`}
                    {i.repUnit === "seconds" ? " s" : i.repUnit === "minutes" ? " min" : ""}
                    {i.amrap ? " (AMRAP)" : ""}
                    {i.supersetGroup ? ` · superserie ${i.supersetGroup}` : ""}
                    {i.intensity ? <span className="block pl-3 text-[0.7rem]">{i.intensity}</span> : null}
                    {i.notes ? <span className="block pl-3 text-[0.7rem]">{i.notes}</span> : null}
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
  const warnings = advice ? [...(advice.avoidReason ? [advice.avoidReason] : []), ...advice.warnings] : [];

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
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-2xl bg-amber-soft p-3 text-amber">
            {warnings.map((w) => (
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
                  <span>{VARIANT_LABEL[v] ?? Object.entries(t.weekdayMap[v]).map(([, d]) => WEEKDAY_LONG[d - 1].slice(0, 3)).join(" · ")}</span>
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
                <span className="w-24 capitalize text-muted">{map[s.key] ? WEEKDAY_LONG[map[s.key] - 1] : s.floating || s.optional ? "opcional" : "—"}</span>
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        )}
        {t.rotation && (
          <>
            <p>
              Sesiones en rotación los días {t.schedule?.days.map((d) => WEEKDAY_LONG[d - 1]).join(", ")} ({t.schedule?.pattern}).
            </p>
            <Field label="Empieza el">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
