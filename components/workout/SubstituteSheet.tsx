"use client";

import clsx from "clsx";
import { ArrowRight, Ban, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { Badge, Button, Sheet, Toggle } from "@/components/ui";
import { useAiEnabled } from "@/lib/hooks/useAi";
import { REASON_LABEL } from "@/lib/format";
import type { Exercise, SubstitutionReason } from "@/lib/types";

export interface AiSubstitute {
  name: string;
  equipment: string[];
  cues: string;
  rationale: string;
}

/**
 * "No puedo hacer este": shows the fallback chain in order with its condition,
 * applies the default rules (section 9.5) and lets the user swap with one tap.
 */
export function SubstituteSheet({
  open,
  onClose,
  exercise,
  exerciseMap,
  allExercises,
  onPick,
  onSkip,
  onMarkUnavailable,
  onCreateCustom,
}: {
  open: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  exerciseMap: Map<string, Exercise>;
  allExercises: Exercise[];
  onPick: (target: Exercise, reason: SubstitutionReason) => void;
  onSkip: (reason: SubstitutionReason) => void;
  onMarkUnavailable: (ex: Exercise) => void;
  onCreateCustom: (s: AiSubstitute, reason: SubstitutionReason) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<SubstitutionReason>("busy");
  const [markMissing, setMarkMissing] = useState(true);
  const aiOn = useAiEnabled();
  const [ai, setAi] = useState<{ loading: boolean; result?: AiSubstitute; error?: string }>({ loading: false });

  const chain = useMemo(() => {
    if (!exercise) return [];
    const links = exercise.fallbackChain
      .map((l) => ({ link: l, ex: exerciseMap.get(l.exerciseId) }))
      .filter((x): x is { link: typeof x.link; ex: Exercise } => !!x.ex);
    // Same family + primary muscle from the catalog, if the chain runs out.
    const extra = allExercises.filter(
      (e) =>
        e.id !== exercise.id &&
        e.family === exercise.family &&
        e.primaryMuscle === exercise.primaryMuscle &&
        !links.some((l) => l.ex.id === e.id),
    );
    return [...links, ...extra.map((ex) => ({ link: { exerciseId: ex.id, when: "Misma familia de movimiento" }, ex }))];
  }, [exercise, exerciseMap, allExercises]);

  const usable = chain.filter(({ ex }) => ex.available && (reason !== "no_spotter" || ex.spotterFree));
  const firstUsable = usable[0]?.ex.id;

  if (!exercise) return null;

  async function askAi() {
    if (!user || !exercise) return;
    setAi({ loading: true });
    try {
      const res = await authedFetch(user, "/api/ai/substitute", { method: "POST", body: JSON.stringify({ exerciseId: exercise.id, reason }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setAi({ loading: false, result: body as AiSubstitute });
    } catch (e) {
      setAi({ loading: false, error: (e as Error).message });
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="No puedo hacer este">
      <p className="text-sm text-muted">
        <span className="font-semibold text-ink">{exercise.name}</span> · ¿qué pasa?
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
        {(Object.keys(REASON_LABEL) as SubstitutionReason[]).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={clsx("min-h-10 rounded-full px-3.5 text-sm font-semibold", reason === r ? "bg-primary text-on-primary" : "bg-sunken text-muted")}
          >
            {REASON_LABEL[r]}
          </button>
        ))}
      </div>

      <p className="mt-3 rounded-2xl bg-sunken px-3 py-2 text-xs text-muted">
        {reason === "busy" && "Regla: si está ocupado más de ~3 min, pasa al siguiente eslabón."}
        {reason === "pain" && "Regla: elige una alternativa que cambie ángulo o agarre. Si el dolor persiste, omite el ejercicio y anótalo. Ante dolor agudo, para y consulta a un profesional."}
        {reason === "no_spotter" && "Solo se muestran alternativas seguras sin compañero."}
        {reason === "missing" && "Puedes marcarlo como no disponible para que no vuelva a aparecer como opción."}
        {reason === "fatigue" && "Una alternativa más estable (máquina/polea) suele permitir buen esfuerzo con menos fatiga."}
        {reason === "other" && "Elige cualquier alternativa de la cadena."}
      </p>

      {reason === "missing" && (
        <div className="mt-2">
          <Toggle checked={markMissing} onChange={setMarkMissing} label="Marcar como no disponible en mi gimnasio" />
        </div>
      )}

      <ol className="mt-3 space-y-2">
        {chain.map(({ link, ex }, i) => {
          const blocked = !ex.available || (reason === "no_spotter" && !ex.spotterFree);
          return (
            <li key={ex.id}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => {
                  if (reason === "missing" && markMissing) onMarkUnavailable(exercise);
                  onPick(ex, reason);
                  onClose();
                }}
                className={clsx(
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  ex.id === firstUsable ? "border-primary bg-primary-soft/50" : "border-line bg-surface-strong",
                  blocked ? "opacity-50" : "hover:border-primary",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{ex.name}</span>
                  <span className="block text-xs text-muted">{link.when}</span>
                </span>
                {ex.id === firstUsable && <Badge tone="primary">Sugerido</Badge>}
                {!ex.available && <Badge tone="neutral">No disponible</Badge>}
                {!ex.spotterFree && <Badge tone="amber">Compañero</Badge>}
                {!blocked && <ArrowRight className="size-4 shrink-0 text-muted" />}
              </button>
            </li>
          );
        })}
      </ol>

      {usable.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-line p-3 text-sm">
          <p className="font-semibold">No queda ninguna alternativa disponible.</p>
          <p className="text-muted">La IA puede proponer un reemplazo del mismo patrón y músculo; tú lo confirmas.</p>
          {ai.result ? (
            <div className="mt-3 rounded-2xl bg-violet-soft p-3">
              <p className="font-semibold">{ai.result.name}</p>
              <p className="text-xs text-muted">{ai.result.rationale}</p>
              {ai.result.cues && <p className="mt-1 text-xs">💡 {ai.result.cues}</p>}
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  onCreateCustom(ai.result!, reason);
                  onClose();
                }}
              >
                Crear y usar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="soft" className="mt-2" onClick={askAi} disabled={ai.loading || !aiOn.enabled}>
              <Sparkles className="size-4" /> {ai.loading ? "Pensando…" : !aiOn.enabled ? "Coach de IA desactivado" : "Pedir sugerencia a la IA"}
            </Button>
          )}
          {ai.error && <p className="mt-2 text-xs text-danger">{ai.error}</p>}
        </div>
      )}

      <Button
        variant="ghost"
        className="mt-3 w-full"
        onClick={() => {
          onSkip(reason);
          onClose();
        }}
      >
        <Ban className="size-4" /> Omitir hoy y anotarlo
      </Button>
    </Sheet>
  );
}
