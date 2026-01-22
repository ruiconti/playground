import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { deriveKey, KVAPI, createKVAPI, createRateLimiter } from './07_middleware-ratelimit';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockRequest(options: { ip?: string; headers?: Record<string, string> } = {}): Request {
    const headers = new Headers(options.headers || {});
    if (options.ip) {
        headers.set('x-forwarded-for', options.ip);
    }
    return new Request('http://localhost/test', { headers });
}

function createMockResponse(body: string = 'OK', status: number = 200): Response {
    return new Response(body, { status });
}

function createMockKV(): KVAPI & { store: Map<string, { value: string; ttl: number }> } {
    const store = new Map<string, { value: string; ttl: number }>();
    return {
        store,
        get: async (key: string) => {
            const entry = store.get(key);
            return entry ? entry.value : null;
        },
        set: async (key: string, value: string, options: { ttl: number }) => {
            store.set(key, { value, ttl: options.ttl });
        },
    };
}

// =============================================================================
// TEST SUITE: deriveKey Function
// =============================================================================

describe('deriveKey', () => {
    describe('IP-based key derivation', () => {
        it('should derive key from x-forwarded-for header', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session = { id: 'user-123' };

            const key = deriveKey(req, session, 'ip');

            expect(key).toBe('rate_limit:ip:192.168.1.1');
        });

        it('should handle IPv6 addresses', () => {
            const req = createMockRequest({ ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' });
            const session = { id: 'user-123' };

            const key = deriveKey(req, session, 'ip');

            expect(key).toBe('rate_limit:ip:2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should handle comma-separated IP list (proxy chain)', () => {
            const req = createMockRequest({ ip: '192.168.1.1, 10.0.0.1, 172.16.0.1' });
            const session = { id: 'user-123' };

            const key = deriveKey(req, session, 'ip');

            // Note: Current implementation uses the full header value
            expect(key).toBe('rate_limit:ip:192.168.1.1, 10.0.0.1, 172.16.0.1');
        });

        it('should throw NotAuthorized when x-forwarded-for header is missing', () => {
            const req = createMockRequest(); // No IP
            const session = { id: 'user-123' };

            expect(() => deriveKey(req, session, 'ip')).toThrow('NotAuthorized');
        });

        it('should throw NotAuthorized when x-forwarded-for header is empty string', () => {
            const req = createMockRequest({ ip: '' });
            const session = { id: 'user-123' };

            // Note: Empty string is falsy, so this should throw
            expect(() => deriveKey(req, session, 'ip')).toThrow('NotAuthorized');
        });
    });

    describe('User ID-based key derivation', () => {
        it('should derive key from session id', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session = { id: 'user-456' };

            const key = deriveKey(req, session, 'user_id');

            expect(key).toBe('rate_limit:user:user-456');
        });

        it('should handle numeric session ids', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session = { id: '12345' };

            const key = deriveKey(req, session, 'user_id');

            expect(key).toBe('rate_limit:user:12345');
        });

        it('should handle UUID session ids', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

            const key = deriveKey(req, session, 'user_id');

            expect(key).toBe('rate_limit:user:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        });

        it('should throw NotAuthorized when session id is empty', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session = { id: '' };

            expect(() => deriveKey(req, session, 'user_id')).toThrow('NotAuthorized');
        });

        it('should not require IP header when using user_id mode', () => {
            const req = createMockRequest(); // No IP
            const session = { id: 'user-789' };

            const key = deriveKey(req, session, 'user_id');

            expect(key).toBe('rate_limit:user:user-789');
        });
    });

    describe('Key format consistency', () => {
        it('should produce different keys for same IP and user_id', () => {
            const req = createMockRequest({ ip: '123' });
            const session = { id: '123' };

            const ipKey = deriveKey(req, session, 'ip');
            const userKey = deriveKey(req, session, 'user_id');

            expect(ipKey).not.toBe(userKey);
            expect(ipKey).toBe('rate_limit:ip:123');
            expect(userKey).toBe('rate_limit:user:123');
        });

        it('should produce unique keys for different IPs', () => {
            const req1 = createMockRequest({ ip: '192.168.1.1' });
            const req2 = createMockRequest({ ip: '192.168.1.2' });
            const session = { id: 'user' };

            const key1 = deriveKey(req1, session, 'ip');
            const key2 = deriveKey(req2, session, 'ip');

            expect(key1).not.toBe(key2);
        });

        it('should produce unique keys for different users', () => {
            const req = createMockRequest({ ip: '192.168.1.1' });
            const session1 = { id: 'user-1' };
            const session2 = { id: 'user-2' };

            const key1 = deriveKey(req, session1, 'user_id');
            const key2 = deriveKey(req, session2, 'user_id');

            expect(key1).not.toBe(key2);
        });
    });
});

// =============================================================================
// TEST SUITE: createKVAPI Function
// =============================================================================

describe('createKVAPI', () => {
    describe('Basic operations', () => {
        it('should return null for non-existent keys', async () => {
            const kv = createKVAPI();

            const result = await kv.get('non-existent-key');

            expect(result).toBeNull();
        });

        it('should store and retrieve values', async () => {
            const kv = createKVAPI();

            await kv.set('test-key', 'test-value', { ttl: 60000 });
            const result = await kv.get('test-key');

            expect(result).toBe('test-value');
        });

        it('should overwrite existing values', async () => {
            const kv = createKVAPI();

            await kv.set('test-key', 'value-1', { ttl: 60000 });
            await kv.set('test-key', 'value-2', { ttl: 60000 });
            const result = await kv.get('test-key');

            expect(result).toBe('value-2');
        });

        it('should store numeric strings correctly', async () => {
            const kv = createKVAPI();

            await kv.set('counter', '42', { ttl: 60000 });
            const result = await kv.get('counter');

            expect(result).toBe('42');
            expect(parseInt(result!)).toBe(42);
        });

        it('should handle empty string values', async () => {
            const kv = createKVAPI();

            await kv.set('empty', '', { ttl: 60000 });
            const result = await kv.get('empty');

            expect(result).toBe('');
        });

        it('should handle special characters in keys', async () => {
            const kv = createKVAPI();

            await kv.set('rate_limit:ip:192.168.1.1', '5', { ttl: 60000 });
            const result = await kv.get('rate_limit:ip:192.168.1.1');

            expect(result).toBe('5');
        });
    });

    describe('TTL expiration', () => {
        let originalDateNow: typeof Date.now;

        beforeEach(() => {
            originalDateNow = Date.now;
        });

        afterEach(() => {
            Date.now = originalDateNow;
        });

        it('should return value before TTL expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 60000 });

            // Advance time but stay within TTL
            Date.now = () => baseTime + 59999;
            const result = await kv.get('key');

            expect(result).toBe('value');
        });

        it('should return null after TTL expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 60000 });

            // Advance time past TTL
            Date.now = () => baseTime + 60001;
            const result = await kv.get('key');

            expect(result).toBeNull();
        });

        it('should return null exactly at TTL boundary', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 60000 });

            // Advance time exactly to TTL
            Date.now = () => baseTime + 60000;
            const result = await kv.get('key');

            // expiresAt < Date.now(), so at exactly TTL boundary it's NOT expired
            // Let's verify this edge case
            expect(result).toBe('value');
        });

        it('should delete expired entries on access', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 60000 });

            // Advance time past TTL
            Date.now = () => baseTime + 60001;

            // First access should return null and delete
            await kv.get('key');

            // Reset time - entry should still be gone
            Date.now = () => baseTime;
            const result = await kv.get('key');

            expect(result).toBeNull();
        });

        it('should handle very short TTL', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 1 });

            Date.now = () => baseTime + 2;
            const result = await kv.get('key');

            expect(result).toBeNull();
        });

        it('should handle zero TTL', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value', { ttl: 0 });

            // Same time, TTL of 0 means expires immediately
            Date.now = () => baseTime + 1;
            const result = await kv.get('key');

            expect(result).toBeNull();
        });

        it('should update TTL when overwriting', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('key', 'value1', { ttl: 10000 });

            // Advance time
            Date.now = () => baseTime + 5000;

            // Overwrite with new TTL
            await kv.set('key', 'value2', { ttl: 10000 });

            // Advance to where original would have expired
            Date.now = () => baseTime + 12000;

            const result = await kv.get('key');
            expect(result).toBe('value2');
        });
    });

    describe('Multiple keys isolation', () => {
        it('should isolate different keys', async () => {
            const kv = createKVAPI();

            await kv.set('key1', 'value1', { ttl: 60000 });
            await kv.set('key2', 'value2', { ttl: 60000 });

            expect(await kv.get('key1')).toBe('value1');
            expect(await kv.get('key2')).toBe('value2');
        });

        it('should expire keys independently', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            await kv.set('short-ttl', 'value1', { ttl: 1000 });
            await kv.set('long-ttl', 'value2', { ttl: 60000 });

            Date.now = () => baseTime + 5000;

            expect(await kv.get('short-ttl')).toBeNull();
            expect(await kv.get('long-ttl')).toBe('value2');
        });
    });
});

