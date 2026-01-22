# Kata 3 — Token Bucket Rate Limiter (Retry-After + TTL Cleanup)

## Context / Product requirements

You’re building a backend rate limiter used by an API gateway. The limiter must:

- support per-key limits (per apiKey/userId),
- allow bursts up to capacity,
- refill smoothly over time,
- return a useful `retryAfterMs` when rejecting,
- avoid unbounded memory growth by cleaning up inactive keys.

This is intentionally small enough for CoderPad but high-signal for systems thinking.

---

## Goal

Implement a correct token bucket limiter with O(1) per call.

---

## API (TypeScript)

```ts
export type AllowRequest = {
  key: string;
  nowMs: number;
  cost?: number; // default 1
};

export type AllowResponse =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: number; retryAfterMs: number };

export class TokenBucketLimiter {
  constructor(
    readonly capacity: number,
    readonly refillPerSec: number,
    readonly idleTtlMs: number = 15 * 60 * 1000
  ) {}

  allow(req: AllowRequest): AllowResponse {
    throw new Error("TODO");
  }
}
```

---

## Validation

Throw `Error("INVALID_ARGUMENT: <message>")` on invalid input.

- `key`: trimmed, non-empty
- `nowMs`: finite number
- `capacity`: integer >= 1
- `refillPerSec`: finite number > 0
- `cost`: integer >= 1 (default 1)

---

## Token math (precise)

Each key has state:

- `tokens` (number, may be fractional)
- `lastRefillMs` (number)
- `lastSeenMs` (number)

On each `allow({key, nowMs, cost})`:

1) If the key has no state, initialize:
   - `tokens = capacity`
   - `lastRefillMs = nowMs`
   - `lastSeenMs = nowMs`

2) Refill:
   - `elapsedMs = max(0, nowMs - lastRefillMs)`
   - `tokens = min(capacity, tokens + (elapsedMs/1000) * refillPerSec)`
   - `lastRefillMs = nowMs`

3) Decision:
   - If `tokens >= cost`:
     - `tokens -= cost`
     - return `allowed: true` with `remaining = floor(tokens)`
   - Else:
     - return `allowed: false`

4) `retryAfterMs` (when rejected):

Let `needed = cost - tokens` (positive).

- If `refillPerSec <= 0`, treat as non-retryable (but validation prevents this).
- `retryAfterMs = ceil((needed / refillPerSec) * 1000)`
- `remaining = floor(tokens)`

5) Update `lastSeenMs = nowMs`.

---

## Idle key cleanup

If a key has not been seen for `idleTtlMs`:

- it may be removed from memory.

You may implement cleanup:

- lazily during `allow()` (check and delete stale state), or
- periodically if you prefer.

---

## Clock behavior

If `nowMs` goes backwards (clock skew):

- treat `elapsedMs = 0` (no refill) to avoid minting extra tokens.

---

## Tests you should write

- Allows up to capacity immediately.
- Refills over time.
- `retryAfterMs` correctness for known cases.
- Different keys independent.
- Clock skew does not increase tokens.
- Idle cleanup removes state after TTL.

---

## Follow-up ladder (do not implement unless asked)

1) Per-plan limits (capacity/refill depend on key prefix).
2) Distributed limiter discussion (Redis) without implementing.
3) Fairness under high concurrency (locking/sharding).
