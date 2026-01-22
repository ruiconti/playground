export type ErrorCode = "INVALID_ARGUMENT" | "RESOURCE_EXHAUSTED";

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

type CacheEntry<V> = {
  value: V;
  expiresAt?: number;
  lastSeenAt: number;
}

export class SingleFlightCache<V> {
  cache = new Map<string, CacheEntry<V>>();
  inflight = new Map<string, Promise<V>>();

  constructor(
    readonly maxEntries: number,
    readonly maxInflight: number = 100
  ) { }

  get(key: string, nowMs: number): V | undefined {
    const existing = this.cache.get(key);
    if (!existing) return undefined;

    if (existing.expiresAt && existing.expiresAt <= nowMs) {
      this.cache.delete(key);
      return undefined;
    }

    existing.lastSeenAt = nowMs;
    this.cache.set(key, existing)
    return existing.value;
  }

  put(key: string, value: V, nowMs: number, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      const sorted = Array.from(this.cache.entries()).sort(([keyA, valA], [keyB, valB]) => valA.lastSeenAt - valB.lastSeenAt)
      const [leastRecentlySeenKey] = sorted[0];
      this.cache.delete(leastRecentlySeenKey);
    }

    this.cache.set(key, { value, expiresAt: ttlMs ? nowMs + ttlMs : undefined, lastSeenAt: nowMs})
  }

  getOrCompute(
    key: string,
    nowMs: number,
    ttlMs: number,
    compute: () => Promise<V>
  ): Promise<V> {
    const existing = this.cache.get(key);
    if (existing) {
      return Promise.resolve(existing.value);
    }

    const inflight = this.inflight.get(key);
    if (inflight) {
      return inflight;
    }

    if (this.inflight.size >= this.maxInflight) {
      return Promise.reject(new ApiError("RESOURCE_EXHAUSTED", "RESOURCE_EXHAUSTED"));
    }

    const start = Date.now();
    const promise = compute()
      .then(value => {
        const elapsedMs = Date.now() - start;
        const nowAtCompletion = nowMs + elapsedMs;
        this.put(key, value, nowAtCompletion, ttlMs);
        this.inflight.delete(key);
        return value;
      })
      .catch(error => {
        this.inflight.delete(key)
        throw error;
      })

    this.inflight.set(key, promise);
    return promise;
  }

  size(nowMs: number): number {
    return this.cache.size;
  }
} 