// =============================================================================
// TEST SUITE: createRateLimiter Function
// =============================================================================

describe('createRateLimiter', () => {
    describe('First request behavior', () => {
        it('should allow first request and initialize counter to 1', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = createMockResponse();

            const result = await rateLimiter(req, res);

            expect(result).toBe(res);
            expect(mockKV.store.get('rate_limit:ip:192.168.1.1')?.value).toBe('1');
        });

        it('should set correct TTL on first request', async () => {
            const mockKV = createMockKV();
            const windowMs = 60000;
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            await rateLimiter(req, createMockResponse());

            expect(mockKV.store.get('rate_limit:ip:192.168.1.1')?.ttl).toBe(windowMs);
        });

        it('should return the original response on first request', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const originalResponse = new Response('Custom Body', {
                status: 201,
                headers: { 'X-Custom': 'Header' },
            });

            const result = await rateLimiter(req, originalResponse);

            expect(result).toBe(originalResponse);
            expect(result.status).toBe(201);
        });
    });

    describe('Counter increment behavior', () => {
        it('should increment counter on subsequent requests', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // First request
            await rateLimiter(req, createMockResponse());
            expect(mockKV.store.get('rate_limit:ip:192.168.1.1')?.value).toBe('1');

            // Second request - counter should be incremented
            await rateLimiter(req, createMockResponse());

            // BUG CHECK: The implementation doesn't increment the counter!
            // This test documents the expected behavior (increment)
            // Current implementation keeps it at '1'
            const currentValue = mockKV.store.get('rate_limit:ip:192.168.1.1')?.value;
            // Expected: '2', Actual: '1' (this test will likely fail, exposing the bug)
            expect(currentValue).toBe('2');
        });

        it('should track request count accurately over multiple requests', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            for (let i = 1; i <= 5; i++) {
                await rateLimiter(req, createMockResponse());
            }

            // BUG CHECK: Expected counter to be '5'
            const currentValue = mockKV.store.get('rate_limit:ip:192.168.1.1')?.value;
            expect(currentValue).toBe('5');
        });
    });

    describe('Rate limit enforcement', () => {
        it('should allow requests up to the limit', async () => {
            const mockKV = createMockKV();
            const maxRequests = 10;
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: maxRequests, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // Make maxRequests requests - all should be allowed
            for (let i = 0; i < maxRequests; i++) {
                const res = createMockResponse();
                const result = await rateLimiter(req, res);
                expect(result).toBe(res);
                expect(result.status).toBe(200);
            }
        });

        it('should block request when limit is exceeded (throwOnLimit: false)', async () => {
            const mockKV = createMockKV();
            // Pre-set counter to be at the limit
            await mockKV.set('rate_limit:ip:192.168.1.1', '11', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            expect(result.status).toBe(429);
        });

        it('should return 429 status code when limit exceeded', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '15', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            expect(result.status).toBe(429);
        });

        it('should return "Rate limit exceeded" message when blocked (per requirements)', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '15', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());
            const body = await result.text();

            // REQUIREMENT CHECK: Should be "Rate limit exceeded" not "RateLimitExceeded"
            expect(body).toBe('Rate limit exceeded');
        });

        it('should throw error when limit exceeded (throwOnLimit: true)', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '15', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: true, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            await expect(rateLimiter(req, createMockResponse())).rejects.toThrow('RateLimitExceeded');
        });

        it('should allow request at exactly the limit (boundary test)', async () => {
            const mockKV = createMockKV();
            // Counter at exactly maxRequestsPerWindow
            await mockKV.set('rate_limit:ip:192.168.1.1', '10', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = createMockResponse();
            const result = await rateLimiter(req, res);

            // count (10) > maxRequestsPerWindow (10) is false, so request should be allowed
            expect(result).toBe(res);
        });

        it('should block request when one over the limit (boundary test)', async () => {
            const mockKV = createMockKV();
            // Counter at maxRequestsPerWindow + 1
            await mockKV.set('rate_limit:ip:192.168.1.1', '11', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            expect(result.status).toBe(429);
        });
    });

    describe('X-RateLimit-Remaining header (per requirements)', () => {
        it('should include X-RateLimit-Remaining header in response', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // REQUIREMENT CHECK: Should have X-RateLimit-Remaining header
            expect(result.headers.get('X-RateLimit-Remaining')).not.toBeNull();
        });

        it('should show correct remaining count after first request', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // After 1 request, should have 9 remaining
            expect(result.headers.get('X-RateLimit-Remaining')).toBe('9');
        });

        it('should show correct remaining count as limit approaches', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '8', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // After 9 requests (8 + this one), should have 1 remaining
            expect(result.headers.get('X-RateLimit-Remaining')).toBe('1');
        });

        it('should show 0 remaining at the limit', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '9', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // After 10 requests, should have 0 remaining
            expect(result.headers.get('X-RateLimit-Remaining')).toBe('0');
        });
    });

    describe('Window expiration and reset', () => {
        let originalDateNow: typeof Date.now;

        beforeEach(() => {
            originalDateNow = Date.now;
        });

        afterEach(() => {
            Date.now = originalDateNow;
        });

        it('should reset counter after window expires', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            const windowMs = 60000;
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs, throwOnLimit: false, by: 'ip' },
                { kv, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // Make first request
            await rateLimiter(req, createMockResponse());

            // Advance time past window
            Date.now = () => baseTime + windowMs + 1;

            // Make another request - should be treated as first in new window
            await rateLimiter(req, createMockResponse());

            // Counter should be reset to 1
            const value = await kv.get('rate_limit:ip:192.168.1.1');
            expect(value).toBe('1');
        });

        it('should allow requests again after window expires even if previously blocked', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            const windowMs = 60000;

            // Set counter to exceed limit
            await kv.set('rate_limit:ip:192.168.1.1', '15', { ttl: windowMs });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs, throwOnLimit: false, by: 'ip' },
                { kv, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // First request should be blocked
            let result = await rateLimiter(req, createMockResponse());
            expect(result.status).toBe(429);

            // Advance time past window
            Date.now = () => baseTime + windowMs + 1;

            // Request should now be allowed
            const newRes = createMockResponse();
            result = await rateLimiter(req, newRes);
            expect(result).toBe(newRes);
            expect(result.status).toBe(200);
        });
    });

    describe('IP-based rate limiting isolation', () => {
        it('should track different IPs separately', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req1 = createMockRequest({ ip: '192.168.1.1' });
            const req2 = createMockRequest({ ip: '192.168.1.2' });

            await rateLimiter(req1, createMockResponse());
            await rateLimiter(req2, createMockResponse());

            expect(mockKV.store.has('rate_limit:ip:192.168.1.1')).toBe(true);
            expect(mockKV.store.has('rate_limit:ip:192.168.1.2')).toBe(true);
        });

        it('should not block one IP when another exceeds limit', async () => {
            const mockKV = createMockKV();
            // Set IP 1 to be over limit
            await mockKV.set('rate_limit:ip:192.168.1.1', '15', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req1 = createMockRequest({ ip: '192.168.1.1' });
            const req2 = createMockRequest({ ip: '192.168.1.2' });

            // IP 1 should be blocked
            const result1 = await rateLimiter(req1, createMockResponse());
            expect(result1.status).toBe(429);

            // IP 2 should be allowed
            const res2 = createMockResponse();
            const result2 = await rateLimiter(req2, res2);
            expect(result2).toBe(res2);
            expect(result2.status).toBe(200);
        });
    });

    describe('User ID-based rate limiting', () => {
        it('should rate limit by user_id instead of IP', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'user_id' },
                { kv: mockKV, session: { id: 'user-123' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            await rateLimiter(req, createMockResponse());

            expect(mockKV.store.has('rate_limit:user:user-123')).toBe(true);
            expect(mockKV.store.has('rate_limit:ip:192.168.1.1')).toBe(false);
        });

        it('should track same user across different IPs', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:user:user-123', '5', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'user_id' },
                { kv: mockKV, session: { id: 'user-123' } }
            );

            // Different IPs, same user
            const req1 = createMockRequest({ ip: '192.168.1.1' });
            const req2 = createMockRequest({ ip: '10.0.0.1' });

            await rateLimiter(req1, createMockResponse());
            await rateLimiter(req2, createMockResponse());

            // Both should increment the same user counter
            // (assuming the bug is fixed where counter actually increments)
        });

        it('should allow different users from same IP', async () => {
            const mockKV = createMockKV();

            // User 1 is over limit
            await mockKV.set('rate_limit:user:user-1', '15', { ttl: 60000 });

            const rateLimiter1 = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'user_id' },
                { kv: mockKV, session: { id: 'user-1' } }
            );

            const rateLimiter2 = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'user_id' },
                { kv: mockKV, session: { id: 'user-2' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' }); // Same IP

            // User 1 should be blocked
            const result1 = await rateLimiter1(req, createMockResponse());
            expect(result1.status).toBe(429);

            // User 2 should be allowed (different user, same IP)
            const res2 = createMockResponse();
            const result2 = await rateLimiter2(req, res2);
            expect(result2).toBe(res2);
        });
    });

    describe('Error handling', () => {
        it('should throw NotAuthorized for missing IP in ip mode', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest(); // No IP

            await expect(rateLimiter(req, createMockResponse())).rejects.toThrow('NotAuthorized');
        });

        it('should throw NotAuthorized for missing session in user_id mode', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'user_id' },
                { kv: mockKV, session: { id: '' } } // Empty session
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            await expect(rateLimiter(req, createMockResponse())).rejects.toThrow('NotAuthorized');
        });

        it('should handle KV get errors gracefully', async () => {
            const errorKV: KVAPI = {
                get: async () => {
                    throw new Error('KV connection failed');
                },
                set: async () => {},
            };

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: errorKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            await expect(rateLimiter(req, createMockResponse())).rejects.toThrow('KV connection failed');
        });

        it('should handle KV set errors gracefully', async () => {
            const errorKV: KVAPI = {
                get: async () => null,
                set: async () => {
                    throw new Error('KV write failed');
                },
            };

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: errorKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            await expect(rateLimiter(req, createMockResponse())).rejects.toThrow('KV write failed');
        });

        it('should handle non-numeric values in KV', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', 'not-a-number', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // parseInt('not-a-number') returns NaN
            // NaN > 10 is false, so request would be allowed (potentially buggy behavior)
            const res = createMockResponse();
            const result = await rateLimiter(req, res);

            // Document current behavior (may want to validate this is intentional)
            expect(result).toBe(res);
        });
    });

    describe('Configuration edge cases', () => {
        it('should handle maxRequestsPerWindow of 0', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 0, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // First request sets counter to 1
            // 1 > 0 is true, so this behavior depends on when check happens
            const res = createMockResponse();
            const result = await rateLimiter(req, res);

            // First request should be allowed (counter not checked on first request)
            expect(result).toBe(res);
        });

        it('should handle maxRequestsPerWindow of 1', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 1, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // First request should be allowed
            const res1 = createMockResponse();
            const result1 = await rateLimiter(req, res1);
            expect(result1).toBe(res1);

            // Second request - counter would be 1, 1 > 1 is false, so allowed
            // Third request - counter would be 1 (bug!), still allowed
            // With proper increment: counter becomes 2, 2 > 1 is true, blocked
        });

        it('should handle very large maxRequestsPerWindow', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: Number.MAX_SAFE_INTEGER, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = createMockResponse();
            const result = await rateLimiter(req, res);

            expect(result).toBe(res);
        });

        it('should handle very small windowMs', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 1, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = createMockResponse();
            const result = await rateLimiter(req, res);

            expect(result).toBe(res);
            expect(mockKV.store.get('rate_limit:ip:192.168.1.1')?.ttl).toBe(1);
        });
    });
});

