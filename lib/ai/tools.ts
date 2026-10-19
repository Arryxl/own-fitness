import "server-only";
import { z } from "zod";
import { addDays, isoWeekday, lastWeekStarts, weekStart } from "@/lib/analytics/dates";
import { summarizeAttendance, weeklyAttendance } from "@/lib/analytics/attendance";
import { dailyMeans, measurementChange, movingAverage7d, weightTrend } from "@/lib/analytics/bodyweight";
import { nutritionSummary, proteinRange, proteinTarget } from "@/lib/analytics/nutrition";
import { ageFromBirthDate, energyTargets } from "@/lib/analytics/energy";
import { recommendTemplates } from "@/lib/plans";
import { MUSCLES, type RecommendationRule } from "@/lib/seed/schema";
import { exerciseHistory, exerciseTrend, performanceDroppedTwice, workingSets } from "@/lib/analytics/strength";
import { round } from "@/lib/analytics/units";
import { PRIORITY_MUSCLES, VOLUME_TARGET, planVolume, setsByMuscle, volumeStatus } from "@/lib/analytics/volume";
import { adminDb } from "@/lib/firebase/admin";
import { WEEKDAY_LONG } from "@/lib/format";
import { applyProposal } from "@/lib/proposals";
import type { PlanSession } from "@/lib/types";
import { exerciseFitsPlace, placeOf, unscheduledSessions, validateBlock, weekSchedule } from "@/lib/week";
import type { UserData } from "@/lib/server/userData";
import { searchMemories } from "./memory";

