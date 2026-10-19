// Client write helpers. Firestore resolves write promises only after the server
// acknowledges them, which never happens offline, so callers fire-and-forget:
// the local cache (and every onSnapshot listener) updates immediately and the
// write syncs when the connection returns.
import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { emitToast } from "@/components/providers/ToastProvider";
import { getDb } from "@/lib/firebase/client";

export type UserCollection =
  | "exerciseOverrides"
  | "personalRecords"
  | "plans"
  | "workouts"
  | "bodyMetrics"
  | "activity"
  | "meals"
  | "foods"
  | "weeklyStats"
  | "weekPlans"
  | "aiReports"
  | "aiChats"
  | "aiMenus"
  | "memories"
  | "proposals";

function report(e: unknown) {
  console.error(e);
  const code = (e as { code?: string }).code;
  emitToast(code === "permission-denied" ? "Sin permiso para guardar (¿sesión cerrada?)" : "No se pudo guardar. Reintenta.", "error");
}

export function newId(uid: string, col: UserCollection): string {
  return doc(collection(getDb(), "users", uid, col)).id;
}

/** Strip the `id` field: it's the document key, not data. */
function body(data: object): DocumentData {
  const { id: _id, ...rest } = data as { id?: string };
  void _id;
  return rest;
}

export function putDoc(uid: string, col: UserCollection, id: string, data: object, merge = false): void {
  setDoc(doc(getDb(), "users", uid, col, id), body(data), { merge }).catch(report);
}

export function patchDoc(uid: string, col: UserCollection, id: string, data: DocumentData): void {
  updateDoc(doc(getDb(), "users", uid, col, id), data).catch(report);
}

export function removeDoc(uid: string, col: UserCollection, id: string): void {
  deleteDoc(doc(getDb(), "users", uid, col, id)).catch(report);
}

export function patchProfile(uid: string, data: DocumentData): void {
  setDoc(doc(getDb(), "users", uid), data, { merge: true }).catch(report);
}

/** Batched writes (max 500 ops per batch). Returns the commit promise for callers that want it. */
export function batchPut(uid: string, items: { col: UserCollection | null; id?: string; data: DocumentData; merge?: boolean }[]): Promise<void> {
  const db = getDb();
  const chunks: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += 450) chunks.push(items.slice(i, i + 450));
  return Promise.all(
    chunks.map((chunk) => {
      const b = writeBatch(db);
      for (const it of chunk) {
        const ref = it.col ? doc(db, "users", uid, it.col, it.id!) : doc(db, "users", uid);
        b.set(ref, it.data, { merge: it.merge ?? false });
      }
      return b.commit();
    }),
  ).then(() => undefined);
}

export { report as reportWriteError };

/** Saves a whole plan, stamping updatedAt. */
export function savePlan<T extends { id: string }>(uid: string, plan: T): void {
  putDoc(uid, "plans", plan.id, { ...plan, updatedAt: Date.now() });
}
