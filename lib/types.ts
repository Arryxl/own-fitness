// Shared domain types. Firestore layout: everything lives under users/{uid}.

export type WeightUnit = "kg" | "lb";

export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "rear_delts"
  | "triceps"
  | "biceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "abs"
  | "traps"
  | "calves";

export type Equipment =
  | "machine"
  | "dumbbell"
  | "barbell"
  | "ez_bar"
  | "smith"
  | "cable"
  | "bodyweight"
  | "bench"
  | "band"
  | "pullup_assist"
  | "dip_station"
  | "captains_chair";

/** reps = count repetitions; seconds = timed holds (plank). */
export type SetMetric = "reps" | "seconds";

export type SubstitutionReason =
  | "busy"
  | "missing"
  | "pain"
  | "no_spotter"
  | "fatigue"
  | "other";

export interface FallbackLink {
  exerciseId: string;
  when: string;
}

export interface Exercise {
  id: string;
  name: string;
  family: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  spotterFree: boolean;
  isCompound: boolean;
  metric: SetMetric;
  cues: string;
  displayUnit: WeightUnit;
  weightIsPerHand: boolean;
  available: boolean;
  fallbackChain: FallbackLink[];
  /** Smallest realistic load jump, in displayUnit. Optional override. */
  increment?: number;
  custom?: boolean;
}

export interface PersonalRecord {
  exerciseId: string;
  currentWeightKg?: number | null;
  reps?: number | null;
  perHand?: boolean | null;
  enteredUnit: WeightUnit;
  enteredValue?: number | null;
  updatedAt: number;
  note: string;
}

export type SessionKind = "gym" | "floating" | "home";

export interface PlanItem {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  rirTarget: number;
  notes: string;
}

export interface PlanSession {
  key: string;
  name: string;
  /** ISO weekday 1 = Monday … 7 = Sunday. null for floating/home sessions. */
  weekday: number | null;
  kind: SessionKind;
  focus: string;
  items: PlanItem[];
}

export interface Plan {
  id: string;
  name: string;
  daysPerWeek: 3 | 4;
  sessions: PlanSession[];
  /** Weekdays a floating session may land on (2 = Tue, 4 = Thu). */
  floatingWeekdays?: number[];
}

export interface WorkoutSet {
  idx: number;
  reps: number | null;
  weightKg: number | null;
  enteredValue: number | null;
  enteredUnit: WeightUnit;
  rir?: number | null;
  isWarmup: boolean;
  done: boolean;
}

export interface WorkoutEntry {
  exerciseId: string;
  plannedExerciseId?: string | null;
  substitutionReason?: SubstitutionReason | null;
  nameSnapshot: string;
  notes: string;
  sets: WorkoutSet[];
}

export type WorkoutStatus = "in_progress" | "completed";

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD (local)
  planId: string | null;
  sessionKey: string | null;
  sessionName: string;
  status: WorkoutStatus;
  startedAt: number;
  endedAt: number | null;
  effort: number | null;
  notes: string;
  entries: WorkoutEntry[];
  updatedAt: number;
}

export interface BodyMetric {
  id: string;
  ts: number;
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  notes: string;
}

export interface Activity {
  id: string;
  date: string;
  steps?: number | null;
  walkMinutes?: number | null;
  notes: string;
}

export interface MealItem {
  name: string;
  grams?: number | null;
  proteinG: number;
  kcal?: number | null;
}

export interface Meal {
  id: string;
  ts: number;
  date: string;
  text: string;
  items: MealItem[];
  proteinG: number;
  kcal?: number | null;
  estCost?: number | null;
  source: "manual" | "ai";
}

export interface Food {
  id: string;
  name: string;
  portionLabel: string;
  portionGrams?: number | null;
  proteinG?: number | null;
  kcal?: number | null;
  /** Price in COP that the user paid for `priceQty` portions. */
  priceCop?: number | null;
  priceQty?: number | null;
  priceNote?: string;
  notes?: string;
}

export interface Profile {
  heightCm: number | null;
  goal: string;
  units: "kg";
  timezone: string;
  weeklyBudget: number | null;
  currency: "COP";
  country: "CO";
  activePlanId: string | null;
  proteinTargetG: number | null;
  stepsTarget: number;
  stepsBaseline: number | null;
  startDate: string | null;
  startWeightKg: number | null;
  restTimerDefaultSec: number;
  seededVersion: number;
  createdAt: number;
}

export interface WeekPlan {
  /** ISO week key, e.g. 2026-W42. */
  id: string;
  floatingWeekday: number | null;
}

export interface WeeklyStats {
  id: string;
  attended: number;
  planned: number;
  setsByMuscle: Partial<Record<Muscle, number>>;
  tonnageByMuscle: Partial<Record<Muscle, number>>;
  avgWeight7d: number | null;
  waistCm: number | null;
  proteinAvg: number | null;
  updatedAt: number;
}

export type Verdict = "on_track" | "mixed" | "off_track" | "insufficient_data";

export interface AiSignal {
  key: string;
  status: "good" | "warn" | "bad" | "unknown";
  detail: string;
}

export interface AiReport {
  id: string;
  type: "weekly" | "adhoc";
  periodStart: string;
  periodEnd: string;
  model: string;
  createdAt: number;
  verdict: Verdict;
  summary: string;
  signals: AiSignal[];
  actions: string[];
  dataUsed: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  ts: number;
  toolCalls: string[];
}

export type MemoryKind = "insight" | "preference" | "injury" | "goal" | "note";

export interface Memory {
  id: string;
  text: string;
  kind: MemoryKind;
  sourceRef: string;
  createdAt: number;
  status?: "pending" | "saved";
}

export interface PlanChangeProposal {
  id: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
  summary: string;
  rationale: string;
  planId: string;
  sessionKey: string;
  op: "replace_exercise" | "change_sets" | "change_reps" | "add_exercise" | "remove_exercise";
  exerciseId?: string | null;
  newExerciseId?: string | null;
  sets?: number | null;
  repMin?: number | null;
  repMax?: number | null;
}
