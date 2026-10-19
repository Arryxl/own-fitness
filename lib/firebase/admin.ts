import "server-only";
import { cert, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;
let credential: Credential | undefined;

// With FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set (tests), no
// service account is needed and nothing touches the real project.
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  if (emulated) {
    app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-ironlog" });
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT no está configurada");
  // Base64-encoded service-account JSON (keeps newlines in the private key intact).
  const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  credential = cert(json);
  app = initializeApp({ credential, projectId: json.project_id });
  return app;
}

export function adminCredential(): Credential | undefined {
  adminApp();
  return credential;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}
