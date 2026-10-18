"use client";

import { Dumbbell, House, Play, Plus } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { WorkoutLogger } from "@/components/workout/WorkoutLogger";
import { sessionForDate } from "@/lib/analytics/attendance";
import { newId, putDoc } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";
import type { PlanSession } from "@/lib/types";
import { buildWorkout, estimateMinutes } from "@/lib/workout";

export default function TrainPage() {
  const data = useData();
  const { today, weekKey } = useToday();
  const active = data.workouts.find((w) => w.status === "in_progress");
  const plan = data.activePlan;

  if (active) return <WorkoutLogger key={active.id} initial={active} />;

  const todays = sessionForDate(plan, today, data.weekPlans.get(weekKey) ?? null);

  function start(session: PlanSession | null) {
    const id = newId(data.uid, "workouts");
    putDoc(data.uid, "workouts", id, buildWorkout({ id, date: today, plan, session, exercises: data.exerciseMap, workouts: data.workouts, records: data.records }));
  }

  return (
    <div className="animate-rise">
      <PageHeader title="Entrenar" subtitle={plan ? plan.name : "Sin plan activo"} />
      {!plan ? (
        <Card>
          <EmptyState icon={<Dumbbell className="size-6" />} title="No hay plan activo" action={<Button onClick={() => start(null)}>Entrenamiento libre</Button>}>
            Elige un plan en la sección Planes o entrena libre.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plan.sessions.map((s) => {
            const isToday = todays?.key === s.key;
            return (
              <Card key={s.key} className={isToday ? "ring-2 ring-primary" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      {isToday && <Badge tone="primary">Hoy</Badge>}
                      {s.kind === "floating" && <Badge tone="violet">Flotante · mar/jue</Badge>}
                      {s.kind === "home" && <Badge tone="amber">En casa</Badge>}
                      {s.weekday && <Badge tone="neutral">{WEEKDAY_LONG[s.weekday - 1]}</Badge>}
                    </div>
                    <h2 className="mt-2 text-lg font-bold">{s.name}</h2>
                    <p className="text-sm text-muted">{s.focus}</p>
                    <p className="mt-1 text-xs text-muted">
                      {s.items.length} ejercicios · ~{estimateMinutes(s)} min
                    </p>
                  </div>
                  <Button variant={isToday ? "primary" : "soft"} onClick={() => start(s)} aria-label={`Iniciar ${s.name}`} className="shrink-0">
                    {s.kind === "home" ? <House className="size-5" /> : <Play className="size-5" />}
                  </Button>
                </div>
              </Card>
            );
          })}
          <Card className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Entrenamiento libre</h2>
              <p className="text-sm text-muted">Empieza vacío y añade ejercicios.</p>
            </div>
            <Button variant="outline" onClick={() => start(null)} aria-label="Iniciar entrenamiento libre">
              <Plus className="size-5" />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
