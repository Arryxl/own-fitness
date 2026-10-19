// Builds catalog v3: takes the v2 library (data/seed/rutinas_seed.json) and adds
// the programs from the deep research ("Catálogo ampliado de rutinas de
// gimnasio", 2026-10-18). Idempotent: entries are replaced by id.
//   node scripts/catalog/build-v3.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../../data/seed/rutinas_seed.json", import.meta.url);
const seed = JSON.parse(readFileSync(FILE, "utf8"));

// ---------------------------------------------------------------- exercises
const W_BUSY = "Si el equipo está ocupado más de ~3 min o no existe en tu gimnasio";
const W_NEXT = "Si la opción anterior tampoco está disponible";
const W_PAIN = "Si notas molestia articular: cambia ángulo o agarre";
const W_SOLO = "Si entrenas solo y no hay rack con barras de seguridad";
const chainOf = (ids, firstWhen = W_BUSY) => ids.map((exerciseId, i) => ({ exerciseId, when: i === 0 ? firstWhen : i === 1 ? W_NEXT : W_PAIN }));

function ex(id, name, family, primaryMuscle, secondaryMuscles, equipment, o = {}) {
  return {
    id,
    name,
    family,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    spotterFree: o.spotterFree ?? true,
    isCompound: o.compound ?? false,
    weightIsPerHand: o.perHand ?? false,
    displayUnit: o.unit ?? "lb",
    cues: o.cues ?? "",
    fallbackChain: chainOf(o.chain ?? [], o.firstWhen),
    available: true,
    source: "seed",
  };
}

const NEW_EXERCISES = [
  // Barbell variants used by the classic programs (need rack/safeties where noted)
  ex("front_squat", "Sentadilla frontal con barra", "sentadilla", "quads", ["glutes", "abs"], ["barbell", "rack"], { spotterFree: false, compound: true, cues: "Codos altos, torso erguido. Entrenando solo, usa barras de seguridad.", chain: ["smith_squat", "goblet_squat", "leg_press"], firstWhen: W_SOLO }),
  ex("barbell_rdl", "Peso muerto rumano con barra", "bisagra_cadera", "hamstrings", ["glutes", "back"], ["barbell"], { compound: true, cues: "Cadera atrás, barra pegada a las piernas, espalda neutra.", chain: ["db_rdl", "smith_rdl", "seated_leg_curl"] }),
  ex("sumo_deadlift", "Peso muerto sumo", "bisagra_cadera", "glutes", ["hamstrings", "quads", "back"], ["barbell"], { compound: true, chain: ["conventional_deadlift", "db_rdl", "leg_press"] }),
  ex("power_clean", "Cargada de potencia (power clean)", "potencia", "glutes", ["hamstrings", "quads", "traps"], ["barbell"], { compound: true, cues: "Movimiento técnico: aprende con carga ligera. Deja caer la barra si fallas.", chain: ["jump_squat", "barbell_rdl"] }),
  ex("incline_barbell_bench", "Press inclinado con barra", "press_inclinado", "chest", ["front_delts", "triceps"], ["barbell", "bench", "rack"], { spotterFree: false, compound: true, chain: ["incline_smith_press", "incline_db_press", "incline_machine_press"], firstWhen: W_SOLO }),
  ex("close_grip_bench", "Press de banca agarre cerrado", "press_cerrado", "triceps", ["chest", "front_delts"], ["barbell", "bench", "rack"], { spotterFree: false, compound: true, chain: ["close_grip_smith_press", "dip", "pushdown_bar"], firstWhen: W_SOLO }),
  ex("good_morning", "Buenos días con barra", "bisagra_cadera", "hamstrings", ["glutes", "back"], ["barbell", "rack"], { compound: true, cues: "Carga moderada, rodillas ligeramente flexionadas.", chain: ["barbell_rdl", "db_rdl", "back_extension"] }),
  // Bodyweight / bars
  ex("pullup", "Dominada (agarre prono)", "jalon_vertical", "back", ["biceps"], ["pullup_bar"], { compound: true, chain: ["chin_up", "assisted_pullup", "lat_pulldown", "band_pulldown"] }),
  ex("dip", "Fondos en paralelas", "fondos", "triceps", ["chest", "front_delts"], ["dip_bars"], { compound: true, cues: "Baja hasta ~90° de codo; evita si te molesta el hombro.", chain: ["assisted_dip", "close_grip_smith_press", "pushdown_rope"] }),
  ex("inverted_row", "Remo invertido", "remo", "back", ["biceps", "rear_delts"], ["bodyweight"], { compound: true, cues: "Barra baja, Smith o anillas. Más horizontal = más difícil.", chain: ["seated_cable_row", "one_arm_db_row", "band_row"] }),
  ex("negative_pullup", "Dominada negativa", "jalon_vertical", "back", ["biceps"], ["pullup_bar"], { compound: true, cues: "Sube con salto o banco y baja en 3-5 s.", chain: ["assisted_pullup", "lat_pulldown", "band_pulldown"] }),
  ex("scapular_pull", "Dominada escapular", "jalon_vertical", "back", [], ["pullup_bar"], { cues: "Colgado con brazos rectos, deprime y retrae las escápulas.", chain: ["straight_arm_pulldown"] }),
  ex("negative_dip", "Fondo negativo", "fondos", "triceps", ["chest", "front_delts"], ["dip_bars"], { compound: true, cues: "Baja en 3-5 s; empieza con el soporte de 60 s.", chain: ["assisted_dip", "pushup"] }),
  ex("dip_support_hold", "Soporte en paralelas (isométrico)", "fondos", "triceps", ["chest"], ["dip_bars"], { cues: "Brazos bloqueados, hombros abajo. Meta: 60 s.", chain: ["assisted_dip"] }),
  ex("wall_pushup", "Flexiones en pared", "press_horizontal", "chest", ["triceps", "front_delts"], ["bodyweight"], {}),
  ex("incline_pushup", "Flexiones inclinadas (manos elevadas)", "press_horizontal", "chest", ["triceps", "front_delts"], ["bodyweight"], { compound: true, chain: ["wall_pushup"] }),
  ex("pike_pushup", "Flexiones en pica", "press_vertical", "front_delts", ["triceps"], ["bodyweight"], { compound: true, chain: ["incline_pushup"] }),
  ex("bw_squat", "Sentadilla con peso corporal", "sentadilla", "quads", ["glutes"], ["bodyweight"], { compound: true, chain: ["sit_to_stand"] }),
  ex("split_squat_bw", "Sentadilla dividida (split squat)", "sentadilla", "quads", ["glutes"], ["bodyweight"], { compound: true, chain: ["bw_squat"] }),
  ex("single_leg_rdl", "Peso muerto a una pierna", "bisagra_cadera", "hamstrings", ["glutes"], ["bodyweight"], { compound: true, cues: "Puedes apoyarte en una pared para el equilibrio.", chain: ["glute_bridge"] }),
  ex("nordic_curl", "Curl nórdico (asistido con banda)", "curl_femoral", "hamstrings", [], ["bodyweight"], { cues: "Baja lento; ayúdate con las manos o una banda.", chain: ["single_leg_rdl", "lying_leg_curl"] }),
  ex("hollow_hold", "Hollow hold", "core_estatico", "abs", [], ["bodyweight"], { chain: ["dead_bug"] }),
  ex("ab_rollout_knee", "Rueda abdominal de rodillas", "core_dinamico", "abs", [], ["bodyweight"], { cues: "Sin arquear la zona lumbar.", chain: ["plank", "dead_bug"] }),
  ex("reverse_crunch", "Crunch inverso", "core_flexion", "abs", [], ["bodyweight"], { chain: ["lying_leg_raise"] }),
  ex("jump_squat", "Sentadilla con salto", "potencia", "quads", ["glutes", "calves"], ["bodyweight"], { cues: "Aterriza suave; 3-5 reps rápidas.", chain: ["goblet_squat"] }),
  ex("sit_to_stand", "Levantarse de la silla (sit-to-stand)", "sentadilla", "quads", ["glutes"], ["bodyweight"], { compound: true, cues: "Sube rápido, baja controlado. Usa los brazos solo si hace falta." }),
  ex("step_up", "Subida al cajón (step-up)", "sentadilla", "quads", ["glutes"], ["bench"], { compound: true, cues: "Banco o escalón estable; sostén mancuernas para progresar.", chain: ["split_squat_bw", "sit_to_stand"] }),
  // Glutes / lower back
  ex("back_extension", "Hiperextensión lumbar", "extension_lumbar", "glutes", ["hamstrings", "back"], ["machine"], { cues: "Banco de hiperextensiones; movimiento controlado.", chain: ["glute_bridge", "single_leg_rdl"] }),
  ex("machine_hip_abduction", "Abducción de cadera en máquina", "abduccion", "glutes", [], ["machine"], { chain: ["band_lateral_walk"] }),
  ex("band_lateral_walk", "Caminata lateral con banda", "abduccion", "glutes", [], ["band"], { chain: ["glute_bridge"] }),
  // Shoulders / back extras
  ex("cable_upright_row", "Remo al mentón en polea", "elevacion_lateral", "side_delts", ["traps"], ["cable"], { cues: "Agarre ancho, codos hasta la altura del hombro (no más).", chain: ["lateral_raise_db", "cable_lateral_raise"] }),
  ex("db_pullover", "Pullover con mancuerna", "aislado_dorsal", "back", ["chest"], ["dumbbell", "bench"], { chain: ["straight_arm_pulldown"] }),
  // Home: dumbbells and bands
  ex("db_floor_press", "Press de suelo con mancuernas", "press_horizontal", "chest", ["triceps", "front_delts"], ["dumbbell"], { compound: true, perHand: true, chain: ["pushup", "band_chest_press"] }),
  ex("band_row", "Remo con banda", "remo", "back", ["biceps", "rear_delts"], ["band"], { compound: true, cues: "Ancla la banda a la altura del pecho (puerta o poste).", chain: ["inverted_row", "one_arm_db_row"] }),
  ex("band_chest_press", "Press de pecho con banda", "press_horizontal", "chest", ["triceps", "front_delts"], ["band"], { compound: true, chain: ["pushup"] }),
  ex("band_pulldown", "Jalón con banda", "jalon_vertical", "back", ["biceps"], ["band"], { compound: true, chain: ["band_row"] }),
  // Balance (older adults)
  ex("single_leg_balance", "Equilibrio a una pierna", "equilibrio", "balance", [], ["bodyweight"], { cues: "Cerca de una pared o silla. Progresa: ojos cerrados o superficie blanda." }),
  ex("tandem_walk", "Caminar en tándem (talón-punta)", "equilibrio", "balance", [], ["bodyweight"], { cues: "Junto a una pared; 10-20 pasos." }),
  // Cardio
  ex("run_walk", "Correr / caminar por intervalos", "carrera", "cardio", [], ["bodyweight"], { unit: "min", cues: "Ritmo en el que puedas hablar a ratos. Calienta 5 min caminando.", chain: ["incline_walk", "elliptical_steady"] }),
  ex("easy_run", "Trote suave", "carrera", "cardio", [], ["bodyweight"], { unit: "min", cues: "Ritmo conversacional.", chain: ["bike_steady", "incline_walk"] }),
  ex("brisk_walk", "Caminata rápida", "cardio_suave", "cardio", [], ["bodyweight"], { unit: "min", chain: ["incline_walk"] }),
  ex("rower_steady", "Remo ergómetro suave", "cardio_suave", "cardio", [], ["machine"], { unit: "min", chain: ["bike_steady", "elliptical_steady"] }),
];

// ---------------------------------------------------------------- templates
function it(exerciseId, sets, repMin, repMax, o = {}) {
  return {
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec: o.rest ?? (repMax <= 6 ? 180 : 90),
    rirTarget: o.rir ?? (repMax <= 6 ? 2 : 1),
    supersetGroup: o.ss ?? null,
    notes: o.notes ?? null,
    repUnit: o.unit ?? "reps",
    ...(o.intensity ? { intensity: o.intensity } : {}),
    ...(o.amrap ? { amrap: true } : {}),
  };
}
const amrap = (extra = "") => `Última serie AMRAP (máximas reps con buena técnica, parando a 1-2 RIR)${extra}`;

function session(key, name, focus, items, o = {}) {
  const lifting = items.filter((i) => i.repUnit !== "minutes");
  const totalSets = lifting.reduce((t, i) => t + i.sets, 0);
  const est =
    o.minutes ??
    Math.round(
      items.reduce((t, i) => t + (i.repUnit === "minutes" ? i.repMax + (i.sets - 1) * (i.restSec / 60) : (i.sets * (45 + i.restSec)) / 60), 0) / 5,
    ) * 5;
  return {
    key,
    name,
    focus,
    items,
    optional: o.optional ?? false,
    notes: o.notes ?? null,
    kind: o.kind ?? (lifting.length ? "lifting" : "cardio"),
    floating: o.floating ?? false,
    estimatedMinutes: est,
    totalSets,
    exerciseCount: items.length,
  };
}

