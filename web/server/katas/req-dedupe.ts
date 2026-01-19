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
