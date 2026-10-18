import "server-only";
import { GoogleGenAI } from "@google/genai";

// Model IDs come from env so they can change without a deploy of code.
// Verified against the Gemini docs and the models list on 2026-10-18.
export const MODELS = {
  primary: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  fallback: process.env.GEMINI_MODEL_FALLBACK || "gemini-3.5-flash-lite",
  embedding: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
};

/** Hard ceiling per AI request so we answer before Vercel Hobby's 60 s limit. */
export const AI_DEADLINE_MS = 50_000;

let client: GoogleGenAI | null = null;
export function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new AiError("config", "Falta GEMINI_API_KEY en el servidor.");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export type AiErrorKind = "rate_limit" | "unavailable" | "timeout" | "config" | "bad_output" | "other";

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

function statusOf(e: unknown): number | null {
  const x = e as { status?: unknown; statusCode?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [x?.status, x?.statusCode, x?.code, x?.response?.status]) if (typeof v === "number") return v;
  const m = String((e as Error)?.message ?? "").match(/\b(429|500|502|503|504)\b/);
  return m ? Number(m[1]) : null;
}

export function classify(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const name = (e as Error)?.name ?? "";
  if (name === "AbortError" || name === "RequestTimeoutError" || name === "TimeoutError") return new AiError("timeout", "La IA tardó demasiado en responder. Intenta de nuevo con una pregunta más corta.");
  const s = statusOf(e);
  const msg = String((e as Error)?.message ?? "");
  if (s === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return new AiError("rate_limit", "Límite de la IA alcanzado por ahora. Intenta más tarde (la cuota diaria se reinicia a medianoche del Pacífico).");
  if (s && s >= 500) return new AiError("unavailable", "El servicio de IA no está disponible en este momento. Tus datos están a salvo; intenta en unos minutos.");
  return new AiError("other", "No se pudo completar la solicitud a la IA.");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn(model)` with exponential backoff on 429/5xx, then retries once on
 * the fallback model. Never retries past the deadline.
 */
export async function withModelFallback<T>(fn: (model: string) => Promise<T>, opts: { deadline: number; retries?: number }): Promise<{ result: T; model: string }> {
  const retries = opts.retries ?? 2;
  let last: AiError | null = null;
  for (const model of [MODELS.primary, MODELS.fallback]) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return { result: await fn(model), model };
      } catch (e) {
        last = classify(e);
        if (last.kind !== "rate_limit" && last.kind !== "unavailable") throw last;
        const wait = 700 * 3 ** attempt + Math.random() * 300;
        if (Date.now() + wait > opts.deadline - 5000) break;
        await sleep(wait);
      }
    }
  }
  throw last ?? new AiError("other", "Error de IA");
}

export function deadlineSignal(deadline: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
}
