"use client";

import clsx from "clsx";
import { Dumbbell, Footprints, House, Plus, Sparkles, Trees, X } from "lucide-react";
import { useRef, useState } from "react";
import { Chat } from "@/components/coach/Chat";
import { Proposals } from "@/components/coach/Proposals";
import { SessionEditor } from "@/components/plan/SessionEditor";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, Sheet } from "@/components/ui";
import { weekStart } from "@/lib/analytics/dates";
import { newId, patchProfile, savePlan } from "@/lib/db/write";
import { WEEKDAY_LONG, fmtDate } from "@/lib/format";
import { useAiEnabled } from "@/lib/hooks/useAi";
import { useToday } from "@/lib/hooks/useToday";
import type { Plan, PlanSession } from "@/lib/types";
import { BLOCK_PRESETS, PLACE_LABEL, newBlock, placeOf, unscheduledSessions, weekSchedule, type WeekDay } from "@/lib/week";

const COACH_SUGGESTIONS = [
  "Quiero bajar la barriga: ¿me sirve hacer abdomen en casa?",
  "¿Qué puedo hacer en casa los días que no voy al gym?",
  "¿Mi semana está equilibrada?",
  "Añade cardio suave a mis días libres",
];

function BlockIcon({ s }: { s: PlanSession }) {
  const place = placeOf(s);
  if (s.kind === "cardio") return place === "outdoor" ? <Trees className="size-4" /> : <Footprints className="size-4" />;
  return place === "home" ? <House className="size-4" /> : place === "outdoor" ? <Trees className="size-4" /> : <Dumbbell className="size-4" />;
}

