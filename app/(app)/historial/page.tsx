"use client";

import clsx from "clsx";
import { ChevronDown, History, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AttendanceHeatmap } from "@/components/charts/AttendanceHeatmap";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Sheet, Stat } from "@/components/ui";
import { lastWeekStarts } from "@/lib/analytics/dates";
import { summarizeAttendance, weeklyAttendance } from "@/lib/analytics/attendance";
import { workingSets } from "@/lib/analytics/strength";
import { formatWeight } from "@/lib/analytics/units";
import { patchDoc, removeDoc } from "@/lib/db/write";
import { REASON_LABEL, fmtDate, fmtDuration, fmtNum } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";
import type { Workout } from "@/lib/types";

export default function HistoryPage() {
  const data = useData();
  const router = useRouter();
  const { today } = useToday();
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Workout | null>(null);

  const weeks = useMemo(
    () => weeklyAttendance({ plan: data.activePlan, workouts: data.workouts, weekStarts: lastWeekStarts(today, 12), floatingByWeek: data.weekPlans, today, startDate: data.profile?.startDate }),
    [data.activePlan, data.workouts, data.weekPlans, today, data.profile?.startDate],
  );
  const summary = summarizeAttendance(weeks);
  const done = [...data.workouts].filter((w) => w.status === "completed").reverse();
  const active = data.workouts.some((w) => w.status === "in_progress");

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Historial" subtitle="Asistencia semana a semana y sesiones registradas" />
      <Card>
        <CardHeader title="Asistencia (12 semanas)" />
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Cumplimiento" value={summary.compliancePct ?? "—"} unit="%" />
          <Stat label="Racha" value={summary.streakWeeks} unit="sem" hint="Semanas completas seguidas" />
          <Stat label="Semanas ≥ 3" value={summary.weeksWithAtLeast3} unit={`/ ${weeks.length}`} />
        </div>
        <AttendanceHeatmap weeks={weeks} today={today} />
      </Card>

      <Card>
        <CardHeader title="Sesiones" subtitle={`${done.length} registradas`} />
        {done.length === 0 ? (
          <EmptyState icon={<History className="size-6" />} title="Aún no hay sesiones">
            Tus entrenamientos terminados aparecerán aquí.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {done.map((w) => {
              const sets = w.entries.reduce((t, e) => t + workingSets(e.sets).length, 0);
              const isOpen = open === w.id;
              return (
                <li key={w.id} className="py-1">
                  <button type="button" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen} className="flex min-h-14 w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{w.sessionName}</span>
                      <span className="block text-xs text-muted first-letter:uppercase">
                        {fmtDate(w.date)} · {sets} series{w.endedAt ? ` · ${fmtDuration(w.endedAt - w.startedAt)}` : ""}
                        {w.effort ? ` · esfuerzo ${w.effort}/10` : ""}
                      </span>
                    </span>
                    <ChevronDown className={clsx("size-5 text-muted transition", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 pb-3">
                      {w.entries.map((e, i) => {
                        const ex = data.exerciseMap.get(e.exerciseId);
                        const unit = ex?.displayUnit ?? "kg";
                        return (
                          <div key={i} className="rounded-2xl bg-sunken p-3 text-sm">
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                              {e.nameSnapshot}
                              {e.plannedExerciseId && e.plannedExerciseId !== e.exerciseId && (
                                <Badge tone="violet">Sustituye a {data.exerciseMap.get(e.plannedExerciseId)?.name ?? "otro"}{e.substitutionReason ? ` · ${REASON_LABEL[e.substitutionReason]}` : ""}</Badge>
                              )}
                            </p>
                            <p className="num mt-1 text-muted">
                              {e.sets
                                .filter((s) => s.done)
                                .map((s) => `${s.isWarmup ? "C " : ""}${s.reps ?? "?"}${ex?.metric === "seconds" ? "s" : ""}${s.weightKg ? ` × ${formatWeight(s.weightKg, unit)}` : ""}${s.rir != null ? ` @RIR${s.rir}` : ""}`)
                                .join(" · ") || "Sin series"}
                            </p>
                            {e.notes && <p className="mt-1 text-xs">📝 {e.notes}</p>}
                          </div>
                        );
                      })}
                      {w.notes && <p className="text-sm text-muted">📝 {w.notes}</p>}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={active}
                          title={active ? "Termina la sesión en curso primero" : undefined}
                          onClick={() => {
                            patchDoc(data.uid, "workouts", w.id, { status: "in_progress", updatedAt: Date.now() });
                            router.push("/entrenar");
                          }}
                        >
                          <Pencil className="size-4" /> Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleting(w)}>
                          <Trash2 className="size-4" /> Borrar
                        </Button>
                        <span className="ml-auto self-center text-xs text-muted">
                          {fmtNum(w.entries.reduce((t, e) => t + workingSets(e.sets).reduce((a, s) => a + (s.reps ?? 0) * (s.weightKg ?? 0), 0), 0), 0)} kg movidos
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="¿Borrar esta sesión?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (deleting) removeDoc(data.uid, "workouts", deleting.id);
                setDeleting(null);
              }}
            >
              Borrar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          {deleting?.sessionName} del {deleting ? fmtDate(deleting.date) : ""}. Se perderán sus series. No se puede deshacer.
        </p>
      </Sheet>
    </div>
  );
}
