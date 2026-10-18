import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/server/auth";

// Two guards: a per-instance burst limiter and a per-day counter in Firestore
// (users/{uid}/aiUsage/{YYYY-MM-DD}, writable only by the server).
const BURST_WINDOW_MS = 60_000;
const BURST_MAX = 12;
const recent = new Map<string, number[]>();

function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 150;
}

/** Pacific-time date, matching when Gemini's daily quota resets. */
function pacificDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

export async function checkAiQuota(uid: string, kind: string): Promise<void> {
  const now = Date.now();
  const list = (recent.get(uid) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  if (list.length >= BURST_MAX) throw new HttpError(429, "Vas muy rápido: espera un minuto antes de otra consulta a la IA.");
  list.push(now);
  recent.set(uid, list);

  const ref = adminDb().doc(`users/${uid}/aiUsage/${pacificDay()}`);
  const count = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const c = (snap.get("count") as number | undefined) ?? 0;
    if (c >= dailyLimit()) return -1;
    tx.set(ref, { count: FieldValue.increment(1), byKind: { [kind]: FieldValue.increment(1) }, updatedAt: now }, { merge: true });
    return c + 1;
  });
  if (count === -1) throw new HttpError(429, "Límite diario de IA alcanzado. Intenta mañana (se reinicia a medianoche del Pacífico).");
}