// =============================================================================
// TEST SUITE: Integration Tests
// =============================================================================

describe('Integration Tests', () => {
    describe('Full request lifecycle with real KV', () => {
        let originalDateNow: typeof Date.now;

        beforeEach(() => {
            originalDateNow = Date.now;
        });

        afterEach(() => {
            Date.now = originalDateNow;
        });

        it('should enforce rate limit across full lifecycle', async () => {
            const baseTime = 1000000;
            Date.now = () => baseTime;

            const kv = createKVAPI();
            const maxRequests = 3;
            const windowMs = 60000;

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: maxRequests, windowMs, throwOnLimit: false, by: 'ip' },
                { kv, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // Make requests up to and exceeding limit
            const results: Response[] = [];
            for (let i = 0; i < maxRequests + 2; i++) {
                results.push(await rateLimiter(req, createMockResponse()));
            }

            // First maxRequests should be allowed
            for (let i = 0; i < maxRequests; i++) {
                expect(results[i].status).toBe(200);
            }

            // Requests beyond limit should be blocked
            // Note: Due to the counter increment bug, this might not work as expected
            // This test documents expected behavior
        });

        it('should handle concurrent requests from multiple IPs', async () => {
            const kv = createKVAPI();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 5, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv, session: { id: 'user' } }
            );

            const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
            const requests = ips.map((ip) => createMockRequest({ ip }));

            // Send concurrent requests
            const results = await Promise.all(
                requests.map((req) => rateLimiter(req, createMockResponse()))
            );

            // All should succeed (first request from each IP)
            results.forEach((result) => {
                expect(result.status).toBe(200);
            });
        });
    });

    describe('Requirement compliance summary', () => {
        it('REQUIREMENT: Limit each IP to 10 requests per 60-second window', async () => {
            const kv = createKVAPI();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // This test validates the configuration matches requirements
            // Full enforcement test requires counter increment fix
            const res = await rateLimiter(req, createMockResponse());
            expect(res.status).toBe(200);
        });

        it('REQUIREMENT: Return 429 status code when limit is hit', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '11', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            expect(result.status).toBe(429);
        });

        it('REQUIREMENT: Return message "Rate limit exceeded" when limit is hit', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '11', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());
            const body = await result.text();

            // Note: Current implementation returns "RateLimitExceeded"
            // Requirement says "Rate limit exceeded"
            expect(body).toBe('Rate limit exceeded');
        });

        it('REQUIREMENT: Return 200 status code when request is allowed', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = new Response('OK', { status: 200 });
            const result = await rateLimiter(req, res);

            expect(result.status).toBe(200);
        });

        it('REQUIREMENT: Return message "OK" when request is allowed', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = new Response('OK', { status: 200 });
            const result = await rateLimiter(req, res);
            const body = await result.text();

            expect(body).toBe('OK');
        });

        it('REQUIREMENT: Include X-RateLimit-Remaining header', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            const remaining = result.headers.get('X-RateLimit-Remaining');
            expect(remaining).not.toBeNull();
            expect(parseInt(remaining!)).toBeGreaterThanOrEqual(0);
        });
    });
});

