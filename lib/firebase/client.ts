// Browser-side Firebase. Firestore uses a persistent IndexedDB cache shared
// across tabs so workouts can be logged without signal and sync later.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function ensureApp(): FirebaseApp {
  if (typeof window === "undefined") throw new Error("Firebase client SDK is browser-only");
  if (!firebaseConfigured) throw new Error("Firebase no está configurado (faltan variables NEXT_PUBLIC_FIREBASE_*)");
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getClientAuth(): Auth {
  auth ??= getAuth(ensureApp());
  return auth;
}

export function getDb(): Firestore {
  db ??= initializeFirestore(ensureApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  return db;
}
