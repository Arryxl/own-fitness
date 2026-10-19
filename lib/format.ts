import { parseISODate } from "@/lib/analytics/dates";
import type { Equipment, Goal, Level, Muscle, SubstitutionReason, Verdict } from "@/lib/types";

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

export function fmtCop(n: number | null | undefined, currency = "COP"): string {
  if (n == null) return "—";
  try {
    return n.toLocaleString(LOCALE, { style: "currency", currency, maximumFractionDigits: currency === "COP" || currency === "CLP" ? 0 : 2 });
  } catch {
    return `${n.toLocaleString(LOCALE)} ${currency}`;
  }
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
  side_delts: "Hombro lateral",
  rear_delts: "Hombro posterior",
  front_delts: "Hombro frontal",
  traps: "Trapecio",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quads: "Cuádriceps",
  hamstrings: "Isquios",
  glutes: "Glúteos",
  calves: "Pantorrillas",
  abs: "Abdomen",
  cardio: "Cardio",
};

export const GOAL_LABEL: Record<Goal, string> = {
  hipertrofia: "Crecer",
  fuerza: "Fuerza",
  definicion: "Definir",
};

export const LEVEL_LABEL: Record<Level, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
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

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  machine: "Máquinas",
  dumbbell: "Mancuernas",
  barbell: "Barra libre",
  rack: "Rack con seguros",
  smith: "Smith",
  cable: "Poleas",
  bodyweight: "Peso corporal",
  bench: "Banco",
  band: "Bandas",
};
