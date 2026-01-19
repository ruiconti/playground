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

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

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

// =============================================================================
// STUB IMPLEMENTATION
// =============================================================================

interface SessionState {
    buffer: string;
    inCodeBlock: boolean;
    lastActivity: number;
}

export function createStreamAccumulator(options: StreamAccumulatorOptions = {}): StreamAccumulator {
    const sessions = new Map<string, SessionState>();

    const getOrCreateSession = (sessionId: string): SessionState => {
        let session = sessions.get(sessionId);
        if (!session) {
            session = { buffer: '', inCodeBlock: false, lastActivity: Date.now() };
            sessions.set(sessionId, session);
        }
        session.lastActivity = Date.now();
        return session;
    };

    const parseBlocks = (session: SessionState): Block[] => {
        const blocks: Block[] = [];
        const delimiter = '```';

        while (true) {
            const delimiterIndex = session.buffer.indexOf(delimiter);
            if (delimiterIndex === -1) break;

            const beforeDelimiter = session.buffer.slice(0, delimiterIndex);
            session.buffer = session.buffer.slice(delimiterIndex + delimiter.length);

            if (!session.inCodeBlock) {
                if (beforeDelimiter.length > 0) {
                    blocks.push({ type: 'text', content: beforeDelimiter });
                }
                session.inCodeBlock = true;
            } else {
                blocks.push({ type: 'code', content: beforeDelimiter });
                session.inCodeBlock = false;
            }
        }

        return blocks;
    };

    return {
        pushChunk(sessionId: string, chunk: string): ChunkResponse {
            const session = getOrCreateSession(sessionId);
            session.buffer += chunk;
            const blocks = parseBlocks(session);
            return { blocks };
        },

        clearSession(sessionId: string): boolean {
            return sessions.delete(sessionId);
        },

        getPending(sessionId: string): PendingResponse | null {
            const session = sessions.get(sessionId);
            if (!session) return null;
            return { pending: session.buffer, inCodeBlock: session.inCodeBlock };
        }
    };
}