export type AllowRequest = {
  key: string;
  nowMs: number;
  cost?: number; // default 1
};

export type AllowResponse =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: number; retryAfterMs: number };

type TokenBucket = {
    capacity: number;
    lastConsumedAtMs: number;
}

export class TokenBucketLimiter {
    buckets = new Map<string, TokenBucket>();
    refillPerMs: number;

  constructor(
    readonly capacity: number,
    readonly refillPerSec: number,
    readonly idleTTLMs: number = 15 * 60 * 1000
  ) {
    if (capacity <= 0) {
        throw new Error("INVALID ARGUMENT: capacity must be greater than 0");
    }
    if (refillPerSec <= 0) {
        throw new Error("INVALID ARGUMENT: refillPerSec must be greater than 0");
    }
    if (idleTTLMs <= 0) {
        throw new Error("INVALID ARGUMENT: idleTTLMs must be greater than 0");
    }
    // if refillPerSec is 10; refillPerMs will be 10 / 1000 = 0.01 i.e., for each 1ms, 0.01 tokens are refilled
    this.refillPerMs = refillPerSec / 1000;
  }

  private gc(nowMs: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
        const elapsedMs = nowMs - bucket.lastConsumedAtMs;
        if (elapsedMs > this.idleTTLMs) {
            this.buckets.delete(key);
        }
    }
  }

  allow(req: AllowRequest): AllowResponse {
    // each consumer has an associated key, that has a token bucket associated with it 
    // - a token bucket is consumed by `allow` calls
    //   -> `cost` means the number of tokens that are consumed by the request
    // - a token is refilled, over time, if and only if the bucket is being *actively used*
    //   -> we don't want to introduce timers to handle this; each time that `allow` is called, we calculate the number of tokens that should be refilled since last `allow` call
    //
    // each `allow` call needs to:
    // 1. decide whether the request is allowed
    // 2. if allowed, consume the tokens and update the bucket state
    // 3. if not allowed, return _when_ this request can be retried, taking into account lastRefilledAtMs and the refill rate
    //
    // separately, we need to garbage collect idle token buckets; for this, it's fine to use timers and not run on the hot path
    this.gc(req.nowMs); // could be scheudled
    let bucket = this.buckets.get(req.key);
    const cost = req.cost ?? 1;

    // first time!
    if (!bucket) {
        // the cost exceeds the bucket capacity - it will never be allowed
        if (cost > this.capacity) {
            return { allowed: false, remaining: this.capacity, retryAfterMs: -1 /* -1 means never */ }
        }

        const remaining = this.capacity - cost;
        bucket = { capacity: remaining, lastConsumedAtMs: req.nowMs }
        this.buckets.set(req.key, bucket);
        return { allowed: true, remaining }
    }

    // subsequent calls; calculate refill
    const elapsedMs = (req.nowMs - bucket.lastConsumedAtMs);
    const refillCandidate = elapsedMs * this.refillPerMs;
    const currentCapacity = Math.min(refillCandidate + bucket.capacity, this.capacity)
    if (cost > currentCapacity) {
        const diff = cost - currentCapacity;
        const retryAfterMs = Math.ceil(diff / this.refillPerMs)
        return { allowed: false, remaining: currentCapacity, retryAfterMs }
    }

    const remaining = currentCapacity - cost;
    bucket.capacity = remaining;
    bucket.lastConsumedAtMs = req.nowMs;
    return { allowed: true, remaining }
  }
}
