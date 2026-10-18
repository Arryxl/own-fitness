import { parseISODate } from "@/lib/analytics/dates";
import type { Muscle, SubstitutionReason, Verdict } from "@/lib/types";

const LOCALE = "es-CO";

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return parseISODate(iso).toLocaleDateString(LOCALE, opts);
}

export function fmtShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function fmtCop(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString(LOCALE, { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  rear_delts: "Deltoide post.",
  triceps: "Tríceps",
  biceps: "Bíceps",
  quads: "Cuádriceps",
  hamstrings: "Isquios",
  glutes: "Glúteos",
  abs: "Abdomen",
  traps: "Trapecio",
  calves: "Pantorrillas",
};

export const REASON_LABEL: Record<SubstitutionReason, string> = {
  busy: "Equipo ocupado",
  missing: "No existe en mi gimnasio",
  pain: "Dolor / molestia",
  no_spotter: "Sin compañero",
  fatigue: "Fatiga",
  other: "Otro",
};

export const VERDICT_LABEL: Record<Verdict, { text: string; tone: "primary" | "amber" | "danger" | "neutral" }> = {
  on_track: { text: "Vas bien", tone: "primary" },
  mixed: { text: "Mixto", tone: "amber" },
  off_track: { text: "Hay que ajustar", tone: "danger" },
  insufficient_data: { text: "Faltan datos", tone: "neutral" },
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  machine: "Máquina",
  dumbbell: "Mancuernas",
  barbell: "Barra",
  ez_bar: "Barra Z",
  smith: "Smith",
  cable: "Polea",
  bodyweight: "Peso corporal",
  bench: "Banco",
  band: "Banda",
  pullup_assist: "Asistida",
  dip_station: "Paralelas",
  captains_chair: "Silla romana",
};
