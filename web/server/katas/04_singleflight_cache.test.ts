// Update the import path if your implementation file is named differently.
import { describe, it, expect } from "bun:test";
import { SingleFlightCache, ApiError } from "./04_singleflight_cache";

describe("SingleFlight Cache", () => {
  it("put/get basic with TTL", () => {
    const c = new SingleFlightCache<number>(2);
    c.put("a", 1, 0, 1000);
    expect(c.get("a", 0)).toBe(1);
    // expired at 1000 => nowMs < 1000 is valid, nowMs == 1000 invalid
    expect(c.get("a", 999)).toBe(1);
    expect(c.get("a", 1000)).toBeUndefined();
  });

  it("LRU eviction: least-recently-used is evicted", () => {
    const c = new SingleFlightCache<number>(2);
    c.put("a", 1, 0, 10_000);
    c.put("b", 2, 0, 10_000);
    // touch a so b becomes LRU
    expect(c.get("a", 1)).toBe(1);
    c.put("c", 3, 0, 10_000);
    expect(c.get("b", 0)).toBeUndefined();
    expect(c.get("a", 0)).toBe(1);
    expect(c.get("c", 0)).toBe(3);
  });

  it("getOrCompute runs compute once for concurrent callers", async () => {
    const c = new SingleFlightCache<number>(10);
    let calls = 0;
    let resolve!: (v: number) => void;
    const p = new Promise<number>((r) => (resolve = r));

    const compute = () => {
      calls++;
      return p;
    };

    const reqs = Array.from({ length: 50 }, () => c.getOrCompute("k", 0, 5000, compute));
    expect(calls).toBe(1);

    resolve(42);
    const vals = await Promise.all(reqs);
    expect(new Set(vals).size).toBe(1);
    expect(vals[0]).toBe(42);

    // Now cached: should not call compute again
    const v2 = await c.getOrCompute("k", 100, 5000, () => {
      calls++;
      return Promise.resolve(7);
    });
    expect(v2).toBe(42);
    expect(calls).toBe(1);
  });

  it("rejection clears inflight and allows retry", async () => {
    const c = new SingleFlightCache<number>(10);
    let calls = 0;

    await expect(
      c.getOrCompute("k", 0, 1000, () => {
        calls++;
        return Promise.reject(new Error("boom"));
      })
    ).rejects.toThrow(/boom/);

    // Next call should invoke compute again (inflight cleared)
    const v = await c.getOrCompute("k", 0, 1000, () => {
      calls++;
      return Promise.resolve(123);
    });
    expect(v).toBe(123);
    expect(calls).toBe(2);
  });

  it("maxInflight enforced", async () => {
    const c = new SingleFlightCache<number>(10, 2);

    let r1!: (v: number) => void;
    let r2!: (v: number) => void;
    const p1 = new Promise<number>((r) => (r1 = r));
    const p2 = new Promise<number>((r) => (r2 = r));

    const a = c.getOrCompute("a", 0, 1000, () => p1);
    const b = c.getOrCompute("b", 0, 1000, () => p2);

    // Third inflight should throw RESOURCE_EXHAUSTED
    await expect(
      c.getOrCompute("c", 0, 1000, () => Promise.resolve(1))
    ).rejects.toThrow(/RESOURCE_EXHAUSTED|too many inflight/);

    r1(1);
    r2(2);
    await Promise.all([a, b]);
  });

  it("validation throws ApiError on invalid input", () => {
    expect(() => new SingleFlightCache<number>(0 as any)).toThrow(/INVALID_ARGUMENT/);
    const c = new SingleFlightCache<number>(1);
    expect(() => c.get("", 0)).toThrow(/INVALID_ARGUMENT/);
    expect(() => c.put("a", 1, 0, 0)).toThrow(/INVALID_ARGUMENT/);
  });
});
