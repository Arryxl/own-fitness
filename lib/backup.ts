// Export / import of all user data (JSON backup + CSV for spreadsheets).
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { demoCollection, demoProfile, isDemo } from "@/lib/demo";
import { getDb } from "@/lib/firebase/client";
import { tsToISODate } from "@/lib/analytics/dates";
import type { BodyMetric, Exercise, Meal, Workout, Activity } from "@/lib/types";
import { batchPut, type UserCollection } from "./db/write";

export const BACKUP_COLLECTIONS: UserCollection[] = [
  "exercises",
  "personalRecords",
  "plans",
  "workouts",
  "bodyMetrics",
  "activity",
  "meals",
  "foods",
  "weeklyStats",
  "weekPlans",
  "aiReports",
  "aiMenus",
  "memories",
  "proposals",
];

export interface Backup {
  app: "ironlog";
  version: 1;
  exportedAt: string;
  profile: Record<string, unknown> | null;
  collections: Partial<Record<UserCollection, Record<string, unknown>[]>>;
}

function clean(d: Record<string, unknown>): Record<string, unknown> {
  // Embeddings are derived data (re-created on import by confirming memories).
  const { embedding: _e, ...rest } = d;
  void _e;
  return rest;
}

export async function exportAll(uid: string): Promise<Backup> {
  const collections: Backup["collections"] = {};
  let profile: Record<string, unknown> | null;
  if (isDemo) {
    profile = demoProfile();
    for (const c of BACKUP_COLLECTIONS) collections[c] = demoCollection(c).map(clean);
  } else {
    const db = getDb();
    profile = ((await getDoc(doc(db, "users", uid))).data() as Record<string, unknown>) ?? null;
    await Promise.all(
      BACKUP_COLLECTIONS.map(async (c) => {
        const snap = await getDocs(collection(db, "users", uid, c));
        collections[c] = snap.docs.map((d) => clean({ ...d.data(), id: d.id }));
      }),
    );
  }
  return { app: "ironlog", version: 1, exportedAt: new Date().toISOString(), profile, collections };
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text) as Backup;
  if (b?.app !== "ironlog" || b.version !== 1 || typeof b.collections !== "object") throw new Error("El archivo no es un respaldo válido de IronLog.");
  for (const [k, v] of Object.entries(b.collections)) {
    if (!BACKUP_COLLECTIONS.includes(k as UserCollection) || !Array.isArray(v)) throw new Error(`Colección desconocida en el respaldo: ${k}`);
    for (const d of v) if (!d || typeof d !== "object" || typeof (d as { id?: unknown }).id !== "string") throw new Error(`Documento sin id en ${k}`);
  }
  return b;
}

/** Writes a backup on top of current data (same ids are overwritten; nothing is deleted). */
export function importBackup(uid: string, b: Backup): Promise<void> {
  const items: Parameters<typeof batchPut>[1] = [];
  for (const [col, docs] of Object.entries(b.collections) as [UserCollection, Record<string, unknown>[]][]) {
    for (const d of docs) {
      const { id, ...data } = d as { id: string } & Record<string, unknown>;
      // Memories come back as pending so they get re-embedded on confirmation.
      items.push({ col, id, data: col === "memories" && data.status === "saved" ? { ...data, status: "pending" } : data });
    }
  }
  if (b.profile) items.push({ col: null, data: b.profile, merge: true });
  return batchPut(uid, items);
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Flat CSVs: one row per set, per measurement, per meal and per activity day. */
export function backupToCsv(b: Backup): Record<string, string> {
  const ex = new Map(((b.collections.exercises ?? []) as unknown as Exercise[]).map((e) => [e.id, e]));
  const sets: unknown[][] = [];
  for (const w of (b.collections.workouts ?? []) as unknown as Workout[]) {
    for (const e of w.entries ?? []) {
      for (const s of e.sets ?? []) {
        sets.push([w.date, w.sessionName, w.status, e.nameSnapshot, ex.get(e.exerciseId)?.primaryMuscle ?? "", e.plannedExerciseId && e.plannedExerciseId !== e.exerciseId ? ex.get(e.plannedExerciseId)?.name ?? e.plannedExerciseId : "", e.substitutionReason ?? "", s.idx + 1, s.isWarmup ? "si" : "no", s.done ? "si" : "no", s.reps, s.weightKg != null ? Math.round(s.weightKg * 100) / 100 : "", s.enteredValue, s.enteredUnit, s.rir, w.effort, e.notes]);
      }
    }
  }
  return {
    "series.csv": toCsv(["fecha", "sesion", "estado", "ejercicio", "musculo", "sustituye_a", "motivo", "serie", "calentamiento", "hecha", "reps", "peso_kg", "valor_ingresado", "unidad", "rir", "esfuerzo_sesion", "notas"], sets),
    "medidas.csv": toCsv(
      ["fecha", "hora", "peso_kg", "cintura_cm", "pecho_cm", "brazo_cm", "notas"],
      ((b.collections.bodyMetrics ?? []) as unknown as BodyMetric[]).map((m) => [tsToISODate(m.ts), new Date(m.ts).toTimeString().slice(0, 5), m.weightKg, m.waistCm, m.chestCm, m.armCm, m.notes]),
    ),
    "comidas.csv": toCsv(
      ["fecha", "descripcion", "proteina_g", "kcal", "origen"],
      ((b.collections.meals ?? []) as unknown as Meal[]).map((m) => [m.date, m.text, m.proteinG, m.kcal, m.source]),
    ),
    "actividad.csv": toCsv(
      ["fecha", "pasos", "minutos_caminata", "notas"],
      ((b.collections.activity ?? []) as unknown as Activity[]).map((a) => [a.date, a.steps, a.walkMinutes, a.notes]),
    ),
  };
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