function tpl(t) {
  const sessionsPerWeek = t.sessionsPerWeek ?? t.daysPerWeek;
  return {
    id: t.id,
    name: t.name,
    goal: t.goal,
    daysPerWeek: t.daysPerWeek,
    level: t.level,
    split: t.split,
    recommendedForNovice: t.recommendedForNovice,
    priorities: t.priorities ?? [],
    knownAs: t.knownAs,
    bestFor: t.bestFor,
    weekdayMap: t.weekdayMap ?? {},
    rationale: t.rationale,
    communityNote: t.communityNote,
    caveats: t.caveats,
    sessions: t.sessions,
    requiresWeekend: t.requiresWeekend ?? Object.values(t.weekdayMap ?? {}).some((m) => Object.values(m).some((d) => d >= 6)),
    sessionMinutesRange: t.sessionMinutesRange,
    cardioMinutesPerWeek: t.cardioMinutesPerWeek ?? 0,
    sessionsPerWeek,
    category: t.category,
    place: t.place ?? "gym",
    tags: t.tags ?? [],
    source: t.source,
    ...(t.progressionRules ? { progressionRules: t.progressionRules } : {}),
    ...(t.deloadRules ? { deloadRules: t.deloadRules } : {}),
    ...(t.rotation ? { rotation: t.rotation, schedule: t.schedule } : {}),
    ...(t.recommendedAddOns ? { recommendedAddOns: t.recommendedAddOns } : {}),
    ...(t.dailyStepsTarget ? { dailyStepsTarget: t.dailyStepsTarget } : {}),
    ...(t.durationWeeks ? { durationWeeks: t.durationWeeks } : {}),
  };
}

const ROT_3 = { rotation: "alternate", schedule: { days: [1, 3, 5], pattern: "Semana 1: A-B-A · Semana 2: B-A-B" } };
const UL4 = (a, b, c, d) => ({ classic: { [a]: 1, [b]: 2, [c]: 4, [d]: 5 }, extraTuesday: { [a]: 1, [b]: 2, [c]: 3, [d]: 5 }, extraThursday: { [a]: 1, [b]: 3, [c]: 4, [d]: 5 } });
const LINEAR_STALL = "Si fallas las repeticiones objetivo, repite el peso la próxima sesión.";
const RACK = "Sentadilla y press de banca con barra requieren rack con barras de seguridad (o compañero) si entrenas solo; si no hay, la app usa la alternativa en Smith o mancuernas.";
const LBKG = "Incrementos de la fuente en libras: 2,5 lb ≈ 1,25 kg · 5 lb ≈ 2,5 kg · 10 lb ≈ 5 kg (usa el salto mínimo que tenga tu gimnasio).";

