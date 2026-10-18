"use client";

import clsx from "clsx";
import {
  Apple,
  ArrowRight,
  CalendarPlus,
  Check,
  Dumbbell,
  Footprints,
  Flame,
  House,
  Ruler,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, IconTile, LinkButton, ProgressBar, Ring } from "@/components/ui";
import { addDays, isoWeekday, weekStart } from "@/lib/analytics/dates";
import { isFloatingCandidate, plannedSessionsForWeek, sessionForDate, summarizeAttendance, weeklyAttendance } from "@/lib/analytics/attendance";
import { dailyMeans, movingAverage7d } from "@/lib/analytics/bodyweight";
import { proteinByDay, proteinTarget } from "@/lib/analytics/nutrition";
import { workingSets } from "@/lib/analytics/strength";
import { lastWeekStarts } from "@/lib/analytics/dates";
import { putDoc, newId } from "@/lib/db/write";
import { VERDICT_LABEL, WEEKDAY_LONG, WEEKDAY_SHORT, fmtDate, fmtNum } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";
import { buildWorkout, estimateMinutes, workoutProgress } from "@/lib/workout";

export default function TodayPage() {
  const data = useData();
  const router = useRouter();
  const { today, weekKey } = useToday();
  const { activePlan: plan, workouts, weekPlans, profile } = data;

  const floating = weekPlans.get(weekKey) ?? null;
  const session = sessionForDate(plan, today, floating);
  const active = workouts.find((w) => w.status === "in_progress");
  const doneToday = workouts.find((w) => w.status === "completed" && w.date === today);
  const canFloat = plan?.sessions.some((s) => s.kind === "floating");
  const homeSession = plan?.sessions.find((s) => s.kind === "home") ?? null;

  const week = useMemo(() => {
    const ws = weekStart(today);
    const att = weeklyAttendance({ plan, workouts, weekStarts: lastWeekStarts(today, 8), floatingByWeek: weekPlans, today });
    const current = att[att.length - 1];
    const planned = plannedSessionsForWeek(plan, ws, floating);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(ws, i);
      const sets = workouts
        .filter((w) => w.date === date && w.status === "completed")
        .reduce((t, w) => t + w.entries.reduce((a, e) => a + workingSets(e.sets).length, 0), 0);
      return { date, sets, planned: planned.some((p) => p.date === date) };
    });
    return { current, summary: summarizeAttendance(att), days };
  }, [plan, workouts, weekPlans, today, floating]);

  const weight = useMemo(() => {
    const ma = movingAverage7d(dailyMeans(data.bodyMetrics, "weightKg"));
    return ma.at(-1) ?? null;
  }, [data.bodyMetrics]);
  const target = proteinTarget(profile?.proteinTargetG, weight?.value ?? profile?.startWeightKg);
  const proteinToday = proteinByDay(data.meals.filter((m) => m.date === today)).get(today) ?? 0;
  const stepsToday = data.activity.find((a) => a.date === today)?.steps ?? 0;
  const stepsTarget = profile?.stepsTarget ?? 8000;
  const lastReport = data.reports[0];

  const pct = week.current.planned ? week.current.attended / week.current.planned : 0;

  function start(s = session) {
    if (active) return router.push("/entrenar");
    const id = newId(data.uid, "workouts");
    const w = buildWorkout({ id, date: today, plan, session: s, exercises: data.exerciseMap, workouts, records: data.records });
    putDoc(data.uid, "workouts", id, w);
    router.push("/entrenar");
  }

  function setFloating(day: number | null) {
    putDoc(data.uid, "weekPlans", weekKey, { id: weekKey, floatingWeekday: day });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="animate-rise space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting} 👋</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">{fmtDate(today)}</p>
        </div>
        <Link href="/coach" className="glass flex size-12 items-center justify-center rounded-2xl" aria-label="Abrir coach">
          <Sparkles className="size-5 text-primary" />
        </Link>
      </header>

      {data.proposals.length > 0 && (
        <Link href="/coach#propuestas" className="flex items-center gap-3 rounded-3xl bg-violet-soft px-4 py-3 text-sm font-semibold text-violet">
          <Sparkles className="size-5" /> El coach tiene {data.proposals.length} propuesta(s) de cambio para revisar
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's session */}
        <Card className="lg:col-span-2">
          {active ? (
            <ActiveCard name={active.sessionName} progress={workoutProgress(active)} onOpen={() => router.push("/entrenar")} />
          ) : doneToday ? (
            <div className="flex items-center gap-4">
              <IconTile tone="primary" className="size-14">
                <Check className="size-7" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">Sesión de hoy completada</p>
                <p className="text-lg font-bold">{doneToday.sessionName}</p>
              </div>
              <LinkButton href="/historial" variant="soft" size="sm">
                Ver
              </LinkButton>
            </div>
          ) : session ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge tone={session.kind === "floating" ? "violet" : "primary"}>{session.kind === "floating" ? "Día flotante" : "Hoy toca"}</Badge>
                  <h2 className="mt-2 text-xl font-extrabold">{session.name}</h2>
                  <p className="text-sm text-muted">{session.focus}</p>
                </div>
                <div className="text-right text-sm text-muted">
                  <div className="num font-bold text-ink">~{estimateMinutes(session)} min</div>
                  <div>{session.items.length} ejercicios</div>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {session.items.map((it) => (
                  <li key={it.exerciseId} className="rounded-full bg-sunken px-2.5 py-1 text-xs font-medium">
                    {data.exerciseMap.get(it.exerciseId)?.name ?? it.exerciseId}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => start()}>
                <Dumbbell className="size-5" /> Iniciar entrenamiento
              </Button>
            </div>
          ) : (
            <div>
              <Badge tone="neutral">Descanso</Badge>
              <h2 className="mt-2 text-xl font-extrabold">Hoy no hay gimnasio</h2>
              <p className="text-sm text-muted">Camina para sumar pasos y, si quieres, haz la sesión corta en casa (caminata + core).</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {homeSession && (
                  <Button variant="soft" onClick={() => start(homeSession)}>
                    <House className="size-4" /> Sesión en casa
                  </Button>
                )}
                <LinkButton href="/actividad" variant="outline">
                  <Footprints className="size-4" /> Registrar pasos
                </LinkButton>
                <Button variant="ghost" onClick={() => start(null)}>
                  Entrenamiento libre
                </Button>
              </div>
            </div>
          )}

          {canFloat && (
            <div className="mt-4 rounded-2xl bg-sunken p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CalendarPlus className="size-4 text-violet" /> Día extra de esta semana
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(plan?.floatingWeekdays ?? [2, 4]).map((d) => (
                  <Button key={d} size="sm" variant={floating === d ? "primary" : "outline"} onClick={() => setFloating(floating === d ? null : d)} aria-pressed={floating === d}>
                    {floating === d ? "✓ " : ""}También voy el {WEEKDAY_LONG[d - 1]}
                  </Button>
                ))}
              </div>
              {!floating && isFloatingCandidate(plan, today) && <p className="mt-2 text-xs text-muted">Hoy es {WEEKDAY_LONG[isoWeekday(today) - 1]}: actívalo si vas a ir.</p>}
            </div>
          )}
        </Card>

        {/* Weekly progress ring */}
        <Card>
          <CardHeader title="Progreso de la semana" />
          <div className="flex items-center gap-4">
            <Ring value={pct} size={104} label={`${Math.round(pct * 100)} % de sesiones cumplidas`}>
              <span className="num text-2xl font-extrabold">{Math.round(pct * 100)}%</span>
            </Ring>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              <Legend color="var(--primary)" label="Sesiones" value={`${week.current.attended}/${week.current.planned}`} />
              <Legend color="var(--accent)" label="Proteína hoy" value={target ? `${fmtNum(proteinToday, 0)}/${target} g` : `${fmtNum(proteinToday, 0)} g`} />
              <Legend color="var(--violet)" label="Pasos hoy" value={fmtNum(stepsToday, 0)} />
              <Legend color="var(--amber)" label="Racha" value={`${week.summary.streakWeeks} sem`} />
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly activity bars */}
        <Card className="lg:col-span-2">
          <CardHeader title="Actividad semanal" subtitle="Series efectivas por día" action={<Badge tone="primary">{week.summary.compliancePct ?? "—"}% cumplimiento</Badge>} />
          <WeekBars days={week.days} today={today} />
        </Card>

        <Card>
          <CardHeader title="Acciones rápidas" />
          <div className="grid grid-cols-2 gap-2">
            <Quick href="/entrenar" icon={<Dumbbell className="size-5" />} tone="primary" label="Entrenar" />
            <Quick href="/medidas" icon={<Ruler className="size-5" />} tone="violet" label="Peso y cintura" />
            <Quick href="/nutricion" icon={<Apple className="size-5" />} tone="accent" label="Registrar comida" />
            <Quick href="/actividad" icon={<Flame className="size-5" />} tone="amber" label="Pasos" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Peso (promedio 7 d)" />
          <p className="num text-3xl font-extrabold">
            {weight ? fmtNum(weight.value, 1) : "—"}
            <span className="ml-1 text-base font-semibold text-muted">kg</span>
          </p>
          <p className="mt-1 text-sm text-muted">{weight ? "Pésate en ayunas, varias veces por semana." : "Aún no hay registros de peso."}</p>
          <LinkButton href="/medidas" variant="soft" size="sm" className="mt-3">
            Registrar peso
          </LinkButton>
        </Card>
        <Card>
          <CardHeader title="Pasos de hoy" />
          <p className="num text-3xl font-extrabold">
            {fmtNum(stepsToday, 0)}
            <span className="ml-1 text-base font-semibold text-muted">/ {fmtNum(stepsTarget, 0)}</span>
          </p>
          <div className="mt-3">
            <ProgressBar value={stepsToday / stepsTarget} color="var(--violet)" label="Pasos de hoy" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Coach IA"
            action={lastReport && <Badge tone={VERDICT_LABEL[lastReport.verdict].tone}>{VERDICT_LABEL[lastReport.verdict].text}</Badge>}
          />
          <p className="line-clamp-3 text-sm text-muted">{lastReport ? lastReport.summary : "Cuando tengas una semana registrada, pide tu primer análisis."}</p>
          <LinkButton href="/coach" variant="soft" size="sm" className="mt-3">
            <Sparkles className="size-4" /> {lastReport ? "Ver informe" : "Ir al coach"}
          </LinkButton>
        </Card>
      </div>
    </div>
  );
}

