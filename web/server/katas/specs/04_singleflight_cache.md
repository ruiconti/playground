# Kata 4 — SingleFlight Cache (LRU + TTL + Suppress Duplicate Work)

## Context / Product requirements

You’re building a backend cache for expensive computations (e.g., indexing a file, computing embeddings, reading metadata).

Requirements:

- Cache results with TTL.
- Evict least-recently-used entries when capacity is exceeded.
- Prevent “thundering herd”: if many callers request the same missing key concurrently, run the computation **once** and share the same in-flight promise.

This is a common high-bar backend primitive (Go’s singleflight) adapted to TypeScript.

---

## Goal

Implement a cache that supports:

- `get/put` with LRU+TTL
- `getOrCompute` with singleflight behavior

---

## API (TypeScript)

```ts
export type ErrorCode = "INVALID_ARGUMENT" | "RESOURCE_EXHAUSTED";

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

export class SingleFlightCache<V> {
  constructor(
    readonly maxEntries: number,
    readonly maxInflight: number = 100
  ) {}

  get(key: string, nowMs: number): V | undefined {
    throw new Error("TODO");
  }

  put(key: string, value: V, nowMs: number, ttlMs?: number): void {
    throw new Error("TODO");
  }

  getOrCompute(
    key: string,
    nowMs: number,
    ttlMs: number,
    compute: () => Promise<V>
  ): Promise<V> {
    throw new Error("TODO");
  }

  size(nowMs: number): number {
    throw new Error("TODO");
  }
}
```

---

## Validation

Throw `new ApiError("INVALID_ARGUMENT", "...")` on invalid input.

- `key`: trimmed, non-empty
- `nowMs`: finite number
- `maxEntries`: integer >= 1
- `ttlMs` for `put`/`getOrCompute`: integer > 0 (if provided)
- `maxInflight`: integer >= 1

---

## Semantics

### TTL

- Each entry may have an expiration time `expiresAtMs`.
- An entry is valid iff `expiresAtMs` is undefined OR `nowMs < expiresAtMs`.
- Expired entries behave as missing and should be removed lazily.

### LRU

- Any successful `get` makes the entry most-recently-used.
- Any `put` makes the entry most-recently-used.
- If after `put` the cache exceeds `maxEntries`, evict least-recently-used entries until size is within limit.

### getOrCompute

When calling `getOrCompute(key, nowMs, ttlMs, compute)`:

1) If a **valid cached value** exists, return it immediately.

2) If an in-flight compute already exists for this key:
   - return the same promise.

3) Otherwise:
   - if total number of in-flight keys >= `maxInflight`, throw `new ApiError("RESOURCE_EXHAUSTED", "too many inflight")`.
   - create an in-flight promise for this key by calling `compute()` exactly once.
   - when it resolves:
     - store the value in cache with TTL `ttlMs` (expiresAt = nowMs_at_completion + ttlMs)
     - clear the in-flight entry
     - resolve all waiters
   - when it rejects:
     - clear the in-flight entry
     - propagate the rejection

Important: `expiresAtMs` for the computed value should be based on the completion time (the `nowMs` you capture when the promise settles), not the call time.

---

## Performance expectations

- `get` and `put` should be O(1).
- Use the classic LRU approach: Map + doubly linked list.
- Singleflight tracking should be a Map from key -> Promise.

---

## Tests you should write

- LRU eviction order correctness.
- TTL expiration removes entries.
- `getOrCompute` calls `compute()` once under concurrency:
  - create 50 promises calling `getOrCompute` on same key
  - assert compute invoked once
  - assert all resolved values equal
- Rejected compute clears inflight and allows retry.
- maxInflight enforcement.

---

## Follow-up ladder (do not implement unless asked)

1) Negative caching (cache errors for short TTL).
2) Per-key locking and sharding for multi-threaded environments.
3) Add `invalidate(prefix)` and discuss complexity.