const SRC = {
  bbr: { name: "r/Fitness — Basic Beginner Routine (wiki oficial)", url: "https://thefitness.wiki/routines/r-fitness-basic-beginner-routine/", verification: "primaria" },
  gslp: { name: "Phrak's GSLP (r/Fitness) — transcripción de Liftosaur", url: "https://www.liftosaur.com/programs/phrakgreyskull", verification: "comunitaria" },
  ss: { name: "Starting Strength (Rippetoe) — fases según Lift Vault", url: "https://liftvault.com/programs/strength/starting-strength-spreadsheet/", verification: "comunitaria" },
  b531: { name: "5/3/1 for Beginners (Wendler / wiki de r/Fitness)", url: "https://thefitness.wiki/routines/5-3-1-for-beginners/", verification: "primaria" },
  ivy: { name: "Ivysaur 4-4-8 (r/Fitness) — transcripción de Liftosaur", url: "https://www.liftosaur.com/programs/ivysaur-4-4-8", verification: "comunitaria" },
  texas: { name: "Texas Method (Pendlay/Rippetoe) — Lift Vault", url: "https://liftvault.com/programs/strength/texas-method/", verification: "comunitaria" },
  madcow: { name: "Madcow 5×5 (derivado de Bill Starr) — Lift Vault / Hevy", url: "https://liftvault.com/programs/strength/madcow-5x5-spreadsheet/", verification: "comunitaria" },
  nsuns: { name: "nSuns 5/3/1 LP 5 días — transcripción de Liftosaur", url: "https://liftvault.com/programs/powerlifting/n-suns-lifting-spreadsheets/", verification: "comunitaria" },
  bbb: { name: "5/3/1 Boring But Big (Jim Wendler)", url: "https://www.jimwendler.com/blogs/jimwendler-com/101077382-boring-but-big", verification: "comunitaria" },
  metal: { name: "PPL de Metallicadpa (r/Fitness, 2015) — Liftosaur", url: "https://www.liftosaur.com/programs/metallicadpappl", verification: "comunitaria" },
  cool: { name: "PPL de Coolcicada — Liftosaur", url: "https://www.liftosaur.com/programs/coolcicada-ppl", verification: "comunitaria" },
  phul: { name: "PHUL (Brandon Campbell) — Liftosaur", url: "https://www.liftosaur.com/programs/phul", verification: "comunitaria" },
  phat: { name: "PHAT (Layne Norton) — Liftosaur, contrastado con Hevy", url: "https://www.liftosaur.com/programs/phat", verification: "comunitaria" },
  gbr: { name: "Generic Bulking Routine (Lyle McDonald) — Liftosaur", url: "https://www.liftosaur.com/programs/lylegenericbulking", verification: "comunitaria" },
  bro: { name: "Bro split clásico — Liftosaur (sin autor único)", url: "https://www.liftosaur.com/programs/bro-split", verification: "comunitaria" },
  fierce: { name: "Fierce 5 Novice (davisj3537) — Liftosaur", url: "https://www.liftosaur.com/programs/fierce-5", verification: "comunitaria" },
  c25k: { name: "NHS Couch to 5K (plan oficial)", url: "https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/", verification: "primaria" },
  nor4x4: { name: "Helgerud et al. 2007 (4×4 al 90-95 % FCmáx)", url: "https://pubmed.ncbi.nlm.nih.gov/17414804/", verification: "primaria" },
  gibala: { name: "Gibala et al. 2012 (10×1 y SIT tipo Wingate)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3381816", verification: "primaria" },
  who: { name: "Síntesis IronLog de las pautas OMS 2020 y ACSM 2026", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/", verification: "sintesis" },
  rr: { name: "r/bodyweightfitness Recommended Routine — Liftosaur", url: "https://www.liftosaur.com/programs/recommended-routine", verification: "comunitaria" },
  older: { name: "Síntesis IronLog de NSCA 2019, ACSM 2026 y OMS 2020", url: "https://pubmed.ncbi.nlm.nih.gov/31343601/", verification: "sintesis" },
  minimal: { name: "Síntesis IronLog de Iversen et al. 2021 y Nuzzo et al. 2024", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772", verification: "sintesis" },
  home: { name: "Síntesis IronLog (ACSM 2026; Lopes et al. 2019 sobre bandas)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6383082/", verification: "sintesis" },
};

const NEW_TEMPLATES = [
  // ------------------------------------------------ STRENGTH · NOVICE
  tpl({
    id: "F3", name: "Basic Beginner Routine (r/Fitness)", goal: "fuerza", daysPerWeek: 3, level: "principiante", split: "strength_full_body", recommendedForNovice: true,
    category: "fuerza_novato", tags: ["barra", "progresion_lineal", "amrap"], source: SRC.bbr, ...ROT_3,
    knownAs: "BBR · rutina básica de la wiki de r/Fitness", priorities: ["fuerza", "técnica con barra"],
    bestFor: "Principiante absoluto con barra que quiere aprender los básicos y subir de peso cada sesión. Máximo 3 meses.",
    rationale: "Dos sesiones A/B de cuerpo completo, 3×5 con la última serie AMRAP y progresión lineal por sesión: la forma más simple de sobrecarga para un novato.",
    communityNote: "Es la recomendación por defecto de la wiki de r/Fitness para empezar, por delante de GZCLP o 5/3/1 for Beginners.",
    caveats: `${RACK} Poco trabajo de brazos y hombro lateral: añade los refuerzos opcionales si quieres. ${LBKG}`,
    sessions: [
      session("A", "Entrenamiento A", "Remo, banca y sentadilla", [it("barbell_row", 3, 5, 5, { amrap: true, notes: amrap() }), it("barbell_bench_press", 3, 5, 5, { amrap: true, notes: amrap() }), it("barbell_back_squat", 3, 5, 5, { amrap: true, notes: amrap() })], { minutes: 50 }),
      session("B", "Entrenamiento B", "Dominada, press militar y peso muerto", [it("chin_up", 3, 5, 5, { amrap: true, notes: amrap(" · sustitutos: negativas, jalón o asistida") }), it("barbell_ohp", 3, 5, 5, { amrap: true, notes: amrap() }), it("conventional_deadlift", 3, 5, 5, { amrap: true, notes: amrap() })], { minutes: 50 }),
    ],
    sessionMinutesRange: [45, 60], cardioMinutesPerWeek: 45,
    progressionRules: [
      "Peso inicial: barra vacía ×5 y sube 10-20 lb por serie hasta que la técnica se degrade; empieza conservador.",
      "Cada sesión: +2,5 lb en ejercicios de tren superior y +5 lb en sentadilla y peso muerto.",
      "Si la serie AMRAP pasa de 10 reps: +5 lb (superior) o +10 lb (inferior).",
      "Si un ejercicio suma menos de 15 reps en total: baja su peso un 10 % la próxima vez.",
      "Descanso 2-3 min entre series. Cardio 2 días: 15-30 min suave y 10-15 min intenso, después de pesas.",
      "Al terminar (≤3 meses): pasa a GZCLP o 5/3/1 for Beginners.",
    ],
  }),
  tpl({
    id: "F4", name: "GSLP de Phrak", goal: "fuerza", daysPerWeek: 3, level: "principiante", split: "strength_full_body", recommendedForNovice: true,
    category: "fuerza_novato", tags: ["barra", "progresion_lineal", "amrap"], source: SRC.gslp, ...ROT_3,
    knownAs: "Phrak's Greyskull LP", priorities: ["fuerza"],
    bestFor: "Principiante que quiere una progresión lineal simple con series AMRAP y dominadas.",
    rationale: "Variante de Greyskull LP: 2×5 + 1×5+ en cada básico y progresión por sesión, con la serie AMRAP marcando el ritmo.",
    communityNote: "Popular en r/Fitness. Críticas: sin aislamiento de brazos, hombros ni core; una sola serie de peso muerto; exige discos de 1,25 kg; la dominada con peso corporal no se puede descargar.",
    caveats: `${RACK} ${LBKG}`,
    sessions: [
      session("A", "Entrenamiento A", "Press militar, dominada y sentadilla", [it("barbell_ohp", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)" }), it("chin_up", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)" }), it("barbell_back_squat", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)" })], { minutes: 45 }),
      session("B", "Entrenamiento B", "Banca, remo y peso muerto", [it("barbell_bench_press", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)" }), it("barbell_row", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)" }), it("conventional_deadlift", 1, 5, 5, { amrap: true, notes: "1×5+ (AMRAP)" })], { minutes: 40 }),
    ],
    sessionMinutesRange: [40, 50],
    progressionRules: ["+2,5 lb en tren superior y +5 lb en tren inferior cada sesión.", "Si la serie AMRAP llega a 10+ reps: duplica el incremento.", "Si haces menos de 5 reps en la última serie: baja un 10 % ese ejercicio."],
  }),
  tpl({
    id: "F5", name: "Starting Strength (fases 1-2)", goal: "fuerza", daysPerWeek: 3, level: "principiante", split: "strength_full_body", recommendedForNovice: true,
    category: "fuerza_novato", tags: ["barra", "progresion_lineal"], source: SRC.ss, ...ROT_3,
    knownAs: "Starting Strength · Mark Rippetoe", priorities: ["sentadilla", "fuerza general"],
    bestFor: "Principiante o persona que vuelve y aún puede subir peso en cada sesión; centrado en sentadilla.",
    rationale: "Sentadilla en todas las sesiones, press y banca alternados y una sola serie pesada de peso muerto. Fase 2: la cargada de potencia entra en B.",
    communityNote: "Clásico del entrenamiento con barra. Los incrementos exactos solo están verificados en fuentes secundarias.",
    caveats: `${RACK} Fase 2: sustituye el peso muerto de B por cargada de potencia 5×3 cuando el peso muerto empiece a dejarte fatigado. Fase 3 (sentadilla ligera el miércoles al ~80 %) cuando ya no puedas subir cada sesión. ${LBKG}`,
    sessions: [
      session("A", "Entrenamiento A", "Sentadilla, press militar y peso muerto", [it("barbell_back_squat", 3, 5, 5, { rest: 240 }), it("barbell_ohp", 3, 5, 5, { rest: 240 }), it("conventional_deadlift", 1, 5, 5, { rest: 240 })], { minutes: 50 }),
      session("B", "Entrenamiento B", "Sentadilla, banca y peso muerto (fase 2: cargada)", [it("barbell_back_squat", 3, 5, 5, { rest: 240 }), it("barbell_bench_press", 3, 5, 5, { rest: 240 }), it("conventional_deadlift", 1, 5, 5, { rest: 240, notes: "Fase 2: cambia por cargada de potencia 5×3" })], { minutes: 50 }),
    ],
    sessionMinutesRange: [45, 60],
    progressionRules: ["Sube carga cada sesión mientras completes 3×5 (fuentes secundarias: +5 lb, peso muerto +10 lb).", LINEAR_STALL, "Tras 3 fallos seguidos con el mismo peso: baja ~10 % y vuelve a subir (fuente secundaria).", "Descanso 3-5 min. Cuando ya no puedas subir cada sesión: Texas Method o Madcow."],
  }),
  tpl({
    id: "F6", name: "5/3/1 for Beginners", goal: "fuerza", daysPerWeek: 3, level: "principiante", split: "strength_full_body", recommendedForNovice: true,
    category: "fuerza_novato", tags: ["barra", "porcentajes", "amrap"], source: SRC.b531,
    weekdayMap: { default: { D1: 1, D2: 3, D3: 5 } },
    knownAs: "5/3/1 para principiantes (Jim Wendler, versión de r/Fitness)", priorities: ["fuerza", "volumen moderado"],
    bestFor: "Principiante que prefiere progresar por ciclos de 3 semanas con porcentajes en lugar de subir cada sesión.",
    rationale: "Cada básico 2 veces por semana: 3 series de ola 5/3/1 sobre un máximo de entrenamiento (TM = 90 % 1RM) + 5×5 First Set Last, y asistencia de empuje, tirón y pierna/core.",
    communityNote: "Muy recomendado en r/Fitness como siguiente paso tras la rutina básica.",
    caveats: `${RACK} Calcula tu TM = 90 % de tu 1RM (o del e1RM que muestra la app). ${LBKG}`,
    sessions: [
      session("D1", "Día 1 · Sentadilla + banca", "Sentadilla y banca con asistencia", [it("jump_squat", 3, 3, 5, { rest: 60, notes: "Saltos o lanzamientos: 10-15 reps en total" }), it("barbell_back_squat", 8, 5, 5, { intensity: "S1 65/75/85 %×5,5,5+ · S2 70/80/90 %×3,3,3+ · S3 75/85/95 %×5,3,1+ del TM; luego FSL 5×5 al % de la 1.ª serie", amrap: true }), it("barbell_bench_press", 8, 5, 5, { intensity: "Misma ola 5/3/1 + FSL 5×5", amrap: true }), it("dip", 3, 10, 20, { notes: "Empuje: 50-100 reps en total" }), it("chin_up", 5, 5, 10, { notes: "Tirón: 50-100 reps en total" }), it("hanging_knee_raise", 3, 10, 20, { notes: "Pierna/core: 50-100 reps en total" })], { minutes: 70 }),
      session("D2", "Día 2 · Peso muerto + press militar", "Peso muerto y press militar con asistencia", [it("jump_squat", 3, 3, 5, { rest: 60, notes: "Saltos o lanzamientos: 10-15 reps en total" }), it("conventional_deadlift", 8, 5, 5, { intensity: "Ola 5/3/1 sobre el TM + FSL 5×5", amrap: true }), it("barbell_ohp", 8, 5, 5, { intensity: "Ola 5/3/1 sobre el TM + FSL 5×5", amrap: true }), it("pushup", 3, 10, 20, { notes: "Empuje: 50-100 reps" }), it("barbell_row", 5, 10, 10, { notes: "Tirón: 50-100 reps" }), it("bulgarian_split_squat", 3, 8, 15, { notes: "Una pierna/core: 50-100 reps" })], { minutes: 70 }),
      session("D3", "Día 3 · Banca + sentadilla", "Banca y sentadilla con asistencia", [it("jump_squat", 3, 3, 5, { rest: 60, notes: "Saltos o lanzamientos: 10-15 reps en total" }), it("barbell_bench_press", 8, 5, 5, { intensity: "Ola 5/3/1 sobre el TM + FSL 5×5", amrap: true }), it("barbell_back_squat", 8, 5, 5, { intensity: "Ola 5/3/1 sobre el TM + FSL 5×5", amrap: true }), it("dip", 3, 10, 20, { notes: "Empuje: 50-100 reps" }), it("lat_pulldown", 5, 10, 10, { notes: "Tirón: 50-100 reps" }), it("plank", 3, 30, 60, { unit: "seconds", rest: 60, notes: "Core" })], { minutes: 70 }),
    ],
    sessionMinutesRange: [60, 75],
    progressionRules: ["TM = 90 % del 1RM.", "Ola de 3 semanas: S1 65/75/85 %×5,5,5+ · S2 70/80/90 %×3,3,3+ · S3 75/85/95 %×5,3,1+.", "FSL: 5×5 al porcentaje de la primera serie de la semana (65/70/75 %).", "Al final de cada ciclo: +5 lb en banca y press militar, +10 lb en sentadilla y peso muerto.", "Test del TM cada 10.ª semana. Si fallas reps de forma sistemática, baja el TM 3 incrementos."],
  }),
  tpl({
    id: "F7", name: "Ivysaur 4-4-8", goal: "fuerza", daysPerWeek: 3, level: "principiante", split: "strength_full_body", recommendedForNovice: true,
    category: "fuerza_novato", tags: ["barra", "ciclo_2_semanas", "regreso"], source: SRC.ivy,
    rotation: "alternate", schedule: { days: [1, 3, 5], pattern: "Ciclo de 2 semanas: S1D1, S1D2, S1D3, S2D1, S2D2, S2D3" },
    knownAs: "Ivysaur's 4-4-8 (r/Fitness, 2016)", priorities: ["fuerza", "banca"],
    bestFor: "Principiante absoluto o persona que vuelve tras un parón y quiere algo más de volumen que un 5×5.",
    rationale: "Cada básico alterna 4×4 pesado (~80 % 1RM) y 4×8 (~90 % del peso de 4×4); banca en todas las sesiones y AMRAP el día 3.",
    communityNote: "Diseñado explícitamente para principiantes y para quien vuelve. El post original no se pudo verificar; la transcripción tiene inconsistencias menores sobre la frecuencia de sentadilla.",
    caveats: `${RACK} Úsalo 3-4 meses. ${LBKG}`,
    sessions: [
      session("S1D1", "Semana 1 · Día 1", "Banca pesada, sentadilla y press en volumen", [it("barbell_bench_press", 4, 4, 4, { intensity: "~80 % 1RM" }), it("barbell_back_squat", 4, 8, 8, { intensity: "~90 % del peso de 4×4" }), it("barbell_ohp", 4, 8, 8), it("chin_up", 4, 8, 8)]),
      session("S1D2", "Semana 1 · Día 2", "Peso muerto y press pesados", [it("barbell_bench_press", 4, 8, 8), it("conventional_deadlift", 4, 4, 4, { intensity: "~80 % 1RM" }), it("barbell_ohp", 4, 4, 4), it("barbell_row", 4, 8, 8)]),
      session("S1D3", "Semana 1 · Día 3", "AMRAP de banca y sentadilla", [it("barbell_bench_press", 4, 4, 4, { amrap: true, notes: "3×4 + 1 serie AMRAP" }), it("barbell_back_squat", 4, 4, 4, { amrap: true, notes: "3×4 + 1 serie AMRAP" }), it("barbell_ohp", 4, 8, 8), it("chin_up", 4, 4, 4)]),
      session("S2D1", "Semana 2 · Día 1", "Peso muerto y remo en volumen", [it("barbell_bench_press", 4, 8, 8), it("conventional_deadlift", 4, 8, 8), it("barbell_ohp", 4, 4, 4), it("barbell_row", 4, 4, 4)]),
      session("S2D2", "Semana 2 · Día 2", "Banca pesada y sentadilla en volumen", [it("barbell_bench_press", 4, 4, 4), it("barbell_back_squat", 4, 8, 8), it("barbell_ohp", 4, 8, 8), it("chin_up", 4, 8, 8)]),
      session("S2D3", "Semana 2 · Día 3", "AMRAP de peso muerto y press", [it("barbell_bench_press", 4, 8, 8), it("conventional_deadlift", 4, 4, 4, { amrap: true, notes: "3×4 + 1 serie AMRAP" }), it("barbell_ohp", 4, 4, 4, { amrap: true, notes: "3×4 + 1 serie AMRAP" }), it("barbell_row", 4, 8, 8)]),
    ],
    sessionMinutesRange: [50, 65],
    progressionRules: ["Por ciclo de 2 semanas: +15 lb sentadilla y peso muerto, +10 lb banca y remo, +5 lb press militar.", "Si el AMRAP llega a 8+ reps: duplica el incremento.", "Si fallas: −10 % y vuelve a subir."],
  }),
  // ------------------------------------------------ STRENGTH · INTERMEDIATE
  tpl({
    id: "F8", name: "Texas Method", goal: "fuerza", daysPerWeek: 3, level: "intermedio", split: "strength_weekly_wave", recommendedForNovice: false,
    category: "fuerza_intermedio", tags: ["barra", "onda_semanal"], source: SRC.texas,
    weekdayMap: { default: { VOL: 1, LIG: 3, INT: 5 } },
    knownAs: "Texas Method (Glenn Pendlay / Mark Rippetoe)", priorities: ["sentadilla", "récords semanales"],
    bestFor: "Quien ya no puede subir peso cada sesión y recupera bien: volumen el lunes, ligero el miércoles y récord el viernes.",
    rationale: "Progresión semanal: el estrés del lunes se convierte en récord de 5 repeticiones el viernes.",
    communityNote: "Rápido pero exigente; poco volumen de banca y peso muerto, mejor para fuerza general que para powerlifting. Si el récord semanal agota, pasa a Madcow o 5/3/1.",
    caveats: `${RACK} Alterna banca y press militar cada semana. Las cargas van del ~63 al ~88 % 1RM. ${LBKG}`,
    sessions: [
      session("VOL", "Lunes · Volumen", "Sentadilla y empuje 5×5", [it("barbell_back_squat", 5, 5, 5, { rest: 240 }), it("barbell_bench_press", 5, 5, 5, { rest: 240, notes: "Alterna con press militar cada semana" }), it("barbell_row", 3, 5, 8, { notes: "Trabajo de espalda" })], { minutes: 70 }),
      session("LIG", "Miércoles · Ligero", "Recuperación activa", [it("barbell_back_squat", 2, 5, 5, { intensity: "~80 % del peso del lunes" }), it("barbell_ohp", 3, 5, 5, { notes: "Ligero" }), it("chin_up", 3, 5, 8), it("back_extension", 3, 10, 15)], { minutes: 45 }),
      session("INT", "Viernes · Intensidad", "Récords de 5", [it("barbell_back_squat", 1, 5, 5, { rest: 300, notes: "Récord de 5 (nuevo máximo de 5 reps)" }), it("barbell_bench_press", 1, 5, 5, { rest: 300, notes: "Récord de 5 · alterna con press militar" }), it("conventional_deadlift", 1, 5, 5, { rest: 300, notes: "O cargada de potencia 5×3" })], { minutes: 50 }),
    ],
    sessionMinutesRange: [45, 70],
    progressionRules: ["Cada viernes busca un récord de 5 reps; el lunes trabaja al ~90 % de ese peso.", "Si te estancas el viernes: 2×3 → 2×2 → 5×1 → 3×1 → nuevo 1RM y vuelve a series de 5."],
  }),
  tpl({
    id: "F9", name: "Madcow 5×5", goal: "fuerza", daysPerWeek: 3, level: "intermedio", split: "strength_weekly_wave", recommendedForNovice: false,
    category: "fuerza_intermedio", tags: ["barra", "onda_semanal", "rampas"], source: SRC.madcow,
    weekdayMap: { default: { L: 1, X: 3, V: 5 } },
    knownAs: "Madcow 5×5 intermedio", priorities: ["sentadilla", "banca", "remo"],
    bestFor: "Siguiente paso tras una progresión lineal: récord semanal en una serie top con rampas.",
    rationale: "Rampas de 5 series hasta un top de 5 el lunes, día ligero (~80 %) el miércoles y triple un ~2,5 % más pesado el viernes con serie de descarga de 8.",
    communityNote: "Derivado del 5×5 de Bill Starr. Las versiones discrepan en la serie de descarga del viernes (77,5 % según Hevy y PTW, ~65 % según Liftosaur) y en las series exactas del miércoles.",
    caveats: `${RACK} Empieza ~10 % por debajo de tu último estancamiento. ${LBKG}`,
    sessions: [
      session("L", "Lunes · Pesado", "Rampas hasta el top de 5", [it("barbell_back_squat", 5, 5, 5, { intensity: "Rampa 50 / 62,5 / 75 / 87,5 / 100 % (top 5)" }), it("barbell_bench_press", 5, 5, 5, { intensity: "Rampa hasta el top de 5" }), it("barbell_row", 5, 5, 5, { intensity: "Rampa hasta el top de 5" }), it("back_extension", 2, 10, 12), it("weighted_floor_crunch", 4, 10, 15)], { minutes: 75 }),
      session("X", "Miércoles · Ligero", "~80 % del lunes", [it("barbell_back_squat", 4, 5, 5, { intensity: "~80 % del lunes" }), it("barbell_ohp", 4, 5, 5, { intensity: "Rampa" }), it("conventional_deadlift", 4, 5, 5, { intensity: "Rampa" }), it("weighted_floor_crunch", 3, 10, 15)], { minutes: 60, notes: "Series del miércoles: versión más citada, no verificada en el post original" }),
      session("V", "Viernes · Récord", "Triple +2,5 % y descarga de 8", [it("barbell_back_squat", 6, 3, 8, { intensity: "52,5 / 65 / 77,5 / 90 / 102,5 %×3 + 1×8 al 77,5 % (otras versiones ~65 %)" }), it("barbell_bench_press", 6, 3, 8, { intensity: "Igual que la sentadilla" }), it("barbell_row", 6, 3, 8, { intensity: "Igual que la sentadilla" }), it("dip", 3, 5, 8), it("ez_curl", 3, 8, 8), it("overhead_db_ext", 3, 8, 8)], { minutes: 80 }),
    ],
    sessionMinutesRange: [60, 80],
    progressionRules: ["La serie top sube ~2,5 % por semana (≈ 5 lb).", "Si fallas la serie top dos semanas seguidas: baja el top un 10 % y vuelve a subir."],
  }),
  tpl({
    id: "F10", name: "nSuns 5/3/1 LP (5 días)", goal: "fuerza", daysPerWeek: 5, level: "intermedio", split: "nsuns", recommendedForNovice: false,
    category: "fuerza_intermedio", tags: ["barra", "porcentajes", "alto_volumen", "amrap"], source: SRC.nsuns,
    weekdayMap: { default: { D1: 1, D2: 2, D3: 3, D4: 4, D5: 5 } },
    knownAs: "nSuns 531 LP (Reddit u/n-Suns)", priorities: ["fuerza", "volumen alto"],
    bestFor: "Novato avanzado o intermedio inicial que recupera muy bien y tiene 5 días. Empieza siempre con un TM conservador.",
    rationale: "T1 de 9 series en % del TM con una serie 1+ que decide cuánto sube el TM, T2 de 8 series y accesorios.",
    communityNote: "Pese al nombre «LP», no es para principiantes: 9 series del principal es mucho volumen. Errores típicos: TM alto, pasar a 6 días antes de tiempo y hacerlo en déficit. Una versión acorta el día 1 a 6 series.",
    caveats: `${RACK} Las series 1+ al 95 % son las de mayor riesgo entrenando solo. TM = 90 % 1RM. ${LBKG}`,
    sessions: [
      session("D1", "Día 1 · Banca (volumen)", "Banca T1 + press militar T2", [it("barbell_bench_press", 9, 4, 8, { intensity: "65×8, 75×6, 85×4 ×3, 80×5, 75×6, 70×7, 65×8+ (% del TM)", amrap: true }), it("barbell_ohp", 8, 3, 8, { intensity: "50×6, 60×5, luego 3,5,7,4,6,8 al 70 %" }), it("lat_pulldown", 3, 8, 12), it("db_curl", 3, 8, 12)], { minutes: 75 }),
      session("D2", "Día 2 · Sentadilla", "Sentadilla T1 + peso muerto sumo T2", [it("barbell_back_squat", 9, 1, 5, { intensity: "75×5, 85×3, 95×1+, 90×3, 85×3, 80×3, 75×5, 70×5, 65×5+", amrap: true }), it("sumo_deadlift", 8, 3, 8, { intensity: "50×5, 60×5, luego 3,5,7,4,6,8 al 70 %" }), it("hanging_knee_raise", 3, 10, 15), it("leg_extension", 3, 10, 15)], { minutes: 80 }),
      session("D3", "Día 3 · Press militar", "Press militar T1 + press inclinado T2", [it("barbell_ohp", 9, 1, 5, { intensity: "Mismo esquema que la sentadilla del día 2", amrap: true }), it("incline_barbell_bench", 8, 3, 8, { intensity: "50×6, 60×5, luego 3,5,7,4,6,8 al 70 %" }), it("lateral_raise_db", 3, 12, 20), it("face_pull", 3, 15, 20)], { minutes: 75 }),
      session("D4", "Día 4 · Peso muerto", "Peso muerto T1 + sentadilla frontal T2", [it("conventional_deadlift", 9, 1, 5, { intensity: "75×5, 85×3, 95×1+, 90×3, 85×3, 80×3, 75×3, 70×3, 65×3+", amrap: true }), it("front_squat", 8, 3, 8, { intensity: "50×5, 60×5, luego 3,5,7,4,6,8 al 70 %" }), it("ab_rollout_knee", 3, 8, 12), it("chin_up", 3, 6, 10)], { minutes: 80 }),
      session("D5", "Día 5 · Banca (5/3/1)", "Banca T1 + banca agarre cerrado T2", [it("barbell_bench_press", 9, 1, 5, { intensity: "75×5, 85×3, 95×1+, 90×3, 85×5, 80×3, 75×5, 70×3, 65×5+", amrap: true }), it("close_grip_bench", 8, 3, 8, { intensity: "50×6, 60×5, luego 3,5,7,4,6,8 al 70 %" }), it("pushdown_rope", 3, 10, 15), it("hammer_curl", 3, 10, 12)], { minutes: 75 }),
    ],
    sessionMinutesRange: [75, 90],
    progressionRules: ["TM = 90 % 1RM.", "Según las reps de la serie 1+: 0-1 → +0; 2-3 → +5 lb; 4-5 → +5-10 lb; 6+ → +10-15 lb al TM.", "Si te estancas: baja el TM un 10 %."],
  }),
  tpl({
    id: "F11", name: "5/3/1 Boring But Big", goal: "fuerza", daysPerWeek: 4, level: "intermedio", split: "531_bbb", recommendedForNovice: false,
    category: "fuerza_intermedio", tags: ["barra", "porcentajes", "fuerza_e_hipertrofia"], source: SRC.bbb,
    weekdayMap: UL4("D1", "D2", "D3", "D4"),
    knownAs: "5/3/1 BBB (Jim Wendler)", priorities: ["fuerza", "tamaño"],
    bestFor: "Intermedio que quiere fuerza y masa con un solo levantamiento principal por día y mucho volumen.",
    rationale: "Ola 5/3/1 del levantamiento del día + 5×10 al 50-60 % del TM del mismo levantamiento + asistencia breve.",
    communityNote: "Uno de los suplementos más conocidos de 5/3/1. La asistencia exacta varía según la versión del libro; aquí se deja como tirón/core a elección.",
    caveats: `${RACK} Las 5×10 son duras: empieza al 50 % del TM. ${LBKG}`,
    sessions: [
      session("D1", "Día 1 · Press militar", "Press + 5×10", [it("barbell_ohp", 8, 5, 10, { intensity: "Ola 5/3/1 (3 series) + BBB 5×10 al 50-60 % del TM", amrap: true }), it("chin_up", 5, 5, 10, { notes: "Asistencia de tirón" }), it("face_pull", 3, 15, 20)], { minutes: 60 }),
      session("D2", "Día 2 · Peso muerto", "Peso muerto + 5×10", [it("conventional_deadlift", 8, 5, 10, { intensity: "Ola 5/3/1 + BBB 5×10 al 50-60 % del TM", amrap: true }), it("hanging_knee_raise", 5, 10, 15, { notes: "Core" })], { minutes: 60 }),
      session("D3", "Día 3 · Banca", "Banca + 5×10", [it("barbell_bench_press", 8, 5, 10, { intensity: "Ola 5/3/1 + BBB 5×10 al 50-60 % del TM", amrap: true }), it("one_arm_db_row", 5, 10, 10, { notes: "Asistencia de tirón" })], { minutes: 60 }),
      session("D4", "Día 4 · Sentadilla", "Sentadilla + 5×10", [it("barbell_back_squat", 8, 5, 10, { intensity: "Ola 5/3/1 + BBB 5×10 al 50-60 % del TM", amrap: true }), it("lying_leg_curl", 5, 10, 10, { notes: "Asistencia" })], { minutes: 65 }),
    ],
    sessionMinutesRange: [55, 70],
    progressionRules: ["TM = 90 % 1RM; ola de 3 semanas (65/75/85, 70/80/90, 75/85/95 %).", "Tras cada ciclo: +5 lb en press y banca, +10 lb en sentadilla y peso muerto.", "7.ª semana: descarga (40/50/60 %×5) o test del TM (70/80/90 %×5 y AMRAP al 100 %: 3-5 reps = TM correcto)."],
    deloadRules: ["Protocolo de la 7.ª semana cada 2 ciclos (descarga o test del TM)."],
  }),
  // ------------------------------------------------ HYPERTROPHY
  ...(() => {
    const pull = (first) => [first, it("lat_pulldown", 3, 8, 12), it("seated_cable_row", 3, 8, 12), it("face_pull", 5, 15, 20, { rest: 60 }), it("hammer_curl", 4, 8, 12, { rest: 60 }), it("db_curl", 4, 8, 12, { rest: 60 })];
    const push = (first, second) => [first, second, it("incline_db_press", 3, 8, 12), it("pushdown_rope", 3, 8, 12, { ss: "A", rest: 60 }), it("overhead_cable_ext", 3, 8, 12, { ss: "B", rest: 60 }), it("lateral_raise_db", 6, 15, 20, { rest: 60, notes: "Reparte en superserie con los dos ejercicios de tríceps" })];
    const legs = () => [it("barbell_back_squat", 3, 5, 5, { amrap: true, notes: "2×5 + 1×5+ (AMRAP)", rest: 240 }), it("barbell_rdl", 3, 8, 12), it("leg_press", 3, 8, 12), it("lying_leg_curl", 3, 8, 12, { rest: 60 }), it("calf_raise_standing", 5, 8, 12, { rest: 60 })];
    const pullA = session("TI1", "Tirón 1 · Peso muerto", "Espalda, deltoide posterior y bíceps", pull(it("conventional_deadlift", 1, 5, 5, { amrap: true, notes: "1×5+ (AMRAP)", rest: 240 })));
    const pushA = session("EM1", "Empuje 1 · Banca", "Pecho, hombro y tríceps", push(it("barbell_bench_press", 5, 5, 5, { amrap: true, notes: "4×5 + 1×5+ (AMRAP)", rest: 240 }), it("barbell_ohp", 3, 8, 12)));
    const legsA = session("PI1", "Pierna 1", "Sentadilla, isquios y gemelo", legs());
    const pullB = session("TI2", "Tirón 2 · Remo", "Espalda, deltoide posterior y bíceps", pull(it("barbell_row", 5, 5, 5, { amrap: true, notes: "4×5 + 1×5+ (AMRAP)", rest: 180 })));
    const pushB = session("EM2", "Empuje 2 · Press militar", "Hombro, pecho y tríceps", push(it("barbell_ohp", 5, 5, 5, { amrap: true, notes: "4×5 + 1×5+ (AMRAP)", rest: 240 }), it("barbell_bench_press", 3, 8, 12)));
    const legsB = session("PI2", "Pierna 2", "Sentadilla, isquios y gemelo", legs());
    const common = {
      goal: "hipertrofia", category: "hipertrofia", source: SRC.metal, priorities: ["pecho", "espalda", "hombros", "brazos"],
      communityNote: "Programa de PPL más recomendado en r/Fitness para principiantes. Críticas: sin trabajo de abdomen y solo 3 series de sentadilla por sesión.",
      caveats: `${RACK} Añade el refuerzo de abdomen si quieres. ${LBKG}`,
      progressionRules: ["Principales: +5 lb por sesión (+10 lb peso muerto) si completas todas las reps.", "Accesorios: doble progresión (del piso al tope del rango, luego +5 lb).", "3 sesiones seguidas fallando un ejercicio: baja ese ejercicio un 10 %.", "Descanso de 3-5 min en los principales."],
      recommendedAddOns: ["AO_CORE"],
    };
    return [
      tpl({ ...common, id: "H7", name: "PPL de Metallicadpa (6 días)", daysPerWeek: 6, level: "principiante", split: "ppl", recommendedForNovice: true, tags: ["ppl", "progresion_lineal", "amrap"],
        weekdayMap: { default: { TI1: 1, EM1: 2, PI1: 3, TI2: 4, EM2: 5, PI2: 6 } },
        knownAs: "Reddit PPL · «A Linear Progression Based PPL Program for Beginners»",
        bestFor: "Principiante (0-12 meses) que puede ir 6 días y quiere progresión lineal en los básicos con mucho volumen de brazos y hombros.",
        rationale: "Cada músculo 2 veces por semana; básicos 5×5 con AMRAP y accesorios a 8-12/15-20 con doble progresión.",
        sessions: [pullA, pushA, legsA, pullB, pushB, legsB], sessionMinutesRange: [60, 90] }),
      tpl({ ...common, id: "H8", name: "PPL de 3 días (1 vez por semana)", daysPerWeek: 3, level: "principiante", split: "ppl", recommendedForNovice: true, tags: ["ppl", "3_dias"],
        weekdayMap: { default: { TI1: 1, EM1: 3, PI1: 5 } },
        knownAs: "Reddit PPL en versión de 3 días",
        bestFor: "Quien solo puede ir 3 días pero quiere la estructura empuje/tirón/pierna. Progreso más lento que la versión de 6 días.",
        rationale: "Mismo contenido que la primera mitad del PPL de Metallicadpa: cada músculo 1 vez por semana con volumen alto por sesión.",
        communityNote: "El autor menciona que puede hacerse en 3 días con progreso más lento; no existe una plantilla oficial aparte. Con volumen igualado la frecuencia importa poco para la hipertrofia, pero el volumen semanal queda por debajo de 10 series en varios músculos.",
        sessions: [pullA, pushA, legsA], sessionMinutesRange: [60, 90] }),
    ];
  })(),
  tpl({
    id: "H9", name: "PPL de Coolcicada (6 días)", goal: "hipertrofia", daysPerWeek: 6, level: "principiante-intermedio", split: "ppl", recommendedForNovice: false,
    category: "hipertrofia", tags: ["ppl"], source: SRC.cool,
    weekdayMap: { default: { EM1: 1, TI1: 2, PI1: 3, EM2: 4, TI2: 5, PI2: 6 } },
    knownAs: "Coolcicada's PPL", priorities: ["espalda", "pierna"],
    bestFor: "Principiante avanzado o intermedio con horario estable de 6 días.",
    rationale: "Básicos 3-4×5 y accesorios 3-5×8-12; mucho volumen de espalda y cuádriceps.",
    communityNote: "Cuesta con horarios irregulares y en déficit. El original no tiene protocolo de fallo (la descarga del 10 % es un añadido de Liftosaur).",
    caveats: `${RACK} ${LBKG}`,
    sessions: (() => {
      const pushS = (k) => session(k, `Empuje ${k.slice(-1)}`, "Pecho, hombro y tríceps", [it("barbell_bench_press", 3, 5, 5), it("barbell_ohp", 3, 5, 5), it("incline_barbell_bench", 3, 5, 5), it("lateral_raise_db", 3, 10, 12, { rest: 60 }), it("pushdown_rope", 3, 10, 12, { rest: 60 }), it("overhead_cable_ext", 3, 10, 12, { rest: 60 }), it("db_shrug", 3, 10, 12, { rest: 60 })]);
      const pullS = (k) => session(k, `Tirón ${k.slice(-1)}`, "Espalda y bíceps", [it("conventional_deadlift", 1, 5, 5, { rest: 240 }), it("barbell_row", 3, 5, 5), it("lat_pulldown", 3, 8, 10), it("seated_cable_row", 3, 8, 10), it("face_pull", 3, 10, 12, { rest: 60 }), it("db_curl", 4, 10, 12, { rest: 60 }), it("hammer_curl", 3, 10, 12, { rest: 60 })]);
      const legS = (k) => session(k, `Pierna ${k.slice(-1)}`, "Cuádriceps, isquios y gemelo", [it("barbell_back_squat", 4, 5, 5, { rest: 240 }), it("leg_press", 3, 8, 10), it("leg_extension", 3, 10, 12, { rest: 60 }), it("lying_leg_curl", 3, 10, 12, { rest: 60 }), it("calf_raise_standing", 5, 10, 12, { rest: 60 })]);
      return [pushS("EM1"), pullS("TI1"), legS("PI1"), pushS("EM2"), pullS("TI2"), legS("PI2")];
    })(),
    sessionMinutesRange: [60, 80],
    progressionRules: ["Compuestos: +5 lb después de 2 sesiones completadas.", "Accesorios: doble progresión."],
  }),
  tpl({
    id: "H10", name: "PHUL (Power Hypertrophy Upper Lower)", goal: "hipertrofia", daysPerWeek: 4, level: "intermedio", split: "phul", recommendedForNovice: false,
    category: "hipertrofia", tags: ["torso_pierna", "fuerza_e_hipertrofia"], source: SRC.phul,
    weekdayMap: UL4("TF", "PF", "TH", "PH"),
    knownAs: "PHUL · Brandon Campbell", priorities: ["fuerza", "tamaño"],
    bestFor: "Intermedio con 4 días que quiere combinar días de fuerza (3-5 reps) y días de hipertrofia (8-15 reps).",
    rationale: "Torso y pierna 2 veces por semana: un día pesado y uno de volumen para cada mitad.",
    communityNote: "Junta sentadilla y peso muerto el mismo día y no trae abdomen ni deltoide posterior; en definición conviene bajar a 3 series. Algunas fuentes lo dan para 3-12 meses de experiencia.",
    caveats: `${RACK} Recomendado añadir el refuerzo de hombros (face pull) y abdomen. ${LBKG}`,
    recommendedAddOns: ["AO_DELTS", "AO_CORE"],
    sessions: [
      session("TF", "Torso · Fuerza", "Básicos de torso pesados", [it("barbell_bench_press", 3, 3, 5), it("incline_db_press", 3, 6, 10), it("barbell_row", 3, 3, 5), it("lat_pulldown", 3, 6, 10), it("barbell_ohp", 3, 5, 8), it("ez_curl", 2, 6, 10, { rest: 75 }), it("ez_skullcrusher", 2, 6, 10, { rest: 75 })]),
      session("PF", "Pierna · Fuerza", "Sentadilla y peso muerto pesados", [it("barbell_back_squat", 3, 3, 5, { rest: 240 }), it("conventional_deadlift", 3, 3, 5, { rest: 240 }), it("leg_press", 4, 10, 15), it("lying_leg_curl", 3, 6, 10, { rest: 75 }), it("calf_raise_standing", 4, 6, 10, { rest: 75 })]),
      session("TH", "Torso · Hipertrofia", "Volumen de torso", [it("incline_barbell_bench", 3, 8, 12), it("incline_db_fly", 3, 8, 12, { rest: 75 }), it("seated_cable_row", 3, 8, 12), it("one_arm_db_row", 3, 8, 12), it("lateral_raise_db", 3, 8, 12, { rest: 60 }), it("incline_db_curl", 3, 8, 12, { rest: 60 }), it("pushdown_rope", 3, 8, 12, { rest: 60 })]),
      session("PH", "Pierna · Hipertrofia", "Volumen de pierna", [it("front_squat", 3, 8, 12), it("db_lunge", 3, 8, 12), it("leg_extension", 3, 10, 15, { rest: 75 }), it("seated_leg_curl", 3, 10, 15, { rest: 75 }), it("seated_calf_raise", 3, 8, 12, { rest: 60 }), it("leg_press_calf_raise", 3, 8, 12, { rest: 60 })]),
    ],
    sessionMinutesRange: [60, 90],
    progressionRules: ["Doble progresión: al completar el tope del rango en todas las series, +5 lb.", "2-3 sesiones estancado: −10 %."],
    deloadRules: ["Semana al 50 % hacia la semana 6 si hay fatiga; siempre después de la semana 12."],
  }),
  tpl({
    id: "H11", name: "PHAT (Power Hypertrophy Adaptive Training)", goal: "hipertrofia", daysPerWeek: 5, level: "avanzado", split: "phat", recommendedForNovice: false,
    category: "hipertrofia", tags: ["fuerza_e_hipertrofia", "alto_volumen"], source: SRC.phat,
    weekdayMap: { default: { TF: 1, PF: 2, EH: 4, PH: 5, PB: 6 } },
    knownAs: "PHAT · Layne Norton", priorities: ["fuerza", "tamaño"],
    bestFor: "Intermedio-avanzado con 5 días y buena recuperación que quiere días de fuerza y de hipertrofia con trabajo de velocidad.",
    rationale: "2 días de fuerza (3-5 reps) y 3 de hipertrofia por grupos, que abren con 6×3 de velocidad al 65 % del peso del día de fuerza.",
    communityNote: "Acumula 24-28 series en los días de hipertrofia (70-90+ min), recuperación de pierna difícil y sin deltoide posterior ni abdomen. Hevy sustituye la velocidad por 4×8-10 al 85 %.",
    caveats: `${RACK} Las primeras 2-4 semanas sin llegar al fallo. Incluye sábado. ${LBKG}`,
    recommendedAddOns: ["AO_DELTS", "AO_CORE"],
    sessions: [
      session("TF", "Torso · Fuerza", "Remo, dominadas y empujes pesados", [it("barbell_row", 3, 3, 5, { notes: "Remo Pendlay" }), it("pullup", 2, 6, 10, { notes: "Lastrada si puedes" }), it("chin_up", 2, 6, 10), it("db_bench_press", 3, 3, 5), it("dip", 2, 6, 10, { notes: "Lastrados si puedes" }), it("db_shoulder_press", 3, 6, 10), it("ez_curl", 3, 6, 10, { rest: 75 }), it("ez_skullcrusher", 3, 6, 10, { rest: 75 })]),
      session("PF", "Pierna · Fuerza", "Sentadilla pesada", [it("barbell_back_squat", 3, 3, 5, { rest: 240 }), it("hack_squat_machine", 2, 6, 10), it("leg_extension", 2, 6, 10, { rest: 75 }), it("barbell_rdl", 3, 5, 8, { notes: "Piernas rígidas" }), it("lying_leg_curl", 2, 6, 10, { rest: 75 }), it("calf_raise_standing", 3, 6, 10, { rest: 60 }), it("seated_calf_raise", 2, 6, 10, { rest: 60 })]),
      session("EH", "Espalda y hombro · Hipertrofia", "Velocidad + volumen", [it("barbell_row", 6, 3, 3, { rest: 90, intensity: "65 % del peso del remo del día de fuerza, rápido" }), it("lat_pulldown", 3, 8, 12), it("seated_cable_row", 3, 8, 12), it("one_arm_db_row", 2, 12, 15), it("straight_arm_pulldown", 2, 15, 20, { rest: 60 }), it("db_shoulder_press", 3, 8, 12), it("cable_upright_row", 2, 12, 15, { rest: 60 }), it("lateral_raise_db", 3, 12, 20, { rest: 60 })]),
      session("PH", "Pierna · Hipertrofia", "Velocidad + volumen", [it("barbell_back_squat", 6, 3, 3, { rest: 90, intensity: "65 % del peso de la sentadilla del día de fuerza, rápido" }), it("hack_squat_machine", 3, 8, 12), it("leg_press", 2, 12, 15), it("leg_extension", 3, 15, 20, { rest: 60 }), it("barbell_rdl", 3, 8, 12), it("lying_leg_curl", 2, 12, 15, { rest: 60 }), it("seated_leg_curl", 2, 15, 20, { rest: 60 }), it("calf_raise_standing", 4, 10, 15, { rest: 60 })]),
      session("PB", "Pecho y brazos · Hipertrofia", "Velocidad + volumen", [it("db_bench_press", 6, 3, 3, { rest: 90, intensity: "65 % del peso del día de fuerza, rápido" }), it("incline_db_press", 3, 8, 12), it("chest_press_machine", 3, 12, 15), it("cable_fly", 2, 15, 20, { rest: 60 }), it("preacher_curl", 3, 8, 12, { rest: 60 }), it("incline_db_curl", 2, 12, 15, { rest: 60 }), it("cable_curl", 2, 15, 20, { rest: 60 }), it("overhead_cable_ext", 3, 8, 12, { rest: 60 }), it("pushdown_rope", 2, 12, 15, { rest: 60 }), it("single_arm_pushdown", 2, 15, 20, { rest: 60 })]),
    ],
    sessionMinutesRange: [55, 90],
    progressionRules: ["Días de fuerza: 3×3 → 3×5, luego +5 lb.", "Rota ejercicios cada 2-3 semanas.", "2-3 sesiones sin progreso: −10 %."],
    deloadRules: ["Descarga al 60-70 % de las cargas cada 6-12 semanas."],
  }),
  tpl({
    id: "H12", name: "Generic Bulking Routine (Lyle McDonald)", goal: "hipertrofia", daysPerWeek: 4, level: "intermedio", split: "upper_lower", recommendedForNovice: false,
    category: "hipertrofia", tags: ["torso_pierna", "ciclos"], source: SRC.gbr,
    weekdayMap: UL4("PI1", "TO1", "PI2", "TO2"),
    knownAs: "GBR · Lyle McDonald", priorities: ["masa general"],
    bestFor: "Intermedio («no para principiantes» según el autor) que quiere un torso/pierna simple en ciclos de 6-8 semanas.",
    rationale: "Torso y pierna 2 veces por semana con básicos a 6-8 reps y accesorios a 10-15, cargas que dejan 1-2 RIR en el fondo del rango.",
    communityNote: "Bajo en brazos y hombro lateral y sin deltoide posterior: Liftosaur sugiere añadir face pulls, elevaciones laterales y abdomen. El texto original se cita con rangos de series (p. ej. 3-4×6-8).",
    caveats: `${RACK} ${LBKG}`,
    recommendedAddOns: ["AO_DELTS", "AO_ARMS", "AO_CORE"],
    sessions: (() => {
      const lower = (k) => session(k, `Pierna ${k.slice(-1)}`, "Sentadilla, bisagra y gemelos", [it("barbell_back_squat", 4, 6, 8, { rest: 180 }), it("barbell_rdl", 3, 6, 8, { notes: "Piernas rígidas" }), it("leg_press", 3, 10, 12), it("seated_leg_curl", 2, 10, 12, { rest: 75 }), it("calf_raise_standing", 3, 6, 8, { rest: 75 }), it("seated_calf_raise", 3, 10, 12, { rest: 60 })]);
      const upper = (k) => session(k, `Torso ${k.slice(-1)}`, "Empuje, tirón y brazos", [it("barbell_bench_press", 4, 6, 8, { rest: 180 }), it("barbell_row", 3, 6, 8), it("db_shoulder_press", 3, 10, 12), it("lat_pulldown", 2, 10, 12, { notes: "O dominadas" }), it("ez_skullcrusher", 2, 12, 15, { rest: 60 }), it("hammer_curl", 2, 12, 15, { rest: 60 })]);
      return [lower("PI1"), upper("TO1"), lower("PI2"), upper("TO2")];
    })(),
    sessionMinutesRange: [50, 70],
    progressionRules: ["4×6 → 4×8 con el mismo peso; luego +5 lb y vuelve a 6.", "Semanas 1-2 del ciclo al 85-95 % del objetivo (rampa de entrada).", "Ciclos de 6-8 semanas."],
    deloadRules: ["Entre ciclos, volumen −40-50 % durante una semana."],
  }),
  tpl({
    id: "H13", name: "Bro split clásico (5 días)", goal: "hipertrofia", daysPerWeek: 5, level: "intermedio", split: "bro_split", recommendedForNovice: false,
    category: "hipertrofia", tags: ["por_grupos", "1_vez_por_semana"], source: SRC.bro,
    weekdayMap: { default: { PE: 1, ES: 2, HO: 3, PI: 4, BR: 5 } },
    knownAs: "Rutina por grupos musculares (bro split)", priorities: ["volumen por sesión"],
    bestFor: "Intermedio que disfruta entrenar un grupo por día y nunca se salta sesiones.",
    rationale: "Un grupo muscular por día con 5-6 ejercicios de 3-4×8-12. Con volumen igualado la frecuencia importa poco, pero concentra mucho volumen en una sesión.",
    communityNote: "Cada músculo 1 vez por semana: saltarse un día deja ese músculo sin estímulo dos semanas. Es «un principio, no una prescripción»: no tiene autor único.",
    caveats: `${RACK} El volumen de pecho/espalda supera ~11 series por sesión: la evidencia sugiere repartir. ${LBKG}`,
    sessions: [
      session("PE", "Pecho", "Pecho", [it("barbell_bench_press", 4, 8, 8, { rest: 120 }), it("incline_db_press", 3, 10, 10), it("dip", 3, 8, 8), it("incline_db_fly", 3, 10, 10, { rest: 60 }), it("cable_fly", 3, 12, 12, { rest: 60 })]),
      session("ES", "Espalda", "Espalda", [it("conventional_deadlift", 3, 5, 5, { rest: 180 }), it("barbell_row", 4, 8, 8), it("lat_pulldown", 3, 10, 10), it("seated_cable_row", 3, 10, 10), it("db_pullover", 3, 12, 12, { rest: 60 })]),
      session("HO", "Hombro", "Hombro y trapecio", [it("barbell_ohp", 4, 8, 8, { rest: 120 }), it("arnold_press", 3, 10, 10), it("lateral_raise_db", 4, 12, 12, { rest: 60 }), it("face_pull", 3, 12, 12, { rest: 60 }), it("db_shrug", 4, 10, 10, { rest: 60 })]),
      session("PI", "Pierna", "Pierna completa", [it("barbell_back_squat", 4, 8, 8, { rest: 180 }), it("barbell_rdl", 3, 10, 10), it("leg_press", 3, 10, 10), it("leg_extension", 3, 12, 12, { rest: 60 }), it("seated_leg_curl", 3, 12, 12, { rest: 60 }), it("calf_raise_standing", 4, 12, 12, { rest: 60 })]),
      session("BR", "Brazo", "Bíceps y tríceps", [it("ez_curl", 3, 10, 10, { rest: 60 }), it("ez_skullcrusher", 3, 10, 10, { rest: 60 }), it("hammer_curl", 3, 10, 10, { rest: 60 }), it("pushdown_bar", 3, 10, 10, { rest: 60 }), it("preacher_curl", 3, 12, 12, { rest: 60 }), it("overhead_db_ext", 3, 12, 12, { rest: 60 })]),
    ],
    sessionMinutesRange: [50, 70],
    progressionRules: ["Doble progresión: cuando completes las reps en todas las series, sube el peso.", "Estancado: −10-15 %."],
    deloadRules: ["Semana opcional a mitad de volumen cada 6-8 semanas."],
  }),
  tpl({
    id: "H14", name: "Fierce 5 Novice", goal: "hipertrofia", daysPerWeek: 3, level: "principiante", split: "full_body", recommendedForNovice: true,
    category: "hipertrofia", tags: ["cuerpo_completo", "fuerza_e_hipertrofia"], source: SRC.fierce, ...ROT_3,
    knownAs: "Fierce 5 (bodybuilding.com)", priorities: ["fuerza base", "físico"],
    bestFor: "Principiante (<6 meses) con 3 días que quiere fuerza en los básicos y algo de trabajo estético en 45-60 min.",
    rationale: "A/B de cuerpo completo: básicos 3×5, remo y bisagra 3×8, face pull y superseries cortas de brazos, gemelo y abdomen.",
    communityNote: "Inclinado a fuerza: queda por debajo de 10 series semanales en casi todos los músculos. Las copias no coinciden en si la carga sube por sesión o por semana.",
    caveats: `${RACK} ${LBKG}`,
    sessions: [
      session("A", "Entrenamiento A", "Sentadilla, banca y remo", [it("barbell_back_squat", 3, 5, 5, { rest: 150 }), it("barbell_bench_press", 3, 5, 5, { rest: 150 }), it("barbell_row", 3, 8, 8, { rest: 150, notes: "Remo Pendlay" }), it("face_pull", 3, 10, 15, { rest: 60 }), it("calf_raise_standing", 2, 15, 20, { ss: "A", rest: 60 }), it("pushdown_rope", 2, 10, 10, { ss: "A", rest: 60 })], { minutes: 55 }),
      session("B", "Entrenamiento B", "Sentadilla frontal, press y rumano", [it("front_squat", 3, 5, 5, { rest: 150 }), it("barbell_ohp", 3, 5, 5, { rest: 150 }), it("barbell_rdl", 3, 8, 8, { rest: 150 }), it("lat_pulldown", 3, 8, 12, { rest: 90 }), it("cable_crunch", 2, 15, 25, { ss: "A", rest: 60 }), it("db_curl", 2, 10, 10, { ss: "A", rest: 60 })], { minutes: 55 }),
    ],
    sessionMinutesRange: [45, 60],
    progressionRules: ["Principales: +5 lb (según la versión, por sesión o por semana; usa la semanal si te estancas pronto).", "Accesorios: doble progresión.", "2 sesiones fallidas: −15 %."],
  }),
  // ------------------------------------------------ CONDITIONING
  tpl({
    id: "A1", name: "Couch to 5K (NHS)", goal: "acondicionamiento", daysPerWeek: 3, level: "principiante", split: "running", recommendedForNovice: true,
    category: "acondicionamiento", tags: ["correr", "9_semanas"], source: SRC.c25k, place: "bodyweight",
    weekdayMap: { default: { C1: 1, C2: 3, C3: 5 }, alternate: { C1: 2, C2: 4, C3: 6 } },
    knownAs: "Couch to 5K · del sofá a 5 km", priorities: ["resistencia", "hábito"],
    bestFor: "Quien nunca ha corrido o vuelve: llega a correr 30 minutos seguidos en 9 semanas.",
    rationale: "Intervalos de correr/caminar que crecen cada semana; 3 sesiones con un día de descanso entre ellas.",
    communityNote: "Plan oficial del NHS. Puedes repetir cualquier semana todas las veces que necesites.",
    caveats: "Calienta 5 min caminando y termina con 5 min caminando. Si tienes una condición de salud, consulta antes a un profesional.",
    durationWeeks: 9,
    sessions: ["C1", "C2", "C3"].map((k, i) => session(k, `Carrera ${i + 1}`, "Intervalos de correr/caminar según tu semana", [it("run_walk", 1, 20, 30, { unit: "minutes", rest: 0, rir: 3, notes: "Sigue la tabla de tu semana (ver reglas de progresión)" })], { kind: "cardio", minutes: 35 })),
    sessionMinutesRange: [30, 40], cardioMinutesPerWeek: 90,
    progressionRules: [
      "S1: correr 1 min / caminar 1:30 ×7 + correr 1 min.",
      "S2: correr 1:30 / caminar 2 min ×5 + correr 1:30.",
      "S3: 1:30 · 1:30 · 3 · 3 · 1:30 · 1:30 · 3 (correr-caminar alternados).",
      "S4: correr 3 · caminar 1:30 · correr 5 · caminar 2:30 · correr 3 · caminar 1:30 · correr 5.",
      "S5: sesión 1 = 5-3-5-3-5; sesión 2 = correr 8 · caminar 5 · correr 8; sesión 3 = 20 min seguidos.",
      "S6: sesión 1 = 5-3-8-3-5; sesión 2 = 10-3-10; sesión 3 = 25 min seguidos.",
      "S7: 25 min seguidos · S8: 28 min · S9: 30 min seguidos.",
    ],
  }),
  tpl({
    id: "A2", name: "4×4 noruego + rodaje suave", goal: "acondicionamiento", daysPerWeek: 3, level: "intermedio", split: "intervals", recommendedForNovice: false,
    category: "acondicionamiento", tags: ["hiit", "vo2max"], source: SRC.nor4x4,
    weekdayMap: { default: { I1: 2, Z1: 4, I2: 6 }, weekdays: { I1: 1, Z1: 3, I2: 5 } },
    knownAs: "Intervalos 4×4 (Helgerud 2007)", priorities: ["VO2máx"],
    bestFor: "Quien ya hace cardio suave y quiere mejorar su capacidad aeróbica de forma eficiente.",
    rationale: "4 × 4 min al 90-95 % de la FCmáx con 3 min de recuperación activa al ~70 %: mejoró el VO2máx más que la carrera larga y lenta.",
    communityNote: "Protocolo de laboratorio muy replicado. Bicicleta, cinta inclinada o remo sirven.",
    caveats: "Si haces pesas, separa el HIIT al menos 3 h de la fuerza y no lo hagas el día antes de la sentadilla pesada. Consulta a un profesional si tienes enfermedad cardiovascular.",
    sessions: [
      session("I1", "Intervalos 4×4", "4 × 4 min al 90-95 % FCmáx", [it("treadmill_intervals", 4, 4, 4, { unit: "minutes", rest: 180, rir: 1, notes: "Recuperación activa de 3 min al ~70 % FCmáx. Calienta 10 min." })], { kind: "cardio", minutes: 40 }),
      session("Z1", "Rodaje suave", "Zona aeróbica, ritmo conversacional", [it("bike_steady", 1, 30, 45, { unit: "minutes", rest: 0, rir: 4 })], { kind: "cardio", minutes: 45 }),
      session("I2", "Intervalos 4×4", "4 × 4 min al 90-95 % FCmáx", [it("bike_intervals", 4, 4, 4, { unit: "minutes", rest: 180, rir: 1, notes: "Recuperación activa de 3 min al ~70 % FCmáx" })], { kind: "cardio", minutes: 40 }),
    ],
    sessionMinutesRange: [40, 45], cardioMinutesPerWeek: 125,
    progressionRules: ["Mantén 4×4; aumenta velocidad/pendiente/resistencia cuando el último intervalo ya no llegue al 90 % FCmáx.", "El rodaje suave puede crecer 5 min por semana hasta 60 min."],
  }),
  tpl({
    id: "A3", name: "Intervalos 10×1 (Gibala)", goal: "acondicionamiento", daysPerWeek: 3, level: "principiante-intermedio", split: "intervals", recommendedForNovice: true,
    category: "acondicionamiento", tags: ["hiit", "poco_tiempo"], source: SRC.gibala,
    weekdayMap: { default: { I1: 1, I2: 3, I3: 5 } },
    knownAs: "10 × 60 s (Little/Gibala)", priorities: ["eficiencia de tiempo"],
    bestFor: "Quien tiene poco tiempo: ~20 min por sesión con mejoras aeróbicas comparables al cardio tradicional.",
    rationale: "10 × 60 s al ~90 % de la FCmáx con 60 s de recuperación; unos 20 minutos.",
    communityNote: "Las cifras de la prensa sobre el estudio de 2010 difieren; se usa la revisión de Gibala 2012.",
    caveats: "Calienta 5 min antes. Separa del entrenamiento de fuerza si te importa la potencia.",
    sessions: ["I1", "I2", "I3"].map((k) => session(k, "Intervalos 10×1", "10 × 60 s al ~90 % FCmáx", [it("bike_intervals", 10, 1, 1, { unit: "minutes", rest: 60, rir: 1, notes: "60 s fuerte (~90 % FCmáx) / 60 s suave" })], { kind: "cardio", minutes: 25 })),
    sessionMinutesRange: [20, 25], cardioMinutesPerWeek: 75,
    progressionRules: ["Cuando los 10 intervalos se sientan sostenibles al ~90 % FCmáx, sube la resistencia o la velocidad."],
  }),
  tpl({
    id: "A4", name: "Sprints tipo Wingate (SIT)", goal: "acondicionamiento", daysPerWeek: 3, level: "avanzado", split: "intervals", recommendedForNovice: false,
    category: "acondicionamiento", tags: ["sit", "poco_tiempo", "bicicleta"], source: SRC.gibala,
    weekdayMap: { default: { S1: 1, S2: 3, S3: 5 } },
    knownAs: "Sprint interval training (Gibala 2012)", priorities: ["potencia aeróbica"],
    bestFor: "Persona entrenada, en bicicleta, que quiere el estímulo aeróbico con ~90 % menos de volumen.",
    rationale: "4-6 × 30 s a tope en bicicleta con ~4-4,5 min de recuperación, 3 veces por semana: adaptaciones similares al cardio tradicional en 6 semanas.",
    communityNote: "Muy exigente; no es para empezar. Tabata original (20/10 a ~170 % VO2máx) solo reproduce sus efectos casi al máximo en bicicleta.",
    caveats: "Solo en bicicleta estática. No apto con enfermedad cardiovascular sin aprobación médica.",
    sessions: ["S1", "S2", "S3"].map((k) => session(k, "Sprints 30 s", "4-6 sprints de 30 s a tope", [it("bike_intervals", 6, 30, 30, { unit: "seconds", rest: 255, rir: 0, notes: "Empieza con 4 sprints; recuperación muy suave de ~4-4,5 min" })], { kind: "cardio", minutes: 30 })),
    sessionMinutesRange: [25, 30], cardioMinutesPerWeek: 90,
    progressionRules: ["Semanas 1-2: 4 sprints · 3-4: 5 · 5+: 6."],
  }),
  tpl({
    id: "A5", name: "Salud general: fuerza 2 días + cardio (OMS)", goal: "salud", daysPerWeek: 5, level: "principiante", split: "hybrid", recommendedForNovice: true,
    category: "salud", tags: ["oms", "hibrido"], source: SRC.who,
    weekdayMap: { default: { F1: 1, C1: 2, F2: 4, C2: 5, C3: 6 }, weekdays: { F1: 1, C1: 2, C2: 3, F2: 4, C3: 5 } },
    knownAs: "Plantilla de salud basada en la OMS", priorities: ["salud", "constancia"],
    bestFor: "Quien quiere estar sano y en forma sin un objetivo estético concreto.",
    rationale: "Cumple la pauta de la OMS: fuerza de todos los grupos musculares 2 días por semana y 150-300 min de actividad moderada.",
    communityNote: "Síntesis de IronLog sobre las pautas de la OMS 2020 y el ACSM 2026 (no es un programa publicado). El salto de beneficio más grande está en pasar de no entrenar a entrenar algo.",
    caveats: "Ajusta el cardio a tu nivel: el ritmo debe permitir hablar. Suma pasos diarios (6.000-10.000 según la edad).",
    dailyStepsTarget: [7000, 10000],
    sessions: [
      session("F1", "Fuerza A", "Cuerpo completo", [it("leg_press", 3, 8, 12), it("chest_press_machine", 3, 8, 12), it("lat_pulldown", 3, 8, 12), it("db_rdl", 2, 8, 12), it("machine_shoulder_press", 2, 8, 12), it("plank", 2, 20, 45, { unit: "seconds", rest: 60 })], { minutes: 45 }),
      session("C1", "Cardio moderado", "Caminata rápida, bici o elíptica", [it("brisk_walk", 1, 30, 50, { unit: "minutes", rest: 0, rir: 4 })], { kind: "cardio", minutes: 45 }),
      session("F2", "Fuerza B", "Cuerpo completo", [it("goblet_squat", 3, 8, 12), it("seated_cable_row", 3, 8, 12), it("db_bench_press", 3, 8, 12), it("glute_bridge", 2, 10, 15), it("lateral_raise_db", 2, 12, 15, { rest: 60 }), it("dead_bug", 2, 8, 12, { rest: 60 })], { minutes: 45 }),
      session("C2", "Cardio moderado", "Ritmo conversacional", [it("bike_steady", 1, 30, 50, { unit: "minutes", rest: 0, rir: 4 })], { kind: "cardio", minutes: 45 }),
      session("C3", "Cardio moderado (opcional)", "Paseo largo o deporte", [it("brisk_walk", 1, 30, 60, { unit: "minutes", rest: 0, rir: 4 })], { kind: "cardio", minutes: 50, optional: true }),
    ],
    sessionMinutesRange: [40, 50], cardioMinutesPerWeek: 150,
    progressionRules: ["Fuerza: doble progresión a 1-3 RIR.", "Cardio: sube 5-10 min por semana hasta 150-300 min semanales."],
  }),
  // ------------------------------------------------ SPECIAL CASES
  tpl({
    id: "S1", name: "Recommended Routine (calistenia)", goal: "salud", daysPerWeek: 3, level: "principiante-intermedio", split: "calisthenics", recommendedForNovice: true,
    category: "calistenia", tags: ["peso_corporal", "escaleras", "casa"], source: SRC.rr, place: "bodyweight",
    weekdayMap: { default: { D1: 1, D2: 3, D3: 5 } },
    knownAs: "r/bodyweightfitness Recommended Routine", priorities: ["fuerza relativa", "técnica"],
    bestFor: "Entrenar con el propio peso en casa o en el parque: barra de dominadas, paralelas y un lugar para remo invertido.",
    rationale: "Tres superseries (dominada + sentadilla, fondo + bisagra, remo + flexión) que avanzan por escaleras de dificultad, más un triplete de core.",
    communityNote: "Referencia de la comunidad r/bodyweightfitness. La wiki oficial puede tener más peldaños (versiones con lastre); verifica allí.",
    caveats: "Calentamiento: dislocaciones con banda, dead bugs y muñecas. Sin barra para remar, usa remo con banda anclada a una puerta.",
    sessions: ["D1", "D2", "D3"].map((k, i) => session(k, `Día ${i + 1}`, "Superseries de empuje, tirón, pierna y core", [
      it("negative_pullup", 3, 5, 8, { ss: "A", rest: 90, rir: 1, notes: "Escalera: escapular → colgado en arco → negativa → dominada" }),
      it("bw_squat", 3, 5, 8, { ss: "A", rest: 90, rir: 1, notes: "Escalera: asistida → corporal → split squat → búlgara → shrimp" }),
      it("negative_dip", 3, 5, 8, { ss: "B", rest: 90, rir: 1, notes: "Escalera: soporte hasta 60 s → negativa → fondo" }),
      it("single_leg_rdl", 3, 5, 8, { ss: "B", rest: 90, rir: 1, notes: "Escalera: RDL corporal → a una pierna → nórdico con banda → nórdico" }),
      it("inverted_row", 3, 5, 8, { ss: "C", rest: 90, rir: 1, notes: "Escalera: vertical → inclinado → horizontal → abierto" }),
      it("pushup", 3, 5, 8, { ss: "C", rest: 90, rir: 1, notes: "Escalera: pared → inclinadas → flexión → diamante → pseudo-planche" }),
      it("ab_rollout_knee", 3, 8, 12, { ss: "D", rest: 60, notes: "Escalera: plancha → rueda de rodillas → rueda con anillas" }),
      it("pallof_press", 3, 8, 12, { ss: "D", rest: 60 }),
      it("back_extension", 3, 8, 12, { ss: "D", rest: 60, notes: "Hiperextensión inversa en banco o en casa" }),
    ], { minutes: 55 })),
    sessionMinutesRange: [45, 60],
    progressionRules: ["3×5 → 3×8 con la misma variante; al llegar a 3×8, pasa a la siguiente y vuelve a 3×5.", "Isométricos: +5 s por sesión.", "Para a ~1 rep del fallo; si te estancas, repite los números."],
  }),
  tpl({
    id: "S2", name: "Adultos mayores y regreso: fuerza, potencia y equilibrio", goal: "salud", daysPerWeek: 3, level: "principiante", split: "older_adults", recommendedForNovice: true,
    category: "mayores", tags: ["mayores", "regreso", "equilibrio", "maquinas"], source: SRC.older,
    weekdayMap: { default: { F1: 1, EQ: 3, F2: 5 } },
    knownAs: "Plantilla para mayores de 60 o tras un parón largo", priorities: ["fuerza funcional", "equilibrio", "prevención de caídas"],
    bestFor: "Mayores de 60, personas desentrenadas o que vuelven tras mucho tiempo.",
    rationale: "NSCA 2019: 2-3 días, 1-2 multiarticulares por grupo, empezar con 10-15 reps y progresar a 6-12 al 70-85 % 1RM, con potencia (subir rápido) y equilibrio 3 días por semana (OMS).",
    communityNote: "Síntesis de IronLog (no es un programa publicado). Las máquinas son igual de válidas que el peso libre (ACSM 2026). No hace falta llegar al fallo.",
    caveats: "Si tienes enfermedades crónicas, osteoporosis, problemas cardíacos o articulares, consulta a un profesional antes de empezar. Haz el equilibrio junto a una pared o silla.",
    sessions: [
      session("F1", "Fuerza y potencia A", "Cuerpo completo con máquinas", [it("leg_press", 2, 10, 15, { rir: 3, notes: "Sube rápido, baja en 2-3 s" }), it("chest_press_machine", 2, 10, 15, { rir: 3 }), it("seated_cable_row", 2, 10, 15, { rir: 3 }), it("sit_to_stand", 2, 6, 10, { rir: 3, rest: 90, notes: "Potencia: levántate lo más rápido que puedas con control" }), it("machine_shoulder_press", 2, 10, 15, { rir: 3 }), it("seated_leg_curl", 2, 10, 15, { rir: 3 }), it("single_leg_balance", 2, 15, 30, { unit: "seconds", rest: 45, notes: "Cada pierna" })], { minutes: 45 }),
      session("EQ", "Equilibrio y caminata", "Equilibrio y actividad aeróbica suave", [it("single_leg_balance", 3, 15, 30, { unit: "seconds", rest: 30, notes: "Cada pierna" }), it("tandem_walk", 3, 20, 30, { unit: "seconds", rest: 30 }), it("step_up", 2, 8, 12, { rir: 3, notes: "Cada pierna, con apoyo si hace falta" }), it("brisk_walk", 1, 20, 30, { unit: "minutes", rest: 0, rir: 4 })], { kind: "lifting", minutes: 40 }),
      session("F2", "Fuerza y potencia B", "Cuerpo completo", [it("goblet_squat", 2, 10, 15, { rir: 3, notes: "A un cajón o banco si hace falta" }), it("lat_pulldown", 2, 10, 15, { rir: 3 }), it("incline_pushup", 2, 8, 15, { rir: 3 }), it("glute_bridge", 2, 10, 15, { rir: 3 }), it("calf_raise_standing", 2, 10, 15, { rir: 3 }), it("pallof_press", 2, 8, 12, { rir: 3 }), it("tandem_walk", 2, 20, 30, { unit: "seconds", rest: 30 })], { minutes: 45 }),
    ],
    sessionMinutesRange: [40, 50], cardioMinutesPerWeek: 60,
    progressionRules: ["Semanas 1-4: 1-2 series de 10-15 reps a 3-4 RIR.", "Después: 2-3 series de 6-12 a 2-3 RIR (~70-85 % 1RM).", "Potencia: carga ligera (40-60 % 1RM), subida lo más rápida posible.", "Equilibrio: progresa a ojos cerrados o superficie blanda cuando aguantes 30 s."],
  }),
  tpl({
    id: "S3", name: "Minimalista 2 días (poco tiempo)", goal: "salud", daysPerWeek: 2, level: "principiante", split: "minimal", recommendedForNovice: true,
    category: "poco_tiempo", tags: ["poco_tiempo", "superseries", "2_dias"], source: SRC.minimal,
    weekdayMap: { default: { M1: 1, M2: 4 }, alt: { M1: 2, M2: 5 } },
    knownAs: "Dosis mínima eficaz (Iversen 2021)", priorities: ["eficiencia", "constancia"],
    bestFor: "Quien solo tiene 2 días de 30-45 minutos y quiere el máximo beneficio por minuto.",
    rationale: "Iversen 2021: ≥4 series semanales por músculo con multiarticulares (pierna, tirón y empuje), cargas de 6-15RM y superseries de antagonistas para ahorrar tiempo.",
    communityNote: "Síntesis de IronLog de Iversen et al. 2021 y Nuzzo et al. 2024. Añadir una tercera serie o un tercer día acerca el volumen a las ~10 series del ACSM.",
    caveats: "No uses series descendentes ni rest-pause en compuestos pesados con barra.",
    sessions: [
      session("M1", "Minimalista A", "3 superseries", [it("leg_press", 2, 6, 15, { ss: "A", rest: 60 }), it("lat_pulldown", 2, 6, 15, { ss: "A", rest: 60 }), it("chest_press_machine", 2, 6, 15, { ss: "B", rest: 60 }), it("seated_cable_row", 2, 6, 15, { ss: "B", rest: 60 }), it("db_rdl", 2, 6, 15, { ss: "C", rest: 60 }), it("db_shoulder_press", 2, 6, 15, { ss: "C", rest: 60 })], { minutes: 35 }),
      session("M2", "Minimalista B", "3 superseries", [it("goblet_squat", 2, 6, 15, { ss: "A", rest: 60 }), it("assisted_pullup", 2, 6, 15, { ss: "A", rest: 60 }), it("db_bench_press", 2, 6, 15, { ss: "B", rest: 60 }), it("one_arm_db_row", 2, 6, 15, { ss: "B", rest: 60 }), it("glute_bridge", 2, 8, 15, { ss: "C", rest: 60 }), it("lateral_raise_db", 2, 10, 15, { ss: "C", rest: 60 })], { minutes: 35 }),
    ],
    sessionMinutesRange: [30, 45],
    progressionRules: ["Doble progresión a 1-3 RIR.", "Para ahorrar tiempo en aislamientos: 1-3 bajadas del 20-25 % (drop set) o rest-pause de ~20 s."],
  }),
  tpl({
    id: "S4", name: "Casa con mancuernas y bandas (3 días)", goal: "hipertrofia", daysPerWeek: 3, level: "principiante", split: "home_full_body", recommendedForNovice: true,
    category: "casa", tags: ["casa", "mancuernas", "bandas"], source: SRC.home, place: "home",
    weekdayMap: { default: { C1: 1, C2: 3, C3: 5 } },
    knownAs: "Cuerpo completo en casa", priorities: ["masa muscular", "constancia"],
    bestFor: "Entrenar en casa con un par de mancuernas ajustables y bandas elásticas.",
    rationale: "Cada músculo 3 veces por semana con multiarticulares de mancuerna y banda; las bandas dan ganancias de fuerza similares a máquinas y mancuernas (Lopes 2019).",
    communityNote: "Síntesis de IronLog (no es un programa publicado). Si las mancuernas se quedan livianas, usa repeticiones altas (15-30) cerca del fallo: la hipertrofia es similar.",
    caveats: "Ancla bien las bandas. Si no tienes banco, el press de suelo y el remo apoyado en una silla sirven.",
    sessions: [
      session("C1", "Casa A", "Cuerpo completo", [it("goblet_squat", 3, 8, 20), it("db_floor_press", 3, 8, 20), it("one_arm_db_row", 3, 8, 15), it("db_rdl", 3, 8, 15), it("standing_db_press", 2, 8, 15), it("db_curl", 2, 10, 20, { rest: 60 }), it("overhead_db_ext", 2, 10, 20, { rest: 60 }), it("plank", 2, 30, 60, { unit: "seconds", rest: 45 })], { minutes: 50 }),
      session("C2", "Casa B", "Cuerpo completo", [it("bulgarian_split_squat", 3, 8, 15), it("pushup", 3, 6, 20), it("band_row", 3, 10, 20), it("glute_bridge", 3, 10, 20), it("lateral_raise_db", 3, 12, 20, { rest: 60 }), it("hammer_curl", 2, 10, 15, { rest: 60 }), it("band_pull_apart", 2, 15, 25, { rest: 45 }), it("dead_bug", 2, 8, 12, { rest: 45 })], { minutes: 50 }),
      session("C3", "Casa C", "Cuerpo completo", [it("db_lunge", 3, 8, 15), it("band_chest_press", 3, 10, 20), it("band_pulldown", 3, 10, 20), it("single_leg_rdl", 3, 8, 12), it("pike_pushup", 3, 6, 12), it("db_curl", 2, 10, 20, { rest: 60 }), it("overhead_db_ext", 2, 10, 20, { rest: 60 }), it("reverse_crunch", 2, 10, 15, { rest: 45 })], { minutes: 50 }),
    ],
    sessionMinutesRange: [45, 55],
    progressionRules: ["Doble progresión: sube reps dentro del rango; al tope, sube peso o tensión de banda.", "Si no puedes subir peso, alarga el rango (hasta 30 reps cerca del fallo) o haz la bajada en 3 s."],
  }),
];

