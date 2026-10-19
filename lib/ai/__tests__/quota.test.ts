import { describe, expect, it } from "vitest";
import { checkBurst, quotaDecision } from "../quota";

const limits = { userRequests: 3, userTokens: 1000, globalRequests: 10 };

describe("AI quotas", () => {
  it("allows requests under every limit", () => {
    expect(quotaDecision({ requests: 2, tokens: 999, globalRequests: 9 }, limits)).toBe("ok");
  });
  it("blocks at the per-user request limit", () => {
    expect(quotaDecision({ requests: 3, tokens: 0, globalRequests: 0 }, limits)).toBe("user_requests");
  });
  it("blocks at the per-user token limit", () => {
    expect(quotaDecision({ requests: 0, tokens: 1000, globalRequests: 0 }, limits)).toBe("user_tokens");
  });
  it("the global cap wins over everything", () => {
    expect(quotaDecision({ requests: 0, tokens: 0, globalRequests: 10 }, limits)).toBe("global");
  });
  it("rate-limits bursts per key in a sliding window", () => {
    const store = new Map<string, number[]>();
    expect([0, 1, 2].map((i) => checkBurst(store, "u", 1000 + i, 3))).toEqual([true, true, true]);
    expect(checkBurst(store, "u", 1500, 3)).toBe(false);
    expect(checkBurst(store, "other", 1500, 3)).toBe(true);
    expect(checkBurst(store, "u", 1000 + 61_000, 3)).toBe(true); // window passed
  });
});
