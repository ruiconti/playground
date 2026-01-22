// Update the import path if your implementation file is named differently.
import { describe, it, expect } from "bun:test";
import { TokenBucketLimiter } from "./03_token_bucket_limiter";

describe("Token Bucket Limiter", () => {
  it("allows up to capacity immediately", () => {
    const lim = new TokenBucketLimiter(3, 1);
    const t = 0;
    expect(lim.allow({ key: "k", nowMs: t }).allowed).toBe(true);
    expect(lim.allow({ key: "k", nowMs: t }).allowed).toBe(true);
    expect(lim.allow({ key: "k", nowMs: t }).allowed).toBe(true);
    const res = lim.allow({ key: "k", nowMs: t });
    expect(res.allowed).toBe(false);
  });

  it("refills over time and retryAfterMs is correct", () => {
    const lim = new TokenBucketLimiter(1, 1); // 1 token capacity, 1 token/sec
    const t0 = 0;
    expect(lim.allow({ key: "k", nowMs: t0 }).allowed).toBe(true);
    const r0 = lim.allow({ key: "k", nowMs: t0 });
    expect(r0.allowed).toBe(false);
    expect(r0.retryAfterMs).toBe(1000);

    // After 500ms, still not enough (needs 0.5 more tokens -> 500ms)
    const r1 = lim.allow({ key: "k", nowMs: 500 });
    expect(r1.allowed).toBe(false);
    expect(r1.retryAfterMs).toBe(500);

    // After 1000ms total, should allow
    const r2 = lim.allow({ key: "k", nowMs: 1000 });
    expect(r2.allowed).toBe(true);
  });

  it("cost > 1 consumes multiple tokens", () => {
    const lim = new TokenBucketLimiter(10, 10); // fast refill; irrelevant
    const t0 = 0;
    const a = lim.allow({ key: "k", nowMs: t0, cost: 3 });
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(7);
  });

  it("different keys are independent", () => {
    const lim = new TokenBucketLimiter(1, 1);
    expect(lim.allow({ key: "a", nowMs: 0 }).allowed).toBe(true);
    expect(lim.allow({ key: "a", nowMs: 0 }).allowed).toBe(false);
    expect(lim.allow({ key: "b", nowMs: 0 }).allowed).toBe(true);
  });

  it("clock skew (time goes backwards) does not mint extra tokens", () => {
    const lim = new TokenBucketLimiter(1, 1);
    expect(lim.allow({ key: "k", nowMs: 1000 }).allowed).toBe(true);
    expect(lim.allow({ key: "k", nowMs: 1000 }).allowed).toBe(false);

    // Go backwards: should still be rejected (elapsed treated as 0)
    const r = lim.allow({ key: "k", nowMs: 900 });
    expect(r.allowed).toBe(false);
  });

  it("idle cleanup removes stale state", () => {
    const lim = new TokenBucketLimiter(1, 1, 1000); // 1s idle ttl
    expect(lim.allow({ key: "k", nowMs: 0 }).allowed).toBe(true);
    expect(lim.allow({ key: "k", nowMs: 0 }).allowed).toBe(false);

    // After TTL, state may be removed; next call should behave like fresh key (full capacity)
    const r = lim.allow({ key: "k", nowMs: 2000 });
    expect(r.allowed).toBe(true);
  });

  it("validation throws on bad input", () => {
    expect(() => new TokenBucketLimiter(0 as any, 1)).toThrow(/INVALID_ARGUMENT/);
    expect(() => new TokenBucketLimiter(1, 0)).toThrow(/INVALID_ARGUMENT/);

    const lim = new TokenBucketLimiter(1, 1);
    expect(() => lim.allow({ key: "", nowMs: 0 })).toThrow(/INVALID_ARGUMENT/);
    expect(() => lim.allow({ key: "k", nowMs: NaN })).toThrow(/INVALID_ARGUMENT/);
    expect(() => lim.allow({ key: "k", nowMs: 0, cost: 0 })).toThrow(/INVALID_ARGUMENT/);
  });
});
