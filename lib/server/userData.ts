import "server-only";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { mergeExercises, mergeFoods } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase/admin";
import type { AddOn, ProgramTemplate } from "@/lib/seed/schema";
import type { Activity, BodyMetric, CatalogExercise, Exercise, ExerciseOverride, Food, Meal, PersonalRecord, Plan, Profile, Workout } from "@/lib/types";

// Catalog docs are global and identical for everyone: cache them per server instance.
const catalogCache = new Map<string, { at: number; items: unknown[] }>();
const CATALOG_TTL = 10 * 60_000;

export async function catalogItems<T>(id: string): Promise<T[]> {
  const hit = catalogCache.get(id);
  if (hit && Date.now() - hit.at < CATALOG_TTL) return hit.items as T[];
  const snap = await adminDb().doc(`catalog/${id}`).get();
  const items = (snap.get("items") as T[] | undefined) ?? [];
  catalogCache.set(id, { at: Date.now(), items });
  return items;
}

/**
 * Lazily loads ONE user's data with the Admin SDK, caching each collection for
 * the lifetime of a single request. The uid always comes from the verified
 * token, never from the request body.
 */
export class UserData {
  private cache = new Map<string, Promise<unknown>>();
  constructor(
    public readonly uid: string,
    public readonly today: string = todayISO(),
  ) {}

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, load());
    return this.cache.get(key) as Promise<T>;
  }

  private col<T>(name: string, build?: (q: FirebaseFirestore.Query) => FirebaseFirestore.Query, idField = "id"): Promise<T[]> {
    return this.memo(name, async () => {
      const base = adminDb().collection(`users/${this.uid}/${name}`);
      const s = await (build ? build(base) : base).get();
      return s.docs.map((d) => ({ ...d.data(), [idField]: d.id }) as T);
    });
  }

  profile(): Promise<Profile | null> {
    return this.memo("profile", async () => {
      const s = await adminDb().doc(`users/${this.uid}`).get();
      return s.exists ? (s.data() as Profile) : null;
    });
  }

  templates() {
    return catalogItems<ProgramTemplate>("programTemplates");
  }
  addOns() {
    return catalogItems<AddOn>("addOns");
  }

  exercises(): Promise<Exercise[]> {
    return this.memo("exercises", async () => {
      const [catalog, overrides, p] = await Promise.all([catalogItems<CatalogExercise>("exercises"), this.col<ExerciseOverride>("exerciseOverrides"), this.profile()]);
      return mergeExercises(catalog, overrides, { units: p?.units ?? "mixed", unavailableEquipment: p?.unavailableEquipment ?? [] });
    });
  }
  async exerciseMap() {
    return new Map((await this.exercises()).map((e) => [e.id, e]));
  }
  plans() {
    return this.col<Plan>("plans");
  }
  async activePlan(): Promise<Plan | null> {
    const [p, plans] = await Promise.all([this.profile(), this.plans()]);
    return plans.find((x) => x.id === p?.activePlanId) ?? null;
  }
  records() {
    return this.col<PersonalRecord>("personalRecords", undefined, "exerciseId");
  }
  workouts() {
    const since = addDays(this.today, -200);
    return this.col<Workout>("workouts", (q) => q.where("date", ">=", since).orderBy("date", "asc"));
  }
  bodyMetrics() {
    const since = Date.now() - 400 * 86400000;
    return this.col<BodyMetric>("bodyMetrics", (q) => q.where("ts", ">=", since).orderBy("ts", "asc"));
  }
  meals() {
    const since = addDays(this.today, -60);
    return this.col<Meal>("meals", (q) => q.where("date", ">=", since).orderBy("date", "asc"));
  }
  activity() {
    const since = addDays(this.today, -60);
    return this.col<Activity>("activity", (q) => q.where("date", ">=", since).orderBy("date", "asc"));
  }
  foods(): Promise<Food[]> {
    return this.memo("foodsMerged", async () => {
      const p = await this.profile();
      const country = p?.country === "CO" ? "CO" : "DEFAULT";
      const [catalog, mine] = await Promise.all([catalogItems<Food>(`foods_${country}`), this.col<Food>("foods")]);
      return mergeFoods(catalog, mine);
    });
  }
}
