"use client";

import { Dumbbell, Footprints, Play, Plus } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { WorkoutLogger } from "@/components/workout/WorkoutLogger";
import { sessionForDate } from "@/lib/analytics/attendance";
import { newId, putDoc } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";
import type { PlanSession } from "@/lib/types";
import { buildWorkout, estimateMinutes } from "@/lib/workout";

export default function TrainPage() {
  const data = useData();
  const { today } = useToday();
  const active = data.workouts.find((w) => w.status === "in_progress");
  const plan = data.activePlan;

  if (active) return <WorkoutLogger key={active.id} initial={active} />;

  const todays = sessionForDate(plan, today);

  function start(session: PlanSession | null) {
    const id = newId(data.uid, "workouts");
    putDoc(data.uid, "workouts", id, buildWorkout({ id, date: today, plan, session, exercises: data.exerciseMap, addOns: data.addOns, workouts: data.workouts, records: data.records }));
  }

  return (
    <div className="animate-rise">
      <PageHeader title="Entrenar" subtitle={plan ? plan.name : "Sin plan activo"} />
      {!plan ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="size-6" />}
            title="Aún no tienes un plan"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/rutinas">Elegir rutina</LinkButton>
                <Button variant="outline" onClick={() => start(null)}>
                  Entrenamiento libre
                </Button>
              </div>
            }
          >
            Elige una de las rutinas reconocidas o entrena libre añadiendo ejercicios.
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
                      {s.kind === "cardio" && <Badge tone="violet">Cardio</Badge>}
                      {(s.optional || s.floating) && <Badge tone="amber">Opcional</Badge>}
                      {s.weekday && <Badge tone="neutral">{WEEKDAY_LONG[s.weekday - 1]}</Badge>}
                      {plan.rotation === "alternate" && <Badge tone="neutral">Rotación A/B</Badge>}
                    </div>
                    <h2 className="mt-2 text-lg font-bold">
                      {s.key} · {s.name}
                    </h2>
                    <p className="text-sm text-muted">{s.focus}</p>
                    <p className="mt-1 text-xs text-muted">
                      {s.items.length} ejercicios · ~{estimateMinutes(s)} min
                    </p>
                  </div>
                  <Button variant={isToday ? "primary" : "soft"} onClick={() => start(s)} aria-label={`Iniciar ${s.name}`} className="shrink-0">
                    {s.kind === "cardio" ? <Footprints className="size-5" /> : <Play className="size-5" />}
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
