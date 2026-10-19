"use client";

import { collection, doc, limit, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { mergeExercises, mergeFoods } from "@/lib/catalog";
import { getDb } from "@/lib/firebase/client";
import type { AddOn, ProgramTemplate, RecommendationRule } from "@/lib/seed/schema";
import type {
  Activity,
  AiReport,
  BodyMetric,
  CatalogExercise,
  Exercise,
  ExerciseOverride,
  Food,
  Meal,
  Memory,
  PersonalRecord,
  Plan,
  PlanChangeProposal,
  Profile,
  Workout,
} from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface ColState<T> {
  data: T[];
  ready: boolean;
  pending: boolean;
}

export interface Catalog {
  exercises: CatalogExercise[];
  templates: ProgramTemplate[];
  addOns: AddOn[];
  rules: RecommendationRule[];
  foods: Food[];
  ready: boolean;
}

export interface AppData {
  uid: string;
  profile: Profile | null;
  /** "missing" only once the server confirms there is no profile (never from an empty offline cache). */
  profileState: "loading" | "missing" | "ready";
  catalog: Catalog;
  exercises: Exercise[];
  exerciseMap: Map<string, Exercise>;
  overrides: Map<string, ExerciseOverride>;
  templates: ProgramTemplate[];
  addOns: AddOn[];
  plans: Plan[];
  activePlan: Plan | null;
  records: Map<string, PersonalRecord>;
  workouts: Workout[];
  bodyMetrics: BodyMetric[];
  activity: Activity[];
  meals: Meal[];
  foods: Food[];
  userFoods: Map<string, Food>;
  reports: AiReport[];
  proposals: PlanChangeProposal[];
  pendingMemories: Memory[];
  ready: boolean;
  hasPendingWrites: boolean;
}

const Ctx = createContext<AppData | null>(null);

function useCol<T>(uid: string | null, name: string, constraints: QueryConstraint[], idField = "id"): ColState<T> {
  const [state, setState] = useState<ColState<T>>({ data: [], ready: false, pending: false });
  // Constraints are built once per mount (dates computed at mount time).
  const key = `${uid}/${name}`;
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(getDb(), "users", uid, name), ...constraints);
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as object), [idField]: d.id }) as T),
          ready: true,
          pending: snap.metadata.hasPendingWrites,
        }),
      (err) => {
        console.error(name, err.code);
        setState((s) => ({ ...s, ready: true }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** One document per catalog section: the whole catalog costs ~5 reads (cached offline afterwards). */
function useCatalogDoc<T>(enabled: boolean, id: string): { items: T[]; ready: boolean; extra: Record<string, unknown> } {
  const [state, setState] = useState<{ items: T[]; ready: boolean; extra: Record<string, unknown> }>({ items: [], ready: false, extra: {} });
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(getDb(), "catalog", id),
      (snap) => {
        const d = snap.data() ?? {};
        setState({ items: (d.items as T[]) ?? [], ready: snap.exists() || !snap.metadata.fromCache, extra: d });
      },
      (err) => {
        console.error("catalog", id, err.code);
        setState((s) => ({ ...s, ready: true }));
      },
    );
  }, [enabled, id]);
  return state;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const uid = status === "signed_in" ? (user?.uid ?? null) : null;
  const [since] = useState(() => {
    const today = todayISO();
    return { workouts: addDays(today, -400), activity: addDays(today, -180), meals: addDays(today, -90), metricsTs: Date.now() - 730 * 86400000 };
  });

  const [profile, setProfile] = useState<{ data: Profile | null; state: AppData["profileState"]; pending: boolean }>({ data: null, state: "loading", pending: false });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(getDb(), "users", uid), { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) setProfile({ data: snap.data() as Profile, state: "ready", pending: snap.metadata.hasPendingWrites });
      else if (!snap.metadata.fromCache) setProfile({ data: null, state: "missing", pending: false });
    });
  }, [uid]);

  const country = profile.data?.country === "CO" ? "CO" : "DEFAULT";
  const catExercises = useCatalogDoc<CatalogExercise>(!!uid, "exercises");
  const catTemplates = useCatalogDoc<ProgramTemplate>(!!uid, "programTemplates");
  const catAddOns = useCatalogDoc<AddOn>(!!uid, "addOns");
  const catMeta = useCatalogDoc<never>(!!uid, "meta");
  const catFoods = useCatalogDoc<Food>(!!uid && profile.state !== "loading", `foods_${country}`);

  const overrides = useCol<ExerciseOverride>(uid, "exerciseOverrides", []);
  const plans = useCol<Plan>(uid, "plans", []);
  const records = useCol<PersonalRecord>(uid, "personalRecords", [], "exerciseId");
  const workouts = useCol<Workout>(uid, "workouts", [where("date", ">=", since.workouts), orderBy("date", "asc")]);
  const bodyMetrics = useCol<BodyMetric>(uid, "bodyMetrics", [where("ts", ">=", since.metricsTs), orderBy("ts", "asc")]);
  const activity = useCol<Activity>(uid, "activity", [where("date", ">=", since.activity), orderBy("date", "asc")]);
  const meals = useCol<Meal>(uid, "meals", [where("date", ">=", since.meals), orderBy("date", "asc")]);
  const userFoods = useCol<Food>(uid, "foods", []);
  const reports = useCol<AiReport>(uid, "aiReports", [orderBy("createdAt", "desc"), limit(12)]);
  const proposals = useCol<PlanChangeProposal>(uid, "proposals", [where("status", "==", "pending")]);
  const pendingMemories = useCol<Memory>(uid, "memories", [where("status", "==", "pending")]);

  const value = useMemo<AppData | null>(() => {
    if (!uid) return null;
    const p = profile.data;
    const exercises = mergeExercises(catExercises.items, overrides.data, { units: p?.units ?? "mixed", unavailableEquipment: p?.unavailableEquipment ?? [] });
    const activePlan = plans.data.find((x) => x.id === p?.activePlanId) ?? null;
    const catalog: Catalog = {
      exercises: catExercises.items,
      templates: catTemplates.items,
      addOns: catAddOns.items,
      rules: (catMeta.extra.recommendationRules as RecommendationRule[]) ?? [],
      foods: catFoods.items,
      ready: catExercises.ready && catTemplates.ready && catAddOns.ready && catMeta.ready,
    };
    const ready = profile.state !== "loading" && catalog.ready && plans.ready && workouts.ready && overrides.ready;
    return {
      uid,
      profile: p,
      profileState: profile.state,
      catalog,
      exercises,
      exerciseMap: new Map(exercises.map((e) => [e.id, e])),
      overrides: new Map(overrides.data.map((o) => [o.id, o])),
      templates: catTemplates.items,
      addOns: catAddOns.items,
      plans: plans.data,
      activePlan,
      records: new Map(records.data.map((r) => [r.exerciseId, r])),
      workouts: workouts.data,
      bodyMetrics: bodyMetrics.data,
      activity: activity.data,
      meals: meals.data,
      foods: mergeFoods(catFoods.items, userFoods.data),
      userFoods: new Map(userFoods.data.map((f) => [f.id, f])),
      reports: reports.data,
      proposals: proposals.data,
      pendingMemories: pendingMemories.data,
      ready,
      hasPendingWrites: profile.pending || workouts.pending || bodyMetrics.pending || meals.pending || activity.pending,
    };
  }, [uid, profile, catExercises, catTemplates, catAddOns, catMeta, catFoods, overrides, plans, records, workouts, bodyMetrics, activity, meals, userFoods, reports, proposals, pendingMemories]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData requires a signed-in user inside DataProvider");
  return v;
}

export function useOptionalData(): AppData | null {
  return useContext(Ctx);
}
