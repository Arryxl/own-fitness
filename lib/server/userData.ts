import "server-only";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { adminDb } from "@/lib/firebase/admin";
import type { Activity, BodyMetric, Exercise, Food, Meal, PersonalRecord, Plan, Profile, Workout } from "@/lib/types";

/**
 * Lazily loads one user's data with the Admin SDK, caching each collection for
 * the lifetime of a single request. Everything is scoped to the verified uid.
 */
export class UserData {
  private cache = new Map<string, Promise<unknown>>();
  constructor(
    public readonly uid: string,
    public readonly today: string = todayISO(),
  ) {}

  private col<T>(name: string, build?: (q: FirebaseFirestore.Query) => FirebaseFirestore.Query, idField = "id"): Promise<T[]> {
    const key = name;
    if (!this.cache.has(key)) {
      const base = adminDb().collection(`users/${this.uid}/${name}`);
      const q = build ? build(base) : base;
      this.cache.set(
        key,
        q.get().then((s) => s.docs.map((d) => ({ ...d.data(), [idField]: d.id }) as T)),
      );
    }
    return this.cache.get(key) as Promise<T[]>;
  }

  profile(): Promise<Profile | null> {
    if (!this.cache.has("profile")) {
      this.cache.set(
        "profile",
        adminDb()
          .doc(`users/${this.uid}`)
          .get()
          .then((s) => (s.exists ? (s.data() as Profile) : null)),
      );
    }
    return this.cache.get("profile") as Promise<Profile | null>;
  }

  exercises() {
    return this.col<Exercise>("exercises");
  }
  async exerciseMap() {
    return new Map((await this.exercises()).map((e) => [e.id, e]));
  }
  plans() {
    return this.col<Plan>("plans");
  }
  async activePlan(): Promise<Plan | null> {
    const [p, plans] = await Promise.all([this.profile(), this.plans()]);
    return plans.find((x) => x.id === p?.activePlanId) ?? plans[0] ?? null;
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
  foods() {
    return this.col<Food>("foods");
  }
  async weekPlans(): Promise<Map<string, number | null>> {
    const list = await this.col<{ id: string; floatingWeekday: number | null }>("weekPlans");
    return new Map(list.map((w) => [w.id, w.floatingWeekday ?? null]));
  }
}
