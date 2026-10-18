import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT no está configurada");
  // Base64-encoded service-account JSON (keeps newlines in the private key intact).
  const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  app = initializeApp({ credential: cert(json), projectId: json.project_id });
  return app;
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