export default function WeekPage() {
  const data = useData();
  const { today } = useToday();
  const ai = useAiEnabled();
  const plan = data.activePlan;
  const [editing, setEditing] = useState<{ session: PlanSession; isNew: boolean } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const coachRef = useRef<HTMLDivElement>(null);

  const days = weekSchedule(plan, weekStart(today));
  const loose = unscheduledSessions(plan);
  const trainingDays = days.filter((d) => d.sessions.some((s) => s.kind === "lifting")).length;
  const extras = days.reduce((t, d) => t + d.extras.length, 0);
  const minutes = days.reduce((t, d) => t + d.minutes, 0);

  function askCoach(weekday: number) {
    setFocusDay(weekday);
    setDraft((d) => ({ text: `Para el ${WEEKDAY_LONG[weekday - 1]}: `, n: d.n + 1 }));
    coachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function createBlankPlan() {
    const id = newId(data.uid, "plans");
    const now = Date.now();
    const p = data.profile;
    const blank: Plan = {
      id,
      name: "Mi semana",
      sourceTemplateId: null,
      goal: p?.goal ?? "salud",
      daysPerWeek: 0,
      level: p?.level ?? "principiante",
      weekdayVariant: null,
      rotation: null,
      scheduleDays: [],
      startDate: today,
      sessions: [],
      enabledAddOns: [],
      recommendedAddOns: [],
      progressionRules: [],
      dailyStepsTarget: null,
      createdAt: now,
      updatedAt: now,
    };
    savePlan(data.uid, blank);
    patchProfile(data.uid, { activePlanId: id });
  }

  if (!plan)
    return (
      <div className="animate-rise">
        <PageHeader title="Mi semana" />
        <Card>
          <EmptyState
            title="Aún no tienes una semana armada"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/rutinas">Partir de una rutina recomendada</LinkButton>
                <Button variant="outline" onClick={createBlankPlan}>
                  Empezar desde cero
                </Button>
              </div>
            }
          >
            Las rutinas de la biblioteca son plantillas: se copian a tu cuenta y aquí las ajustas día por día, con bloques extra en casa, en el gym o fuera.
          </EmptyState>
        </Card>
      </div>
    );

  return (
    <div className="animate-rise space-y-4">
      <PageHeader
        title="Mi semana"
        subtitle={`${plan.name}${plan.sourceTemplateId ? ` · plantilla ${plan.sourceTemplateId}` : ""} · tócalo todo, es tu copia`}
        action={
          <LinkButton href="/planes" variant="outline" size="sm">
            Plan completo
          </LinkButton>
        }
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Summary label="Días de gym / fuerza" value={trainingDays} />
        <Summary label="Bloques extra" value={extras} />
        <Summary label="Min. planeados" value={minutes} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-3">
          {days.map((d) => (
            <DayCard
              key={d.weekday}
              day={d}
              isToday={d.date === today}
              rotating={plan.rotation === "alternate"}
              onOpen={(s) => setEditing({ session: s, isNew: false })}
              onAdd={() => setAdding(d.weekday)}
              onAsk={() => askCoach(d.weekday)}
              askDisabled={!ai.enabled}
            />
          ))}
          {loose.length > 0 && (
            <Card>
              <CardHeader title="Sin día fijo" subtitle="Opcionales: hazlas cuando quieras o asígnales un día" />
              <ul className="space-y-2">
                {loose.map((s) => (
                  <BlockRow key={s.key} s={s} onOpen={() => setEditing({ session: s, isNew: false })} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div ref={coachRef} className="min-w-0 scroll-mt-4 space-y-3 lg:sticky lg:top-8 lg:h-fit">
          <Proposals id="propuestas-semana" />
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" /> Coach de tu semana
                </span>
              }
              subtitle="Pregúntale si algo te conviene; si sí, te propone el bloque y tú lo apruebas."
            />
            {focusDay && (
              <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-xs font-semibold text-primary-strong">
                Hablando del {WEEKDAY_LONG[focusDay - 1]}
                <button
                  type="button"
                  aria-label="Dejar de hablar de ese día"
                  className="flex size-6 items-center justify-center rounded-full hover:bg-primary/10"
                  onClick={() => setFocusDay(null)}
                >
                  <X className="size-3.5" />
                </button>
              </p>
            )}
            <Chat embedded chatId="semana" context={{ screen: "semana", focusDay }} draft={draft} suggestions={COACH_SUGGESTIONS} onProposal={() => {}} />
          </Card>
        </div>
      </div>

      <AddBlockSheet
        weekday={adding}
        onClose={() => setAdding(null)}
        onPick={(draftBlock) => {
          setAdding(null);
          setEditing({ session: newBlock(plan, draftBlock), isNew: true });
        }}
      />
      {editing && <SessionEditor key={editing.session.key} plan={plan} session={editing.session} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-2 py-3">
      <div className="num text-2xl font-extrabold">{value}</div>
      <div className="text-[0.7rem] font-semibold text-muted">{label}</div>
    </div>
  );
}

function DayCard({
  day,
  isToday,
  rotating,
  onOpen,
  onAdd,
  onAsk,
  askDisabled,
}: {
  day: WeekDay;
  isToday: boolean;
  rotating: boolean;
  onOpen: (s: PlanSession) => void;
  onAdd: () => void;
  onAsk: () => void;
  askDisabled: boolean;
}) {
  const empty = day.sessions.length === 0 && day.extras.length === 0;
  return (
    <Card className={clsx(isToday && "ring-2 ring-primary")} aria-label={WEEKDAY_LONG[day.weekday - 1]}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold first-letter:uppercase">{fmtDate(day.date, { weekday: "long", day: "numeric", month: "short" })}</h2>
          {isToday && <Badge tone="primary">Hoy</Badge>}
          {empty && <Badge>Descanso</Badge>}
        </div>
        {day.minutes > 0 && <span className="num text-xs font-semibold text-muted">~{day.minutes} min</span>}
      </div>
      {!empty && (
        <ul className="mt-3 space-y-2">
          {day.sessions.map((s) => (
            <BlockRow key={s.key} s={s} hint={rotating ? "Rotación A/B" : undefined} onOpen={() => onOpen(s)} />
          ))}
          {day.extras.map((s) => (
            <BlockRow key={s.key} s={s} onOpen={() => onOpen(s)} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="soft" onClick={onAdd} aria-label={`Añadir bloque el ${WEEKDAY_LONG[day.weekday - 1]}`}>
          <Plus className="size-4" /> Añadir
        </Button>
        <Button size="sm" variant="ghost" onClick={onAsk} disabled={askDisabled} aria-label={`Preguntar al coach por el ${WEEKDAY_LONG[day.weekday - 1]}`}>
          <Sparkles className="size-4" /> Preguntar al coach
        </Button>
      </div>
    </Card>
  );
}

function BlockRow({ s, hint, onOpen }: { s: PlanSession; hint?: string; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:brightness-95",
          s.extra ? "border border-dashed border-violet/40 bg-violet-soft" : "bg-sunken",
        )}
      >
        <span
          className={clsx(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            s.extra ? "bg-surface-strong text-violet" : "bg-primary-soft text-primary-strong",
          )}
        >
          <BlockIcon s={s} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{s.name}</span>
          <span className="block truncate text-xs text-muted">
            {PLACE_LABEL[placeOf(s)]} · {s.items.length} ejercicio{s.items.length === 1 ? "" : "s"} · ~{s.estimatedMinutes} min
            {hint && ` · ${hint}`}
          </span>
        </span>
        {s.extra && <Badge tone="violet">Extra</Badge>}
      </button>
    </li>
  );
}

function AddBlockSheet({ weekday, onClose, onPick }: { weekday: number | null; onClose: () => void; onPick: (d: Parameters<typeof newBlock>[1]) => void }) {
  return (
    <Sheet open={weekday !== null} onClose={onClose} title={weekday ? `Añadir al ${WEEKDAY_LONG[weekday - 1]}` : "Añadir"}>
      <p className="mb-3 text-sm text-muted">Elige una base y ajústala. Los bloques extra no cuentan para tu asistencia al gym.</p>
      <ul className="space-y-2">
        {BLOCK_PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick({ ...p.draft, items: p.draft.items.map((i) => ({ ...i })), weekday })}
              className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-surface-strong px-4 py-3 text-left transition hover:bg-sunken"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
                {p.draft.kind === "cardio" ? (
                  <Footprints className="size-5" />
                ) : p.draft.place === "home" ? (
                  <House className="size-5" />
                ) : (
                  <Dumbbell className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-sm text-muted">{p.description}</span>
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onPick({ name: "", place: "home", kind: "lifting", weekday, estimatedMinutes: 15, items: [] })}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left font-semibold transition hover:bg-sunken"
          >
            <Plus className="size-5 text-muted" /> En blanco (eliges tú los ejercicios)
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
