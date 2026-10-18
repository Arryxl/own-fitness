// Seed exercise catalog (section 9). Everything here is editable from the app.
import type { Equipment, Exercise, FallbackLink, Muscle, SetMetric, WeightUnit } from "@/lib/types";

interface Opts {
  spotterFree?: boolean;
  compound?: boolean;
  metric?: SetMetric;
  unit?: WeightUnit;
  perHand?: boolean;
  cues?: string;
}

function ex(
  id: string,
  name: string,
  family: string,
  primaryMuscle: Muscle,
  secondaryMuscles: Muscle[],
  equipment: Equipment[],
  o: Opts = {},
): Omit<Exercise, "fallbackChain"> {
  const isDumbbell = equipment.includes("dumbbell");
  return {
    id,
    name,
    family,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    spotterFree: o.spotterFree ?? true,
    isCompound: o.compound ?? false,
    metric: o.metric ?? "reps",
    cues: o.cues ?? "",
    // Most dumbbells and machines in the user's gym are in pounds.
    displayUnit: o.unit ?? "lb",
    weightIsPerHand: o.perHand ?? isDumbbell,
    available: true,
  };
}

const BASE: Omit<Exercise, "fallbackChain">[] = [
  // Horizontal chest press
  ex("machine_chest_press", "Press de pecho en máquina", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["machine"], { compound: true, cues: "Escápulas atrás y abajo, codos ~45°." }),
  ex("db_flat_press", "Press plano con mancuernas", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["dumbbell", "bench"], { compound: true }),
  ex("smith_flat_press", "Press plano en Smith con topes", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["smith", "bench"], { compound: true, cues: "Ajusta los topes de seguridad a la altura del pecho." }),
  ex("push_up", "Flexiones", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["bodyweight"], { compound: true, unit: "kg", cues: "Pies elevados o lastre para progresar." }),
  ex("cable_chest_press", "Press de pecho en polea de pie", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["cable"], { compound: true }),
  ex("barbell_bench_press", "Press de banca con barra", "press_pecho_horizontal", "chest", ["triceps", "shoulders"], ["barbell", "bench"], { compound: true, spotterFree: false, unit: "kg", cues: "Sin compañero: usa Smith con topes o mancuernas." }),
  // Incline press
  ex("db_incline_press", "Press inclinado con mancuernas", "press_pecho_inclinado", "chest", ["shoulders", "triceps"], ["dumbbell", "bench"], { compound: true, cues: "Banco a 30-45°." }),
  ex("smith_incline_press", "Press inclinado en Smith", "press_pecho_inclinado", "chest", ["shoulders", "triceps"], ["smith", "bench"], { compound: true }),
  ex("machine_incline_press", "Press inclinado en máquina", "press_pecho_inclinado", "chest", ["shoulders", "triceps"], ["machine"], { compound: true }),
  ex("decline_push_up", "Flexiones con pies elevados", "press_pecho_inclinado", "chest", ["shoulders", "triceps"], ["bodyweight"], { compound: true, unit: "kg" }),
  // Flies
  ex("cable_fly", "Cruces en polea", "aperturas_pecho", "chest", [], ["cable"]),
  ex("pec_deck", "Pec deck", "aperturas_pecho", "chest", [], ["machine"]),
  ex("db_incline_fly", "Aperturas con mancuernas en banco inclinado", "aperturas_pecho", "chest", [], ["dumbbell", "bench"]),
  ex("low_to_high_cable_fly", "Cruces en polea de abajo hacia arriba", "aperturas_pecho", "chest", ["shoulders"], ["cable"]),
  // Vertical pull
  ex("lat_pulldown", "Jalón al pecho", "jalon_vertical", "back", ["biceps"], ["cable"], { compound: true, cues: "Lleva los codos hacia los bolsillos." }),
  ex("assisted_pull_up", "Dominadas asistidas (máquina)", "jalon_vertical", "back", ["biceps"], ["pullup_assist"], { compound: true, cues: "Más contrapeso = más fácil." }),
  ex("neutral_pulldown", "Jalón agarre neutro/cerrado", "jalon_vertical", "back", ["biceps"], ["cable"], { compound: true }),
  ex("single_arm_cable_pulldown", "Jalón unilateral en polea", "jalon_vertical", "back", ["biceps"], ["cable"], { compound: true }),
  ex("band_pull_up", "Dominadas con banda", "jalon_vertical", "back", ["biceps"], ["band", "bodyweight"], { compound: true, unit: "kg" }),
  // Horizontal row
  ex("seated_cable_row", "Remo sentado en polea", "remo_horizontal", "back", ["biceps", "rear_delts"], ["cable"], { compound: true }),
  ex("machine_row", "Remo en máquina", "remo_horizontal", "back", ["biceps", "rear_delts"], ["machine"], { compound: true }),
  ex("chest_supported_row", "Remo con apoyo en pecho", "remo_horizontal", "back", ["biceps", "rear_delts"], ["dumbbell", "bench"], { compound: true }),
  ex("one_arm_db_row", "Remo con mancuerna a una mano", "remo_horizontal", "back", ["biceps", "rear_delts"], ["dumbbell", "bench"], { compound: true }),
  ex("smith_bent_row", "Remo inclinado en Smith", "remo_horizontal", "back", ["biceps", "rear_delts"], ["smith"], { compound: true }),
  // Lateral raises
  ex("db_lateral_raise", "Elevaciones laterales", "elevacion_lateral", "shoulders", [], ["dumbbell"], { cues: "Sube hasta la altura del hombro, sin impulso." }),
  ex("cable_lateral_raise", "Elevaciones laterales en polea unilateral", "elevacion_lateral", "shoulders", [], ["cable"]),
  ex("machine_lateral_raise", "Máquina de elevaciones laterales", "elevacion_lateral", "shoulders", [], ["machine"]),
  ex("lying_lateral_raise", "Elevaciones laterales acostado de lado (banco inclinado)", "elevacion_lateral", "shoulders", [], ["dumbbell", "bench"]),
  // Vertical push
  ex("db_shoulder_press", "Press de hombros con mancuernas", "empuje_vertical", "shoulders", ["triceps"], ["dumbbell", "bench"], { compound: true }),
  ex("machine_shoulder_press", "Press de hombros en máquina", "empuje_vertical", "shoulders", ["triceps"], ["machine"], { compound: true }),
  ex("standing_db_press", "Press con mancuernas de pie", "empuje_vertical", "shoulders", ["triceps", "abs"], ["dumbbell"], { compound: true }),
  ex("smith_seated_press", "Press en Smith sentado", "empuje_vertical", "shoulders", ["triceps"], ["smith", "bench"], { compound: true }),
  ex("arnold_press", "Press Arnold", "empuje_vertical", "shoulders", ["triceps"], ["dumbbell", "bench"], { compound: true }),
  ex("vertical_push_unknown", "Empuje vertical (por identificar)", "empuje_vertical", "shoulders", ["traps", "triceps"], ["machine"], { compound: true, cues: "Renómbralo cuando sepas qué ejercicio exacto es." }),
  // Rear delts
  ex("face_pull", "Face pull en polea con cuerda", "deltoide_posterior", "rear_delts", ["traps"], ["cable"]),
  ex("reverse_pec_deck", "Máquina de pájaros (reverse pec deck)", "deltoide_posterior", "rear_delts", ["traps"], ["machine"]),
  ex("db_rear_delt_fly", "Pájaros con mancuernas inclinado sobre banco", "deltoide_posterior", "rear_delts", ["traps"], ["dumbbell", "bench"]),
  ex("band_pull_apart", "Pájaros con banda elástica", "deltoide_posterior", "rear_delts", ["traps"], ["band"], { unit: "kg" }),
  // Triceps
  ex("cable_overhead_ext", "Extensión de tríceps sobre la cabeza en polea", "extension_triceps", "triceps", [], ["cable"]),
  ex("db_overhead_ext", "Extensión sobre la cabeza con mancuerna a dos manos", "extension_triceps", "triceps", [], ["dumbbell"], { perHand: false }),
  ex("ez_skull_crusher", "Press francés con barra Z", "extension_triceps", "triceps", [], ["ez_bar", "bench"], { spotterFree: false, cues: "Usar con cuidado: carga moderada, controla la bajada." }),
  ex("rope_pushdown", "Pushdown de tríceps con cuerda", "extension_triceps", "triceps", [], ["cable"]),
  ex("bar_pushdown", "Pushdown con barra recta/V", "extension_triceps", "triceps", [], ["cable"]),
  ex("single_arm_pushdown", "Pushdown a una mano", "extension_triceps", "triceps", [], ["cable"]),
  ex("assisted_dip", "Fondos asistidos", "fondos", "triceps", ["chest", "shoulders"], ["pullup_assist"], { compound: true, cues: "Más contrapeso = más fácil." }),
  ex("dip_machine", "Máquina de fondos", "fondos", "triceps", ["chest", "shoulders"], ["machine"], { compound: true }),
  ex("close_grip_press", "Press cerrado en Smith/mancuernas", "fondos", "triceps", ["chest", "shoulders"], ["smith", "dumbbell", "bench"], { compound: true, perHand: false }),
  // Biceps
  ex("db_incline_curl", "Curl inclinado con mancuernas", "curl_biceps", "biceps", [], ["dumbbell", "bench"]),
  ex("db_curl", "Curl de bíceps con mancuernas", "curl_biceps", "biceps", [], ["dumbbell"], { unit: "kg" }),
  ex("cable_curl", "Curl en polea", "curl_biceps", "biceps", [], ["cable"]),
  ex("ez_curl", "Curl con barra Z", "curl_biceps", "biceps", [], ["ez_bar"]),
  ex("concentration_curl", "Curl concentrado", "curl_biceps", "biceps", [], ["dumbbell", "bench"]),
  ex("hammer_curl", "Curl martillo", "curl_martillo", "biceps", [], ["dumbbell"]),
  ex("rope_hammer_curl", "Martillo con cuerda en polea", "curl_martillo", "biceps", [], ["cable"]),
  ex("alt_hammer_curl", "Martillo alterno", "curl_martillo", "biceps", [], ["dumbbell"]),
  ex("incline_neutral_curl", "Curl neutro en banco inclinado", "curl_martillo", "biceps", [], ["dumbbell", "bench"]),
  // Legs
  ex("leg_press", "Prensa de piernas", "sentadilla_prensa", "quads", ["glutes"], ["machine"], { compound: true }),
  ex("smith_squat", "Sentadilla en Smith", "sentadilla_prensa", "quads", ["glutes"], ["smith"], { compound: true }),
  ex("goblet_squat", "Sentadilla goblet", "sentadilla_prensa", "quads", ["glutes"], ["dumbbell"], { compound: true, perHand: false }),
  ex("bulgarian_split_squat", "Sentadilla búlgara con apoyo", "sentadilla_prensa", "quads", ["glutes"], ["dumbbell", "bench"], { compound: true }),
  ex("leg_extension", "Extensión de piernas en máquina", "sentadilla_prensa", "quads", [], ["machine"]),
  ex("db_rdl", "Peso muerto rumano con mancuernas", "bisagra_cadera", "hamstrings", ["glutes"], ["dumbbell"], { compound: true, cues: "Cadera atrás, espalda neutra." }),
  ex("smith_rdl", "Peso muerto rumano en Smith", "bisagra_cadera", "hamstrings", ["glutes"], ["smith"], { compound: true }),
  ex("leg_curl", "Curl femoral en máquina", "bisagra_cadera", "hamstrings", [], ["machine"]),
  ex("glute_bridge", "Puente de glúteo / hip thrust", "bisagra_cadera", "glutes", ["hamstrings"], ["bodyweight", "bench"], { compound: true, perHand: false }),
  // Core
  ex("plank", "Plancha", "core_antiextension", "abs", [], ["bodyweight"], { metric: "seconds", unit: "kg" }),
  ex("knee_plank", "Plancha de rodillas", "core_antiextension", "abs", [], ["bodyweight"], { metric: "seconds", unit: "kg" }),
  ex("dead_bug", "Dead bug", "core_antiextension", "abs", [], ["bodyweight"], { unit: "kg" }),
  ex("pallof_press", "Pallof press en polea", "core_antiextension", "abs", [], ["cable"]),
  ex("hanging_knee_raise", "Elevación de rodillas colgado", "core_flexion", "abs", [], ["bodyweight"], { unit: "kg" }),
  ex("captains_chair_raise", "Elevación de rodillas en silla romana", "core_flexion", "abs", [], ["captains_chair"], { unit: "kg" }),
  ex("cable_crunch", "Crunch en polea", "core_flexion", "abs", [], ["cable"]),
  ex("machine_crunch", "Crunch en máquina", "core_flexion", "abs", [], ["machine"]),
  ex("floor_crunch", "Crunch en suelo (con peso opcional)", "core_flexion", "abs", [], ["bodyweight"], { unit: "kg", perHand: false }),
  ex("lying_leg_raise", "Elevación de piernas acostado", "core_flexion", "abs", [], ["bodyweight"], { unit: "kg" }),
];

