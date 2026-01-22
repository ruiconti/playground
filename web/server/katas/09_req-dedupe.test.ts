import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    createDedupeCache,
    hashPrompt,
    type LLMApi,
    type DedupeCache,
    type DedupeCacheOptions,
} from './09_req-dedupe';
import { isExtensionsEnabled } from './test_utils';

const describeExt = isExtensionsEnabled() ? describe : describe.skip;

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockLLM(options: {
    delay?: number;
    responses?: Map<string, string>;
    failPrompts?: Set<string>;
} = {}): LLMApi & { callCount: number; callHistory: string[] } {
    const { delay = 50, responses = new Map(), failPrompts = new Set() } = options;
    let callCount = 0;
    const callHistory: string[] = [];

    return {
        get callCount() { return callCount; },
        get callHistory() { return callHistory; },
        async complete(prompt: string): Promise<string> {
            callCount++;
            callHistory.push(prompt);

            await new Promise(resolve => setTimeout(resolve, delay));

            if (failPrompts.has(prompt)) {
                throw new Error('LLM API error');
            }

            return responses.get(prompt) ?? `Response to: ${prompt}`;
        }
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// TEST SUITE: Basic Request Flow
// =============================================================================

describe('Basic Request Flow', () => {
    let llm: ReturnType<typeof createMockLLM>;
    let cache: ReturnType<typeof createDedupeCache>;

    beforeEach(() => {
        llm = createMockLLM({ delay: 10 });
        cache = createDedupeCache(llm, { ttlMs: 5000 });
    });

    describe('New request handling', () => {
        it('should call LLM for new prompt', async () => {
            const result = await cache.complete({ prompt: 'Hello' });

            expect(llm.callCount).toBe(1);
            expect(result.response).toBe('Response to: Hello');
        });

        it('should return cached: false for new requests', async () => {
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(false);
        });

        it('should return the LLM response', async () => {
            llm = createMockLLM({
                delay: 10,
                responses: new Map([['test prompt', 'custom response']])
            });
            cache = createDedupeCache(llm, { ttlMs: 5000 });

            const result = await cache.complete({ prompt: 'test prompt' });

            expect(result.response).toBe('custom response');
        });
    });

    describe('Response format', () => {
        it('should return object with response and cached properties', async () => {
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result).toHaveProperty('response');
            expect(result).toHaveProperty('cached');
            expect(typeof result.response).toBe('string');
            expect(typeof result.cached).toBe('boolean');
        });
    });
});

// =============================================================================
// TEST SUITE: Cache Hit Behavior
// =============================================================================

describe('Cache Hit Behavior', () => {
    let llm: ReturnType<typeof createMockLLM>;
    let cache: ReturnType<typeof createDedupeCache>;

    beforeEach(() => {
        llm = createMockLLM({ delay: 10 });
        cache = createDedupeCache(llm, { ttlMs: 5000 });
    });

    describe('Recent request caching', () => {
        it('should return cached result for repeated prompt within TTL', async () => {
            await cache.complete({ prompt: 'Hello' });
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(true);
            expect(llm.callCount).toBe(1);
        });

        it('should return same response for cached request', async () => {
            const first = await cache.complete({ prompt: 'Hello' });
            const second = await cache.complete({ prompt: 'Hello' });

            expect(second.response).toBe(first.response);
        });

        it('should not call LLM again for cached request', async () => {
            await cache.complete({ prompt: 'Hello' });
            await cache.complete({ prompt: 'Hello' });
            await cache.complete({ prompt: 'Hello' });

            expect(llm.callCount).toBe(1);
        });
    });

    describe('Different prompts isolation', () => {
        it('should cache different prompts separately', async () => {
            await cache.complete({ prompt: 'Hello' });
            await cache.complete({ prompt: 'Goodbye' });

            expect(llm.callCount).toBe(2);
        });

        it('should return correct cached response for each prompt', async () => {
            llm = createMockLLM({
                delay: 10,
                responses: new Map([
                    ['prompt1', 'response1'],
                    ['prompt2', 'response2']
                ])
            });
            cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'prompt1' });
            await cache.complete({ prompt: 'prompt2' });

            const result1 = await cache.complete({ prompt: 'prompt1' });
            const result2 = await cache.complete({ prompt: 'prompt2' });

            expect(result1.response).toBe('response1');
            expect(result2.response).toBe('response2');
            expect(result1.cached).toBe(true);
            expect(result2.cached).toBe(true);
        });
    });
});

