import { adminAuth } from "@/lib/firebase/admin";
import { errorResponse, requireAdmin } from "@/lib/server/auth";
import { limits } from "@/lib/ai/rate-limit";
import { ALERT_RATIO, SPARK_DAILY, aiUsageDays, firestoreUsageToday } from "@/lib/server/usage";

export const maxDuration = 30;

/** Aggregates only: user counts, AI usage and Firestore quota. No user content. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    let total = 0;
    let disabled = 0;
    let verified = 0;
    let newLast7 = 0;
    const weekAgo = Date.now() - 7 * 86400000;
    let pageToken: string | undefined;
    do {
      const page = await adminAuth().listUsers(1000, pageToken);
      for (const u of page.users) {
        total++;
        if (u.disabled) disabled++;
        if (u.emailVerified || u.providerData.some((p) => p.providerId === "google.com")) verified++;
        if (new Date(u.metadata.creationTime).getTime() > weekAgo) newLast7++;
      }
      pageToken = page.pageToken;
    } while (pageToken);

    const [ai, firestore] = await Promise.all([aiUsageDays(14), firestoreUsageToday()]);
    const ratio = (v: number | null, max: number) => (v == null ? null : v / max);
    const ratios = { reads: ratio(firestore.reads, SPARK_DAILY.reads), writes: ratio(firestore.writes, SPARK_DAILY.writes), deletes: ratio(firestore.deletes, SPARK_DAILY.deletes) };
    return Response.json({
      users: { total, disabled, verified, newLast7 },
      ai: { days: ai, limits: limits() },
      firestore: { ...firestore, quota: SPARK_DAILY, ratios, alert: Object.values(ratios).some((r) => r != null && r >= ALERT_RATIO), alertRatio: ALERT_RATIO },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