// Tools the coach may call. All read-only except propose_plan_change,
// propose_week_block and save_memory, which only create *pending* items the
// user must approve in the UI.

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
    description:
      "Perfil de entrenamiento del usuario (sin nombre, email ni fecha de nacimiento): edad, sexo, estatura, peso, objetivo, nivel, enfoque (zona del cuerpo a priorizar), días que entrena, equipo no disponible, lesiones declaradas, restricciones alimentarias, presupuesto y metas estimadas de calorías/proteína (rangos).",
    args: z.object({}),
    run: async (_a, { data }) => {
      const [p, plan] = await Promise.all([data.profile(), data.activePlan()]);
      if (!p) return { error: "Sin perfil" };
      const ma = movingAverage7d(dailyMeans(await data.bodyMetrics(), "weightKg")).at(-1)?.value ?? p.startWeightKg;
      const age = ageFromBirthDate(p.birthDate, data.today);
      return {
        ageYears: age,
        sex: p.sex,
        heightCm: p.heightCm,
        startDate: p.startDate,
        startWeightKg: p.startWeightKg,
        currentWeight7dKg: ma ?? null,
        goal: p.goal,
        level: p.level,
        trainingWeekdays: p.trainingDays,
        unavailableEquipment: p.unavailableEquipment,
        emphasis: p.emphasis ?? "equilibrado",
        injuriesDeclared: p.injuries || null,
        dietaryRestrictions: p.dietaryRestrictions,
        dietNotes: p.dietNotes || null,
        country: p.country,
        currency: p.currency,
        weeklyFoodBudget: p.weeklyBudget,
        activePlan: plan ? { name: plan.name, templateId: plan.sourceTemplateId } : null,
        proteinTargetG: proteinTarget(p.proteinTargetG, ma),
        proteinRangeG: proteinRange(ma),
        energyEstimate: energyTargets({ sex: p.sex, ageYears: age, heightCm: p.heightCm, weightKg: ma ?? null, trainingDaysPerWeek: p.trainingDays.length, goal: p.goal }),
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
      const [plan, workouts, profile] = await Promise.all([data.activePlan(), data.workouts(), data.profile()]);
      const list = weeklyAttendance({ plan, workouts, weekStarts: lastWeekStarts(data.today, weeks), today: data.today, startDate: profile?.startDate });
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
        sourceTemplateId: plan.sourceTemplateId,
        rotation: plan.rotation,
        enabledAddOns: plan.enabledAddOns,
        progressionRules: plan.progressionRules,
        sessions: plan.sessions.map((s) => ({
          key: s.key,
          name: s.name,
          weekday: s.weekday,
          kind: s.kind,
          place: placeOf(s),
          extraBlock: !!s.extra,
          optional: s.optional || s.floating,
          items: s.items.map((i) => ({ exerciseId: i.exerciseId, name: map.get(i.exerciseId)?.name, available: map.get(i.exerciseId)?.available, sets: i.sets, range: `${i.repMin}-${i.repMax} ${i.repUnit}`, rir: i.rirTarget })),
        })),
      };
    },
  }),
  tool({
    name: "get_week_schedule",
    description:
      "La semana del usuario de lunes (1) a domingo (7) tal como la ve en 'Mi semana': en cada día, las sesiones del plan (cuentan como entrenamiento) y los bloques extra (core en casa, caminata…, no cuentan para la asistencia), con lugar (gym, home, outdoor), minutos y ejercicios. Úsala antes de sugerir añadir o mover algo.",
    args: z.object({}),
    run: async (_a, { data }) => {
      const [plan, map] = await Promise.all([data.activePlan(), data.exerciseMap()]);
      if (!plan) return { error: "Sin plan activo. El usuario puede elegir una plantilla en Rutinas o empezar desde cero en Mi semana." };
      const block = (s: PlanSession) => ({
        key: s.key,
        name: s.name,
        kind: s.kind,
        place: placeOf(s),
        countsAsTraining: !s.extra && s.kind === "lifting",
        extraBlock: !!s.extra,
        minutes: s.estimatedMinutes,
        exercises: s.items.map((i) => ({ id: i.exerciseId, name: map.get(i.exerciseId)?.name, muscle: map.get(i.exerciseId)?.primaryMuscle, sets: i.sets, range: `${i.repMin}-${i.repMax} ${i.repUnit}` })),
      });
      const days = weekSchedule(plan, weekStart(data.today));
      return {
        plan: { id: plan.id, name: plan.name, templateId: plan.sourceTemplateId, rotation: plan.rotation },
        today: { date: data.today, weekday: isoWeekday(data.today) },
        days: days.map((d) => ({ weekday: d.weekday, day: WEEKDAY_LONG[d.weekday - 1], date: d.date, minutes: d.minutes, rest: d.sessions.length === 0 && d.extras.length === 0, sessions: d.sessions.map(block), extras: d.extras.map(block) })),
        withoutFixedDay: unscheduledSessions(plan).map(block),
      };
    },
  }),
  tool({
    name: "find_exercises",
    description:
      "Busca ejercicios reales del catálogo para armar o cambiar bloques. Filtra por músculo, por lugar (gym = disponibles en su gimnasio; home = peso corporal, mancuernas, bandas, banco o barra de dominadas; outdoor = peso corporal, bandas, barras de parque) y por texto. Devuelve ids válidos y la unidad del rango (reps, seconds o minutes). Usa SOLO ids que devuelva esta herramienta u otra.",
    args: z.object({
      muscle: z.enum(MUSCLES).optional(),
      place: z.enum(["gym", "home", "outdoor"]).optional(),
      query: z.string().max(60).optional(),
      limit: z.coerce.number().int().min(1).max(30).default(15),
    }),
    run: async ({ muscle, place, query, limit }, { data }) => {
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const q = query ? norm(query) : "";
      const list = (await data.exercises()).filter((e) => (!muscle || e.primaryMuscle === muscle) && (!place || exerciseFitsPlace(e, place)) && (!q || norm(e.name).includes(q) || norm(e.family).includes(q)));
      return {
        count: list.length,
        exercises: list.slice(0, limit).map((e) => ({ id: e.id, name: e.name, muscle: e.primaryMuscle, secondary: e.secondaryMuscles, equipment: e.equipment, unit: e.metric, compound: e.isCompound, availableAtGym: e.available })),
      };
    },
  }),
  tool({
    name: "propose_week_block",
    description:
      "Propone añadir un BLOQUE EXTRA a uno o varios días de la semana (p. ej. core en casa martes y jueves, caminata el sábado). NO lo aplica: el usuario lo aprueba en pantalla y se crea una copia por día. Valida que los ejercicios existan y se puedan hacer en ese lugar; si devuelve error, corrige y vuelve a llamar.",
    args: z.object({
      summary: z.string().min(5).max(200),
      rationale: z.string().min(5).max(600),
      name: z.string().min(2).max(60),
      focus: z.string().max(100).optional(),
      place: z.enum(["gym", "home", "outdoor"]),
      kind: z.enum(["lifting", "cardio"]).default("lifting"),
      weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7),
      minutes: z.coerce.number().int().min(5).max(120),
      items: z
        .array(
          z.object({
            exerciseId: z.string().min(1).max(80),
            sets: z.coerce.number().int().min(1).max(8),
            repMin: z.coerce.number().int().min(1).max(120),
            repMax: z.coerce.number().int().min(1).max(180),
            unit: z.enum(["reps", "seconds", "minutes"]).optional(),
            restSec: z.coerce.number().int().min(0).max(300).optional(),
            notes: z.string().max(120).optional(),
          }),
        )
        .min(1)
        .max(8),
    }),
    run: async (a, { data }) => {
      const [plan, map] = await Promise.all([data.activePlan(), data.exerciseMap()]);
      if (!plan) return { error: "Sin plan activo. Pide al usuario que elija una rutina o empiece desde cero en Mi semana." };
      const checked = validateBlock({ name: a.name, focus: a.focus, place: a.place, kind: a.kind, weekdays: a.weekdays, minutes: a.minutes, items: a.items }, plan, map, weekStart(data.today));
      if ("error" in checked) return { error: checked.error };
      const proposal = { summary: a.summary, rationale: a.rationale, planId: plan.id, sessionKey: "", op: "add_block" as const, block: checked.block };
      if (!applyProposal(plan, { ...proposal, id: "check", status: "pending", createdAt: 0 })) return { error: "La propuesta no se puede aplicar a este plan." };
      const ref = adminDb().collection(`users/${data.uid}/proposals`).doc();
      await ref.set({ ...proposal, status: "pending", createdAt: Date.now() });
      return {
        ok: true,
        proposalId: ref.id,
        days: checked.block.weekdays.map((d) => WEEKDAY_LONG[d - 1]),
        exercises: checked.block.items.map((i) => `${map.get(i.exerciseId)?.name}: ${i.sets}×${i.repMin}-${i.repMax} ${i.repUnit}`),
        warnings: checked.warnings,
        message: "Propuesta creada; el usuario la verá en 'Mi semana' y en el coach para aprobarla.",
      };
    },
  }),
  tool({
    name: "list_program_templates",
    description: "Lista las plantillas de la biblioteca (hipertrofia, fuerza, definición, acondicionamiento, casos especiales y rutinas para mujeres por enfoque: glúteo y pierna, pierna, todo el cuerpo, tren superior) con objetivo, días, nivel, lugar, enfoque, fuente y si son recomendadas para el perfil. Cita plantillas por id; NO inventes rutinas.",
    args: z.object({}),
    run: async (_a, { data }) => {
      const [templates, p, metaSnap] = await Promise.all([data.templates(), data.profile(), adminDb().doc("catalog/meta").get()]);
      const rules = (metaSnap.get("recommendationRules") as RecommendationRule[] | undefined) ?? [];
      const rec = recommendTemplates(templates, rules, { goal: p?.goal ?? null, level: p?.level ?? null, trainingDays: p?.trainingDays ?? [], place: p?.trainingPlace ?? "gym", ageYears: ageFromBirthDate(p?.birthDate ?? null, data.today), sex: p?.sex ?? null, emphasis: p?.emphasis ?? null });
      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        goal: t.goal,
        daysPerWeek: t.daysPerWeek,
        level: t.level,
        requiresWeekend: t.requiresWeekend,
        sessionMinutes: t.sessionMinutesRange,
        category: t.category,
        place: t.place,
        emphasis: t.emphasis ?? null,
        source: t.source?.name,
        verification: t.source?.verification,
        recommendedForUser: rec.advice.get(t.id)?.recommended ?? false,
        warnings: rec.advice.get(t.id)?.warnings ?? [],
      }));
    },
  }),
  tool({
    name: "get_program_template",
    description: "Detalle de una plantilla por id: sesiones, ejercicios, volumen semanal, fundamento, advertencias y reglas de progresión.",
    args: z.object({ id: z.string().min(1).max(10) }),
    run: async ({ id }, { data }) => {
      const t = (await data.templates()).find((x) => x.id === id);
      if (!t) return { error: "No existe la plantilla " + id };
      const map = await data.exerciseMap();
      return { ...t, sessions: t.sessions.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, name: map.get(i.exerciseId)?.name })) })) };
    },
  }),
  tool({
    name: "get_exercise_alternatives",
    description: "Cadena ordenada de alternativas de un ejercicio (con la condición de cada eslabón) y si cada una está disponible en el gimnasio del usuario.",
    args: z.object({ exerciseId: z.string().min(1).max(80) }),
    run: async ({ exerciseId }, ctx) => {
      const ex = await findExercise(ctx, exerciseId);
      if (!ex) return { error: "Ejercicio no encontrado" };
      const map = await ctx.data.exerciseMap();
      return {
        exercise: { id: ex.id, name: ex.name, available: ex.available, spotterFree: ex.spotterFree },
        chain: ex.fallbackChain.map((l) => ({ id: l.exerciseId, name: map.get(l.exerciseId)?.name, when: l.when, available: map.get(l.exerciseId)?.available, spotterFree: map.get(l.exerciseId)?.spotterFree })),
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
      "Propone UN cambio a una sesión o bloque existente (sessionKey de get_week_schedule o get_active_plan). NO lo aplica: crea una propuesta que el usuario aprueba o rechaza en pantalla. Ops: replace_exercise, change_sets, change_reps, add_exercise, remove_exercise; move_session (cambia el día: weekday 1-7, 0 = sin día fijo); remove_session (solo bloques extra). Para crear un bloque nuevo usa propose_week_block. Úsalo solo con una razón basada en datos.",
    args: z.object({
      summary: z.string().min(5).max(200),
      rationale: z.string().min(5).max(600),
      sessionKey: z.string().min(1).max(20),
      op: z.enum(["replace_exercise", "change_sets", "change_reps", "add_exercise", "remove_exercise", "move_session", "remove_session"]),
      exerciseId: z.string().max(80).optional(),
      newExerciseId: z.string().max(80).optional(),
      sets: z.coerce.number().int().min(1).max(8).optional(),
      repMin: z.coerce.number().int().min(1).max(120).optional(),
      repMax: z.coerce.number().int().min(1).max(180).optional(),
      weekday: z.coerce.number().int().min(0).max(7).optional(),
    }),
    run: async (a, { data }) => {
      const [plan, map] = await Promise.all([data.activePlan(), data.exerciseMap()]);
      if (!plan) return { error: "Sin plan activo" };
      const session = plan.sessions.find((s) => s.key === a.sessionKey);
      if (!session) return { error: `Sesión desconocida: ${a.sessionKey}. Usa las keys de get_week_schedule.` };
      for (const id of [a.exerciseId, a.newExerciseId]) if (id && !map.has(id)) return { error: `Ejercicio desconocido: ${id}. Usa ids de get_active_plan o de find_exercises.` };
      if (a.op === "move_session" && a.weekday === undefined) return { error: "move_session necesita weekday (1-7, o 0 para quitarle el día)." };
      if (a.op === "move_session" && plan.rotation === "alternate" && !session.extra) return { error: "En un plan con rotación A/B las sesiones del plan no tienen día fijo; solo se pueden mover los bloques extra." };
      if (a.op === "remove_session" && !session.extra) return { error: "Solo se pueden quitar bloques extra. Para una sesión del plan propone moverla (move_session) o cambiar sus ejercicios." };
      const added = a.op === "add_exercise" ? map.get(a.newExerciseId ?? a.exerciseId ?? "") : undefined;
      const proposal = {
        summary: a.summary,
        rationale: a.rationale,
        planId: plan.id,
        sessionKey: a.sessionKey,
        op: a.op,
        exerciseId: a.exerciseId ?? null,
        newExerciseId: a.newExerciseId ?? null,
        sets: a.sets ?? null,
        repMin: a.repMin ?? null,
        repMax: a.repMax ?? null,
        repUnit: added?.metric ?? null,
        weekday: a.op === "move_session" ? a.weekday || null : null,
      };
      if (!applyProposal(plan, { ...proposal, id: "check", status: "pending", createdAt: 0 }))
        return { error: "Ese cambio no se puede aplicar: revisa que el ejercicio esté en esa sesión y que los datos estén completos (series, repMin ≤ repMax)." };
      const ref = adminDb().collection(`users/${data.uid}/proposals`).doc();
      await ref.set({ ...proposal, status: "pending", createdAt: Date.now() });
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
  list_program_templates: "Revisando la biblioteca de rutinas",
  get_program_template: "Leyendo una plantilla",
  get_exercise_alternatives: "Buscando alternativas",
  search_memory: "Buscando en tus notas",
  get_week_schedule: "Revisando tu semana",
  find_exercises: "Buscando ejercicios",
  propose_plan_change: "Preparando una propuesta",
  propose_week_block: "Preparando un bloque para tu semana",
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
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`);
    console.warn("tool", name, "invalid args:", issues.join(" | "));
    return { error: "Argumentos inválidos", issues };
  }
  try {
    const out = await t.run(parsed.data as never, ctx);
    // The model gets the error and usually retries; the log shows what it got wrong.
    if (out && typeof out === "object" && "error" in out) console.warn("tool", name, "error:", (out as { error: unknown }).error);
    return out;
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