function ActiveCard({ name, progress, onOpen }: { name: string; progress: { done: number; total: number }; onOpen: () => void }) {
  return (
    <div>
      <Badge tone="accent">En curso</Badge>
      <h2 className="mt-2 text-xl font-extrabold">{name}</h2>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={progress.total ? progress.done / progress.total : 0} label="Series completadas" />
        <span className="num shrink-0 text-sm font-semibold">
          {progress.done}/{progress.total}
        </span>
      </div>
      <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={onOpen}>
        Continuar entrenamiento <ArrowRight className="size-5" />
      </Button>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="num ml-auto font-semibold">{value}</span>
    </li>
  );
}

function WeekBars({ days, today }: { days: { date: string; sets: number; planned: boolean }[]; today: string }) {
  const max = Math.max(20, ...days.map((d) => d.sets));
  return (
    <div className="flex h-40 items-end justify-between gap-2" role="img" aria-label="Series por día de esta semana">
      {days.map((d, i) => {
        const isToday = d.date === today;
        const h = d.sets ? Math.max(10, (d.sets / max) * 100) : d.planned ? 10 : 4;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
            <span className="num text-[0.7rem] font-semibold text-muted">{d.sets || ""}</span>
            <div className="flex h-28 w-full max-w-10 items-end">
              <div
                className={clsx(
                  "w-full rounded-full transition-[height] duration-500",
                  d.sets ? (isToday ? "bg-primary" : "bg-primary/55") : d.planned ? "border-2 border-dashed border-primary/40 bg-transparent" : "bg-sunken",
                )}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className={clsx("flex size-7 items-center justify-center rounded-full text-xs font-bold", isToday ? "bg-primary text-on-primary" : "text-muted")}>
              {WEEKDAY_SHORT[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Quick({ href, icon, label, tone }: { href: string; icon: React.ReactNode; label: string; tone: "primary" | "violet" | "accent" | "amber" }) {
  return (
    <Link href={href} className="flex min-h-20 flex-col justify-between gap-2 rounded-2xl border border-line bg-surface-strong p-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md">
      <IconTile tone={tone}>{icon}</IconTile>
      {label}
    </Link>
  );
}
