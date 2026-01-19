// ## Problem 2: Streaming Text Accumulator
//
// You're building an endpoint that receives chunks of streaming text and emits parsed blocks when complete delimiters are found.
//
// **Requirements:**
//
// - `POST /stream/:sessionId` with body `{"chunk": "..."}` accumulates text for that session
// - Response returns any **complete** blocks found so far: `{"blocks": [{"type": "text"|"code", "content": "..."}]}`
// - Code blocks are delimited by triple backticks (```)
// - Blocks are only emitted once they're complete (closing delimiter received)
// - `DELETE /stream/:sessionId` clears the session
//
// **Example sequence:**
// ```
// POST /stream/abc {"chunk": "Hello "} → {"blocks": []}
// POST /stream/abc {"chunk": "world```code"} → {"blocks": [{"type": "text", "content": "Hello world"}]}
// POST /stream/abc {"chunk": " here```done"} → {"blocks": [{"type": "code", "content": "code here"}]}
// ```
//
// **What this tests:**
// - State machine for parsing
// - Handling partial tokens across chunks
// - Session state management
// - Knowing when to emit vs buffer
//
// **Extensions:**
// 1. Add inline code (single backticks) as a third block type
// 2. Add `GET /stream/:sessionId/pending` that returns buffered but incomplete content
// 3. Add session TTL (auto-expire after 5 minutes of inactivity)