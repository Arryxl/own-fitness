"use client";

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, todayISO } from "@/lib/analytics/dates";
import { getDb } from "@/lib/firebase/client";
import { demoCollection, demoProfile, demoSubscribe, isDemo } from "@/lib/demo";
import type {
  Activity,
  AiReport,
  BodyMetric,
  Exercise,
  Food,
  Meal,
  Memory,
  PersonalRecord,
  Plan,
  PlanChangeProposal,
  Profile,
  WeekPlan,
  Workout,
} from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface ColState<T> {
  data: T[];
  ready: boolean;
}

export interface AppData {
  uid: string;
  profile: Profile | null;
  /** "missing" only once the server confirms there is no profile (never from an empty offline cache). */
  profileState: "loading" | "missing" | "ready";
  exercises: Exercise[];
  exerciseMap: Map<string, Exercise>;
  plans: Plan[];
  activePlan: Plan | null;
  records: Map<string, PersonalRecord>;
  workouts: Workout[];
  bodyMetrics: BodyMetric[];
  activity: Activity[];
  meals: Meal[];
  foods: Food[];
  weekPlans: Map<string, number | null>;
  reports: AiReport[];
  proposals: PlanChangeProposal[];
  pendingMemories: Memory[];
  ready: boolean;
  hasPendingWrites: boolean;
}

const Ctx = createContext<AppData | null>(null);

type DemoShape = (docs: Record<string, unknown>[]) => Record<string, unknown>[];
const byField = (f: string, dir = 1): DemoShape => (docs) => [...docs].sort((a, b) => ((a[f] as number) > (b[f] as number) ? dir : -dir));
const pendingOnly: DemoShape = (docs) => docs.filter((d) => d.status === "pending");

function useCol<T>(
  uid: string | null,
  name: string,
  constraints: QueryConstraint[],
  idField = "id",
  demoShape: DemoShape = (d) => d,
): ColState<T> & { pending: boolean } {
  const [state, setState] = useState<ColState<T> & { pending: boolean }>({ data: [], ready: false, pending: false });
  // Constraints are built once per mount (dates computed at mount time).
  const key = `${uid}/${name}`;
  useEffect(() => {
    if (!uid) return;
    if (isDemo) {
      const read = () =>
        setState({
          data: demoShape(demoCollection(name)).map((d) => ({ ...d, [idField]: d.id }) as T),
          ready: true,
          pending: false,
        });
      read();
      return demoSubscribe(read);
    }
    const q = query(collection(getDb(), "users", uid, name), ...constraints);
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as object), [idField]: d.id }) as T),
          ready: true,
          pending: snap.metadata.hasPendingWrites,
        });
      },
      (err) => {
        console.error(name, err);
        setState((s) => ({ ...s, ready: true }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [since] = useState(() => {
    const today = todayISO();
    return {
      workouts: addDays(today, -400),
      activity: addDays(today, -180),
      meals: addDays(today, -90),
      metricsTs: Date.now() - 730 * 86400000,
    };
  });

  const [profile, setProfile] = useState<{ data: Profile | null; state: AppData["profileState"]; pending: boolean }>({
    data: null,
    state: "loading",
    pending: false,
  });
  useEffect(() => {
    if (!uid) return;
    if (isDemo) {
      const read = () => {
        const p = demoProfile();
        setProfile(p ? { data: p as unknown as Profile, state: "ready", pending: false } : { data: null, state: "missing", pending: false });
      };
      read();
      return demoSubscribe(read);
    }
    return onSnapshot(doc(getDb(), "users", uid), { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) setProfile({ data: snap.data() as Profile, state: "ready", pending: snap.metadata.hasPendingWrites });
      else if (!snap.metadata.fromCache) setProfile({ data: null, state: "missing", pending: false });
    });
  }, [uid]);

  const exercises = useCol<Exercise>(uid, "exercises", []);
  const plans = useCol<Plan>(uid, "plans", []);
  const records = useCol<PersonalRecord>(uid, "personalRecords", [], "exerciseId");
  const workouts = useCol<Workout>(uid, "workouts", [where("date", ">=", since.workouts), orderBy("date", "asc")], "id", byField("date"));
  const bodyMetrics = useCol<BodyMetric>(uid, "bodyMetrics", [where("ts", ">=", since.metricsTs), orderBy("ts", "asc")], "id", byField("ts"));
  const activity = useCol<Activity>(uid, "activity", [where("date", ">=", since.activity), orderBy("date", "asc")], "id", byField("date"));
  const meals = useCol<Meal>(uid, "meals", [where("date", ">=", since.meals), orderBy("date", "asc")], "id", byField("ts"));
  const foods = useCol<Food>(uid, "foods", []);
  const weekPlans = useCol<WeekPlan>(uid, "weekPlans", []);
  const reports = useCol<AiReport>(uid, "aiReports", [orderBy("createdAt", "desc"), limit(12)], "id", byField("createdAt", -1));
  const proposals = useCol<PlanChangeProposal>(uid, "proposals", [where("status", "==", "pending")], "id", pendingOnly);
  const pendingMemories = useCol<Memory>(uid, "memories", [where("status", "==", "pending")], "id", pendingOnly);

  const value = useMemo<AppData | null>(() => {
    if (!uid) return null;
    const exerciseMap = new Map(exercises.data.map((e) => [e.id, e]));
    const activePlan = plans.data.find((p) => p.id === profile.data?.activePlanId) ?? plans.data[0] ?? null;
    const ready = profile.state !== "loading" && exercises.ready && plans.ready && workouts.ready;
    return {
      uid,
      profile: profile.data,
      profileState: profile.state,
      exercises: [...exercises.data].sort((a, b) => a.name.localeCompare(b.name, "es")),
      exerciseMap,
      plans: plans.data,
      activePlan,
      records: new Map(records.data.map((r) => [r.exerciseId, r])),
      workouts: workouts.data,
      bodyMetrics: bodyMetrics.data,
      activity: activity.data,
      meals: meals.data,
      foods: foods.data,
      weekPlans: new Map(weekPlans.data.map((w) => [w.id, w.floatingWeekday ?? null])),
      reports: reports.data,
      proposals: proposals.data,
      pendingMemories: pendingMemories.data,
      ready,
      hasPendingWrites: profile.pending || workouts.pending || bodyMetrics.pending || meals.pending || activity.pending,
    };
  }, [uid, profile, exercises, plans, records, workouts, bodyMetrics, activity, meals, foods, weekPlans, reports, proposals, pendingMemories]);

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