// =============================================================================
// TEST SUITE: TTL Expiration
// =============================================================================

describe('TTL Expiration', () => {
    let originalDateNow: typeof Date.now;

    beforeEach(() => {
        originalDateNow = Date.now;
    });

    afterEach(() => {
        Date.now = originalDateNow;
    });

    describe('Cache expiration', () => {
        it('should return cached result before TTL expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });

            Date.now = () => baseTime + 4999;
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(true);
            expect(llm.callCount).toBe(1);
        });

        it('should fetch fresh result after TTL expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });

            Date.now = () => baseTime + 5001;
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(false);
            expect(llm.callCount).toBe(2);
        });

        it('should handle very short TTL', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 1 });

            await cache.complete({ prompt: 'Hello' });
            await delay(5);
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(false);
        });

        it('should handle zero TTL (no caching)', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 0 });

            await cache.complete({ prompt: 'Hello' });

            Date.now = () => baseTime + 1;
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(false);
            expect(llm.callCount).toBe(2);
        });
    });

    describe('TTL boundary conditions', () => {
        it('should not return cached at exactly TTL boundary', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });

            Date.now = () => baseTime + 5000;
            const result = await cache.complete({ prompt: 'Hello' });

            expect(result.cached).toBe(false);
        });
    });
});

// =============================================================================
// TEST SUITE: Request Deduplication (In-Flight Sharing)
// =============================================================================

