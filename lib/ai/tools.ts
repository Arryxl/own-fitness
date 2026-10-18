import "server-only";
import { z } from "zod";
import { addDays, lastWeekStarts, weekStart } from "@/lib/analytics/dates";
import { summarizeAttendance, weeklyAttendance } from "@/lib/analytics/attendance";
import { dailyMeans, measurementChange, movingAverage7d, weightTrend } from "@/lib/analytics/bodyweight";
import { nutritionSummary, proteinRange, proteinTarget } from "@/lib/analytics/nutrition";
import { exerciseHistory, exerciseTrend, performanceDroppedTwice, workingSets } from "@/lib/analytics/strength";
import { round } from "@/lib/analytics/units";
import { PRIORITY_MUSCLES, VOLUME_TARGET, planVolume, setsByMuscle, volumeStatus } from "@/lib/analytics/volume";
import { adminDb } from "@/lib/firebase/admin";
import type { UserData } from "@/lib/server/userData";
import { searchMemories } from "./memory";

// Tools the coach may call. All read-only except propose_plan_change and
// save_memory, which only create *pending* items the user must approve in the UI.

export interface ToolContext {
  data: UserData;
}

interface ToolDef<A extends z.ZodType> {
  name: string;
  description: string;
  args: A;
  run: (args: z.infer<A>, ctx: ToolContext) => Promise<unknown>;
}

function tool<A extends z.ZodType>(def: ToolDef<A>) {
  return def;
}

const weeksArg = (max: number, def: number) => z.coerce.number().int().min(1).max(max).default(def);
const daysArg = (max: number, def: number) => z.coerce.number().int().min(1).max(max).default(def);

const r1 = (n: number | null | undefined) => (n == null ? null : round(n, 1));

async function findExercise(ctx: ToolContext, q: string) {
  const list = await ctx.data.exercises();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const t = norm(q);
  return list.find((e) => e.id === q) ?? list.find((e) => norm(e.name) === t) ?? list.find((e) => norm(e.name).includes(t)) ?? null;
}

