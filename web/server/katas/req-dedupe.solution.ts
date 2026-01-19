// ## Problem 1: Request Deduplication Cache
//
// You're building a service that proxies expensive LLM API calls. Multiple clients may request the same prompt simultaneously.
// You should only make one actual API call and share the result.
//
// **Requirements**:
//
// 1. `POST /complete` with body `{"prompt": "..."}` returns `{"response": "...", "cached": boolean}`.
// 2. If the same prompt is currently in-flight, wait for that request to complete and return the same result
// 3. If the prompt was completed recently (within TTL), return cached result
// 4. If the prompt is new, call the (simulated) LLM API and cache the result
// 5. Concurrent requests for the same prompt should NOT trigger multiple LLM calls
//
// **What this tests:**
// - Handling concurrent requests to the same resource
// - Promise/async coordination (sharing a single in-flight promise)
// - Cache with TTL
// - State management across requests
//
// **Extensions:**
// 1. Add a max cache size with LRU eviction
// 2. Add cache invalidation endpoint `DELETE /cache/:promptHash`
// 3. Handle LLM failures gracefully (don't cache errors, allow retry)

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CompleteRequest = { prompt: string };
export type CompleteResponse = { response: string; cached: boolean };
export type CacheStats = { hits: number; misses: number; inFlight: number; size: number };

export interface LLMApi {
    complete(prompt: string): Promise<string>;
}

export interface DedupeCache {
    complete(request: CompleteRequest): Promise<CompleteResponse>;
    invalidate(promptHash: string): Promise<boolean>;
    getStats(): CacheStats;
}

export interface DedupeCacheOptions {
    ttlMs: number;
    maxSize?: number;
}

// =============================================================================
// STUB IMPLEMENTATION
// =============================================================================

export function hashPrompt(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        const char = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

export function createDedupeCache(llm: LLMApi, options: DedupeCacheOptions): DedupeCache & {
    _cache: Map<string, { response: string; expiresAt: number }>;
    _inFlight: Map<string, Promise<string>>;
} {
    const cache = new Map<string, { response: string; expiresAt: number }>();
    const inFlight = new Map<string, Promise<string>>();
    let hits = 0;
    let misses = 0;

    return {
        _cache: cache,
        _inFlight: inFlight,

        async complete(request: CompleteRequest): Promise<CompleteResponse> {
            const hash = hashPrompt(request.prompt);

            const cached = cache.get(hash);
            if (cached && cached.expiresAt > Date.now()) {
                hits++;
                return { response: cached.response, cached: true };
            }

            const existing = inFlight.get(hash);
            if (existing) {
                hits++;
                const response = await existing;
                return { response, cached: true };
            }

            misses++;
            const promise = llm.complete(request.prompt);
            inFlight.set(hash, promise);

            try {
                const response = await promise;
                cache.set(hash, { response, expiresAt: Date.now() + options.ttlMs });
                return { response, cached: false };
            } finally {
                inFlight.delete(hash);
            }
        },

        async invalidate(promptHash: string): Promise<boolean> {
            return cache.delete(promptHash);
        },

        getStats(): CacheStats {
            return {
                hits,
                misses,
                inFlight: inFlight.size,
                size: cache.size
            };
        }
    };
}
