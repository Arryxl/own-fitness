"use client";

import { Ruler, Scale, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TrendChart } from "@/components/charts/Charts";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, PageHeader, Segmented, Stat, parseNum } from "@/components/ui";
import { addDays, todayISO, tsToISODate } from "@/lib/analytics/dates";
import { dailyMeans, measurementChange, movingAverage7d, weightTrend } from "@/lib/analytics/bodyweight";
import { newId, putDoc, removeDoc } from "@/lib/db/write";
import { fmtNum } from "@/lib/format";

function localDateTimeValue(ts: number) {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function MeasurementsPage() {
  const data = useData();
  const toast = useToast();
  const [when, setWhen] = useState(() => localDateTimeValue(Date.now()));
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [arm, setArm] = useState("");
  const [range, setRange] = useState<"30" | "90" | "365">("90");

  const weights = useMemo(() => dailyMeans(data.bodyMetrics, "weightKg"), [data.bodyMetrics]);
  const waists = useMemo(() => dailyMeans(data.bodyMetrics, "waistCm"), [data.bodyMetrics]);
  const trend = weightTrend(weights);
  const waistChange = measurementChange(waists.filter((w) => w.date >= addDays(todayISO(), -56)));

  const chartData = useMemo(() => {
    const from = addDays(todayISO(), -Number(range));
    const ma = new Map(movingAverage7d(weights).map((d) => [d.date, d.value]));
    return weights.filter((d) => d.date >= from).map((d) => ({ date: d.date, value: Math.round(d.value * 10) / 10, avg: ma.get(d.date) ?? null }));
  }, [weights, range]);

  function save() {
    const w = parseNum(weight);
    const wa = parseNum(waist);
    const c = parseNum(chest);
    const a = parseNum(arm);
    if (w == null && wa == null && c == null && a == null) return;
    if ((w != null && (w < 30 || w > 250)) || (wa != null && (wa < 40 || wa > 200))) {
      toast("Revisa los valores: parecen fuera de rango.", "error");
      return;
    }
    const id = newId(data.uid, "bodyMetrics");
    putDoc(data.uid, "bodyMetrics", id, { ts: new Date(when).getTime(), weightKg: w, waistCm: wa, chestCm: c, armCm: a, notes: "" });
    setWeight("");
    setWaist("");
    setChest("");
    setArm("");
    toast("Medida guardada", "success");
  }

  const recent = [...data.bodyMetrics].reverse().slice(0, 15);
  const rateText =
    trend.ratePerWeek == null
      ? "Necesito ~1 semana de datos para la tendencia"
      : `${trend.ratePerWeek > 0 ? "+" : ""}${fmtNum(trend.ratePerWeek, 2)} kg/sem (${trend.pctPerWeek != null ? `${trend.pctPerWeek > 0 ? "+" : ""}${fmtNum(trend.pctPerWeek, 2)} %` : "—"})`;

  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Peso y medidas" subtitle="En recomposición, la cintura y las cargas dicen más que la báscula" />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader title="Nueva medida" subtitle="Deja vacío lo que no midas" />
          <div className="space-y-3">
            <Field label="Fecha y hora">{(id) => <Input id={id} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Peso (kg)">{(id) => <Input id={id} inputMode="decimal" placeholder="73,5" value={weight} onChange={(e) => setWeight(e.target.value)} className="num text-lg font-bold" />}</Field>
              <Field label="Cintura (cm)" hint="A la altura del ombligo">
                {(id) => <Input id={id} inputMode="decimal" placeholder="88" value={waist} onChange={(e) => setWaist(e.target.value)} className="num text-lg font-bold" />}
              </Field>
              <Field label="Pecho (cm)">{(id) => <Input id={id} inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} className="num" />}</Field>
              <Field label="Brazo (cm)">{(id) => <Input id={id} inputMode="decimal" value={arm} onChange={(e) => setArm(e.target.value)} className="num" />}</Field>
            </div>
            <Button className="w-full" onClick={save}>
              Guardar
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Peso corporal"
              action={
                <Segmented
                  label="Rango"
                  value={range}
                  onChange={setRange}
                  className="w-48"
                  options={[
                    { value: "30", label: "30 d" },
                    { value: "90", label: "90 d" },
                    { value: "365", label: "1 año" },
                  ]}
                />
              }
            />
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Stat label="Promedio 7 d" value={fmtNum(trend.avg7d, 1)} unit="kg" />
              <Stat label="Último" value={fmtNum(trend.latest, 1)} unit="kg" />
              <Stat label="Tendencia" value={trend.ratePerWeek == null ? "—" : `${trend.ratePerWeek > 0 ? "+" : ""}${fmtNum(trend.ratePerWeek, 2)}`} unit={trend.ratePerWeek == null ? "" : "kg/sem"} />
            </div>
            {chartData.length ? (
              <TrendChart data={chartData} unit="kg" dotsLabel="Peso" />
            ) : (
              <EmptyState icon={<Scale className="size-6" />} title="Sin registros de peso">
                Pésate por la mañana, después del baño y antes de comer.
              </EmptyState>
            )}
            <p className="mt-2 text-xs text-muted">{rateText}. Referencia (heurística): subir más de ~0,5 % por semana sostenido suele ser exceso de grasa.</p>
          </Card>

          <Card>
            <CardHeader title="Cintura" subtitle="Semanal, a la altura del ombligo" />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Stat label="Última" value={fmtNum(waists.at(-1)?.value, 1)} unit="cm" />
              <Stat label="Cambio 8 semanas" value={waistChange.change == null ? "—" : `${waistChange.change > 0 ? "+" : ""}${fmtNum(waistChange.change, 1)}`} unit="cm" />
            </div>
            {waists.length ? (
              <TrendChart data={waists.map((w) => ({ date: w.date, value: w.value, avg: w.value }))} unit="cm" dotsLabel="Cintura" lineLabel="Cintura" color="var(--violet)" dotColor="var(--violet)" />
            ) : (
              <EmptyState icon={<Ruler className="size-6" />} title="Sin medidas de cintura" />
            )}
          </Card>

          <Card>
            <CardHeader title="Registros recientes" />
            <ul className="divide-y divide-line text-sm">
              {recent.map((m) => (
                <li key={m.id} className="flex min-h-12 items-center gap-2">
                  <span className="w-24 shrink-0 text-muted">{tsToISODate(m.ts).slice(5)} {new Date(m.ts).toTimeString().slice(0, 5)}</span>
                  <span className="num min-w-0 flex-1">
                    {[m.weightKg != null && `${fmtNum(m.weightKg)} kg`, m.waistCm != null && `cintura ${fmtNum(m.waistCm)}`, m.chestCm != null && `pecho ${fmtNum(m.chestCm)}`, m.armCm != null && `brazo ${fmtNum(m.armCm)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <IconButton label="Borrar registro" className="size-10 text-muted" onClick={() => removeDoc(data.uid, "bodyMetrics", m.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
