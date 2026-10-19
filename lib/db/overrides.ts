import type { CatalogExercise, ExerciseOverride } from "@/lib/types";
import { newId, putDoc } from "./write";

/** Saves the user's change to one exercise without copying the whole catalog entry. */
export function saveOverride(uid: string, exerciseId: string, patch: Partial<Omit<ExerciseOverride, "id" | "userModified" | "updatedAt">>) {
  putDoc(uid, "exerciseOverrides", exerciseId, { ...patch, id: exerciseId, userModified: true, updatedAt: Date.now() }, true);
}

/** Creates a user-only exercise; returns its id. */
export function createCustomExercise(uid: string, def: Omit<CatalogExercise, "id" | "source" | "available">): string {
  const id = `custom_${newId(uid, "exerciseOverrides")}`;
  putDoc(uid, "exerciseOverrides", id, { id, userModified: true, custom: def, available: true, updatedAt: Date.now() });
  return id;
}
