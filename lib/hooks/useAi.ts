"use client";

import { useCallback } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { todayISO } from "@/lib/analytics/dates";
import { isDemo } from "@/lib/demo";

export class AiClientError extends Error {}

/** Calls one of our /api/ai/* endpoints with the user's token and local date. */
export function useAiPost() {
  const { user } = useAuth();
  return useCallback(
    async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
      if (isDemo) throw new AiClientError("La IA no está disponible en el modo demo (necesita Firebase y la clave de Gemini en el servidor).");
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
