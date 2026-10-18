"use client";

import clsx from "clsx";
import { addDays } from "@/lib/analytics/dates";
import type { WeekAttendance } from "@/lib/analytics/attendance";
import { WEEKDAY_SHORT, fmtShortDate } from "@/lib/format";

/** Weeks as columns, weekdays as rows: attended / planned-but-missed / rest. */
export function AttendanceHeatmap({ weeks, today }: { weeks: WeekAttendance[]; today: string }) {
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="grid" aria-label="Calendario de asistencia">
        <div className="flex shrink-0 flex-col gap-1.5 pt-6" aria-hidden>
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="flex h-6 items-center text-[0.65rem] font-semibold text-muted">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w.weekStart} role="row" className="flex shrink-0 flex-col gap-1.5">
            <span className="h-5 text-center text-[0.6rem] text-muted">{fmtShortDate(w.weekStart).replace(".", "")}</span>
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(w.weekStart, i);
              const attended = w.attendedDates.includes(date);
              const planned = w.plannedDates.includes(date);
              const future = date > today;
              const state = attended ? "Fui" : planned ? (future ? "Planeado" : "No fui") : "Descanso";
              return (
                <span
                  key={date}
                  role="gridcell"
                  title={`${fmtShortDate(date)}: ${state}`}
                  aria-label={`${fmtShortDate(date)}: ${state}`}
                  className={clsx(
                    "block size-6 rounded-md",
                    attended && "bg-primary",
                    !attended && planned && !future && "border-2 border-accent bg-accent-soft",
                    !attended && planned && future && "border-2 border-dashed border-primary/40",
                    !attended && !planned && "bg-sunken",
                    date === today && "ring-2 ring-ink/40 ring-offset-1 ring-offset-transparent",
                  )}
                />
              );
            })}
            <span className={clsx("mt-0.5 text-center text-[0.65rem] font-bold", w.met ? "text-primary" : "text-muted")}>
              {w.attended}/{w.planned}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <Legend className="bg-primary" label="Fui" />
        <Legend className="border-2 border-accent bg-accent-soft" label="Planeado, no fui" />
        <Legend className="border-2 border-dashed border-primary/40" label="Planeado" />
        <Legend className="bg-sunken" label="Descanso" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("size-3.5 rounded", className)} /> {label}
    </span>
  );
}