const TOOLS = [
  tool({
    name: "get_profile",
    description: "Perfil del usuario: estatura, peso inicial, objetivo, días de entrenamiento, presupuesto semanal (COP), meta de proteína y pasos. Sin datos personales identificables.",
    args: z.object({}),
    run: async (_a, { data }) => {
      const [p, plan] = await Promise.all([data.profile(), data.activePlan()]);
      if (!p) return { error: "Sin perfil" };
      const ma = movingAverage7d(dailyMeans(await data.bodyMetrics(), "weightKg")).at(-1)?.value ?? p.startWeightKg;
      return {
        heightCm: p.heightCm,
        startDate: p.startDate,
        startWeightKg: p.startWeightKg,
        goal: p.goal,
        activePlan: plan?.name ?? null,
        weeklyBudgetCop: p.weeklyBudget,
        proteinTargetG: proteinTarget(p.proteinTargetG, ma),
        proteinRangeG: proteinRange(ma),
        stepsTarget: p.stepsTarget,
        today: data.today,
      };
    },
  }),
  tool({
    name: "get_attendance",
    description: "Sesiones de gimnasio planeadas vs realizadas por semana (lunes a domingo), racha y % de cumplimiento.",
    args: z.object({ weeks: weeksArg(26, 4) }),
    run: async ({ weeks }, { data }) => {
      const [plan, workouts, weekPlans, profile] = await Promise.all([data.activePlan(), data.workouts(), data.weekPlans(), data.profile()]);
      const list = weeklyAttendance({ plan, workouts, weekStarts: lastWeekStarts(data.today, weeks), floatingByWeek: weekPlans, today: data.today, startDate: profile?.startDate });
      return {
        weeks: list.map((w) => ({ weekStart: w.weekStart, planned: w.planned, attended: w.attended, closed: w.closed, attendedDates: w.attendedDates })),
        summary: summarizeAttendance(list),
        rule: "Constancia: ≥3 sesiones/semana.",
      };
    },
  }),
  tool({
    name: "get_bodyweight_trend",
    description: "Pesajes diarios (media del día), promedio móvil de 7 días, tasa de cambio en kg/semana y % del peso por semana.",
    args: z.object({ days: daysArg(365, 28) }),
    run: async ({ days }, { data }) => {
      const daily = dailyMeans(await data.bodyMetrics(), "weightKg");
      const from = addDays(data.today, -days + 1);
      const win = daily.filter((d) => d.date >= from);
      const ma = movingAverage7d(daily).filter((d) => d.date >= from);
      return {
        readings: win.map((d) => ({ date: d.date, kg: r1(d.value) })),
        avg7d: ma.map((d) => ({ date: d.date, kg: r1(d.value) })),
        trend: weightTrend(daily, Math.min(days, 28), data.today),
        note: win.length < 4 ? "Pocos pesajes en el periodo: la tendencia no es fiable." : undefined,
      };
    },
  }),
  tool({
    name: "get_measurements",
    description: "Cintura (a la altura del ombligo), pecho y brazo en cm, con el cambio en el periodo.",
    args: z.object({ days: daysArg(365, 56) }),
    run: async ({ days }, { data }) => {
      const metrics = await data.bodyMetrics();
      const from = addDays(data.today, -days + 1);
      const out: Record<string, unknown> = {};
      for (const f of ["waistCm", "chestCm", "armCm"] as const) {
        const d = dailyMeans(metrics, f).filter((x) => x.date >= from);
        out[f] = { readings: d.map((x) => ({ date: x.date, cm: r1(x.value) })), ...measurementChange(d) };
      }
      return out;
    },
  }),
  tool({
    name: "get_exercise_progress",
    description: "Progreso de UN ejercicio concreto (por id o nombre): mejor serie por sesión, e1RM estimado (Epley), carga máxima, reps totales y tendencia. No mezcla sustitutos.",
    args: z.object({ exercise: z.string().min(1).max(120), weeks: weeksArg(52, 8) }),
    run: async ({ exercise, weeks }, ctx) => {
      const ex = await findExercise(ctx, exercise);
      if (!ex) return { error: `No encontré el ejercicio "${exercise}".` };
      const from = addDays(ctx.data.today, -weeks * 7);
      const hist = exerciseHistory(await ctx.data.workouts(), ex.id).filter((h) => h.date >= from);
      const record = (await ctx.data.records()).find((r) => r.exerciseId === ex.id);
      return {
        exercise: { id: ex.id, name: ex.name, unitShown: ex.displayUnit, perHand: ex.weightIsPerHand },
        sessions: hist.map((h) => ({
          date: h.date,
          substitutedFor: h.substituted ? true : undefined,
          sets: h.sets.map((s) => ({ reps: s.reps, kg: r1(s.weightKg), rir: s.rir ?? undefined })),
          e1rmKg: r1(h.e1rmKg),
          topKg: r1(h.topWeightKg),
          totalReps: h.totalReps,
        })),
        trend: exerciseTrend(hist),
        droppedTwice: performanceDroppedTwice(hist),
        initialMark: record ? { kg: r1(record.currentWeightKg), reps: record.reps, perHand: record.perHand, note: record.note } : null,
      };
    },
  }),
  tool({
    name: "get_key_lifts_summary",
    description: "Resumen de tendencia de los ejercicios compuestos realizados en las últimas semanas (para evaluar sobrecarga progresiva).",
    args: z.object({ weeks: weeksArg(12, 3) }),
    run: async ({ weeks }, { data }) => {
      const [workouts, map] = await Promise.all([data.workouts(), data.exerciseMap()]);
      const from = addDays(data.today, -weeks * 7);
      const recent = workouts.filter((w) => w.date >= from);
      const ids = [...new Set(recent.flatMap((w) => w.entries.map((e) => e.exerciseId)))];
      const rows = ids
        .map((id) => ({ ex: map.get(id), t: exerciseTrend(exerciseHistory(recent, id)) }))
        .filter((x) => x.ex && x.t.sessions > 0)
        .map(({ ex, t }) => ({ name: ex!.name, compound: ex!.isCompound, ...t }));
      const comparable = rows.filter((r) => r.direction !== "unknown");
      return {
        exercises: rows,
        up: comparable.filter((r) => r.direction === "up").length,
        flat: comparable.filter((r) => r.direction === "flat").length,
        down: comparable.filter((r) => r.direction === "down").length,
        comparable: comparable.length,
      };
    },
  }),
  tool({
    name: "get_weekly_volume",
    description: "Series duras por músculo por semana vs objetivo 12-20 (secundarios cuentan 0,5; heurística). Señala <10 o >22.",
    args: z.object({ weeks: weeksArg(12, 2) }),
    run: async ({ weeks }, { data }) => {
      const [workouts, map, plan] = await Promise.all([data.workouts(), data.exerciseMap(), data.activePlan()]);
      return {
        target: VOLUME_TARGET,
        priority: PRIORITY_MUSCLES,
        weeks: lastWeekStarts(data.today, weeks).map((ws) => {
          const sets = setsByMuscle(
            workouts.filter((w) => w.date >= ws && w.date <= addDays(ws, 6)),
            map,
          );
          return { weekStart: ws, sets, status: Object.fromEntries(Object.entries(sets).map(([m, v]) => [m, volumeStatus(v ?? 0)])) };
        }),
        plannedPerWeek: plan ? planVolume(plan, map) : null,
      };
    },
  }),
  tool({
    name: "get_recent_workouts",
    description: "Últimas n sesiones resumidas: fecha, sesión, esfuerzo, ejercicios con sus series y notas.",
    args: z.object({ n: z.coerce.number().int().min(1).max(10).default(3) }),
    run: async ({ n }, { data }) => {
      const list = (await data.workouts()).filter((w) => w.status === "completed").slice(-n);
      return list.map((w) => ({
        date: w.date,
        session: w.sessionName,
        effort: w.effort,
        notes: w.notes || undefined,
        exercises: w.entries.map((e) => ({
          name: e.nameSnapshot,
          substitution: e.plannedExerciseId && e.plannedExerciseId !== e.exerciseId ? e.substitutionReason ?? "otro" : undefined,
          sets: workingSets(e.sets).map((s) => `${s.reps}×${r1(s.weightKg) ?? "PC"}kg${s.rir != null ? `@${s.rir}` : ""}`),
          notes: e.notes || undefined,
        })),
      }));
    },
  }),
  tool({
    name: "get_nutrition_summary",
    description: "Proteína media diaria, días registrados y días que llegó a la meta (o al mínimo realista 1,6 g/kg).",
    args: z.object({ days: daysArg(60, 7) }),
    run: async ({ days }, { data }) => {
      const [meals, profile, metrics] = await Promise.all([data.meals(), data.profile(), data.bodyMetrics()]);
      const from = addDays(data.today, -days + 1);
      const w = movingAverage7d(dailyMeans(metrics, "weightKg")).at(-1)?.value ?? profile?.startWeightKg;
      const target = proteinTarget(profile?.proteinTargetG, w);
      return { ...nutritionSummary(meals.filter((m) => m.date >= from), target), rangeG: proteinRange(w), periodDays: days };
    },
  }),
  tool({
    name: "get_active_plan",
    description: "Plan activo con sus sesiones, ejercicios, series, rangos de repeticiones y RIR objetivo.",
    args: z.object({}),
    run: async (_a, { data }) => {
      const [plan, map] = await Promise.all([data.activePlan(), data.exerciseMap()]);
      if (!plan) return { error: "Sin plan activo" };
      return {
        id: plan.id,
        name: plan.name,
        sessions: plan.sessions.map((s) => ({
          key: s.key,
          name: s.name,
          weekday: s.weekday,
          kind: s.kind,
          items: s.items.map((i) => ({ exerciseId: i.exerciseId, name: map.get(i.exerciseId)?.name, sets: i.sets, reps: `${i.repMin}-${i.repMax}`, rir: i.rirTarget })),
        })),
      };
    },
  }),
  tool({
    name: "search_memory",
    description: "Busca en las notas guardadas del usuario (lesiones, preferencias, objetivos, conclusiones de informes) por similitud semántica.",
    args: z.object({ query: z.string().min(2).max(300), k: z.coerce.number().int().min(1).max(8).default(4) }),
    run: async ({ query, k }, { data }) => ({ results: await searchMemories(data.uid, query, k) }),
  }),
  tool({
    name: "propose_plan_change",
    description:
      "Propone UN cambio al plan. NO lo aplica: crea una propuesta que el usuario aprueba o rechaza en pantalla. Úsalo solo con una razón basada en datos.",
    args: z.object({
      summary: z.string().min(5).max(200),
      rationale: z.string().min(5).max(600),
      sessionKey: z.string().min(1).max(20),
      op: z.enum(["replace_exercise", "change_sets", "change_reps", "add_exercise", "remove_exercise"]),
      exerciseId: z.string().max(80).optional(),
      newExerciseId: z.string().max(80).optional(),
      sets: z.coerce.number().int().min(1).max(8).optional(),
      repMin: z.coerce.number().int().min(1).max(60).optional(),
      repMax: z.coerce.number().int().min(1).max(90).optional(),
    }),
    run: async (a, { data }) => {
      const [plan, map] = await Promise.all([data.activePlan(), data.exerciseMap()]);
      if (!plan) return { error: "Sin plan activo" };
      if (!plan.sessions.some((s) => s.key === a.sessionKey)) return { error: `Sesión desconocida: ${a.sessionKey}` };
      for (const id of [a.exerciseId, a.newExerciseId]) if (id && !map.has(id)) return { error: `Ejercicio desconocido: ${id}. Usa ids de get_active_plan o del catálogo.` };
      const ref = adminDb().collection(`users/${data.uid}/proposals`).doc();
      await ref.set({ ...a, planId: plan.id, status: "pending", createdAt: Date.now() });
      return { ok: true, proposalId: ref.id, message: "Propuesta creada; el usuario debe aprobarla en la app." };
    },
  }),
  tool({
    name: "save_memory",
    description: "Sugiere guardar una nota duradera (lesión, preferencia, objetivo, conclusión). Queda pendiente hasta que el usuario la confirme.",
    args: z.object({ text: z.string().min(3).max(500), kind: z.enum(["insight", "preference", "injury", "goal", "note"]) }),
    run: async ({ text, kind }, { data }) => {
      const ref = adminDb().collection(`users/${data.uid}/memories`).doc();
      await ref.set({ text, kind, sourceRef: "coach", createdAt: Date.now(), status: "pending" });
      return { ok: true, message: "Nota sugerida; el usuario la confirmará." };
    },
  }),
];

