"use client";

import { Footprints } from "lucide-react";
import { useMemo, useState } from "react";
import { DailyBars } from "@/components/charts/Charts";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, ProgressBar, Stat, parseNum } from "@/components/ui";
import { addDays } from "@/lib/analytics/dates";
import { patchProfile, putDoc } from "@/lib/db/write";
import { fmtDate, fmtNum } from "@/lib/format";
import { useToday } from "@/lib/hooks/useToday";

export default function ActivityPage() {
  const data = useData();
  const toast = useToast();
  const { today } = useToday();
  const [date, setDate] = useState(today);
  const existing = data.activity.find((a) => a.date === date);
  const [steps, setSteps] = useState("");
  const [minutes, setMinutes] = useState("");
  const target = data.profile?.stepsTarget ?? 8000;
  const [targetDraft, setTargetDraft] = useState(String(target));

  const last14 = useMemo(() => {
    const byDate = new Map(data.activity.map((a) => [a.date, a]));
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      return { date: d, value: byDate.get(d)?.steps ?? 0 };
    });
  }, [data.activity, today]);
  const withData = last14.filter((d) => d.value > 0);
  const avg = withData.length ? withData.reduce((a, b) => a + b.value, 0) / withData.length : null;
  const hits = withData.filter((d) => d.value >= target).length;
  const todaySteps = data.activity.find((a) => a.date === today)?.steps ?? 0;

  function save() {
    const s = parseNum(steps);
    const m = parseNum(minutes);
    if (s == null && m == null) return;
    // One document per day (id = date): re-saving a day overwrites it.
    putDoc(data.uid, "activity", date, {
      date,
      steps: s ?? existing?.steps ?? null,
      walkMinutes: m ?? existing?.walkMinutes ?? null,
      notes: existing?.notes ?? "",
    });
    setSteps("");
    setMinutes("");
    toast("Actividad guardada", "success");
  }

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Pasos y caminata" subtitle="Pesas + caminar es la combinación con mejor respaldo para bajar grasa" />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Hoy" />
            <p className="num text-3xl font-extrabold">
              {fmtNum(todaySteps, 0)}
              <span className="ml-1 text-base font-semibold text-muted">/ {fmtNum(target, 0)} pasos</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={todaySteps / target} color="var(--violet)" label="Pasos de hoy" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Registrar" subtitle={existing ? `Ya hay datos del ${fmtDate(date, { day: "numeric", month: "short" })}: se actualizarán` : undefined} />
            <div className="space-y-3">
              <Field label="Día">{(id) => <Input id={id} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pasos">{(id) => <Input id={id} inputMode="numeric" placeholder={existing?.steps ? String(existing.steps) : "8000"} value={steps} onChange={(e) => setSteps(e.target.value)} className="num text-lg font-bold" />}</Field>
                <Field label="Min. caminando">{(id) => <Input id={id} inputMode="numeric" placeholder={existing?.walkMinutes ? String(existing.walkMinutes) : "30"} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="num text-lg font-bold" />}</Field>
              </div>
              <Button className="w-full" onClick={save}>
                Guardar
              </Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Meta diaria" subtitle="Por defecto: tu base + 2 500 pasos, entre 8 000 y 10 000" />
            <div className="flex gap-2">
              <Input aria-label="Meta de pasos" inputMode="numeric" value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} className="num" />
              <Button
                variant="soft"
                onClick={() => {
                  const n = parseNum(targetDraft);
                  if (n && n > 0) patchProfile(data.uid, { stepsTarget: Math.round(n) });
                }}
              >
                Guardar
              </Button>
            </div>
          </Card>
        </div>
        <Card>
          <CardHeader title="Últimos 14 días" />
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="Promedio (días con datos)" value={fmtNum(avg, 0)} unit="pasos" />
            <Stat label="Días en la meta" value={hits} unit={`/ ${withData.length}`} />
          </div>
          {withData.length ? (
            <DailyBars data={last14} goal={target} unit="pasos" height={260} />
          ) : (
            <EmptyState icon={<Footprints className="size-6" />} title="Sin pasos registrados">
              Copia el número de pasos de tu celular o reloj al final del día.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
