"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum, fmtShortDate } from "@/lib/format";

const axis = { fontSize: 11, fill: "var(--muted)" };

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-strong px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{label ? fmtShortDate(label) : ""}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p, i) => (
          <p key={i} className="num" style={{ color: p.color }}>
            {p.name}: {fmtNum(p.value, 1)} {unit}
          </p>
        ))}
    </div>
  );
}

export interface SeriesPoint {
  date: string;
  value: number | null;
  avg?: number | null;
}

/** Dots for raw readings + a smooth line for the 7-day average (weight). */
export function TrendChart({
  data,
  unit,
  height = 220,
  dotsLabel = "Medida",
  lineLabel = "Promedio 7 d",
  color = "var(--primary)",
  dotColor = "var(--accent)",
  band,
}: {
  data: SeriesPoint[];
  unit: string;
  height?: number;
  dotsLabel?: string;
  lineLabel?: string;
  color?: string;
  dotColor?: string;
  band?: { from: number; to: number };
}) {
  const values = data.flatMap((d) => [d.value, d.avg]).filter((v): v is number => v != null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Gráfico de ${dotsLabel.toLowerCase()}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickFormatter={fmtShortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} domain={[Math.floor(min - pad), Math.ceil(max + pad)]} width={44} allowDecimals={false} />
          {band && <ReferenceArea y1={band.from} y2={band.to} fill="var(--primary-soft)" fillOpacity={0.6} />}
          <Tooltip content={<ChartTooltip unit={unit} />} />
          {data.some((d) => d.avg != null) && (
            <Area type="monotone" dataKey="avg" name={lineLabel} stroke={color} strokeWidth={2.5} fill="url(#trendFill)" connectNulls dot={false} isAnimationActive={false} />
          )}
          <Scatter dataKey="value" name={dotsLabel} fill={dotColor} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Line chart for one or two series (e1RM and top load). */
export function LinesChart({
  data,
  lines,
  unit,
  height = 220,
}: {
  data: Record<string, number | string | null>[];
  lines: { key: string; label: string; color: string; dashed?: boolean }[];
  unit: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Gráfico de líneas">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickFormatter={fmtShortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={44} allowDecimals={false} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2.5}
              strokeDasharray={l.dashed ? "5 4" : undefined}
              dot={{ r: 3, fill: l.color }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily bars with an optional goal line (steps). */
export function DailyBars({ data, goal, unit, height = 200, color = "var(--violet)" }: { data: { date: string; value: number }[]; goal?: number; unit: string; height?: number; color?: string }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Gráfico de barras diario">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickFormatter={fmtShortDate} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--surface-sunken)" }} />
          {goal && <ReferenceLine y={goal} stroke="var(--primary)" strokeDasharray="5 4" label={{ value: "Meta", fill: "var(--primary)", fontSize: 11, position: "insideTopRight" }} />}
          <Bar dataKey="value" name="Valor" fill={color} radius={[8, 8, 8, 8]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
