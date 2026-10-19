"use client";

import { Check, Lightbulb, X } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, CardHeader } from "@/components/ui";
import { patchDoc, putDoc } from "@/lib/db/write";
import { WEEKDAY_LONG } from "@/lib/format";
import { applyProposal } from "@/lib/proposals";
import type { PlanChangeProposal, PlanItem } from "@/lib/types";
import { PLACE_LABEL } from "@/lib/week";

const OP_LABEL: Record<PlanChangeProposal["op"], string> = {
  replace_exercise: "Cambiar ejercicio",
  change_sets: "Cambiar series",
  change_reps: "Cambiar repeticiones",
  add_exercise: "Añadir ejercicio",
  remove_exercise: "Quitar ejercicio",
  move_session: "Mover de día",
  remove_session: "Quitar bloque",
  add_block: "Nuevo bloque",
};

const unit = (u: PlanItem["repUnit"]) => (u === "seconds" ? " s" : u === "minutes" ? " min" : " reps");

/** Coach proposals: nothing changes in the plan until the user approves here. */
export function Proposals({ id = "propuestas" }: { id?: string }) {
  const data = useData();
  const toast = useToast();
  if (data.proposals.length === 0) return null;
  const name = (exId?: string | null) => (exId ? (data.exerciseMap.get(exId)?.name ?? exId) : "");

  return (
    <Card id={id} className="border-violet/30">
      <CardHeader title="Propuestas del coach" subtitle="No se aplican hasta que las apruebes" />
      <ul className="space-y-3">
        {data.proposals.map((p) => {
          const plan = data.plans.find((x) => x.id === p.planId);
          const session = plan?.sessions.find((s) => s.key === p.sessionKey);
          const b = p.op === "add_block" ? p.block : null;
          return (
            <li key={p.id} className="rounded-2xl bg-violet-soft p-4 text-sm">
              <p className="flex items-start gap-2 font-semibold">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-violet" /> {p.summary}
              </p>
              <p className="mt-1 text-muted">{p.rationale}</p>
              {b ? (
                <div className="mt-2 text-xs">
                  <p>
                    <b>{OP_LABEL[p.op]}</b> · {b.name} · {PLACE_LABEL[b.place]} · ~{b.estimatedMinutes} min ·{" "}
                    {b.weekdays.map((d) => WEEKDAY_LONG[d - 1]).join(", ")}
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {b.items.map((it, i) => (
                      <li key={i}>
                        {name(it.exerciseId)} · {it.sets}×{it.repMin === it.repMax ? it.repMin : `${it.repMin}-${it.repMax}`}
                        {unit(it.repUnit)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-xs">
                  <b>{OP_LABEL[p.op]}</b> · {session?.name ?? p.sessionKey}
                  {p.exerciseId && ` · ${name(p.exerciseId)}`}
                  {p.newExerciseId && ` → ${name(p.newExerciseId)}`}
                  {p.sets ? ` · ${p.sets} series` : ""}
                  {p.repMin && p.repMax ? ` · ${p.repMin}-${p.repMax}${unit(p.repUnit ?? "reps")}` : ""}
                  {p.op === "move_session" && ` → ${p.weekday ? WEEKDAY_LONG[p.weekday - 1] : "sin día fijo"}`}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const next = plan && applyProposal(plan, p);
                    if (!next) {
                      toast("La propuesta ya no aplica al plan actual.", "error");
                      patchDoc(data.uid, "proposals", p.id, { status: "rejected" });
                      return;
                    }
                    putDoc(data.uid, "plans", next.id, next);
                    patchDoc(data.uid, "proposals", p.id, { status: "accepted", decidedAt: Date.now() });
                    toast(b ? "Bloque añadido a tu semana" : "Plan actualizado", "success");
                  }}
                >
                  <Check className="size-4" /> Aplicar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => patchDoc(data.uid, "proposals", p.id, { status: "rejected", decidedAt: Date.now() })}>
                  <X className="size-4" /> Rechazar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
