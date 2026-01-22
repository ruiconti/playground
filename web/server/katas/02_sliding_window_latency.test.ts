// Update the import path if your implementation file is named differently.
import { describe, it, expect } from "bun:test";
import { LatencyMetrics } from "./02_sliding_window_latency";

function percentileNearestRank(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const rank = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return sorted[rank];
}

describe("Sliding Window Latency Metrics", () => {
  it("empty window yields zeros", () => {
    const m = new LatencyMetrics();
    const res = m.query({ windowSec: 60, nowMs: 10_000 });
    expect(res).toEqual({ count: 0, ratePerSec: 0, p50: 0, p95: 0 });
  });

  it("window boundaries: strict > lower bound and <= upper bound", () => {
    const m = new LatencyMetrics();
    // Window is (now-60s, now]
    const now = 100_000;
    const lower = now - 60_000;
    m.add({ tsMs: lower, userId: "u", latencyMs: 10 }); // excluded (not >)
    m.add({ tsMs: lower + 1, userId: "u", latencyMs: 20 }); // included
    m.add({ tsMs: now, userId: "u", latencyMs: 30 }); // included
    const res = m.query({ windowSec: 60, nowMs: now });
    expect(res.count).toBe(2);
  });

  it("basic percentiles follow nearest-rank rule", () => {
    const m = new LatencyMetrics();
    const now = 1_000_000;
    const vals = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    vals.forEach((v, i) => m.add({ tsMs: now - 1000 + i, userId: "u", latencyMs: v }));

    const res = m.query({ windowSec: 60, nowMs: now, userId: "u" });
    expect(res.count).toBe(vals.length);
    expect(res.p50).toBe(percentileNearestRank(vals, 0.5));
    expect(res.p95).toBe(percentileNearestRank(vals, 0.95));
    expect(res.ratePerSec).toBe(vals.length / 60);
  });

  it("user filter works", () => {
    const m = new LatencyMetrics();
    const now = 50_000;
    m.add({ tsMs: now - 1000, userId: "a", latencyMs: 10 });
    m.add({ tsMs: now - 900, userId: "b", latencyMs: 1000 });
    m.add({ tsMs: now - 800, userId: "a", latencyMs: 20 });
    const resA = m.query({ windowSec: 60, nowMs: now, userId: "a" });
    expect(resA.count).toBe(2);
    expect(resA.p50).toBe(10);
    const resAll = m.query({ windowSec: 60, nowMs: now });
    expect(resAll.count).toBe(3);
  });

  it("out-of-order arrivals still counted based on tsMs", () => {
    const m = new LatencyMetrics();
    const now = 100_000;
    m.add({ tsMs: now - 10, userId: "u", latencyMs: 30 });
    m.add({ tsMs: now - 20, userId: "u", latencyMs: 10 });
    m.add({ tsMs: now - 15, userId: "u", latencyMs: 20 });
    const res = m.query({ windowSec: 10, nowMs: now });
    expect(res.count).toBe(3);
    expect(res.p50).toBe(20);
    expect(res.p95).toBe(30);
  });

  it("validation throws on bad input", () => {
    const m = new LatencyMetrics();
    expect(() => m.add({ tsMs: 0, userId: "", latencyMs: 1 })).toThrow(/INVALID_ARGUMENT/);
    expect(() => m.add({ tsMs: NaN, userId: "u", latencyMs: 1 })).toThrow(/INVALID_ARGUMENT/);
    expect(() => m.add({ tsMs: 0, userId: "u", latencyMs: -1 })).toThrow(/INVALID_ARGUMENT/);
    expect(() => m.query({ windowSec: 60, nowMs: NaN })).toThrow(/INVALID_ARGUMENT/);
  });
});
