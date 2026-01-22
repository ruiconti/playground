// Problem:
// Build a rate limiter middleware/function for an HTTP server.
// Requirements:

// Limit each IP address to 10 requests per 60-second window
// Return 429 status code with message "Rate limit exceeded" when limit is hit
// Return 200 status code with message "OK" when request is allowed
// Include a header X-RateLimit-Remaining showing requests left in current window
type RateLimiterOptions = {
    maxRequestsPerWindow: number;
    windowMs: number;
    throwOnLimit: boolean;
    by: 'ip' | 'user_id'
}

export interface KVAPI { 
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options: { ttl: number }): Promise<void>;
}

type RateLimiterContext = {
    kv: KVAPI;
    session: { id: string };
}

export function deriveKey(req: Request, session: { id: string }, by: 'ip' | 'user_id') {
    switch (by) {
        case 'ip': {
            const ip = req.headers.get('x-forwarded-for');
            if (!ip) throw new Error('NotAuthorized');
            return `rate_limit:ip:${ip}`
        }
        case 'user_id': {
            if (!session.id) throw new Error('NotAuthorized');
            return `rate_limit:user:${session.id}`
        }
    }
}

export function createRateLimiter(opts: RateLimiterOptions, context: RateLimiterContext) {
    const { maxRequestsPerWindow, windowMs, throwOnLimit, by } = opts;
    const { kv, session } = context;

    return async function rateLimit(req: Request, res: Response) {
        const key = deriveKey(req, session, by);
        const entry = await kv.get(key) ?? '0';

        // key insight: at this moment, we are looking at `t-1` moment, _not_ `t`
        const current = parseInt(entry);
        if (current > maxRequestsPerWindow) {
            if (throwOnLimit) throw new Error('RateLimitExceeded');
            return new Response('Rate limit exceeded', { status: 429 });
        }

        // now we're looking at `t` 
        const next = current + 1
        const remaining = maxRequestsPerWindow - next;
        await kv.set(key, next.toString(), { ttl: windowMs });
        res.headers.set('X-RateLimit-Remaining', remaining.toString());
        return res;
    }

}

export function createKVAPI() {
    const kv = new Map<string, { value: string, expiresAt: number }>();
    return {
        get: async (key: string) => {
            const entry = kv.get(key);
            if (!entry) return null;
            if (entry.expiresAt < Date.now()) {
                kv.delete(key);
                return null;
            }
            return entry.value;
        },
        set: async (key: string, value: string, options: { ttl: number }) => {
            kv.set(key, { value, expiresAt: Date.now() + options.ttl });
        }
    }
}

// usage
const rateLimiter = createRateLimiter({
    maxRequestsPerWindow: 10,
    windowMs: 60_000,
    throwOnLimit: false,
    by: 'ip'
}, {
    kv: createKVAPI(),
    session: { id: '123' },
})

// usage
const app = Bun.serve({
    port: 3000,
    fetch: async (req) => {
        return rateLimiter(req, new Response('OK', { status: 200 }));
    },
    websocket: {
        open: (ws) => {
            console.log('WebSocket opened');
        },
        message: (ws, message) => {
            console.log('WebSocket message:', message);
        },
    },
});

console.log(`Server is running on port ${app.port}`);