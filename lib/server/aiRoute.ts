import "server-only";
import { AiError } from "@/lib/ai/client";
import { checkAiQuota } from "@/lib/ai/rate-limit";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { HttpError, clientIp, requireUser, type AuthedUser } from "./auth";
import { UserData } from "./userData";

export interface AiRouteContext {
  user: AuthedUser;
  body: Record<string, unknown>;
  data: UserData;
  today: string;
}

export const GEMINI_TIER = process.env.GEMINI_TIER === "paid" ? "paid" : "free";

/**
 * The client's local date (the server runs in UTC). Accepted only if within a
 * day of the server's date, otherwise the server's date is used.
 */
function clientToday(v: unknown): string {
  const server = todayISO();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= addDays(server, -1) && v <= addDays(server, 1)) return v;
  return server;
}

export function aiStatus(e: AiError): number {
  return e.kind === "rate_limit" ? 429 : e.kind === "timeout" ? 504 : e.kind === "unavailable" ? 503 : e.kind === "config" ? 500 : 502;
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof AiError) return Response.json({ error: e.message, kind: e.kind }, { status: aiStatus(e) });
  console.error("ai route error:", (e as Error)?.name, (e as Error)?.message);
  return Response.json({ error: "Error interno. Tus datos están a salvo; intenta de nuevo." }, { status: 500 });
}

/**
 * Every AI endpoint: verified token → body → AI consent (required on the free
 * tier) → per-user/IP/global quotas. Data access is always scoped to the
 * token's uid, never to a uid sent by the client.
 */
export async function prepareAiRoute(req: Request, kind: string): Promise<AiRouteContext> {
  const user = await requireUser(req);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Cuerpo de la solicitud inválido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Cuerpo de la solicitud inválido");
  const today = clientToday(body.today);
  const data = new UserData(user.uid, today);
  const profile = await data.profile();
  if (!profile?.onboardingCompletedAt) throw new HttpError(403, "Completa tu perfil antes de usar el coach.");
  if (GEMINI_TIER === "free" && !profile.aiConsent?.accepted) throw new HttpError(403, "Para usar el coach debes aceptar el consentimiento de IA en Ajustes.");
  await checkAiQuota(user.uid, kind, clientIp(req));
  return { user, body, data, today };
}
