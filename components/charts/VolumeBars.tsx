"use client";

import { PRIORITY_MUSCLES, TRACKED_MUSCLES, VOLUME_TARGET, volumeStatus, type MuscleCount } from "@/lib/analytics/volume";
import { MUSCLE_LABEL, fmtNum } from "@/lib/format";

const STATUS_COLOR = {
  low: "var(--accent)",
  near: "var(--amber)",
  ok: "var(--primary)",
  high: "var(--amber)",
  excess: "var(--accent)",
} as const;

/** Horizontal bars with the 12-20 weekly-set band shaded. */
export function VolumeBars({ sets, max = 26 }: { sets: MuscleCount; max?: number }) {
  const scale = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[0.7rem] text-muted">
        <span className="inline-block h-2.5 w-6 rounded bg-primary-soft" /> Rango objetivo {VOLUME_TARGET.min}-{VOLUME_TARGET.max} series/semana (heurística; secundarios cuentan ½)
      </div>
      {TRACKED_MUSCLES.map((m) => {
        const v = sets[m] ?? 0;
        const st = volumeStatus(v);
        const priority = PRIORITY_MUSCLES.includes(m);
        return (
          <div key={m} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
            <span className={`truncate text-sm ${priority ? "font-bold" : "text-muted"}`}>{MUSCLE_LABEL[m]}</span>
            <div className="relative h-4 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${MUSCLE_LABEL[m]}: ${fmtNum(v)} series`}>
              <div className="absolute inset-y-0 bg-primary-soft" style={{ left: scale(VOLUME_TARGET.min), width: `calc(${scale(VOLUME_TARGET.max)} - ${scale(VOLUME_TARGET.min)})` }} />
              <div className="absolute inset-y-0.5 left-0.5 rounded-full transition-[width] duration-500" style={{ width: `calc(${scale(v)} - 2px)`, background: STATUS_COLOR[st], opacity: priority ? 1 : 0.7 }} />
            </div>
            <span className="num text-right text-sm font-semibold">{fmtNum(v)}</span>
          </div>
        );
      })}
    </div>
  );
}
