// One-off/admin script: uploads the global read-only catalog, publishes the
// Firestore rules and grants the admin claim to ADMIN_EMAILS.
//
//   npm run seed            (uses .env.local: FIREBASE_SERVICE_ACCOUNT, ADMIN_EMAILS)
//   npm run seed -- --force (rewrite the catalog even if dataVersion is unchanged)
//   npm run seed -- --emulator (target the local emulators instead)
//
// Idempotent: the catalog is only rewritten when the seed's dataVersion changes.
// It never touches users/** (per-user edits live in exerciseOverrides/foods).
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getSecurityRules } from "firebase-admin/security-rules";

const args = new Set(process.argv.slice(2));
const emulator = args.has("--emulator");
const force = args.has("--force");

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const seed = read("data/seed/rutinas_seed.json");
const foods = read("data/seed/foods.json");

let app;
if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-ironlog" });
} else {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const sa = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const db = getFirestore(app);

// 1) Catalog: aggregated documents (one read loads the whole catalog).
const metaRef = db.doc("catalog/meta");
const meta = (await metaRef.get()).data();
const version = `${seed.dataVersion}+foods-${foods.version}`;
if (!force && meta?.version === version) {
  console.log(`catalog already at ${version} (use --force to rewrite)`);
} else {
  const batch = db.batch();
  batch.set(db.doc("catalog/exercises"), { items: seed.exercises, updatedAt: Date.now() });
  batch.set(db.doc("catalog/programTemplates"), { items: seed.programTemplates, updatedAt: Date.now() });
  batch.set(db.doc("catalog/addOns"), { items: seed.addOns, updatedAt: Date.now() });
  for (const [country, data] of Object.entries(foods.countries)) {
    batch.set(db.doc(`catalog/foods_${country}`), { country, currency: data.currency, items: data.items, updatedAt: Date.now() });
  }
  batch.set(metaRef, {
    version,
    schemaVersion: seed.schemaVersion,
    dataVersion: seed.dataVersion,
    goals: seed.goals,
    muscles: seed.muscles,
    recommendationRules: seed.recommendationRules,
    foodCountries: Object.keys(foods.countries),
    updatedAt: Date.now(),
  });
  await batch.commit();
  console.log(`catalog written: ${seed.exercises.length} exercises, ${seed.programTemplates.length} templates, ${seed.addOns.length} add-ons, foods for ${Object.keys(foods.countries).join(", ")} (${version})`);
}

// 2) Firestore rules (skip on the emulator: it loads firestore.rules itself).
if (!emulator && !args.has("--no-rules")) {
  const source = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  await getSecurityRules(app).releaseFirestoreRulesetFromSource(source);
  console.log("firestore.rules published");
}

// 3) Admin role via custom claim for existing accounts listed in ADMIN_EMAILS.
const admins = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
for (const email of admins) {
  try {
    const user = await getAuth(app).getUserByEmail(email);
    if (!user.customClaims?.admin) {
      await getAuth(app).setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
      console.log("admin claim granted to an ADMIN_EMAILS account");
    }
  } catch (e) {
    if (e?.code === "auth/user-not-found") console.log("an ADMIN_EMAILS account has not signed up yet; run the seed again after it registers");
    else throw e;
  }
}
process.exit(0);
