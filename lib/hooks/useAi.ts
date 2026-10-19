"use client";

import { useCallback } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { useOptionalData } from "@/components/providers/DataProvider";
import { todayISO } from "@/lib/analytics/dates";

export class AiClientError extends Error {}

export const AI_TIER = process.env.NEXT_PUBLIC_GEMINI_TIER === "paid" ? "paid" : "free";

/** With the free tier the AI only runs if the user accepted the AI consent. */
export function useAiEnabled(): { enabled: boolean; reason: string | null } {
  const data = useOptionalData();
  const accepted = !!data?.profile?.aiConsent?.accepted;
  if (AI_TIER === "free" && !accepted) return { enabled: false, reason: "Activa el coach de IA en Ajustes (requiere tu consentimiento)." };
  return { enabled: true, reason: null };
}

/** Calls one of our /api/ai/* endpoints with the user's token and local date. */
export function useAiPost() {
  const { user } = useAuth();
  return useCallback(
    async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
      if (!user) throw new AiClientError("Inicia sesión de nuevo.");
      if (!navigator.onLine) throw new AiClientError("Sin conexión: la IA necesita internet. Tus datos se guardan igual.");
      const res = await authedFetch(user, path, { method: "POST", body: JSON.stringify({ ...body, today: todayISO() }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new AiClientError((json as { error?: string }).error ?? "Error de la IA");
      return json as T;
    },
    [user],
  );
}
