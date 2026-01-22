// ## Problem: Sliding Window Latency Metrics
//
// You're building the backend logic behind a latency dashboard for a developer tool.
// A high-volume stream of measurements arrives continuously. The UI queries for
// "last N seconds" metrics to display rate (events/sec) and p50/p95 latency.
//
// **Requirements:**
//
// - `add(m: Measurement)` ingests a latency measurement with timestamp and userId
// - `query(q: QueryRequest)` returns metrics for a time window: count, ratePerSec, p50, p95
// - Window semantics: include measurements where `tsMs > nowMs - windowSec*1000` AND `tsMs <= nowMs`
// - Optional userId filter in queries
// - If no measurements in window: count=0, ratePerSec=0, p50=0, p95=0
//
// **Percentile definition (nearest-rank):**
// ```
// Let n = values.length
// Let rank(p) = ceil(p * n) - 1 (0-indexed), clamped to [0, n-1]
// p50 = valuesSorted[rank(0.50)]
// p95 = valuesSorted[rank(0.95)]
// ```
//
// **Validation:**
// Throw `Error("INVALID_ARGUMENT: <message>")` for:
// - Empty or whitespace-only userId
// - Non-finite tsMs or nowMs
// - Negative latencyMs
//
// **What this tests:**
// - Streaming data ingestion
// - Sliding window aggregation
// - Percentile computation
// - Handling out-of-order events by event time (not arrival time)
//
// **Extensions:**
// 1. Avoid scanning all history: maintain per-window deques and incremental aggregates
// 2. Approximate p95 with histogram buckets (bounded memory)
// 3. Support "lateness": drop events older than nowMs - window - 5s
//
// NOTE: Spec details in ./specs/02_sliding_window_latency.md

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Measurement = {
    tsMs: number;      // event timestamp
    userId: string;    // tenant/user identifier
    latencyMs: number; // >= 0
};

export type QueryRequest = {
    windowSec: 10 | 60 | 300;
    nowMs: number;     // caller provided (do not use Date.now in query)
    userId?: string;   // optional filter
};

export type QueryResponse = {
    count: number;
    ratePerSec: number; // count / windowSec
    p50: number;        // exact for v1
    p95: number;        // exact for v1
};

export class LatencyMetrics {
    add(m: Measurement): void {
        throw new Error('NotImplemented');
    }

    query(q: QueryRequest): QueryResponse {
        throw new Error('NotImplemented');
    }
}
