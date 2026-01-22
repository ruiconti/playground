# Kata 2 — Sliding Window Latency Metrics (Streaming + Percentiles)

## Context / Product requirements

You’re building the backend logic behind a latency dashboard for a developer tool.

A high-volume stream of measurements arrives continuously. The UI queries for “last N seconds” metrics to display:

- rate (events/sec)
- p50 and p95 latency

The system must be correct, handle time windows, and be able to evolve to bounded-memory approximations.

---

## Goal

Implement a component that ingests measurements and answers windowed percentile queries.

---

## API (TypeScript)

```ts
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
    throw new Error("TODO");
  }

  query(q: QueryRequest): QueryResponse {
    throw new Error("TODO");
  }
}
```

---

## Validation

On invalid input, throw `Error("INVALID_ARGUMENT: <message>")`.

- `userId`: trimmed, non-empty
- `latencyMs`: finite number, `>= 0`
- `tsMs`: finite number
- `nowMs`: finite number

---

## Window semantics

A measurement is included in a query window iff:

- `tsMs > nowMs - windowSec*1000` AND `tsMs <= nowMs`

If `userId` is provided in the query, only include that user.

If no measurements in window:

- `count = 0`, `ratePerSec = 0`, `p50 = 0`, `p95 = 0`

---

## Percentile definition

For v1, compute exact percentiles by sorting the in-window `latencyMs` values.

Use this deterministic selection rule:

- Let `n = values.length`.
- Let `rank(p) = ceil(p * n) - 1` (0-indexed), clamped to `[0, n-1]`.
- Then:
  - `p50 = valuesSorted[rank(0.50)]`
  - `p95 = valuesSorted[rank(0.95)]`

(This yields common “nearest-rank” behavior and avoids interpolation ambiguity.)

---

## Performance expectations

- `add()` should be amortized O(1).
- v1 `query()` may be O(k log k) due to sorting `k` window values.
- You must be able to describe how to improve (see follow-ups).

---

## Out-of-order events

For v1, you may assume events can be out-of-order and still be accepted.

**But** the query window must be based on `tsMs` (event time), not arrival order.

---

## Tests you should write

- Empty query window yields zeros.
- Basic fixed set where p50/p95 are known.
- User filter correctness.
- Window boundary correctness (strict > lower bound, <= upper bound).
- Deterministic percentile rank rule.

---

## Follow-up ladder (do not implement unless asked)

1) Avoid scanning all history: maintain per-window deques and incremental aggregates.
2) Approximate p95 with histogram buckets (bounded memory).
3) Support “lateness”: drop events older than `nowMs - window - 5s`.
