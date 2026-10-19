import { z } from "zod";
import { AI_DEADLINE_MS } from "@/lib/ai/client";
import { COACH_PROMPT_VERSION } from "@/lib/ai/prompts/coach.v3";
import { coachPromptFor } from "@/lib/ai/prompts/summary";
import { WeeklyReportSchema } from "@/lib/ai/schemas";
import { generateStructured } from "@/lib/ai/structured";
import { lastClosedWeek, runTool } from "@/lib/ai/tools";
import { addDays, daysBetween, isoWeekday } from "@/lib/analytics/dates";
import { adminDb } from "@/lib/firebase/admin";
import { prepareAiRoute, toErrorResponse } from "@/lib/server/aiRoute";

export const maxDuration = 60;

const Body = z.object({
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  auto: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await prepareAiRoute(req, "report");
    const parsed = Body.safeParse(ctx.body);
    if (!parsed.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
    const { data, user, today } = ctx;
    const deadline = Date.now() + AI_DEADLINE_MS;

    let { start, end } = lastClosedWeek(today);
    let type: "weekly" | "adhoc" = "weekly";
    if (parsed.data.periodStart && isoWeekday(parsed.data.periodStart) === 1 && parsed.data.periodStart <= today) {
      start = parsed.data.periodStart;
      end = addDays(start, 6);
    }
    if (end >= today) type = "adhoc"; // week still open: partial analysis

    const reports = adminDb().collection(`users/${user.uid}/aiReports`);
    if (parsed.data.auto) {
      const existing = await reports.where("periodStart", "==", start).limit(1).get();
      if (!existing.empty) return Response.json({ id: existing.docs[0].id, existing: true });
    }

    // Collect the evidence deterministically with the same tools the chat uses.
    const tctx = { data };
    const [profile, attendance, weight, measures, lifts, volume, nutrition, plan, memories] = await Promise.all([
      runTool("get_profile", {}, tctx),
      runTool("get_attendance", { weeks: 4 }, tctx),
      runTool("get_bodyweight_trend", { days: 28 }, tctx),
      runTool("get_measurements", { days: 56 }, tctx),
      runTool("get_key_lifts_summary", { weeks: 3 }, tctx),
      runTool("get_weekly_volume", { weeks: 2 }, tctx),
      runTool("get_nutrition_summary", { days: 7 }, tctx),
      runTool("get_active_plan", {}, tctx),
      runTool("search_memory", { query: "lesiones, molestias, preferencias y objetivos del usuario", k: 4 }, tctx).catch(() => ({ results: [] })),
    ]);

    const workouts = (await data.workouts()).filter((w) => w.status === "completed");
    const p = await data.profile();
    const firstDate = [workouts[0]?.date, p?.startDate].filter(Boolean).sort()[0] as string | undefined;
    const spanDays = firstDate ? daysBetween(firstDate, end) + 1 : 0;
    const insufficient = spanDays < 14 || workouts.length < 3;

    const evidence = { periodStart: start, periodEnd: end, today, daysOfHistory: spanDays, profile, attendance, weight, measures, lifts, volume, nutrition, plan, memories };
    const system = await coachPromptFor(data);
    const input = `Genera el informe semanal del periodo ${start} a ${end}${type === "adhoc" ? " (semana aún abierta: análisis parcial)" : ""}.
Evalúa las señales de la regla 8.2 usando SOLO estos datos (resultado de las herramientas, en JSON). No inventes cifras; si un dato falta, márcalo "unknown" y pide que lo registre.
${insufficient ? `Hay menos de 2 semanas de datos (${spanDays} días, ${workouts.length} sesiones): el veredicto DEBE ser insufficient_data; aun así da hasta 3 acciones útiles para empezar bien.` : ""}
Responde en JSON con el esquema indicado. summary: 2-4 frases con números. actions: máximo 3, priorizadas.

DATOS:
${JSON.stringify(evidence)}`;

    const { data: out, model } = await generateStructured({ uid: ctx.user.uid, system, input, schema: WeeklyReportSchema, deadline, temperature: 0.3 });
    const verdict = insufficient ? "insufficient_data" : out.verdict;

    const ref = reports.doc();
    await ref.set({
      type,
      periodStart: start,
      periodEnd: end,
      model,
      prompt: COACH_PROMPT_VERSION,
      createdAt: Date.now(),
      verdict,
      summary: out.summary,
      signals: out.signals,
      actions: out.actions.slice(0, 3),
      dataUsed: {
        daysOfHistory: spanDays,
        sessions: workouts.filter((w) => w.date >= start && w.date <= end).length,
        attendance: (attendance as { summary?: unknown }).summary ?? null,
        weightTrend: (weight as { trend?: unknown }).trend ?? null,
        nutrition,
      },
    });
    if (out.memory && out.memory.length > 10) {
      await adminDb()
        .collection(`users/${user.uid}/memories`)
        .add({ text: out.memory, kind: "insight", sourceRef: `aiReports/${ref.id}`, createdAt: Date.now(), status: "pending" });
    }
    return Response.json({ id: ref.id });
  } catch (e) {
    return toErrorResponse(e);
  }
}
