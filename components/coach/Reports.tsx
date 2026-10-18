"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleHelp, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { addDays, weekStart } from "@/lib/analytics/dates";
import { VERDICT_LABEL, fmtShortDate } from "@/lib/format";
import { useAiPost } from "@/lib/hooks/useAi";
import { useToday } from "@/lib/hooks/useToday";
import type { AiReport } from "@/lib/types";

const SIGNAL_LABEL: Record<string, string> = {
  constancia: "Constancia",
  sobrecarga: "Sobrecarga progresiva",
  volumen: "Volumen",
  peso: "Peso",
  cintura: "Cintura",
  proteina: "Proteína",
};

const STATUS_ICON = {
  good: <CheckCircle2 className="size-4 text-primary" />,
  warn: <TriangleAlert className="size-4 text-amber" />,
  bad: <CircleAlert className="size-4 text-danger" />,
  unknown: <CircleHelp className="size-4 text-muted" />,
};

export function Reports() {
  const data = useData();
  const post = useAiPost();
  const toast = useToast();
  const { today } = useToday();
  const [busy, setBusy] = useState<"last" | "current" | null>(null);

  async function generate(which: "last" | "current") {
    setBusy(which);
    try {
      const periodStart = which === "last" ? addDays(weekStart(today), -7) : weekStart(today);
      await post("/api/ai/report", { periodStart });
      toast("Informe listo", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-muted">El coach revisa constancia, sobrecarga, volumen, peso, cintura y proteína con tus datos reales y te da máximo 3 acciones.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => generate("last")} disabled={!!busy}>
            {busy === "last" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analizar semana pasada
          </Button>
          <Button variant="soft" onClick={() => generate("current")} disabled={!!busy}>
            {busy === "current" && <Loader2 className="size-4 animate-spin" />} Semana actual (parcial)
          </Button>
        </div>
      </Card>
      {data.reports.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles className="size-6" />} title="Aún no hay informes">
            Se genera solo al abrir la app cuando termina una semana con datos, o pídelo arriba.
          </EmptyState>
        </Card>
      ) : (
        data.reports.map((r) => <ReportCard key={r.id} r={r} />)
      )}
    </div>
  );
}

export function ReportCard({ r }: { r: AiReport }) {
  const v = VERDICT_LABEL[r.verdict];
  return (
    <Card className="animate-rise">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={v.tone} className="text-sm">
          {v.text}
        </Badge>
        <span className="text-sm text-muted">
          {fmtShortDate(r.periodStart)} – {fmtShortDate(r.periodEnd)}
          {r.type === "adhoc" ? " · parcial" : ""}
        </span>
      </div>
      <p className="mt-3 leading-relaxed">{r.summary}</p>
      {r.signals.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {r.signals.map((s, i) => (
            <li key={i} className={clsx("flex items-start gap-2 rounded-2xl bg-sunken p-3 text-sm")}>
              <span className="mt-0.5 shrink-0">{STATUS_ICON[s.status]}</span>
              <span>
                <span className="block font-semibold">{SIGNAL_LABEL[s.key] ?? s.key}</span>
                <span className="text-muted">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {r.actions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold">Qué hacer</p>
          <ol className="mt-2 space-y-2">
            {r.actions.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
                <span className="pt-0.5">{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-[0.7rem] text-muted">Generado por {r.model}. Heurísticas, no consejo médico.</p>
    </Card>
  );
}
