// Exercise demo images from free-exercise-db (public domain, Unlicense):
// https://github.com/yuhonas/free-exercise-db — two photos per exercise
// (start and end position) that the app alternates as a small animation.
//
// The mapping below was reviewed by hand. `null` means there is no faithful
// equivalent there; a wrong picture is worse than none.
//
//   node scripts/catalog/build-media.mjs
//
// Downloads the frames into public/exercises/ and writes data/exercise-media.json.
import fs from "node:fs";
import path from "node:path";
// sharp ships with Next.js; it is only needed here, at build time of the catalog.
import sharp from "sharp";

const COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const WIDTH = 480;
const RAW = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}`;

const MAP = {
  chest_press_machine: "Leverage_Chest_Press",
  db_bench_press: "Dumbbell_Bench_Press",
  smith_bench_press: "Smith_Machine_Bench_Press",
  cable_chest_press: "Standing_Cable_Chest_Press",
  pushup: "Pushups",
  pushup_feet_elevated: "Push-Ups_With_Feet_Elevated",
  incline_db_press: "Incline_Dumbbell_Press",
  incline_smith_press: "Smith_Machine_Incline_Bench_Press",
  incline_machine_press: "Leverage_Incline_Chest_Press",
  pec_deck: "Butterfly",
  cable_fly: "Cable_Crossover",
  low_high_cable_fly: "Low_Cable_Crossover",
  incline_db_fly: "Incline_Dumbbell_Flyes",
  lat_pulldown: "Wide-Grip_Lat_Pulldown",
  neutral_pulldown: "V-Bar_Pulldown",
  assisted_pullup: "Band_Assisted_Pull-Up",
  single_arm_pulldown: "One_Arm_Lat_Pulldown",
  straight_arm_pulldown: "Straight-Arm_Pulldown",
  seated_cable_row: "Seated_Cable_Rows",
  machine_row: "Leverage_Iso_Row",
  chest_supported_row: "Dumbbell_Incline_Row",
  one_arm_db_row: "One-Arm_Dumbbell_Row",
  smith_inclined_row: "Smith_Machine_Bent_Over_Row",
  lateral_raise_db: "Side_Lateral_Raise",
  cable_lateral_raise: "Cable_Seated_Lateral_Raise",
  machine_lateral_raise: null,
  lying_lateral_raise: "Lying_One-Arm_Lateral_Raise",
  db_shoulder_press: "Dumbbell_Shoulder_Press",
  machine_shoulder_press: "Machine_Shoulder_Military_Press",
  smith_shoulder_press: "Smith_Machine_Overhead_Shoulder_Press",
  standing_db_press: "Standing_Dumbbell_Press",
  arnold_press: "Arnold_Dumbbell_Press",
  face_pull: "Face_Pull",
  reverse_pec_deck: "Reverse_Machine_Flyes",
  db_rear_fly: "Reverse_Flyes",
  band_pull_apart: "Band_Pull_Apart",
  db_shrug: "Dumbbell_Shrug",
  cable_shrug: "Cable_Shrugs",
  overhead_cable_ext: "Cable_Rope_Overhead_Triceps_Extension",
  overhead_db_ext: "Standing_Dumbbell_Triceps_Extension",
  ez_skullcrusher: "EZ-Bar_Skullcrusher",
  pushdown_rope: "Triceps_Pushdown_-_Rope_Attachment",
  pushdown_bar: "Triceps_Pushdown_-_V-Bar_Attachment",
  single_arm_pushdown: "Cable_One_Arm_Tricep_Extension",
  assisted_dip: "Dip_Machine",
  close_grip_smith_press: "Smith_Machine_Close-Grip_Bench_Press",
  incline_db_curl: "Incline_Dumbbell_Curl",
  bayesian_cable_curl: "Standing_One-Arm_Cable_Curl",
  preacher_curl: "Preacher_Curl",
  db_curl: "Dumbbell_Bicep_Curl",
  ez_curl: "EZ-Bar_Curl",
  cable_curl: "Standing_Biceps_Cable_Curl",
  concentration_curl: "Concentration_Curls",
  hammer_curl: "Hammer_Curls",
  rope_hammer_cable: "Cable_Hammer_Curls_-_Rope_Attachment",
  leg_press: "Leg_Press",
  smith_squat: "Smith_Machine_Squat",
  goblet_squat: "Goblet_Squat",
  bulgarian_split_squat: "Split_Squat_with_Dumbbells",
  db_lunge: "Dumbbell_Lunges",
  leg_extension: "Leg_Extensions",
  db_rdl: "Stiff-Legged_Dumbbell_Deadlift",
  smith_rdl: "Smith_Machine_Stiff-Legged_Deadlift",
  seated_leg_curl: "Seated_Leg_Curl",
  lying_leg_curl: "Lying_Leg_Curls",
  hip_thrust: "Barbell_Hip_Thrust",
  glute_bridge: "Butt_Lift_Bridge",
  calf_raise_standing: "Standing_Calf_Raises",
  seated_calf_raise: "Seated_Calf_Raise",
  leg_press_calf_raise: "Calf_Press_On_The_Leg_Press_Machine",
  smith_calf_raise: "Smith_Machine_Calf_Raise",
  plank: ["Plank", [1]], // isometric: only the hold position
  knee_plank: ["Plank", [1]],
  dead_bug: "Dead_Bug",
  pallof_press: "Pallof_Press",
  hanging_knee_raise: "Hanging_Leg_Raise",
  captains_chair_knee_raise: "Knee_Hip_Raise_On_Parallel_Bars",
  lying_leg_raise: "Flat_Bench_Lying_Leg_Raise",
  cable_crunch: "Cable_Crunch",
  machine_crunch: "Ab_Crunch_Machine",
  weighted_floor_crunch: "Crunches",
  barbell_back_squat: "Barbell_Squat",
  barbell_bench_press: "Barbell_Bench_Press_-_Medium_Grip",
  barbell_row: "Bent_Over_Barbell_Row",
  barbell_ohp: "Standing_Military_Press",
  conventional_deadlift: "Barbell_Deadlift",
  hack_squat_machine: "Hack_Squat",
  chin_up: "Chin-Up",
  incline_walk: "Walking_Treadmill",
  bike_steady: "Bicycling_Stationary",
  elliptical_steady: "Elliptical_Trainer",
  bike_intervals: "Bicycling_Stationary",
  treadmill_intervals: "Running_Treadmill",
  front_squat: "Front_Barbell_Squat",
  barbell_rdl: "Romanian_Deadlift",
  sumo_deadlift: "Sumo_Deadlift",
  power_clean: "Power_Clean",
  incline_barbell_bench: "Barbell_Incline_Bench_Press_-_Medium_Grip",
  close_grip_bench: "Close-Grip_Barbell_Bench_Press",
  good_morning: "Good_Morning",
  pullup: "Pullups",
  dip: "Dips_-_Triceps_Version",
  inverted_row: "Inverted_Row",
  negative_pullup: "Pullups",
  scapular_pull: "Scapular_Pull-Up",
  negative_dip: "Dips_-_Triceps_Version",
  dip_support_hold: null,
  wall_pushup: "Incline_Push-Up",
  incline_pushup: "Incline_Push-Up",
  pike_pushup: null,
  bw_squat: "Bodyweight_Squat",
  split_squat_bw: "Split_Squats",
  single_leg_rdl: "Kettlebell_One-Legged_Deadlift",
  nordic_curl: "Natural_Glute_Ham_Raise",
  hollow_hold: null,
  ab_rollout_knee: "Ab_Roller",
  reverse_crunch: "Reverse_Crunch",
  jump_squat: "Freehand_Jump_Squat",
  sit_to_stand: "Bodyweight_Squat", // "Chair_Squat" there is a barbell squat
  step_up: "Dumbbell_Step_Ups",
  back_extension: "Hyperextensions_Back_Extensions",
  machine_hip_abduction: "Thigh_Abductor",
  band_lateral_walk: "Monster_Walk",
  cable_upright_row: "Upright_Cable_Row",
  db_pullover: "Straight-Arm_Dumbbell_Pullover",
  db_floor_press: "Dumbbell_Floor_Press",
  band_row: null,
  band_chest_press: null,
  band_pulldown: null,
  single_leg_balance: null,
  tandem_walk: null,
  run_walk: "Trail_Running_Walking",
  easy_run: "Trail_Running_Walking",
  brisk_walk: null,
  rower_steady: "Rowing_Stationary",
  // Glute work for the routines for women
  hip_thrust_machine: null,
  db_hip_thrust: null, // the hip thrust photos there use a barbell
  single_leg_glute_bridge: "Single_Leg_Glute_Bridge",
  cable_kickback: "One-Legged_Cable_Kickback",
  band_kickback: "Glute_Kickback",
  cable_pull_through: "Pull_Through",
  cable_hip_abduction: null, // "Cable_Hip_Adduction" there is the opposite movement
};

const root = path.resolve(import.meta.dirname, "../..");
const seed = JSON.parse(fs.readFileSync(path.join(root, "data/seed/rutinas_seed.json"), "utf8"));
const fedb = await (await fetch(`${RAW}/dist/exercises.json`)).json();
const byId = new Map(fedb.map((e) => [e.id, e]));

/** A mapping is the source id, or [id, frame indexes] to pick frames (e.g. only the hold of a plank). */
const entry = (v) => (v == null ? null : Array.isArray(v) ? { src: v[0], pick: v[1] } : { src: v, pick: [0, 1] });

const ours = seed.exercises.map((e) => e.id);
const missing = ours.filter((id) => !(id in MAP));
const unknown = Object.entries(MAP).filter(([, v]) => entry(v) && !byId.has(entry(v).src));
if (missing.length || unknown.length) {
  console.error("Mapping out of date:", { missing, unknown: unknown.map(([k, v]) => `${k} → ${entry(v).src}`) });
  process.exit(1);
}

const outDir = path.join(root, "public/exercises");
fs.mkdirSync(outDir, { recursive: true });
const index = {};
const used = new Set();
for (const id of ours) {
  const e = entry(MAP[id]);
  if (!e) continue;
  const { src, pick } = e;
  const all = byId.get(src).images;
  const files = [];
  for (const i of pick) {
    const rel = all[i];
    if (!rel) throw new Error(`${src} has no frame ${i}`);
    // Named after the source exercise so shared images (e.g. two plank variants) are stored once.
    const name = `${src.toLowerCase()}-${i}.jpg`;
    const file = path.join(outDir, name);
    let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (!buf) {
      const res = await fetch(`${RAW}/exercises/${rel}`);
      if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    }
    // The app shows them at ~320 px: 480 px wide is enough for 1.5× screens.
    if ((await sharp(buf).metadata()).width > WIDTH) buf = await sharp(buf).resize({ width: WIDTH }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    fs.writeFileSync(file, buf);
    used.add(name);
    files.push(`/exercises/${name}`);
  }
  index[id] = { frames: files, source: src };
}
// Frames no exercise points to any more (after a mapping change).
for (const f of fs.readdirSync(outDir)) if (!used.has(f)) fs.rmSync(path.join(outDir, f));

const meta = { source: "free-exercise-db (yuhonas) · dominio público (Unlicense)", url: "https://github.com/yuhonas/free-exercise-db", commit: COMMIT };
fs.writeFileSync(path.join(root, "data/exercise-media.json"), JSON.stringify({ meta, exercises: index }, null, 1) + "\n");
const size = fs.readdirSync(outDir).reduce((t, f) => t + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`${Object.keys(index).length}/${ours.length} exercises with images · ${fs.readdirSync(outDir).length} files · ${(size / 1e6).toFixed(1)} MB`);
