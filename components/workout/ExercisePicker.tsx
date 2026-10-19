"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Input, Sheet } from "@/components/ui";
import { MUSCLE_LABEL } from "@/lib/format";
import type { Exercise, Muscle } from "@/lib/types";
import { ExerciseThumb } from "./ExerciseDemo";

export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
  title = "Elegir ejercicio",
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (e: Exercise) => void;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const muscles = useMemo(() => [...new Set(exercises.map((e) => e.primaryMuscle))], [exercises]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return exercises.filter(
      (e) =>
        (muscle === "all" || e.primaryMuscle === muscle) &&
        (!t || e.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(t)),
    );
  }, [exercises, q, muscle]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-surface-strong px-1 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio…" className="pl-10" aria-label="Buscar ejercicio" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", ...muscles] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMuscle(m)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${muscle === m ? "bg-primary text-on-primary" : "bg-sunken text-muted"}`}
            >
              {m === "all" ? "Todos" : MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                onPick(e);
                onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-sunken"
            >
              <ExerciseThumb exerciseId={e.id} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{e.name}</span>
                <span className="block text-xs text-muted">{MUSCLE_LABEL[e.primaryMuscle]}</span>
              </span>
              {!e.available && <Badge tone="neutral">No disponible</Badge>}
              {!e.spotterFree && <Badge tone="amber">Requiere compañero</Badge>}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Sin resultados</li>}
      </ul>
    </Sheet>
  );
}
