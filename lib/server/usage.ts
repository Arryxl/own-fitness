import "server-only";
import { adminDb, adminCredential } from "@/lib/firebase/admin";

/** Firestore Spark free quota (per day, project-wide). Verified 2026-10-18. */
export const SPARK_DAILY = { reads: 50_000, writes: 20_000, deletes: 20_000 };
export const ALERT_RATIO = 0.7;

export interface FirestoreUsage {
  source: "monitoring" | "unavailable";
  reads: number | null;
  writes: number | null;
  deletes: number | null;
  note?: string;
}

/** Today's (Pacific) document reads/writes/deletes from Cloud Monitoring. */
export async function firestoreUsageToday(): Promise<FirestoreUsage> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const cred = adminCredential();
  if (!projectId || !cred) return { source: "unavailable", reads: null, writes: null, deletes: null, note: "Sin credenciales de servicio" };
  try {
    const { access_token } = await cred.getAccessToken();
    const now = new Date();
    // Quotas reset at midnight Pacific; start the window there.
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const start = new Date(now.getTime() - (pacific.getHours() * 3600 + pacific.getMinutes() * 60 + pacific.getSeconds()) * 1000);
    const metric = async (type: string) => {
      const params = new URLSearchParams({
        filter: `metric.type="firestore.googleapis.com/document/${type}"`,
        "interval.startTime": start.toISOString(),
        "interval.endTime": now.toISOString(),
        "aggregation.alignmentPeriod": `${Math.max(60, Math.ceil((now.getTime() - start.getTime()) / 1000))}s`,
        "aggregation.perSeriesAligner": "ALIGN_SUM",
        "aggregation.crossSeriesReducer": "REDUCE_SUM",
      });
      const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!res.ok) throw new Error(`monitoring ${res.status}`);
      const json = (await res.json()) as { timeSeries?: { points?: { value?: { int64Value?: string } }[] }[] };
      return (json.timeSeries ?? []).reduce((t, s) => t + (s.points ?? []).reduce((a, p) => a + Number(p.value?.int64Value ?? 0), 0), 0);
    };
    const [reads, writes, deletes] = await Promise.all([metric("read_count"), metric("write_count"), metric("delete_count")]);
    return { source: "monitoring", reads, writes, deletes };
  } catch (e) {
    const msg = (e as Error).message;
    return {
      source: "unavailable",
      reads: null,
      writes: null,
      deletes: null,
      note: msg.includes("403") ? "La cuenta de servicio necesita el rol «Monitoring Viewer» en Google Cloud IAM." : "No se pudo leer Cloud Monitoring.",
    };
  }
}

export async function aiUsageDays(days: number): Promise<{ day: string; count: number; tokens: number }[]> {
  const out: { day: string; count: number; tokens: number }[] = [];
  const refs = Array.from({ length: days }, (_, i) => {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(Date.now() - i * 86400000));
    return { d, ref: adminDb().doc(`system/aiUsage-${d}`) };
  });
  const snaps = await adminDb().getAll(...refs.map((r) => r.ref));
  snaps.forEach((s, i) => out.push({ day: refs[i].d, count: (s.get("count") as number) ?? 0, tokens: (s.get("tokens") as number) ?? 0 }));
  return out.reverse();
}
