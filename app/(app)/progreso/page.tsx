"use client";

import { Dumbbell, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AttendanceHeatmap } from "@/components/charts/AttendanceHeatmap";
import { LinesChart, TrendChart } from "@/components/charts/Charts";
import { VolumeBars } from "@/components/charts/VolumeBars";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, Select, Stat } from "@/components/ui";
import { addDays, lastWeekStarts, weekStart } from "@/lib/analytics/dates";
import { summarizeAttendance, weeklyAttendance } from "@/lib/analytics/attendance";
import { dailyMeans, measurementChange, movingAverage7d, weightTrend } from "@/lib/analytics/bodyweight";
import { nutritionSummary, proteinTarget } from "@/lib/analytics/nutrition";
import { exerciseHistory, exerciseTrend } from "@/lib/analytics/strength";
import { formatWeight, fromKg, round } from "@/lib/analytics/units";
import { setsByMuscle } from "@/lib/analytics/volume";
import { VERDICT_LABEL, fmtNum } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";

type Tab = "summary" | "strength" | "body" | "volume";

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>("summary");
  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Progreso" subtitle="Tus números reales, sin adornos" />
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: "summary", label: "Resumen" },
          { value: "strength", label: "Fuerza" },
          { value: "body", label: "Cuerpo" },
          { value: "volume", label: "Volumen" },
        ]}
      />
      {tab === "summary" && <Summary />}
      {tab === "strength" && <Strength />}
      {tab === "body" && <Body />}
      {tab === "volume" && <Volume />}
    </div>
  );
}