export type ToolName = (typeof TOOLS)[number]["name"];

export const TOOL_LABELS: Record<string, string> = {
  get_profile: "Leyendo tu perfil",
  get_attendance: "Revisando asistencia",
  get_bodyweight_trend: "Analizando tu peso",
  get_measurements: "Revisando medidas",
  get_exercise_progress: "Revisando un ejercicio",
  get_key_lifts_summary: "Revisando tus cargas",
  get_weekly_volume: "Calculando volumen",
  get_recent_workouts: "Leyendo sesiones recientes",
  get_nutrition_summary: "Revisando proteína",
  get_active_plan: "Leyendo tu plan",
  search_memory: "Buscando en tus notas",
  propose_plan_change: "Preparando una propuesta",
  save_memory: "Sugiriendo una nota",
};

/** Declarations in the Interactions API format. */
export function toolDeclarations() {
  return TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.args, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    delete schema.additionalProperties;
    return { type: "function" as const, name: t.name, description: t.description, parameters: schema };
  });
}

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<unknown> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { error: `Herramienta desconocida: ${name}` };
  const parsed = t.args.safeParse(rawArgs ?? {});
  if (!parsed.success) return { error: "Argumentos inválidos", issues: parsed.error.issues.map((i) => i.message).slice(0, 3) };
  try {
    return await t.run(parsed.data as never, ctx);
  } catch (e) {
    console.error("tool", name, e);
    return { error: "No se pudo obtener ese dato ahora." };
  }
}

/** Week helpers used by the weekly report route. */
export function lastClosedWeek(today: string): { start: string; end: string } {
  const start = addDays(weekStart(today), -7);
  return { start, end: addDays(start, 6) };
}

