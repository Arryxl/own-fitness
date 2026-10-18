import "server-only";
import { AiError } from "@/lib/ai/client";
import { checkAiQuota } from "@/lib/ai/rate-limit";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { HttpError, requireUser, type AuthedUser } from "./auth";
import { UserData } from "./userData";

export interface AiRouteContext {
  user: AuthedUser;
  body: Record<string, unknown>;
  data: UserData;
  today: string;
}

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
  console.error(e);
  return Response.json({ error: "Error interno. Tus datos están a salvo; intenta de nuevo." }, { status: 500 });
}

/** Auth + allowlist + body parsing + AI quota for every AI endpoint. */
export async function prepareAiRoute(req: Request, kind: string): Promise<AiRouteContext> {
  const user = await requireUser(req);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Cuerpo de la solicitud inválido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Cuerpo de la solicitud inválido");
  await checkAiQuota(user.uid, kind);
  const today = clientToday(body.today);
  return { user, body, data: new UserData(user.uid, today), today };
}
