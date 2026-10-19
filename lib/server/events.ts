import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export type EventType = "account_deleted" | "user_blocked" | "user_unblocked";

/**
 * Minimal event log for operations (counts per day + last events). Stores no
 * health data and no email: only the event type, time and an opaque actor uid.
 */
export async function logEvent(type: EventType, actorUid: string | null): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    await Promise.all([
      adminDb().doc(`system/events-${day}`).set({ [type]: FieldValue.increment(1), updatedAt: Date.now() }, { merge: true }),
      adminDb().collection("system/eventLog/items").add({ type, at: Date.now(), actor: actorUid }),
    ]);
  } catch {
    /* never block the action because of logging */
  }
}
