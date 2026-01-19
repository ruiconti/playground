// ## Problem 3: Text Patch Application
//
// You're building a service that maintains document state and applies patches.
//
// **Requirements:**
//
// - `POST /docs` creates a new document, returns `{"id": "...", "content": ""}`
// - `GET /docs/:id` returns `{"id": "...", "content": "...", "version": number}`
// - `POST /docs/:id/patch` with body `{"position": number, "delete": number, "insert": "..."}` applies an edit
//   - `position`: character index where edit starts
//   - `delete`: number of characters to remove
//   - `insert`: string to insert at that position
// - Each patch increments the version
// - Return 400 if position is out of bounds
//
// **Example:**
// ```
// POST /docs → {"id": "1", "content": "", "version": 0}
// POST /docs/1/patch {"position": 0, "delete": 0, "insert": "hello"} → {"content": "hello", "version": 1}
// POST /docs/1/patch {"position": 5, "delete": 0, "insert": " world"} → {"content": "hello world", "version": 2}
// POST /docs/1/patch {"position": 0, "delete": 5, "insert": "hi"} → {"content": "hi world", "version": 3}
// ```
//
// **What this tests:**
// - String manipulation with indices
// - State versioning
// - Input validation
// - Clean API design
//
// **Extensions:**
// 1. Add `GET /docs/:id/history` that returns all patches applied
// 2. Add `POST /docs/:id/revert?to=<version>` that reverts to a specific version
// 3. Add optimistic locking: patch must include `expectedVersion`, reject if mismatch
//
// NOTE: Implementations live in ./patch.solution.ts.

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Document = { id: string; content: string; version: number };
export type PatchRequest = { position: number; delete: number; insert: string; expectedVersion?: number };
export type PatchResponse = { content: string; version: number };
export type PatchHistoryEntry = { version: number; patch: PatchRequest; timestamp: number };

export class PatchError extends Error {
    code: 'OUT_OF_BOUNDS' | 'VERSION_MISMATCH' | 'NOT_FOUND';

    constructor(code: 'OUT_OF_BOUNDS' | 'VERSION_MISMATCH' | 'NOT_FOUND', message: string) {
        super(message);
        this.name = 'PatchError';
        this.code = code;
    }
}

export interface DocumentStore {
    createDocument(): Document;
    getDocument(id: string): Document | null;
    applyPatch(id: string, patch: PatchRequest): PatchResponse;
    getHistory(id: string): PatchHistoryEntry[];
    revertTo(id: string, version: number): Document;
}

export function createDocumentStore(): DocumentStore {
    throw new Error('NotImplemented');
}
