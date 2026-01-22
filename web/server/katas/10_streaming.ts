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
//
// NOTE: Implementations live in ./10_streaming.solution.ts.

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================


// key insights:
// state machine for parsing LLM responses
// - states: `idle` | `parsing_text` | `parsing_code` | `done`
// key transitions are:
// - `idle` -> `parsing_text` when the first chunk arrives
// - `parsing_text` -> `parsing_text` when more text arrives, without backticks
// - `parsing_text` -> `done` when `done` is encountered
// - `parsing_text` -> `parsing_code` when backticks are opened
// - `parsing_code` -> `parsing_text` when backticks are closed
export type BlockType = 'text' | 'code' | 'inline_code';
export type Block = { type: BlockType; content: string };
export type ChunkResponse = { blocks: Block[] };
export type PendingResponse = { pending: string; inCodeBlock: boolean };

export interface StreamAccumulator {
    pushChunk(sessionId: string, chunk: string): ChunkResponse;
    clearSession(sessionId: string): boolean;
    getPending(sessionId: string): PendingResponse | null;
}

export interface StreamAccumulatorOptions {
    sessionTtlMs?: number;
}

type SessionState = { buffer: string, state: 'idle' | 'parsing_text' | 'parsing_code' | 'done' }

function parseChunk(chunk: string, current: SessionState): { state: SessionState, blocks: Block[] } {
    const peek = (n: number) => chunk[n];
    const blocks: Block[] = [];

    for (let i = 0; i < chunk.length; i++) {
        if (peek(i) === '`' && peek(i + 1) === '`' && peek(i + 2) === '`') {
            // backtick! needs to consume 3 more chars to be a code block
            if (current.state === 'parsing_text' || current.state === 'idle') {
                current.state = 'parsing_code';
                // flush buffer
                if (current.buffer.length > 0) {
                    blocks.push({ type: 'text', content: current.buffer })
                    current.buffer = '';
                }
            } else if (current.state === 'parsing_code') {
                current.state = 'parsing_text';
                // flush buffer
                // we should allow empty code blocks
                blocks.push({ type: 'code', content: current.buffer })
                current.buffer = '';
            }
            // advance the index
            i += 2;
        } else if (peek(i) === 'd' && peek(i + 1) === 'o' && peek(i + 2) === 'n' && peek(i + 3) === 'e') {
            if (current.state === 'parsing_code') {
                if (current.buffer.length > 0) {
                    blocks.push({ type: 'code', content: current.buffer })
                    current.buffer = '';
                }
            } else if (current.state === 'parsing_text') {
                if (current.buffer.length > 0) {
                    blocks.push({ type: 'text', content: current.buffer })
                    current.buffer = '';
                }
            }

            current.state = 'done';
            break;
        } else {
            current.buffer += peek(i);
        }
    }

    return { state: current, blocks };
}

export function createStreamAccumulator(options: StreamAccumulatorOptions = {}): StreamAccumulator {
    const sessions = new Map<string, SessionState>();
    return {
        pushChunk(sessionId: string, chunk: string): ChunkResponse {
            const session = sessions.get(sessionId) ?? { buffer: '', state: 'idle' };
            const next = parseChunk(chunk, session);
            sessions.set(sessionId, next.state);

            if (next.state.state === 'done') {
                sessions.delete(sessionId);
            }

            if (next.blocks.length > 0) {
                return { blocks: next.blocks };
            }

            return { blocks: [] };
        },
        clearSession(sessionId: string): boolean {
            return sessions.delete(sessionId);
        },
        getPending(sessionId: string): PendingResponse | null {
            const session = sessions.get(sessionId);
            if (!session) return null;
            return { pending: session.buffer, inCodeBlock: session.state === 'parsing_code' };
        }
    }
}
