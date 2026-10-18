"use client";

import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseConfigured, getClientAuth } from "@/lib/firebase/client";
import { DEMO_UID, isDemo } from "@/lib/demo";

const demoUser = {
  uid: DEMO_UID,
  email: null,
  displayName: "Demo",
  getIdToken: async () => "demo",
} as unknown as User;

type Status = "loading" | "signed_out" | "signed_in" | "denied" | "unconfigured";

interface AuthCtx {
  status: Status;
  user: User | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const allowKey = (uid: string) => `ironlog:allowed:${uid}`;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* storage unavailable: ignore */
  }
}

/** Asks the server whether this account is on the allowlist. Offline → trust a cached "yes". */
async function checkAllowed(user: User): Promise<boolean> {
  const cached = safeGet(allowKey(user.uid)) === "1";
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/auth/check", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 403) return false;
    if (res.ok) {
      safeSet(allowKey(user.uid), "1");
      return true;
    }
    return cached || res.status >= 500; // server misconfigured: Firestore rules still protect data
  } catch {
    return true; // offline: the Firestore rules are the real gate
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(isDemo || firebaseConfigured ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      // Set after mount so nothing time-dependent renders during prerender.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(demoUser);
      setStatus("signed_in");
      return;
    }
    if (!firebaseConfigured) return;
    const auth = getClientAuth();
    getRedirectResult(auth).catch((e) => setError(friendlyAuthError(e)));
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setStatus("signed_out");
        return;
      }
      setUser(u);
      setStatus(safeGet(allowKey(u.uid)) === "1" ? "signed_in" : "loading");
      const ok = await checkAllowed(u);
      if (!ok) {
        safeSet(allowKey(u.uid), null);
        await fbSignOut(auth);
        setUser(null);
        setStatus("denied");
        return;
      }
      setStatus("signed_in");
    });
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    if (isDemo) return;
    const auth = getClientAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    try {
      // Installed PWAs (especially iOS) handle popups poorly; use redirect there.
      if (standalone) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(friendlyAuthError(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isDemo) return;
    await fbSignOut(getClientAuth());
  }, []);

  const value = useMemo(() => ({ status, user, error, signIn, signOut }), [status, user, error, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code.includes("network")) return "Sin conexión. Conéctate para iniciar sesión por primera vez.";
  if (code.includes("unauthorized-domain")) return "Este dominio no está autorizado en Firebase Auth (Ajustes → Dominios autorizados).";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** Fetch helper for our API routes: attaches the Firebase ID token. */
export async function authedFetch(user: User, input: string, init: RequestInit = {}): Promise<Response> {
  const token = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}