// ---------------------------------------------------------------- metadata for v2 templates
const V2_META = {
  H1: { category: "hipertrofia", tags: ["cuerpo_completo"], place: "gym" },
  H2: { category: "hipertrofia", tags: ["torso_pierna"], place: "gym" },
  H3: { category: "hipertrofia", tags: ["torso_pierna", "fuerza_e_hipertrofia"], place: "gym" },
  H4: { category: "hipertrofia", tags: ["ulppl"], place: "gym" },
  H5: { category: "hipertrofia", tags: ["ppl"], place: "gym" },
  H6: { category: "hipertrofia", tags: ["arnold"], place: "gym" },
  F1: { category: "fuerza_novato", tags: ["barra", "progresion_lineal"], place: "gym" },
  F2: { category: "fuerza_novato", tags: ["barra", "niveles_t1_t2_t3"], place: "gym" },
  D1: { category: "definicion", tags: ["torso_pierna", "cardio"], place: "gym" },
  D2: { category: "definicion", tags: ["cuerpo_completo", "cardio"], place: "gym" },
};
const V2_SOURCE = { name: "Biblioteca IronLog v2 (adaptada a entrenar sin compañero)", url: null, verification: "adaptacion" };

// ---------------------------------------------------------------- rules
const NEW_RULES = [
  { if: { place: "bodyweight" }, recommend: ["S1"], note: "Entrenas sin equipo: calistenia con escaleras de progresión." },
  { if: { place: "home" }, recommend: ["S4"], note: "Entrenas en casa: mancuernas y bandas." },
  { if: { ageMin: 60 }, recommend: ["S2"], note: "Pautas NSCA/OMS: fuerza, potencia y equilibrio." },
  { if: { goal: "fuerza", daysPerWeek: 3, level: "principiante" }, recommend: ["F3", "F1"] },
  { if: { goal: "fuerza", daysPerWeek: 3, level: "intermedio" }, recommend: ["F8", "F9"] },
  { if: { goal: "fuerza", daysPerWeek: 4, level: "intermedio" }, recommend: ["F11", "F2"] },
  { if: { goal: "fuerza", daysPerWeek: 5 }, recommend: ["F10"] },
  { if: { goal: "hipertrofia", daysPerWeek: 3, level: "principiante" }, recommend: ["H1", "H14"] },
  { if: { goal: "hipertrofia", daysPerWeek: 4, level: "intermedio" }, recommend: ["H10", "H2"] },
  { if: { goal: "hipertrofia", daysPerWeek: 5, level: "intermedio" }, recommend: ["H4", "H13"] },
  { if: { goal: "hipertrofia", daysPerWeek: 5, level: "avanzado" }, recommend: ["H11", "H4"] },
  { if: { goal: "hipertrofia", daysPerWeek: 6, level: "principiante" }, recommend: ["H7"], note: "El PPL de Metallicadpa está pensado para principiantes de 0-12 meses." },
  { if: { goal: "hipertrofia", daysPerWeek: 6, level: "intermedio" }, recommend: ["H7", "H9"] },
  { if: { goal: "acondicionamiento", level: "principiante" }, recommend: ["A1", "A3"] },
  { if: { goal: "acondicionamiento", level: "intermedio" }, recommend: ["A2", "A3"] },
  { if: { goal: "acondicionamiento", level: "avanzado" }, recommend: ["A2", "A4"] },
  { if: { goal: "salud", daysPerWeek: 2 }, recommend: ["S3"] },
  { if: { goal: "salud" }, recommend: ["A5", "S3"] },
  { if: { level: "principiante" }, avoid: ["F8", "F9", "F10", "F11", "H11", "H12", "H13", "A4"], why: "Programa para intermedios o avanzados: más volumen o intensidad de la que un principiante necesita." },
];

