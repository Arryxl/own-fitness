// Shared domain types. Global read-only catalog lives in `catalog/*`; each
// user's data lives under `users/{uid}/**`.
import type { CatalogExercise, Equipment, Goal, Muscle, Place, RepUnit, TemplateItem } from "@/lib/seed/schema";

export type { AddOn, CatalogExercise, Category, Equipment, Goal, Muscle, Place, ProgramTemplate, RepUnit, TemplateItem } from "@/lib/seed/schema";

export type WeightUnit = "kg" | "lb";
/** "mixed" = use each exercise's usual gym unit (dumbbells/machines often in lb). */
export type UnitsPref = "kg" | "lb" | "mixed";
export type Level = "principiante" | "intermedio" | "avanzado";
export type Sex = "male" | "female" | "other";

export type SubstitutionReason = "busy" | "missing" | "pain" | "no_spotter" | "fatigue" | "other";

export interface FallbackLink {
  exerciseId: string;
  when: string;
}

/** users/{uid}/exerciseOverrides/{exerciseId}: only the fields the user changed (or a full custom exercise). */
export interface ExerciseOverride {
  id: string;
  userModified: true;
  available?: boolean;
  displayUnit?: WeightUnit;
  fallbackChain?: FallbackLink[];
  name?: string;
  cues?: string;
  increment?: number | null;
  /** Custom exercises created by the user carry the full definition. */
  custom?: Omit<CatalogExercise, "id" | "source" | "available">;
  updatedAt: number;
}

/** Effective exercise = catalog entry merged with the user's override and equipment profile. */
export interface Exercise {
  id: string;
  name: string;
  family: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  spotterFree: boolean;
  isCompound: boolean;
  weightIsPerHand: boolean;
  displayUnit: WeightUnit;
  metric: RepUnit;
  cues: string;
  fallbackChain: FallbackLink[];
  available: boolean;
  increment?: number | null;
  custom: boolean;
  overridden: boolean;
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

export type PlanItem = TemplateItem;

/** Where a session or extra block happens. */
export type BlockPlace = "gym" | "home" | "outdoor";

export interface PlanSession {
  key: string;
  name: string;
  focus: string;
  kind: "lifting" | "cardio";
  /** ISO weekday 1 = Monday … 7 = Sunday; null for optional/floating or rotating sessions. */
  weekday: number | null;
  optional: boolean;
  floating: boolean;
  notes: string | null;
  estimatedMinutes: number;
  items: PlanItem[];
  /** Missing on plans created before weekly blocks existed: treated as "gym". */
  place?: BlockPlace;
  /**
   * A block added on top of the plan (core at home, a walk, mobility…) by the
   * user or an approved coach proposal. It never counts toward attendance.
   */
  extra?: boolean;
}

/** users/{uid}/plans/{id}: an editable copy of a template. */
export interface Plan {
  id: string;
  name: string;
  sourceTemplateId: string | null;
  goal: Goal;
  daysPerWeek: number;
  level: string;
  weekdayVariant: string | null;
  rotation: "alternate" | null;
  /** For rotating plans: training weekdays and the date the rotation starts counting from. */
  scheduleDays: number[];
  startDate: string;
  sessions: PlanSession[];
  enabledAddOns: string[];
  recommendedAddOns: string[];
  progressionRules: string[];
  dailyStepsTarget: [number, number] | null;
  createdAt: number;
  updatedAt: number;
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
  repUnit?: RepUnit;
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
  sessionKind?: "lifting" | "cardio";
  /** Logged from an extra block: excluded from attendance. */
  extra?: boolean;
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

/** Catalog food merged with the user's prices; users/{uid}/foods holds overrides and custom foods. */
export interface Food {
  id: string;
  name: string;
  portionLabel: string;
  portionGrams?: number | null;
  proteinG?: number | null;
  kcal?: number | null;
  tags?: string[];
  priceCop?: number | null;
  priceQty?: number | null;
  priceNote?: string;
  notes?: string;
  custom?: boolean;
  hidden?: boolean;
}

export interface AiConsent {
  accepted: boolean;
  at: number | null;
}

export interface Profile {
  schemaVersion: 2;
  displayName: string | null;
  birthDate: string | null;
  sex: Sex | null;
  heightCm: number | null;
  startWeightKg: number | null;
  goal: Goal | null;
  trainingDays: number[];
  level: Level | null;
  unavailableEquipment: Equipment[];
  /** Where the user trains; drives recommendations and equipment defaults. */
  trainingPlace?: Place;
  injuries: string;
  country: string;
  currency: string;
  weeklyBudget: number | null;
  dietaryRestrictions: string[];
  dietNotes: string;
  units: UnitsPref;
  healthAcceptedAt: number | null;
  privacyAcceptedAt: number | null;
  aiConsent: AiConsent;
  onboardingStep: number;
  onboardingCompletedAt: number | null;
  activePlanId: string | null;
  proteinTargetG: number | null;
  stepsTarget: number;
  stepsBaseline: number | null;
  startDate: string | null;
  restTimerDefaultSec: number;
  timezone: string;
  createdAt: number;
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

export type ProposalOp =
  "replace_exercise" | "change_sets" | "change_reps" | "add_exercise" | "remove_exercise" | "move_session" | "remove_session" | "add_block";

/** A new extra block proposed by the coach; one copy is created per weekday. */
export interface ProposedBlock {
  name: string;
  focus: string;
  place: BlockPlace;
  kind: "lifting" | "cardio";
  weekdays: number[];
  estimatedMinutes: number;
  items: PlanItem[];
}

export interface PlanChangeProposal {
  id: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
  summary: string;
  rationale: string;
  planId: string;
  /** Empty for add_block. */
  sessionKey: string;
  op: ProposalOp;
  exerciseId?: string | null;
  newExerciseId?: string | null;
  sets?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  /** add_exercise: unit of the rep range (seconds for a plank, minutes for cardio). */
  repUnit?: RepUnit | null;
  /** move_session: the new ISO weekday (null = no fixed day). */
  weekday?: number | null;
  block?: ProposedBlock | null;
}
