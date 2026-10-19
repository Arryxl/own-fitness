// Pure quota logic (unit-tested). Storage lives in rate-limit.ts.

export interface QuotaLimits {
  userRequests: number;
  userTokens: number;
  globalRequests: number;
}

export interface QuotaUsage {
  requests: number;
  tokens: number;
  globalRequests: number;
}

export type QuotaDecision = "ok" | "user_requests" | "user_tokens" | "global";

export function quotaDecision(usage: QuotaUsage, limits: QuotaLimits): QuotaDecision {
  if (usage.globalRequests >= limits.globalRequests) return "global";
  if (usage.requests >= limits.userRequests) return "user_requests";
  if (usage.tokens >= limits.userTokens) return "user_tokens";
  return "ok";
}

/** Sliding one-minute window. Returns false when the key is over `max`. Mutates `store`. */
export function checkBurst(store: Map<string, number[]>, key: string, now: number, max: number, windowMs = 60_000): boolean {
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    store.set(key, hits);
    return false;
  }
  hits.push(now);
  store.set(key, hits);
  // Keep memory bounded on long-lived instances.
  if (store.size > 5000) for (const [k, v] of store) if (!v.some((t) => now - t < windowMs)) store.delete(k);
  return true;
}