const W_BUSY = "Si está ocupado más de ~3 min o no existe";
const W_NEXT = "Si el anterior tampoco está disponible";
const W_ANGLE = "Si hay dolor: cambia ángulo/agarre";
const W_LAST = "Último recurso";

/** Ordered fallback chains (section 9.5). Key = plan exercise; value = replacements in order. */
const CHAINS: Record<string, string[]> = {
  machine_chest_press: ["db_flat_press", "smith_flat_press", "push_up", "cable_chest_press"],
  db_flat_press: ["machine_chest_press", "smith_flat_press", "push_up"],
  barbell_bench_press: ["smith_flat_press", "machine_chest_press", "db_flat_press"],
  db_incline_press: ["smith_incline_press", "machine_incline_press", "decline_push_up", "low_to_high_cable_fly"],
  smith_incline_press: ["machine_incline_press", "db_incline_press", "decline_push_up"],
  machine_incline_press: ["smith_incline_press", "db_incline_press", "decline_push_up"],
  cable_fly: ["pec_deck", "db_incline_fly", "push_up"],
  pec_deck: ["cable_fly", "db_incline_fly", "push_up"],
  lat_pulldown: ["assisted_pull_up", "neutral_pulldown", "single_arm_cable_pulldown", "band_pull_up"],
  neutral_pulldown: ["lat_pulldown", "assisted_pull_up", "single_arm_cable_pulldown"],
  seated_cable_row: ["machine_row", "chest_supported_row", "one_arm_db_row", "smith_bent_row"],
  chest_supported_row: ["machine_row", "seated_cable_row", "one_arm_db_row"],
  one_arm_db_row: ["chest_supported_row", "seated_cable_row", "machine_row"],
  db_lateral_raise: ["cable_lateral_raise", "machine_lateral_raise", "lying_lateral_raise"],
  db_shoulder_press: ["machine_shoulder_press", "standing_db_press", "smith_seated_press", "arnold_press"],
  machine_shoulder_press: ["db_shoulder_press", "smith_seated_press", "arnold_press"],
  face_pull: ["reverse_pec_deck", "db_rear_delt_fly", "band_pull_apart"],
  cable_overhead_ext: ["db_overhead_ext", "ez_skull_crusher", "rope_pushdown"],
  rope_pushdown: ["bar_pushdown", "single_arm_pushdown", "assisted_dip"],
  assisted_dip: ["dip_machine", "close_grip_press", "rope_pushdown"],
  db_incline_curl: ["db_curl", "cable_curl", "ez_curl", "concentration_curl"],
  db_curl: ["cable_curl", "ez_curl", "concentration_curl"],
  hammer_curl: ["rope_hammer_curl", "alt_hammer_curl", "incline_neutral_curl"],
  leg_press: ["smith_squat", "goblet_squat", "bulgarian_split_squat", "leg_extension"],
  goblet_squat: ["smith_squat", "leg_press", "bulgarian_split_squat"],
  db_rdl: ["smith_rdl", "leg_curl", "glute_bridge"],
  plank: ["knee_plank", "dead_bug", "pallof_press"],
  hanging_knee_raise: ["captains_chair_raise", "cable_crunch", "machine_crunch", "floor_crunch"],
  cable_crunch: ["machine_crunch", "floor_crunch", "lying_leg_raise"],
};

function chainFor(id: string): FallbackLink[] {
  const ids = CHAINS[id] ?? [];
  return ids.map((exerciseId, i) => ({
    exerciseId,
    when: i === 0 ? W_BUSY : i === 1 ? W_ANGLE : i === ids.length - 1 ? W_LAST : W_NEXT,
  }));
}

export const SEED_EXERCISES: Exercise[] = BASE.map((e) => ({ ...e, fallbackChain: chainFor(e.id) }));
