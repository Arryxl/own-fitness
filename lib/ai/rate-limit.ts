import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/server/auth";
import { checkBurst, quotaDecision, type QuotaLimits } from "./quota";

// AI usage guards:
//  - burst limiters per user and per IP (in memory, per server instance)
//  - per-user daily request and token quotas: users/{uid}/aiUsage/{day} (server-only)
//  - a global daily cap across all users: system/aiUsage-{day}
const userHits = new Map<string, number[]>();
const ipHits = new Map<string, number[]>();

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function limits(): QuotaLimits {
  return {
    userRequests: envInt("AI_DAILY_MESSAGES", 60),
    userTokens: envInt("AI_DAILY_TOKENS", 400_000),
    globalRequests: envInt("AI_GLOBAL_DAILY_LIMIT", 1000),
  };
}

/** Pacific-time date, matching when Gemini's daily quota resets. */
export function pacificDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
}

export async function checkAiQuota(uid: string, kind: string, ip: string): Promise<void> {
  const now = Date.now();
  if (!checkBurst(userHits, uid, now, 12)) throw new HttpError(429, "Vas muy rápido: espera un minuto antes de otra consulta a la IA.");
  if (!checkBurst(ipHits, ip, now, 30)) throw new HttpError(429, "Demasiadas solicitudes desde esta red. Espera un minuto.");

  const day = pacificDay();
  const userRef = adminDb().doc(`users/${uid}/aiUsage/${day}`);
  const globalRef = adminDb().doc(`system/aiUsage-${day}`);
  const result = await adminDb().runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const decision = quotaDecision(
      { requests: (u.get("count") as number) ?? 0, tokens: (u.get("tokens") as number) ?? 0, globalRequests: (g.get("count") as number) ?? 0 },
      limits(),
    );
    if (decision !== "ok") return decision;
    tx.set(userRef, { count: FieldValue.increment(1), byKind: { [kind]: FieldValue.increment(1) }, updatedAt: now }, { merge: true });
    tx.set(globalRef, { count: FieldValue.increment(1), updatedAt: now }, { merge: true });
    return "ok" as const;
  });
  if (result === "user_requests") throw new HttpError(429, "Llegaste al límite diario de consultas a la IA. Se reinicia a medianoche del Pacífico (2-3 a. m. en Colombia).");
  if (result === "user_tokens") throw new HttpError(429, "Llegaste al límite diario de uso de la IA. Intenta mañana.");
  if (result === "global") throw new HttpError(503, "La IA alcanzó su límite diario general. Intenta mañana; tus datos se siguen guardando.");
}

/** Adds the tokens a request used (after it finishes). Never throws. */
export async function recordTokens(uid: string, tokens: number | undefined): Promise<void> {
  if (!tokens || tokens <= 0) return;
  const day = pacificDay();
  try {
    await Promise.all([
      adminDb().doc(`users/${uid}/aiUsage/${day}`).set({ tokens: FieldValue.increment(tokens) }, { merge: true }),
      adminDb().doc(`system/aiUsage-${day}`).set({ tokens: FieldValue.increment(tokens) }, { merge: true }),
    ]);
  } catch {
    /* usage accounting must never break a reply */
  }
}