describe('Request Deduplication (In-Flight Sharing)', () => {
    describe('Concurrent identical requests', () => {
        it('should only make one LLM call for concurrent identical requests', async () => {
            const llm = createMockLLM({ delay: 100 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const promises = [
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' })
            ];

            await Promise.all(promises);

            expect(llm.callCount).toBe(1);
        });

        it('should return same response to all concurrent requests', async () => {
            const llm = createMockLLM({
                delay: 100,
                responses: new Map([['Hello', 'shared response']])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const [result1, result2, result3] = await Promise.all([
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' })
            ]);

            expect(result1.response).toBe('shared response');
            expect(result2.response).toBe('shared response');
            expect(result3.response).toBe('shared response');
        });

        it('should mark first request as not cached, others as cached', async () => {
            const llm = createMockLLM({ delay: 100 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const results = await Promise.all([
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Hello' })
            ]);

            const notCachedCount = results.filter(r => !r.cached).length;
            const cachedCount = results.filter(r => r.cached).length;

            expect(notCachedCount).toBe(1);
            expect(cachedCount).toBe(2);
        });

        it('should handle many concurrent requests', async () => {
            const llm = createMockLLM({ delay: 50 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const promises = Array(100).fill(null).map(() =>
                cache.complete({ prompt: 'Hello' })
            );

            await Promise.all(promises);

            expect(llm.callCount).toBe(1);
        });
    });

    describe('Concurrent different requests', () => {
        it('should make separate LLM calls for different prompts', async () => {
            const llm = createMockLLM({ delay: 50 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await Promise.all([
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Goodbye' }),
                cache.complete({ prompt: 'Test' })
            ]);

            expect(llm.callCount).toBe(3);
        });

        it('should return correct response for each concurrent request', async () => {
            const llm = createMockLLM({
                delay: 50,
                responses: new Map([
                    ['Hello', 'Hello response'],
                    ['Goodbye', 'Goodbye response']
                ])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const [hello, goodbye] = await Promise.all([
                cache.complete({ prompt: 'Hello' }),
                cache.complete({ prompt: 'Goodbye' })
            ]);

            expect(hello.response).toBe('Hello response');
            expect(goodbye.response).toBe('Goodbye response');
        });
    });

    describe('In-flight state cleanup', () => {
        it('should remove request from in-flight after completion', async () => {
            const llm = createMockLLM({ delay: 50 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });

            expect(cache._inFlight.size).toBe(0);
        });

        it('should allow new LLM call after in-flight completes and TTL expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 100 });

            await cache.complete({ prompt: 'Hello' });
            expect(llm.callCount).toBe(1);

            Date.now = () => baseTime + 200;
            await cache.complete({ prompt: 'Hello' });
            expect(llm.callCount).toBe(2);

            Date.now = () => 1000000;
        });
    });
});

// =============================================================================
// TEST SUITE: Error Handling
// =============================================================================

describe('Error Handling', () => {
    describe('LLM API failures', () => {
        it('should propagate LLM errors to caller', async () => {
            const llm = createMockLLM({
                delay: 10,
                failPrompts: new Set(['bad prompt'])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await expect(cache.complete({ prompt: 'bad prompt' }))
                .rejects.toThrow('LLM API error');
        });

        it('should not cache failed requests', async () => {
            const llm = createMockLLM({
                delay: 10,
                failPrompts: new Set(['bad prompt'])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            try {
                await cache.complete({ prompt: 'bad prompt' });
            } catch {
                // Expected
            }

            expect(cache._cache.size).toBe(0);
        });

        it('should allow retry after failed request', async () => {
            const failOnFirst = { count: 0 };
            const llm: LLMApi & { callCount: number } = {
                callCount: 0,
                async complete(prompt: string): Promise<string> {
                    this.callCount++;
                    failOnFirst.count++;
                    if (failOnFirst.count === 1) {
                        throw new Error('Temporary failure');
                    }
                    return `Response to: ${prompt}`;
                }
            };
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            try {
                await cache.complete({ prompt: 'test' });
            } catch {
                // Expected first failure
            }

            const result = await cache.complete({ prompt: 'test' });
            expect(result.response).toBe('Response to: test');
            expect(llm.callCount).toBe(2);
        });

        it('should remove failed request from in-flight state', async () => {
            const llm = createMockLLM({
                delay: 10,
                failPrompts: new Set(['bad prompt'])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            try {
                await cache.complete({ prompt: 'bad prompt' });
            } catch {
                // Expected
            }

            expect(cache._inFlight.size).toBe(0);
        });

        it('should propagate error to all waiting concurrent requests', async () => {
            const llm = createMockLLM({
                delay: 100,
                failPrompts: new Set(['bad prompt'])
            });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const promises = [
                cache.complete({ prompt: 'bad prompt' }),
                cache.complete({ prompt: 'bad prompt' }),
                cache.complete({ prompt: 'bad prompt' })
            ];

            const results = await Promise.allSettled(promises);

            results.forEach(result => {
                expect(result.status).toBe('rejected');
            });

            expect(llm.callCount).toBe(1);
        });
    });

    describe('Input validation', () => {
        it('should handle empty prompt', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const result = await cache.complete({ prompt: '' });

            expect(result.response).toBeDefined();
        });

        it('should handle very long prompts', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const longPrompt = 'a'.repeat(10000);
            const result = await cache.complete({ prompt: longPrompt });

            expect(result.response).toBeDefined();
        });

        it('should handle prompts with special characters', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const result = await cache.complete({ prompt: '{"json": "value"}\n\ttabs\r\nwindows' });

            expect(result.response).toBeDefined();
        });

        it('should handle unicode prompts', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const result = await cache.complete({ prompt: '\u65E5\u672C\u8A9E emoji \uD83C\uDF89' });

            expect(result.response).toBeDefined();
        });
    });
});

// =============================================================================
// TEST SUITE: Cache Invalidation Extension
// =============================================================================

describeExt('Cache Invalidation Extension', () => {
    describe('DELETE /cache/:promptHash', () => {
        it('should invalidate cached entry', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });
            expect(cache._cache.size).toBe(1);

            const hash = hashPrompt('Hello');
            const result = await cache.invalidate(hash);

            expect(result).toBe(true);
            expect(cache._cache.size).toBe(0);
        });

        it('should return false for non-existent hash', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const result = await cache.invalidate('nonexistent');

            expect(result).toBe(false);
        });

        it('should allow fresh LLM call after invalidation', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            await cache.complete({ prompt: 'Hello' });
            expect(llm.callCount).toBe(1);

            const hash = hashPrompt('Hello');
            await cache.invalidate(hash);

            await cache.complete({ prompt: 'Hello' });
            expect(llm.callCount).toBe(2);
        });
    });
});

// =============================================================================
// TEST SUITE: Hash Function
// =============================================================================

describe('Hash Function', () => {
    it('should produce consistent hashes for same input', () => {
        const hash1 = hashPrompt('Hello');
        const hash2 = hashPrompt('Hello');

        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
        const hash1 = hashPrompt('Hello');
        const hash2 = hashPrompt('World');

        expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
        const hash = hashPrompt('');

        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
    });

    it('should handle unicode', () => {
        const hash = hashPrompt('\u65E5\u672C\u8A9E');

        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
    });
});

// =============================================================================
// TEST SUITE: Cache Stats
// =============================================================================

describe('Cache Stats', () => {
    it('should track cache size', async () => {
        const llm = createMockLLM({ delay: 10 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        expect(cache.getStats().size).toBe(0);

        await cache.complete({ prompt: 'Hello' });
        expect(cache.getStats().size).toBe(1);

        await cache.complete({ prompt: 'World' });
        expect(cache.getStats().size).toBe(2);
    });

    it('should track in-flight count', async () => {
        const llm = createMockLLM({ delay: 100 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        expect(cache.getStats().inFlight).toBe(0);

        const promise = cache.complete({ prompt: 'Hello' });

        // Give it a moment to start
        await delay(10);
        expect(cache.getStats().inFlight).toBe(1);

        await promise;
        expect(cache.getStats().inFlight).toBe(0);
    });
});

// =============================================================================
// TEST SUITE: Stress and Performance Tests
// =============================================================================

describe('Stress and Performance Tests', () => {
    describe('High concurrency', () => {
        it('should handle 1000 concurrent requests for same prompt', async () => {
            const llm = createMockLLM({ delay: 100 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const promises = Array(1000).fill(null).map(() =>
                cache.complete({ prompt: 'same' })
            );

            const results = await Promise.all(promises);

            expect(llm.callCount).toBe(1);
            expect(results.every(r => r.response === results[0].response)).toBe(true);
        });

        it('should handle 100 different prompts concurrently', async () => {
            const llm = createMockLLM({ delay: 10 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const promises = Array(100).fill(null).map((_, i) =>
                cache.complete({ prompt: `prompt${i}` })
            );

            const results = await Promise.all(promises);

            expect(llm.callCount).toBe(100);
            expect(results.every(r => !r.cached)).toBe(true);
        });

        it('should handle mixed same and different prompts concurrently', async () => {
            const llm = createMockLLM({ delay: 50 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            const prompts = ['a', 'a', 'b', 'b', 'c', 'a', 'b', 'c', 'd', 'd'];
            const promises = prompts.map(p => cache.complete({ prompt: p }));

            await Promise.all(promises);

            expect(llm.callCount).toBe(4);
        });
    });

    describe('Sequential load', () => {
        it('should handle 100 sequential requests efficiently', async () => {
            const llm = createMockLLM({ delay: 5 });
            const cache = createDedupeCache(llm, { ttlMs: 5000 });

            for (let i = 0; i < 100; i++) {
                await cache.complete({ prompt: 'same' });
            }

            expect(llm.callCount).toBe(1);
        });
    });
});

// =============================================================================
// TEST SUITE: Requirements Compliance
// =============================================================================

describe('Requirements Compliance', () => {
    it('REQUIREMENT: POST /complete returns {"response": "...", "cached": boolean}', async () => {
        const llm = createMockLLM({ delay: 10 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        const result = await cache.complete({ prompt: 'Hello' });

        expect(result).toMatchObject({
            response: expect.any(String),
            cached: expect.any(Boolean)
        });
    });

    it('REQUIREMENT: In-flight requests share result instead of making duplicate calls', async () => {
        const llm = createMockLLM({ delay: 100 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        await Promise.all([
            cache.complete({ prompt: 'Hello' }),
            cache.complete({ prompt: 'Hello' }),
            cache.complete({ prompt: 'Hello' })
        ]);

        expect(llm.callCount).toBe(1);
    });

    it('REQUIREMENT: Recently completed requests return cached result', async () => {
        const llm = createMockLLM({ delay: 10 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        await cache.complete({ prompt: 'Hello' });
        const result = await cache.complete({ prompt: 'Hello' });

        expect(result.cached).toBe(true);
    });

    it('REQUIREMENT: New prompts call the LLM API', async () => {
        const llm = createMockLLM({ delay: 10 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        const result = await cache.complete({ prompt: 'Hello' });

        expect(result.cached).toBe(false);
        expect(llm.callCount).toBe(1);
    });

    it('REQUIREMENT: Concurrent requests for same prompt do NOT trigger multiple LLM calls', async () => {
        const llm = createMockLLM({ delay: 100 });
        const cache = createDedupeCache(llm, { ttlMs: 5000 });

        const promises = Array(10).fill(null).map(() =>
            cache.complete({ prompt: 'concurrent test' })
        );

        await Promise.all(promises);

        expect(llm.callCount).toBe(1);
    });
});
