// Adds the routines for women, chosen by the body area they want to prioritise
// (glutes and legs, legs, whole body, upper body), plus the glute exercises
// they need. Runs on top of catalog v3 and is idempotent: entries are
// replaced by id.
//   node scripts/catalog/build-women.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { ex, it, session, tpl } from "./helpers.mjs";

const FILE = new URL("../../data/seed/rutinas_seed.json", import.meta.url);
const seed = JSON.parse(readFileSync(FILE, "utf8"));

// ---------------------------------------------------------------- exercises
const NEW_EXERCISES = [
  ex("hip_thrust_machine", "Hip thrust en máquina", "puente_cadera", "glutes", ["hamstrings"], ["machine"], { compound: true, cues: "Mentón al pecho, costillas abajo; sube hasta extender la cadera y aprieta 1 s arriba.", chain: ["hip_thrust", "db_hip_thrust", "glute_bridge"] }),
  ex("db_hip_thrust", "Hip thrust con mancuerna", "puente_cadera", "glutes", ["hamstrings"], ["dumbbell", "bench"], { compound: true, cues: "Espalda alta apoyada en el banco, mancuerna sobre la cadera (con una toalla). Sube hasta extender la cadera.", chain: ["glute_bridge", "single_leg_glute_bridge"] }),
  ex("single_leg_glute_bridge", "Puente de glúteo a una pierna", "puente_cadera", "glutes", ["hamstrings"], ["bodyweight"], { cues: "Talón cerca del glúteo, la otra pierna arriba. Cadera nivelada al subir.", chain: ["glute_bridge"] }),
  ex("cable_kickback", "Patada de glúteo en polea", "patada_gluteo", "glutes", [], ["cable"], { cues: "Tobillera en la polea baja, torso algo inclinado; lleva la pierna atrás sin arquear la zona lumbar.", chain: ["band_kickback", "single_leg_glute_bridge"] }),
  ex("band_kickback", "Patada de glúteo en cuadrupedia (con banda)", "patada_gluteo", "glutes", [], ["band"], { cues: "En cuatro apoyos, banda en los pies o rodillas; empuja con el talón hacia atrás y arriba.", chain: ["single_leg_glute_bridge"] }),
  ex("cable_pull_through", "Pull-through en polea", "bisagra_cadera", "glutes", ["hamstrings"], ["cable"], { compound: true, cues: "De espaldas a la polea baja, cuerda entre las piernas; cadera atrás y extiende apretando glúteo.", chain: ["db_rdl", "back_extension", "glute_bridge"] }),
  ex("cable_hip_abduction", "Abducción de cadera de pie en polea", "abduccion", "glutes", [], ["cable"], { cues: "Tobillera en la polea baja, pierna de afuera; sube de lado sin inclinar el torso.", chain: ["machine_hip_abduction", "band_lateral_walk"] }),
];

// Better first alternatives for the classic hip thrust (it needs a barbell, a bench and a Smith).
const LINKS = {
  hip_thrust: [
    { exerciseId: "hip_thrust_machine", when: "Si hay máquina de hip thrust o la barra está ocupada" },
    { exerciseId: "db_hip_thrust", when: "Si no hay barra ni máquina" },
  ],
  glute_bridge: [{ exerciseId: "single_leg_glute_bridge", when: "Si el puente con dos piernas ya es fácil" }],
};

// ---------------------------------------------------------------- templates
const UL4 = (a, b, c, d) => ({ classic: { [a]: 1, [b]: 2, [c]: 4, [d]: 5 }, extraTuesday: { [a]: 1, [b]: 2, [c]: 3, [d]: 5 }, extraThursday: { [a]: 1, [b]: 3, [c]: 4, [d]: 5 } });