// ---------------------------------------------------------------- merge
const byId = (list) => new Map(list.map((x) => [x.id, x]));
const exercises = byId(seed.exercises);
for (const e of NEW_EXERCISES) exercises.set(e.id, e);
// Better alternatives for existing exercises now that more options exist.
const addLink = (id, link) => {
  const e = exercises.get(id);
  if (e && !e.fallbackChain.some((l) => l.exerciseId === link.exerciseId)) e.fallbackChain.push(link);
};
addLink("chin_up", { exerciseId: "negative_pullup", when: "Si aún no logras dominadas completas" });
addLink("assisted_dip", { exerciseId: "dip", when: "Si ya dominas el fondo con tu peso" });
addLink("pushup", { exerciseId: "incline_pushup", when: "Si aún no completas flexiones en el suelo" });

const templates = byId(seed.programTemplates);
for (const [id, meta] of Object.entries(V2_META)) {
  const t = templates.get(id);
  if (t) templates.set(id, { ...t, ...meta, source: t.source ?? V2_SOURCE });
}
for (const t of NEW_TEMPLATES) templates.set(t.id, t);

const ruleKey = (r) => JSON.stringify(r);
const rules = [...NEW_RULES, ...seed.recommendationRules.filter((r) => !NEW_RULES.some((n) => ruleKey(n) === ruleKey(r)))];
// The default must stay last.
rules.sort((a, b) => ("default" in a ? 1 : 0) - ("default" in b ? 1 : 0));

const out = {
  ...seed,
  schemaVersion: 3,
  dataVersion: "2026-10-18",
  goals: { ...seed.goals, acondicionamiento: "Acondicionamiento (resistencia cardiovascular)", salud: "Salud y forma general" },
  muscles: { ...seed.muscles, balance: "Equilibrio" },
  exercises: [...exercises.values()],
  programTemplates: [...templates.values()],
  recommendationRules: rules,
};
writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
console.log(`catalog v3: ${out.exercises.length} exercises, ${out.programTemplates.length} templates, ${out.recommendationRules.length} rules`);
