"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseConfigured, getClientAuth } from "@/lib/firebase/client";

type Status = "loading" | "signed_out" | "unverified" | "signed_in" | "unconfigured";

interface AuthCtx {
  status: Status;
  user: User | null;
  isAdmin: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, alias: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Google accounts are verified by Google; email/password accounts must confirm their address. */
function isVerified(u: User): boolean {
  return u.emailVerified || u.providerData.some((p) => p.providerId === "google.com");
}

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
    "auth/user-disabled": "Esta cuenta está bloqueada. Si crees que es un error, contacta al administrador.",
    "auth/network-request-failed": "Sin conexión. Conéctate para iniciar sesión.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Auth (Ajustes → Dominios autorizados).",
    "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.",
  };
  return map[code] ?? "No se pudo completar la acción. Intenta de nuevo.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(firebaseConfigured ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = getClientAuth();
    getRedirectResult(auth).catch((e) => setError(friendlyAuthError(e)));
    return onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setStatus("signed_out");
        return;
      }
      try {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } catch {
        setIsAdmin(false);
      }
      setStatus(isVerified(u) ? "signed_in" : "unverified");
    });
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(friendlyAuthError(e));
      return false;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const auth = getClientAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
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

  const signInWithEmail = useCallback((email: string, password: string) => run(() => signInWithEmailAndPassword(getClientAuth(), email.trim(), password)), [run]);

  const signUpWithEmail = useCallback(
    (email: string, password: string, alias: string) =>
      run(async () => {
        if (password.length < 8) throw { code: "auth/weak-password" };
        const cred = await createUserWithEmailAndPassword(getClientAuth(), email.trim(), password);
        if (alias.trim()) await updateProfile(cred.user, { displayName: alias.trim().slice(0, 40) });
        await sendEmailVerification(cred.user, { url: `${window.location.origin}/` });
      }),
    [run],
  );

  const resetPassword = useCallback(
    (email: string) => run(() => sendPasswordResetEmail(getClientAuth(), email.trim(), { url: `${window.location.origin}/login` })),
    [run],
  );

  const resendVerification = useCallback(
    () =>
      run(async () => {
        const u = getClientAuth().currentUser;
        if (u) await sendEmailVerification(u, { url: `${window.location.origin}/` });
      }),
    [run],
  );

  const refreshUser = useCallback(async () => {
    const u = getClientAuth().currentUser;
    if (!u) return;
    await u.reload();
    // Force a fresh token so Firestore rules see email_verified = true.
    await u.getIdToken(true);
    setUser(getClientAuth().currentUser);
    setStatus(isVerified(u) ? "signed_in" : "unverified");
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getClientAuth());
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isAdmin,
      error,
      clearError: () => setError(null),
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      resendVerification,
      refreshUser,
      signOut,
    }),
    [status, user, isAdmin, error, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, resendVerification, refreshUser, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
