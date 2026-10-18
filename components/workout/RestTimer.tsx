"use client";

import { Minus, Plus, TimerReset, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui";

export interface RestState {
  endsAt: number;
  total: number;
}

/** Floating rest timer shown after a set is marked done. Survives reloads via the parent's state. */
export function RestTimer({ rest, onChange }: { rest: RestState | null; onChange: (r: RestState | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);

  const left = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const finished = !!rest && left === 0;

  useEffect(() => {
    if (!finished) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* unsupported */
    }
  }, [finished]);

  if (!rest) return null;
  const pct = rest.total ? 1 - left / rest.total : 1;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6 lg:left-[17rem]">
      <div
        role="timer"
        aria-live="off"
        aria-label={`Descanso: ${mm} minutos ${ss} segundos`}
        className={`glass mx-auto flex max-w-md items-center gap-2 overflow-hidden rounded-3xl p-2 pl-4 ${finished ? "ring-2 ring-primary" : ""}`}
      >
        <div className="relative min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{finished ? "¡Descanso terminado!" : "Descanso"}</p>
          <p className="num text-2xl font-extrabold">
            {mm}:{ss}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
        <IconButton label="Restar 15 segundos" onClick={() => onChange({ ...rest, endsAt: rest.endsAt - 15000 })}>
          <Minus className="size-5" />
        </IconButton>
        <IconButton label="Sumar 15 segundos" onClick={() => onChange({ endsAt: Math.max(Date.now(), rest.endsAt) + 15000, total: rest.total + 15 })}>
          <Plus className="size-5" />
        </IconButton>
        <IconButton label="Reiniciar descanso" onClick={() => onChange({ endsAt: Date.now() + rest.total * 1000, total: rest.total })}>
          <TimerReset className="size-5" />
        </IconButton>
        <IconButton label="Cerrar temporizador" onClick={() => onChange(null)}>
          <X className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}