function Summary() {
  const data = useData();
  const { today } = useToday();
  const weeks = useMemo(
    () => weeklyAttendance({ plan: data.activePlan, workouts: data.workouts, weekStarts: lastWeekStarts(today, 8), floatingByWeek: data.weekPlans, today, startDate: data.profile?.startDate }),
    [data.activePlan, data.workouts, data.weekPlans, today, data.profile?.startDate],
  );
  const att = summarizeAttendance(weeks);
  const current = weeks.at(-1)!;
  const weights = useMemo(() => dailyMeans(data.bodyMetrics, "weightKg"), [data.bodyMetrics]);
  const trend = weightTrend(weights);
  const waist = measurementChange(dailyMeans(data.bodyMetrics, "waistCm").filter((w) => w.date >= addDays(today, -56)));
  const weekSets = useMemo(
    () => setsByMuscle(data.workouts.filter((w) => w.date >= weekStart(today)), data.exerciseMap),
    [data.workouts, data.exerciseMap, today],
  );
  const target = proteinTarget(data.profile?.proteinTargetG, trend.avg7d ?? data.profile?.startWeightKg);
  const nutrition = nutritionSummary(
    data.meals.filter((m) => m.date >= addDays(today, -6)),
    target,
  );
  const best = useMemo(() => {
    const ids = new Set(data.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)));
    return [...ids]
      .map((id) => ({ ex: data.exerciseMap.get(id), t: exerciseTrend(exerciseHistory(data.workouts, id)) }))
      .filter((x) => x.ex?.isCompound && x.t.bestE1rmKg)
      .sort((a, b) => (b.t.e1rmChangePct ?? -999) - (a.t.e1rmChangePct ?? -999))
      .slice(0, 6);
  }, [data.workouts, data.exerciseMap]);
  const report = data.reports[0];
  const chart = useMemo(() => {
    const ma = new Map(movingAverage7d(weights).map((d) => [d.date, d.value]));
    return weights.filter((d) => d.date >= addDays(today, -60)).map((d) => ({ date: d.date, value: round(d.value, 1), avg: ma.get(d.date) ?? null }));
  }, [weights, today]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="Cumplimiento semanal" />
        <p className="num text-3xl font-extrabold">
          {current.attended}/{current.planned}
          <span className="ml-1 text-base font-semibold text-muted">esta semana</span>
        </p>
        <div className="mt-3">
          <ProgressBar value={current.planned ? current.attended / current.planned : 0} label="Sesiones de esta semana" />
        </div>
        <p className="mt-2 text-sm text-muted">
          {att.compliancePct ?? "—"} % en 8 semanas · racha de {att.streakWeeks} sem
        </p>
      </Card>
      <Card>
        <CardHeader title="Peso (promedio 7 d)" />
        <p className="num text-3xl font-extrabold">
          {fmtNum(trend.avg7d, 1)}
          <span className="ml-1 text-base font-semibold text-muted">kg</span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          {trend.ratePerWeek != null && (trend.ratePerWeek >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />)}
          {trend.ratePerWeek == null ? "Faltan datos para la tendencia" : `${trend.ratePerWeek > 0 ? "+" : ""}${fmtNum(trend.ratePerWeek, 2)} kg/sem · ${fmtNum(trend.pctPerWeek, 2)} %`}
        </p>
      </Card>
      <Card>
        <CardHeader title="Cintura (8 semanas)" />
        <p className="num text-3xl font-extrabold">
          {fmtNum(waist.last?.value, 1)}
          <span className="ml-1 text-base font-semibold text-muted">cm</span>
        </p>
        <p className="mt-1 text-sm text-muted">{waist.change == null ? "Mide cada semana para ver el cambio" : `${waist.change > 0 ? "+" : ""}${fmtNum(waist.change, 1)} cm`}</p>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Tendencia de peso" subtitle="Puntos = pesajes · línea = promedio de 7 días" />
        {chart.length ? <TrendChart data={chart} unit="kg" dotsLabel="Peso" /> : <EmptyState title="Sin pesajes" />}
      </Card>
      <Card>
        <CardHeader title="Proteína (7 días)" />
        <p className="num text-3xl font-extrabold">
          {fmtNum(nutrition.avgProteinG, 0)}
          <span className="ml-1 text-base font-semibold text-muted">g/día</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          Meta {target ?? "—"} g · {nutrition.daysHitTarget}/{nutrition.daysLogged} días cumplidos
        </p>
        <div className="mt-3">
          <ProgressBar value={target && nutrition.avgProteinG ? nutrition.avgProteinG / target : 0} color="var(--accent)" label="Proteína media vs meta" />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Volumen de esta semana" subtitle="Series duras por músculo vs objetivo 12-20" />
        <VolumeBars sets={weekSets} />
      </Card>
      <Card>
        <CardHeader title="Mejores levantamientos" subtitle="e1RM estimado (Epley)" />
        {best.length === 0 ? (
          <EmptyState icon={<Dumbbell className="size-6" />} title="Aún sin datos" />
        ) : (
          <ul className="space-y-2.5">
            {best.map(({ ex, t }) => (
              <li key={ex!.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{ex!.name}</span>
                <span className="num font-semibold">{formatWeight(t.bestE1rmKg, ex!.displayUnit)}</span>
                {t.e1rmChangePct != null && <Badge tone={t.e1rmChangePct > 0 ? "primary" : t.e1rmChangePct < 0 ? "danger" : "neutral"}>{t.e1rmChangePct > 0 ? "+" : ""}{fmtNum(t.e1rmChangePct, 0)}%</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Asistencia" />
        <AttendanceHeatmap weeks={weeks} today={today} />
      </Card>
      <Card>
        <CardHeader title="Último informe del coach" action={report && <Badge tone={VERDICT_LABEL[report.verdict].tone}>{VERDICT_LABEL[report.verdict].text}</Badge>} />
        <p className="line-clamp-5 text-sm text-muted">{report?.summary ?? "Aún no hay informes."}</p>
        <Link href="/coach" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          <Sparkles className="size-4" /> Ir al coach
        </Link>
      </Card>
    </div>
  );
}

function Strength() {
  const data = useData();
  const done = useMemo(() => {
    const ids = new Set(data.workouts.filter((w) => w.status === "completed").flatMap((w) => w.entries.map((e) => e.exerciseId)));
    return [...ids].map((id) => data.exerciseMap.get(id)).filter((e) => !!e).sort((a, b) => a!.name.localeCompare(b!.name, "es"));
  }, [data.workouts, data.exerciseMap]);
  const [id, setId] = useState(done[0]?.id ?? "");
  const ex = data.exerciseMap.get(id);
  const history = useMemo(() => (id ? exerciseHistory(data.workouts, id) : []), [data.workouts, id]);
  const t = exerciseTrend(history);
  const unit = ex?.displayUnit ?? "kg";

  if (done.length === 0) return <Card><EmptyState icon={<Dumbbell className="size-6" />} title="Registra tu primera sesión para ver la fuerza" /></Card>;

  return (
    <div className="space-y-4">
      <Select aria-label="Ejercicio" value={id} onChange={(e) => setId(e.target.value)}>
        {done.map((e) => (
          <option key={e!.id} value={e!.id}>
            {e!.name}
          </option>
        ))}
      </Select>
      <Card>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <Stat label="Mejor e1RM" value={t.bestE1rmKg ? round(fromKg(t.bestE1rmKg, unit), 1) : "—"} unit={unit} />
          <Stat label="Cambio" value={t.e1rmChangePct == null ? "—" : `${t.e1rmChangePct > 0 ? "+" : ""}${fmtNum(t.e1rmChangePct, 1)}`} unit="%" />
          <Stat label="Sesiones" value={t.sessions} />
        </div>
        <LinesChart
          unit={unit}
          data={history.map((h) => ({
            date: h.date,
            e1rm: h.e1rmKg ? round(fromKg(h.e1rmKg, unit), 1) : null,
            top: h.topWeightKg ? round(fromKg(h.topWeightKg, unit), 1) : null,
            reps: h.totalReps,
          }))}
          lines={
            history.some((h) => h.e1rmKg)
              ? [
                  { key: "e1rm", label: "e1RM", color: "var(--primary)" },
                  { key: "top", label: "Carga máx.", color: "var(--accent)", dashed: true },
                ]
              : [{ key: "reps", label: "Reps totales", color: "var(--primary)" }]
          }
        />
        <p className="mt-2 text-xs text-muted">e1RM = estimación (Epley); solo de este ejercicio concreto, sin mezclar sustitutos.</p>
      </Card>
      <Card>
        <CardHeader title="Sesiones" />
        <ul className="divide-y divide-line text-sm">
          {[...history].reverse().map((h) => (
            <li key={h.workoutId + h.date} className="flex min-h-11 items-center gap-2">
              <span className="w-20 shrink-0 text-muted">{h.date.slice(5)}</span>
              <span className="num min-w-0 flex-1 truncate">{h.sets.map((s) => `${s.reps}${s.weightKg ? `×${round(fromKg(s.weightKg, unit), 1)}` : ""}`).join(" · ")}</span>
              {h.substituted && <Badge tone="violet">Sustituto</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Body() {
  const data = useData();
  const { today } = useToday();
  const series = (field: "chestCm" | "armCm" | "waistCm") => dailyMeans(data.bodyMetrics, field).map((d) => ({ date: d.date, value: d.value, avg: d.value }));
  const weights = dailyMeans(data.bodyMetrics, "weightKg");
  const ma = new Map(movingAverage7d(weights).map((d) => [d.date, d.value]));
  const w = weights.filter((d) => d.date >= addDays(today, -365)).map((d) => ({ date: d.date, value: round(d.value, 1), avg: ma.get(d.date) ?? null }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader title="Peso (1 año)" />
        {w.length ? <TrendChart data={w} unit="kg" dotsLabel="Peso" height={260} /> : <EmptyState title="Sin pesajes" />}
      </Card>
      {(
        [
          ["waistCm", "Cintura", "var(--violet)"],
          ["chestCm", "Pecho", "var(--primary)"],
          ["armCm", "Brazo", "var(--accent)"],
        ] as const
      ).map(([f, label, color]) => {
        const s = series(f);
        return (
          <Card key={f}>
            <CardHeader title={`${label} (cm)`} />
            {s.length ? <TrendChart data={s} unit="cm" dotsLabel={label} lineLabel={label} color={color} dotColor={color} /> : <EmptyState title={`Sin medidas de ${label.toLowerCase()}`} />}
          </Card>
        );
      })}
    </div>
  );
}

function Volume() {
  const data = useData();
  const { today } = useToday();
  const [which, setWhich] = useState<"this" | "last">("this");
  const ws = which === "this" ? weekStart(today) : addDays(weekStart(today), -7);
  const sets = useMemo(
    () => setsByMuscle(data.workouts.filter((w) => w.date >= ws && w.date <= addDays(ws, 6)), data.exerciseMap),
    [data.workouts, data.exerciseMap, ws],
  );
  const history = useMemo(
    () =>
      lastWeekStarts(today, 8).map((start) => {
        const s = setsByMuscle(data.workouts.filter((w) => w.date >= start && w.date <= addDays(start, 6)), data.exerciseMap);
        return { date: start, chest: s.chest ?? 0, back: s.back ?? 0, shoulders: s.shoulders ?? 0, triceps: s.triceps ?? 0 };
      }),
    [data.workouts, data.exerciseMap, today],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Series duras por músculo"
          action={<Segmented label="Semana" className="w-52" value={which} onChange={setWhich} options={[{ value: "this", label: "Esta" }, { value: "last", label: "Anterior" }]} />}
        />
        <VolumeBars sets={sets} />
      </Card>
      <Card>
        <CardHeader title="Prioridades (8 semanas)" subtitle="Pecho, espalda, hombros y tríceps" />
        <LinesChart
          unit="series"
          data={history}
          lines={[
            { key: "chest", label: "Pecho", color: "var(--primary)" },
            { key: "back", label: "Espalda", color: "var(--violet)" },
            { key: "shoulders", label: "Hombros", color: "var(--accent)" },
            { key: "triceps", label: "Tríceps", color: "var(--amber)" },
          ]}
        />
        <p className="mt-2 text-xs text-muted">Objetivo de referencia 12-20 series/semana por músculo; marcamos menos de 10 o más de 22.</p>
      </Card>
    </div>
  );
}
