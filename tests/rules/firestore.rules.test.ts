// Firestore security rules tests. Run with the emulator (needs Java):
//   npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const OWNER = "owner@example.com";
const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

describe.skipIf(!hasEmulator)("firestore.rules", () => {
  beforeAll(async () => {
    const rules = readFileSync("firestore.rules.tmpl", "utf8").replace("__ALLOWED_EMAILS__", `'${OWNER}'`);
    env = await initializeTestEnvironment({ projectId: "demo-ironlog", firestore: { rules } });
  });
  afterAll(() => env?.cleanup());
  beforeEach(() => env.clearFirestore());

  const owner = () => env.authenticatedContext("u1", { email: OWNER, email_verified: true }).firestore();

  it("lets the allowlisted owner read and write their data", async () => {
    await assertSucceeds(setDoc(doc(owner(), "users/u1"), { heightCm: 182 }));
    await assertSucceeds(setDoc(doc(owner(), "users/u1/workouts/w1"), { date: "2026-10-19" }));
    await assertSucceeds(getDoc(doc(owner(), "users/u1/workouts/w1")));
    await assertSucceeds(setDoc(doc(owner(), "users/u1/aiChats/main/messages/m1"), { text: "hola" }));
  });

  it("blocks unauthenticated access", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/u1/workouts/w1")));
    await assertFails(setDoc(doc(anon, "users/u1"), { x: 1 }));
  });

  it("blocks other Google accounts, even on their own uid", async () => {
    const other = env.authenticatedContext("u2", { email: "someone@example.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(other, "users/u2/workouts/w1"), { date: "2026-10-19" }));
    await assertFails(getDoc(doc(other, "users/u1/workouts/w1")));
  });

  it("blocks the owner's email when unverified", async () => {
    const unverified = env.authenticatedContext("u1", { email: OWNER, email_verified: false }).firestore();
    await assertFails(getDoc(doc(unverified, "users/u1")));
  });

  it("blocks the owner from another uid's tree", async () => {
    await assertFails(getDoc(doc(owner(), "users/u9/workouts/w1")));
  });

  it("keeps AI usage counters server-only", async () => {
    await assertFails(setDoc(doc(owner(), "users/u1/aiUsage/2026-10-19"), { count: 0 }));
  });
});