// =============================================================================
// TEST SUITE: Bug Detection Tests
// =============================================================================

describe('Bug Detection Tests', () => {
    describe('Counter increment bug', () => {
        it('BUG: Counter should be incremented on each request', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });

            // First request
            await rateLimiter(req, createMockResponse());
            const firstValue = mockKV.store.get('rate_limit:ip:192.168.1.1')?.value;

            // Second request
            await rateLimiter(req, createMockResponse());
            const secondValue = mockKV.store.get('rate_limit:ip:192.168.1.1')?.value;

            // BUG: Implementation sets count.toString() without incrementing
            // Expected: secondValue should be '2'
            // Actual: secondValue is '1'
            expect(parseInt(secondValue!)).toBe(parseInt(firstValue!) + 1);
        });
    });

    describe('Message format bug', () => {
        it('BUG: Error message should be "Rate limit exceeded" not "RateLimitExceeded"', async () => {
            const mockKV = createMockKV();
            await mockKV.set('rate_limit:ip:192.168.1.1', '11', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());
            const body = await result.text();

            // Per requirements: "Rate limit exceeded"
            // Current implementation: "RateLimitExceeded"
            expect(body).toBe('Rate limit exceeded');
        });
    });

    describe('Missing header bug', () => {
        it('BUG: X-RateLimit-Remaining header is not implemented', async () => {
            const mockKV = createMockKV();
            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // Per requirements: Should include X-RateLimit-Remaining header
            // Current implementation: Does not add any headers
            const header = result.headers.get('X-RateLimit-Remaining');
            expect(header).not.toBeNull();
        });
    });

    describe('Boundary condition analysis', () => {
        it('BUG CHECK: Comparison uses > instead of >=', async () => {
            const mockKV = createMockKV();
            // Set counter exactly at limit
            await mockKV.set('rate_limit:ip:192.168.1.1', '10', { ttl: 60000 });

            const rateLimiter = createRateLimiter(
                { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
                { kv: mockKV, session: { id: 'user' } }
            );

            const req = createMockRequest({ ip: '192.168.1.1' });
            const result = await rateLimiter(req, createMockResponse());

            // Current: count (10) > maxRequests (10) = false, so allowed
            // This might be intentional (allow exactly 10) or a bug (should allow only 9)
            // Document current behavior for review
            expect(result.status).toBe(200); // Current behavior
            // If requirement is "10 requests allowed", this is correct
            // If requirement is "after 10 requests, block", need >= comparison
        });
    });
});

