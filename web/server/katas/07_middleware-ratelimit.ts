// Problem:
// Build a rate limiter middleware/function for an HTTP server.
// Requirements:
//
// Limit each IP address to 10 requests per 60-second window
// Return 429 status code with message "Rate limit exceeded" when limit is hit
// Return 200 status code with message "OK" when request is allowed
// Include a header X-RateLimit-Remaining showing requests left in current window
//
// NOTE: Implementations live in ./07_middleware-ratelimit.solution.ts.

export type RateLimiterOptions = {
    maxRequestsPerWindow: number;
    windowMs: number;
    throwOnLimit: boolean;
    by: 'ip' | 'user_id';
};

export interface KVAPI {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options: { ttl: number }): Promise<void>;
}

export type RateLimiterContext = {
    kv: KVAPI;
    session: { id: string };
};

export function deriveKey(req: Request, session: { id: string }, by: 'ip' | 'user_id'): string {
    throw new Error('NotImplemented');
}

export function createRateLimiter(
    opts: RateLimiterOptions,
    context: RateLimiterContext
): (req: Request, res: Response) => Promise<Response> {
    throw new Error('NotImplemented');
}

export function createKVAPI(): KVAPI {
    throw new Error('NotImplemented');
}
