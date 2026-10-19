// Firestore security rules tests (run with the emulator: npm run test:rules).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

describe.skipIf(!hasEmulator)("firestore.rules (multi-user)", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: "demo-ironlog", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  });
  afterAll(() => env?.cleanup());
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "catalog/exercises"), { items: [{ id: "x" }] });
      await setDoc(doc(db, "users/alice"), { displayName: "A" });
      await setDoc(doc(db, "users/alice/workouts/w1"), { date: "2026-10-19" });
      await setDoc(doc(db, "users/alice/aiChats/main/messages/m1"), { text: "hola" });
      await setDoc(doc(db, "users/bob/workouts/w1"), { date: "2026-10-19" });
      await setDoc(doc(db, "system/aiUsage-2026-10-19"), { count: 1 });
    });
  });

  const user = (uid: string, token: Record<string, unknown> = {}) =>
    env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: "password" }, ...token }).firestore();

  it("an owner reads and writes their own data", async () => {
    const a = user("alice");
    await assertSucceeds(getDoc(doc(a, "users/alice")));
    await assertSucceeds(setDoc(doc(a, "users/alice"), { displayName: "Alice" }, { merge: true }));
    await assertSucceeds(setDoc(doc(a, "users/alice/workouts/w2"), { date: "2026-10-20" }));
    await assertSucceeds(getDocs(collection(a, "users/alice/workouts")));
    await assertSucceeds(deleteDoc(doc(a, "users/alice/workouts/w2")));
    await assertSucceeds(getDoc(doc(a, "users/alice/aiChats/main/messages/m1")));
  });

  it("a user cannot read or write another user's data", async () => {
    const b = user("bob");
    await assertFails(getDoc(doc(b, "users/alice")));
    await assertFails(getDoc(doc(b, "users/alice/workouts/w1")));
    await assertFails(getDocs(collection(b, "users/alice/workouts")));
    await assertFails(setDoc(doc(b, "users/alice/workouts/w9"), { date: "x" }));
    await assertFails(deleteDoc(doc(b, "users/alice/workouts/w1")));
    await assertFails(getDoc(doc(b, "users/alice/aiChats/main/messages/m1")));
  });

  it("an admin has no special access to other users' data", async () => {
    const admin = user("boss", { admin: true });
    await assertFails(getDoc(doc(admin, "users/alice")));
    await assertFails(getDocs(collection(admin, "users/alice/workouts")));
    await assertFails(getDoc(doc(admin, "system/aiUsage-2026-10-19")));
  });

  it("blocks unauthenticated and unverified-email accounts", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/alice")));
    await assertFails(getDoc(doc(anon, "catalog/exercises")));
    const unverified = user("alice", { email_verified: false });
    await assertFails(getDoc(doc(unverified, "users/alice")));
  });

  it("Google accounts count as verified", async () => {
    const g = user("alice", { email_verified: false, firebase: { sign_in_provider: "google.com" } });
    await assertSucceeds(getDoc(doc(g, "users/alice")));
  });

  it("the catalog is read-only for signed-in users", async () => {
    const a = user("alice");
    await assertSucceeds(getDoc(doc(a, "catalog/exercises")));
    await assertFails(setDoc(doc(a, "catalog/exercises"), { items: [] }));
  });

  it("quota counters and chat transcripts are server-only", async () => {
    const a = user("alice");
    await assertFails(setDoc(doc(a, "users/alice/aiUsage/2026-10-19"), { count: 0 }));
    await assertFails(setDoc(doc(a, "users/alice/aiChats/main/messages/m2"), { text: "x" }));
    await assertFails(setDoc(doc(a, "system/aiUsage-2026-10-19"), { count: 0 }));
  });

  it("the profile document cannot be deleted from the client", async () => {
    await assertFails(deleteDoc(doc(user("alice"), "users/alice")));
  });
});
