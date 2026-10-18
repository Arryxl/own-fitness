import type { BodyMetric } from "@/lib/types";
import { addDays, daysBetween, tsToISODate } from "./dates";
import { round } from "./units";

export interface DailyValue {
  date: string;
  value: number;
}

/** Mean of all readings per calendar day (several weigh-ins a day are allowed). Oldest first. */
export function dailyMeans(metrics: BodyMetric[], field: "weightKg" | "waistCm" | "chestCm" | "armCm"): DailyValue[] {
  const byDay = new Map<string, number[]>();
  for (const m of metrics) {
    const v = m[field];
    if (v == null || !Number.isFinite(v)) continue;
    const d = tsToISODate(m.ts);
    byDay.set(d, [...(byDay.get(d) ?? []), v]);
  }
  return [...byDay.entries()]
    .map(([date, vs]) => ({ date, value: vs.reduce((a, b) => a + b, 0) / vs.length }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Trailing 7-calendar-day average for each day that has a reading
 * (averages the days with data inside the window).
 */
export function movingAverage7d(daily: DailyValue[]): DailyValue[] {
  return daily.map((d) => {
    const from = addDays(d.date, -6);
    const win = daily.filter((x) => x.date >= from && x.date <= d.date);
    return { date: d.date, value: round(win.reduce((a, b) => a + b.value, 0) / win.length, 2) };
  });
}

/** Least-squares slope in units/day. */
function slopePerDay(points: DailyValue[]): number | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export interface WeightTrend {
  latest: number | null;
  avg7d: number | null;
  /** kg per week from a linear fit over the window. */
  ratePerWeek: number | null;
  /** % of body weight per week. */
  pctPerWeek: number | null;
  daysOfData: number;
  spanDays: number;
}

export function weightTrend(daily: DailyValue[], windowDays = 21, today?: string): WeightTrend {
  if (daily.length === 0) {
    return { latest: null, avg7d: null, ratePerWeek: null, pctPerWeek: null, daysOfData: 0, spanDays: 0 };
  }
  const end = today ?? daily[daily.length - 1].date;
  const win = daily.filter((d) => d.date >= addDays(end, -(windowDays - 1)) && d.date <= end);
  const ma = movingAverage7d(daily);
  const avg7d = ma[ma.length - 1]?.value ?? null;
  const span = win.length >= 2 ? daysBetween(win[0].date, win[win.length - 1].date) : 0;
  // Need at least ~1 week of span for a meaningful rate.
  const slope = span >= 7 ? slopePerDay(win) : null;
  const rate = slope != null ? round(slope * 7, 2) : null;
  return {
    latest: round(daily[daily.length - 1].value, 2),
    avg7d,
    ratePerWeek: rate,
    pctPerWeek: rate != null && avg7d ? round((rate / avg7d) * 100, 2) : null,
    daysOfData: win.length,
    spanDays: span,
  };
}

export interface MeasurementChange {
  first: DailyValue | null;
  last: DailyValue | null;
  change: number | null;
}

export function measurementChange(daily: DailyValue[]): MeasurementChange {
  if (daily.length === 0) return { first: null, last: null, change: null };
  const first = daily[0];
  const last = daily[daily.length - 1];
  return { first, last, change: daily.length > 1 ? round(last.value - first.value, 1) : null };
}