const SRC = {
  glute: { name: "Síntesis IronLog (Plotkin et al. 2023; Roberts et al. 2020; ACSM 2026)", url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full", verification: "sintesis" },
  sex: { name: "Síntesis IronLog (Roberts et al. 2020; Refalo et al. 2025; ACSM 2026)", url: "https://pubmed.ncbi.nlm.nih.gov/32218059/", verification: "sintesis" },
};

const SAME_AS_MEN =
  "No existe una rutina «de mujer» fisiológicamente distinta: con el mismo entrenamiento, mujeres y hombres ganan músculo en proporción parecida (Roberts 2020; Refalo 2025). Lo que cambia es el objetivo, y esta rutina reparte el volumen según el tuyo.";
const GLUTE_EVIDENCE =
  "Hip thrust y sentadilla dieron un crecimiento de glúteo parecido en 9 semanas (Plotkin 2023, MRI); la sentadilla además creció más cuádriceps y aductores. Por eso se combinan: un empuje de cadera, una sentadilla o zancada profunda y una bisagra en cada semana.";
const DOUBLE = "Doble progresión: cuando completes el tope del rango en todas las series con 1-2 repeticiones en reserva, sube el peso lo mínimo posible.";
const GLUTE_PROGRESSION = [DOUBLE, "En hip thrust aprieta 1 s arriba en cada repetición; si la zona lumbar trabaja más que el glúteo, baja el peso.", "Cada 6-8 semanas, una semana con la mitad de series para recuperar."];
const PUMP = { rest: 60 };

// Upper-body days shared by the 4-day lower-focused templates: enough to keep
// (and slowly build) the upper body while the legs get the priority.
const UPPER_A = (glute) =>
  session("U1", "Torso A", "Espalda, pecho y hombro", [
    it("lat_pulldown", 3, 8, 12),
    it("chest_press_machine", 3, 8, 12),
    it("seated_cable_row", 3, 8, 12),
    it("db_shoulder_press", 2, 8, 12),
    it("lateral_raise_db", 3, 12, 20, PUMP),
    it("face_pull", 2, 15, 20, PUMP),
    ...(glute ? [it("cable_kickback", 2, 12, 20, { ...PUMP, notes: "Extra de glúteo al final: poco cansancio y no compite con la pierna de mañana." })] : []),
  ]);
const UPPER_B = (glute) =>
  session("U2", "Torso B", "Espalda, pecho y brazos", [
    it("neutral_pulldown", 3, 10, 12),
    it("incline_db_press", 3, 8, 12),
    it("chest_supported_row", 3, 8, 12),
    it("cable_lateral_raise", 2, 12, 20, PUMP),
    it("db_curl", 2, 10, 15, PUMP),
    it("overhead_cable_ext", 2, 10, 15, PUMP),
    ...(glute ? [it("cable_hip_abduction", 2, 15, 20, PUMP)] : []),
    it("cable_crunch", 2, 10, 15, PUMP),
  ]);

const NEW_TEMPLATES = [
  // ------------------------------------------------ GLUTES AND LEGS
  tpl({
    id: "M1", name: "Glúteo y pierna · cuerpo completo 3 días", goal: "hipertrofia", daysPerWeek: 3, level: "principiante", split: "full_body_glute", recommendedForNovice: true,
    category: "mujeres", emphasis: "gluteo_pierna", tags: ["gluteo", "pierna", "cuerpo_completo"], source: SRC.glute,
    weekdayMap: { default: { A: 1, B: 3, C: 5 } },
    knownAs: "Glúteo 3 veces por semana", priorities: ["glúteo", "pierna", "constancia"],
    bestFor: "Empezar a crecer glúteo y pierna con 3 días, sin dejar el torso.",
    rationale: `Glúteo en las 3 sesiones (frecuencia 3) con un ejercicio de empuje de cadera, uno de sentadilla o zancada y una bisagra. ${GLUTE_EVIDENCE} El torso recibe lo justo para progresar.`,
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "El torso queda por debajo de ~10 series por semana a propósito; si también quieres priorizarlo, usa Todo el cuerpo 3 días.",
    sessions: [
      session("A", "Día A", "Glúteo (hip thrust) + espalda", [
        it("hip_thrust", 3, 8, 12, { rest: 120 }),
        it("leg_press", 3, 10, 15, { notes: "Pies altos y algo abiertos en la plataforma: más glúteo y femoral." }),
        it("seated_leg_curl", 3, 10, 15),
        it("machine_hip_abduction", 2, 15, 25, PUMP),
        it("lat_pulldown", 3, 8, 12),
        it("db_shoulder_press", 2, 8, 12),
        it("plank", 2, 30, 60, { unit: "seconds", rest: 45 }),
      ]),
      session("B", "Día B", "Sentadilla + bisagra + pecho", [
        it("smith_squat", 3, 8, 12, { rest: 120, notes: "Baja tan profundo como controles: la sentadilla profunda trabaja más glúteo." }),
        it("db_rdl", 3, 8, 12),
        it("bulgarian_split_squat", 2, 8, 12, { notes: "Torso algo inclinado hacia delante y paso largo: más glúteo." }),
        it("cable_kickback", 2, 12, 20, PUMP),
        it("seated_cable_row", 3, 8, 12),
        it("chest_press_machine", 2, 8, 12),
        it("face_pull", 2, 15, 20, PUMP),
      ]),
      session("C", "Día C", "Glúteo unilateral + torso", [
        it("hip_thrust_machine", 3, 10, 15, { rest: 90 }),
        it("step_up", 3, 8, 12, { notes: "Escalón a la altura de la rodilla; empuja con el talón de la pierna de arriba." }),
        it("lying_leg_curl", 2, 10, 15),
        it("back_extension", 2, 12, 20, { notes: "Espalda alta un poco redondeada y pies girados hacia fuera: el glúteo hace el trabajo." }),
        it("neutral_pulldown", 2, 10, 15),
        it("incline_db_press", 2, 8, 12),
        it("lateral_raise_db", 2, 12, 20, PUMP),
      ]),
    ],
    sessionMinutesRange: [50, 60],
    progressionRules: GLUTE_PROGRESSION,
    recommendedAddOns: ["AO_CORE"],
  }),
  tpl({
    id: "M2", name: "Glúteo y pierna · 4 días (pierna-torso)", goal: "hipertrofia", daysPerWeek: 4, level: "principiante-intermedio", split: "lower_upper_glute", recommendedForNovice: true,
    category: "mujeres", emphasis: "gluteo_pierna", tags: ["gluteo", "pierna", "torso_pierna"], source: SRC.glute,
    weekdayMap: UL4("L1", "U1", "L2", "U2"),
    knownAs: "Pierna-torso con prioridad de glúteo", priorities: ["glúteo", "pierna"],
    bestFor: "Crecer glúteo y pierna con 4 días: 2 de pierna completa y 2 de torso con un extra de glúteo.",
    rationale: `Dos días de pierna con enfoques distintos (cadera / cuádriceps) y un extra corto de glúteo en los días de torso: glúteo 4 veces por semana. ${GLUTE_EVIDENCE}`,
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Si el hip thrust con barra te queda incómodo, la app usa la máquina o la mancuerna. Mantén la técnica antes que el peso.",
    sessions: [
      session("L1", "Pierna 1", "Glúteo: cadera", [
        it("hip_thrust", 4, 6, 10, { rest: 150 }),
        it("db_rdl", 3, 8, 12),
        it("bulgarian_split_squat", 3, 8, 12, { notes: "Paso largo y torso algo inclinado: más glúteo." }),
        it("seated_leg_curl", 2, 10, 15),
        it("machine_hip_abduction", 3, 15, 25, PUMP),
      ]),
      UPPER_A(true),
      session("L2", "Pierna 2", "Cuádriceps y glúteo", [
        it("smith_squat", 4, 8, 12, { rest: 150, notes: "Baja profundo: más recorrido, más glúteo." }),
        it("leg_press", 3, 10, 15),
        it("lying_leg_curl", 3, 10, 15),
        it("cable_pull_through", 3, 12, 15),
        it("calf_raise_standing", 3, 10, 15, PUMP),
      ]),
      UPPER_B(true),
    ],
    sessionMinutesRange: [50, 65],
    progressionRules: GLUTE_PROGRESSION,
  }),
  tpl({
    id: "M3", name: "Glúteo y pierna · 5 días", goal: "hipertrofia", daysPerWeek: 5, level: "intermedio", split: "glute_focus_5", recommendedForNovice: false,
    category: "mujeres", emphasis: "gluteo_pierna", tags: ["gluteo", "pierna", "alto_volumen"], source: SRC.glute,
    weekdayMap: { default: { G1: 1, U1: 2, Q1: 3, U2: 4, G2: 5 } },
    knownAs: "Glúteo 3 días + torso 2 días", priorities: ["glúteo", "pierna"],
    bestFor: "Quien ya entrena hace 6+ meses y quiere el máximo de glúteo con 5 días.",
    rationale: `Tres días de pierna (glúteo pesado, cuádriceps, glúteo y femoral) y dos de torso. El glúteo queda cerca de 20 series semanales, repartidas para no pasar de ~10 por sesión. ${GLUTE_EVIDENCE}`,
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Mucho volumen de pierna: si las rodillas o la zona lumbar se cargan, quita una serie de cada ejercicio de pierna antes que un día.",
    sessions: [
      session("G1", "Glúteo pesado", "Hip thrust y bisagra", [
        it("hip_thrust", 4, 6, 10, { rest: 150 }),
        it("barbell_rdl", 3, 6, 10, { rest: 150 }),
        it("db_lunge", 3, 8, 12, { notes: "Zancada hacia atrás y paso largo." }),
        it("machine_hip_abduction", 3, 15, 25, PUMP),
      ]),
      session("U1", "Torso A", "Espalda, pecho y hombro", [
        it("lat_pulldown", 3, 8, 12),
        it("chest_press_machine", 3, 8, 12),
        it("seated_cable_row", 3, 8, 12),
        it("db_shoulder_press", 3, 8, 12),
        it("lateral_raise_db", 3, 12, 20, PUMP),
        it("face_pull", 2, 15, 20, PUMP),
      ]),
      session("Q1", "Cuádriceps", "Sentadilla y prensa", [
        it("smith_squat", 4, 8, 12, { rest: 150, notes: "Baja profundo." }),
        it("leg_press", 3, 10, 15),
        it("leg_extension", 3, 12, 15, PUMP),
        it("seated_leg_curl", 3, 10, 15),
        it("calf_raise_standing", 3, 10, 15, PUMP),
      ]),
      session("U2", "Torso B", "Espalda, pecho y brazos", [
        it("neutral_pulldown", 3, 10, 12),
        it("incline_db_press", 3, 8, 12),
        it("chest_supported_row", 3, 8, 12),
        it("cable_lateral_raise", 3, 12, 20, PUMP),
        it("db_curl", 2, 10, 15, PUMP),
        it("overhead_cable_ext", 2, 10, 15, PUMP),
        it("cable_crunch", 2, 10, 15, PUMP),
      ]),
      session("G2", "Glúteo y femoral", "Volumen de glúteo", [
        it("hip_thrust_machine", 3, 10, 15),
        it("step_up", 3, 8, 12),
        it("lying_leg_curl", 3, 10, 15),
        it("cable_kickback", 2, 12, 20, PUMP),
        it("cable_hip_abduction", 2, 15, 20, PUMP),
      ]),
    ],
    sessionMinutesRange: [50, 65],
    progressionRules: GLUTE_PROGRESSION,
    deloadRules: ["Cada 6-8 semanas, o si 2 sesiones seguidas bajan las repeticiones: una semana con la mitad de series."],
  }),
  // ------------------------------------------------ WHOLE LEG
  tpl({
    id: "M4", name: "Pierna completa · 4 días (pierna-torso)", goal: "hipertrofia", daysPerWeek: 4, level: "principiante-intermedio", split: "lower_upper_legs", recommendedForNovice: true,
    category: "mujeres", emphasis: "pierna", tags: ["pierna", "torso_pierna"], source: SRC.glute,
    weekdayMap: UL4("L1", "U1", "L2", "U2"),
    knownAs: "Pierna-torso con prioridad de pierna", priorities: ["cuádriceps", "femoral", "glúteo", "pantorrilla"],
    bestFor: "Crecer la pierna completa (no solo el glúteo): cuádriceps, femorales, glúteo y pantorrilla.",
    rationale: "Un día dominante de cuádriceps y otro de cadera; cada músculo de la pierna 2 veces por semana con ~10-14 series. La sentadilla profunda y la prensa crecen cuádriceps y aductores además del glúteo (Plotkin 2023).",
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Si buscas sobre todo glúteo, Glúteo y pierna 4 días lo prioriza más.",
    sessions: [
      session("L1", "Pierna 1", "Cuádriceps", [
        it("hack_squat_machine", 4, 6, 10, { rest: 150 }),
        it("leg_press", 3, 10, 15),
        it("leg_extension", 3, 12, 15, PUMP),
        it("seated_leg_curl", 3, 10, 15),
        it("calf_raise_standing", 4, 10, 15, PUMP),
      ]),
      UPPER_A(false),
      session("L2", "Pierna 2", "Femoral y glúteo", [
        it("db_rdl", 4, 8, 12, { rest: 120 }),
        it("hip_thrust", 3, 8, 12, { rest: 120 }),
        it("bulgarian_split_squat", 3, 8, 12),
        it("lying_leg_curl", 3, 10, 15),
        it("seated_calf_raise", 3, 12, 20, PUMP),
      ]),
      UPPER_B(false),
    ],
    sessionMinutesRange: [50, 65],
    progressionRules: [DOUBLE, "Cada 6-8 semanas, una semana con la mitad de series para recuperar."],
  }),
  // ------------------------------------------------ WHOLE BODY
  tpl({
    id: "M5", name: "Todo el cuerpo · 3 días", goal: "hipertrofia", daysPerWeek: 3, level: "principiante", split: "full_body", recommendedForNovice: true,
    category: "mujeres", emphasis: "equilibrado", tags: ["cuerpo_completo"], source: SRC.sex,
    weekdayMap: { default: { A: 1, B: 3, C: 5 } },
    knownAs: "Cuerpo completo equilibrado", priorities: ["todo el cuerpo", "constancia"],
    bestFor: "Trabajar todo el cuerpo de forma pareja con 3 días, con un poco más de glúteo que una rutina estándar.",
    rationale: "Cada sesión trabaja pierna, empuje, tracción y hombro; cada músculo grande 2-3 veces por semana con ~10 series. Las mujeres suelen ganar fuerza de torso rápido al empezar (Roberts 2020), así que el torso no se descuida.",
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Las sesiones son largas (~60 min); si vas justa de tiempo, haz solo los 5 primeros ejercicios.",
    sessions: [
      session("A", "Día A", "Cuerpo completo", [
        it("smith_squat", 3, 8, 12, { rest: 120 }),
        it("chest_press_machine", 3, 8, 12),
        it("lat_pulldown", 3, 8, 12),
        it("hip_thrust", 3, 8, 12),
        it("lateral_raise_db", 2, 12, 20, PUMP),
        it("pushdown_rope", 2, 10, 15, PUMP),
        it("plank", 2, 30, 60, { unit: "seconds", rest: 45 }),
      ]),
      session("B", "Día B", "Cuerpo completo", [
        it("db_rdl", 3, 8, 12, { rest: 120 }),
        it("db_shoulder_press", 3, 8, 12),
        it("seated_cable_row", 3, 8, 12),
        it("leg_press", 3, 10, 15),
        it("incline_db_press", 2, 8, 12),
        it("db_curl", 2, 10, 15, PUMP),
        it("face_pull", 2, 15, 20, PUMP),
      ]),
      session("C", "Día C", "Cuerpo completo", [
        it("bulgarian_split_squat", 3, 8, 12),
        it("incline_db_press", 3, 8, 12),
        it("chest_supported_row", 3, 8, 12),
        it("seated_leg_curl", 3, 10, 15),
        it("machine_hip_abduction", 2, 15, 25, PUMP),
        it("cable_lateral_raise", 2, 12, 20, PUMP),
        it("cable_crunch", 2, 10, 15, PUMP),
      ]),
    ],
    sessionMinutesRange: [50, 60],
    progressionRules: [DOUBLE],
  }),
  tpl({
    id: "M6", name: "Todo el cuerpo · 4 días (pierna-torso)", goal: "hipertrofia", daysPerWeek: 4, level: "principiante-intermedio", split: "lower_upper", recommendedForNovice: true,
    category: "mujeres", emphasis: "equilibrado", tags: ["torso_pierna"], source: SRC.sex,
    weekdayMap: UL4("L1", "U1", "L2", "U2"),
    knownAs: "Pierna-torso equilibrado", priorities: ["todo el cuerpo"],
    bestFor: "Trabajar todo de forma pareja con 4 días: 2 de pierna y 2 de torso.",
    rationale: "Cada músculo 2 veces por semana con ~10-14 series, el rango con mejor relación beneficio-tiempo según ACSM 2026. El glúteo tiene un ejercicio directo en cada día de pierna.",
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Si con el tiempo quieres más glúteo, cambia a Glúteo y pierna 4 días: tiene el mismo esquema.",
    sessions: [
      session("L1", "Pierna 1", "Cuádriceps y glúteo", [
        it("smith_squat", 4, 8, 12, { rest: 150 }),
        it("hip_thrust", 3, 8, 12),
        it("leg_extension", 2, 12, 15, PUMP),
        it("seated_leg_curl", 3, 10, 15),
        it("calf_raise_standing", 3, 10, 15, PUMP),
      ]),
      session("U1", "Torso A", "Espalda, pecho y hombro", [
        it("lat_pulldown", 3, 8, 12),
        it("chest_press_machine", 3, 8, 12),
        it("seated_cable_row", 3, 8, 12),
        it("db_shoulder_press", 3, 8, 12),
        it("lateral_raise_db", 3, 12, 20, PUMP),
        it("face_pull", 2, 15, 20, PUMP),
        it("pushdown_rope", 2, 10, 15, PUMP),
      ]),
      session("L2", "Pierna 2", "Femoral y glúteo", [
        it("db_rdl", 3, 8, 12, { rest: 120 }),
        it("leg_press", 3, 10, 15),
        it("bulgarian_split_squat", 2, 8, 12),
        it("lying_leg_curl", 2, 10, 15),
        it("machine_hip_abduction", 2, 15, 25, PUMP),
      ]),
      session("U2", "Torso B", "Espalda, pecho y brazos", [
        it("neutral_pulldown", 3, 10, 12),
        it("incline_db_press", 3, 8, 12),
        it("pec_deck", 2, 12, 15, PUMP),
        it("chest_supported_row", 3, 8, 12),
        it("cable_lateral_raise", 3, 12, 20, PUMP),
        it("db_curl", 2, 10, 15, PUMP),
        it("overhead_cable_ext", 2, 10, 15, PUMP),
        it("cable_crunch", 2, 10, 15, PUMP),
      ]),
    ],
    sessionMinutesRange: [50, 60],
    progressionRules: [DOUBLE, "Cada 6-8 semanas, una semana con la mitad de series para recuperar."],
  }),
  // ------------------------------------------------ HOME
  tpl({
    id: "M7", name: "Glúteo y pierna en casa · 3 días", goal: "hipertrofia", daysPerWeek: 3, level: "principiante", split: "home_full_body_glute", recommendedForNovice: true,
    category: "mujeres", emphasis: "gluteo_pierna", place: "home", tags: ["casa", "gluteo", "mancuernas", "bandas"], source: SRC.glute,
    weekdayMap: { default: { A: 1, B: 3, C: 5 } },
    knownAs: "Glúteo en casa", priorities: ["glúteo", "pierna"],
    bestFor: "Crecer glúteo y pierna en casa con un par de mancuernas, bandas y un banco o sofá firme.",
    rationale: `Glúteo en las 3 sesiones con empuje de cadera, zancada o sentadilla y bisagra, más trabajo con banda. Con peso limitado, las repeticiones altas (15-30) cerca del fallo dan una hipertrofia parecida. ${GLUTE_EVIDENCE}`,
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "Si no tienes banco, apoya la espalda alta en un sofá firme pegado a la pared. Si las mancuernas se quedan livianas, pasa a la versión a una pierna.",
    sessions: [
      session("A", "Casa A", "Glúteo + espalda", [
        it("db_hip_thrust", 4, 10, 20, { rest: 90 }),
        it("goblet_squat", 3, 10, 20),
        it("db_rdl", 3, 10, 15),
        it("band_lateral_walk", 2, 15, 25, PUMP),
        it("one_arm_db_row", 3, 10, 15),
        it("pushup", 2, 6, 20),
      ]),
      session("B", "Casa B", "Zancada + hombro", [
        it("bulgarian_split_squat", 3, 8, 15, { notes: "Paso largo y torso algo inclinado: más glúteo." }),
        it("single_leg_rdl", 3, 8, 12),
        it("glute_bridge", 3, 15, 30, { notes: "Con mancuerna sobre la cadera; aprieta 1 s arriba." }),
        it("band_kickback", 2, 15, 25, PUMP),
        it("band_row", 3, 12, 20),
        it("lateral_raise_db", 2, 12, 20, PUMP),
        it("band_pull_apart", 2, 15, 25, { rest: 45 }),
      ]),
      session("C", "Casa C", "Glúteo unilateral + torso", [
        it("single_leg_glute_bridge", 3, 10, 20),
        it("step_up", 3, 8, 15),
        it("db_lunge", 2, 10, 15, { notes: "Zancada hacia atrás." }),
        it("band_lateral_walk", 2, 15, 25, PUMP),
        it("band_pulldown", 3, 12, 20),
        it("db_floor_press", 2, 8, 15),
        it("dead_bug", 2, 8, 12, { rest: 45 }),
      ]),
    ],
    sessionMinutesRange: [45, 55],
    progressionRules: [DOUBLE, "Si no puedes subir peso, alarga el rango (hasta 30 reps cerca del fallo), haz la bajada en 3 s o pasa a la versión a una pierna."],
  }),
  // ------------------------------------------------ UPPER BODY
  tpl({
    id: "M8", name: "Tren superior · 4 días", goal: "hipertrofia", daysPerWeek: 4, level: "principiante-intermedio", split: "upper_focus", recommendedForNovice: true,
    category: "mujeres", emphasis: "torso", tags: ["torso", "brazos", "hombros"], source: SRC.sex,
    weekdayMap: UL4("T1", "P1", "T2", "P2"),
    knownAs: "Espalda, hombros y brazos", priorities: ["espalda", "hombros", "brazos"],
    bestFor: "Priorizar espalda, hombros y brazos (con la pierna en mantenimiento activo).",
    rationale: "Dos días de torso con más volumen y dos de cuerpo completo cortos: espalda, deltoides y brazos 4 veces por semana; la pierna conserva ~8-10 series para no perder lo ganado. Las mujeres suelen progresar rápido en fuerza de torso al empezar (Roberts 2020).",
    communityNote: `${SAME_AS_MEN} Síntesis de IronLog, no un programa publicado.`,
    caveats: "La pierna queda en mantenimiento: si también quieres crecerla, usa Todo el cuerpo 4 días.",
    sessions: [
      session("T1", "Torso A", "Espalda y hombro", [
        it("lat_pulldown", 4, 8, 12),
        it("seated_cable_row", 3, 8, 12),
        it("db_shoulder_press", 3, 8, 12),
        it("lateral_raise_db", 3, 12, 20, PUMP),
        it("face_pull", 3, 15, 20, PUMP),
        it("bayesian_cable_curl", 2, 10, 15, PUMP),
        it("overhead_cable_ext", 2, 10, 15, PUMP),
      ]),
      session("P1", "Pierna + brazos", "Pierna y brazos", [
        it("leg_press", 3, 10, 15),
        it("hip_thrust", 3, 8, 12),
        it("seated_leg_curl", 2, 10, 15),
        it("db_curl", 2, 10, 15, PUMP),
        it("pushdown_rope", 2, 10, 15, PUMP),
        it("cable_crunch", 2, 10, 15, PUMP),
      ]),
      session("T2", "Torso B", "Pecho, espalda y brazos", [
        it("incline_db_press", 3, 8, 12),
        it("chest_supported_row", 3, 8, 12),
        it("neutral_pulldown", 3, 10, 12),
        it("cable_lateral_raise", 3, 12, 20, PUMP),
        it("reverse_pec_deck", 2, 15, 20, PUMP),
        it("hammer_curl", 2, 10, 15, PUMP),
        it("pushdown_bar", 2, 10, 15, PUMP),
      ]),
      session("P2", "Pierna + hombro", "Pierna y hombro", [
        it("smith_squat", 3, 8, 12, { rest: 120 }),
        it("db_rdl", 3, 8, 12),
        it("machine_shoulder_press", 2, 8, 12),
        it("machine_lateral_raise", 2, 12, 20, PUMP),
        it("plank", 2, 30, 60, { unit: "seconds", rest: 45 }),
      ]),
    ],
    sessionMinutesRange: [45, 60],
    progressionRules: [DOUBLE],
  }),
];

// ---------------------------------------------------------------- rules
// The emphasis is the person's own choice, so these rules do not look at sex;
// only the whole-body ones are for women (men keep the classic H templates).
const NEW_RULES = [
  { if: { emphasis: "gluteo_pierna", daysPerWeek: 3 }, recommend: ["M1", "M5"] },
  { if: { emphasis: "gluteo_pierna", daysPerWeek: 4 }, recommend: ["M2", "M4"] },
  { if: { emphasis: "gluteo_pierna", daysPerWeek: 5 }, recommend: ["M3", "M2"] },
  { if: { emphasis: "gluteo_pierna" }, recommend: ["M2", "M1"] },
  { if: { emphasis: "pierna", daysPerWeek: 3 }, recommend: ["M1", "M5"] },
  { if: { emphasis: "pierna", daysPerWeek: 4 }, recommend: ["M4", "M2"] },
  { if: { emphasis: "pierna", daysPerWeek: 5 }, recommend: ["M3", "M4"] },
  { if: { emphasis: "pierna" }, recommend: ["M4", "M1"] },
  { if: { emphasis: "gluteo_pierna", place: "home" }, recommend: ["M7"], note: "Entrenas en casa: glúteo y pierna con mancuernas y bandas." },
  { if: { emphasis: "pierna", place: "home" }, recommend: ["M7"], note: "Entrenas en casa: pierna con mancuernas y bandas." },
  { if: { emphasis: "torso" }, recommend: ["M8"] },
  { if: { sex: "female", emphasis: "equilibrado", goal: "hipertrofia", daysPerWeek: 3 }, recommend: ["M5"] },
  { if: { sex: "female", emphasis: "equilibrado", goal: "hipertrofia", daysPerWeek: 4 }, recommend: ["M6"] },
  { if: { sex: "female", emphasis: "equilibrado", goal: "definicion", daysPerWeek: 3 }, recommend: ["M5", "D2"], note: "Para perder grasa, la dieta y los pasos diarios hacen la diferencia; la rutina conserva el músculo." },
  { if: { sex: "female", emphasis: "equilibrado", goal: "definicion", daysPerWeek: 4 }, recommend: ["M6", "D1"], note: "Para perder grasa, la dieta y los pasos diarios hacen la diferencia; la rutina conserva el músculo." },
  { if: { level: "principiante" }, avoid: ["M3"], why: "Mucho volumen de pierna para empezar: con 4 días progresas igual y te recuperas mejor." },
];

// ---------------------------------------------------------------- merge
const byId = (list) => new Map(list.map((x) => [x.id, x]));
const exercises = byId(seed.exercises);
for (const e of NEW_EXERCISES) exercises.set(e.id, e);
for (const [id, links] of Object.entries(LINKS)) {
  const e = exercises.get(id);
  if (!e) continue;
  const rest = e.fallbackChain.filter((l) => !links.some((n) => n.exerciseId === l.exerciseId));
  e.fallbackChain = [...links, ...rest];
}

const templates = byId(seed.programTemplates);
for (const t of NEW_TEMPLATES) templates.set(t.id, t);

// Rules that mention these templates are always rebuilt from NEW_RULES.
const ours = new Set(NEW_TEMPLATES.map((t) => t.id));
const refs = (r) => ("recommend" in r ? r.recommend : "avoid" in r ? r.avoid : [r.default]);
const rules = [...NEW_RULES, ...seed.recommendationRules.filter((r) => !refs(r).some((id) => ours.has(id)))];
rules.sort((a, b) => ("default" in a ? 1 : 0) - ("default" in b ? 1 : 0));

const out = {
  ...seed,
  dataVersion: "2026-10-19",
  exercises: [...exercises.values()],
  programTemplates: [...templates.values()],
  recommendationRules: rules,
};
writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
console.log(`catalog + mujeres: ${out.exercises.length} exercises, ${out.programTemplates.length} templates, ${out.recommendationRules.length} rules`);
