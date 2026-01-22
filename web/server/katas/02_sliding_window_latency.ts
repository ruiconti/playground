/**
 * Kata 02 - Sliding Window Latency Metrics
 *
 * A component that ingests measurements and answers windowed percentile queries
 * for a latency dashboard. Supports rate calculations and p50/p95 percentiles.
 */

export type Measurement = {
  tsMs: number; // event timestamp
  userId: string; // tenant/user identifier
  latencyMs: number; // >= 0
};

export type QueryRequest = {
  windowSec: 10 | 60 | 300;
  nowMs: number; // caller provided (do not use Date.now in query)
  userId?: string; // optional filter
};

export type QueryResponse = {
  count: number;
  ratePerSec: number; // count / windowSec
  p50: number; // exact for v1
  p95: number; // exact for v1
};

export class LatencyMetrics {
  private measurements: Measurement[] = [];

  /**
   * Add a measurement to the store
   * @throws Error if input is invalid
   */
  add(m: Measurement): void {
    // Validate userId: trimmed, non-empty
    if (typeof m.userId !== "string" || m.userId.trim() === "") {
      throw new Error("INVALID_ARGUMENT: userId must be a non-empty string");
    }

    // Validate tsMs: finite number
    if (typeof m.tsMs !== "number" || !Number.isFinite(m.tsMs)) {
      throw new Error("INVALID_ARGUMENT: tsMs must be a finite number");
    }

    // Validate latencyMs: finite number >= 0
    if (
      typeof m.latencyMs !== "number" ||
      !Number.isFinite(m.latencyMs) ||
      m.latencyMs < 0
    ) {
      throw new Error(
        "INVALID_ARGUMENT: latencyMs must be a finite number >= 0"
      );
    }

    this.measurements.push({
      tsMs: m.tsMs,
      userId: m.userId.trim(),
      latencyMs: m.latencyMs,
    });
  }

  /**
   * Query metrics for a given time window
   * @throws Error if input is invalid
   */
  query(q: QueryRequest): QueryResponse {
    // Validate nowMs: finite number
    if (typeof q.nowMs !== "number" || !Number.isFinite(q.nowMs)) {
      throw new Error("INVALID_ARGUMENT: nowMs must be a finite number");
    }

    // Validate userId if provided
    if (q.userId !== undefined) {
      if (typeof q.userId !== "string" || q.userId.trim() === "") {
        throw new Error("INVALID_ARGUMENT: userId must be a non-empty string");
      }
    }

    const windowMs = q.windowSec * 1000;
    const lowerBound = q.nowMs - windowMs;
    const upperBound = q.nowMs;

    // Filter measurements: tsMs > lowerBound AND tsMs <= upperBound
    const filtered = this.measurements.filter((m) => {
      const inWindow = m.tsMs > lowerBound && m.tsMs <= upperBound;
      const matchesUser =
        q.userId === undefined || m.userId === q.userId.trim();
      return inWindow && matchesUser;
    });

    const count = filtered.length;

    if (count === 0) {
      return {
        count: 0,
        ratePerSec: 0,
        p50: 0,
        p95: 0,
      };
    }

    // Extract latency values and sort for percentile calculation
    const latencies = filtered.map((m) => m.latencyMs).sort((a, b) => a - b);

    return {
      count,
      ratePerSec: count / q.windowSec,
      p50: this.percentileNearestRank(latencies, 0.5),
      p95: this.percentileNearestRank(latencies, 0.95),
    };
  }

  /**
   * Calculate percentile using the nearest-rank method
   * rank(p) = ceil(p * n) - 1, clamped to [0, n-1]
   */
  private percentileNearestRank(sortedValues: number[], p: number): number {
    const n = sortedValues.length;
    if (n === 0) return 0;

    const rank = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
    return sortedValues[rank];
  }
}