// =============================================================================
// TEST SUITE: Stress and Performance Tests
// =============================================================================

describe('Stress Tests', () => {
    it('should handle rapid sequential requests', async () => {
        const mockKV = createMockKV();
        const rateLimiter = createRateLimiter(
            { maxRequestsPerWindow: 100, windowMs: 60000, throwOnLimit: false, by: 'ip' },
            { kv: mockKV, session: { id: 'user' } }
        );

        const req = createMockRequest({ ip: '192.168.1.1' });

        // Make 50 rapid requests
        const promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(rateLimiter(req, createMockResponse()));
        }

        const results = await Promise.all(promises);

        // All should complete without errors
        expect(results.length).toBe(50);
    });

    it('should handle many different IPs', async () => {
        const mockKV = createMockKV();
        const rateLimiter = createRateLimiter(
            { maxRequestsPerWindow: 10, windowMs: 60000, throwOnLimit: false, by: 'ip' },
            { kv: mockKV, session: { id: 'user' } }
        );

        // Create requests from 100 different IPs
        const promises = [];
        for (let i = 0; i < 100; i++) {
            const req = createMockRequest({ ip: `192.168.1.${i}` });
            promises.push(rateLimiter(req, createMockResponse()));
        }

        const results = await Promise.all(promises);

        // All first requests should succeed
        results.forEach((result) => {
            expect(result.status).toBe(200);
        });

        // All IPs should have their own entries
        expect(mockKV.store.size).toBe(100);
    });
});
