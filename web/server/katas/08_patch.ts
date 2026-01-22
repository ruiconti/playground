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
// NOTE: Implementations live in ./08_patch.solution.ts.

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Document = { id: string; content: string; version: number, history: PatchHistoryEntry[] };
export type PatchRequest = { position: number; delete: number; insert: string; expectedVersion?: number };
export type PatchResponse = { content: string; version: number };
export type PatchHistoryEntry = { version: number; content: string; patchRequest?: PatchRequest; timestamp: number };

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
    const documents = new Map<string, Document>();
    let idseq = 1;

    return {
        createDocument(): Document {
            const id = String(idseq++)
            const doc: Document = { id, content: '', version: 0, history: [] }
            documents.set(id, doc);
            return doc 
        },
        getDocument(id: string): Document | null {
            return documents.get(id) ?? null;
        },
        applyPatch(id: string, patch: PatchRequest) { 
            const doc = documents.get(id);
            if (!doc) {
                throw new PatchError('NOT_FOUND', `Document ${id} not found`);
            }
            if (patch.position < 0 || patch.position > doc.content.length) {
                throw new PatchError('OUT_OF_BOUNDS', `Position ${patch.position} is out of bounds. Document length is ${doc.content.length}`);
            }
            if (patch.position + patch.delete > (doc.content.length)) {
                throw new PatchError('OUT_OF_BOUNDS', `Delete range exceeds document length. Document length is ${doc.content.length}`);
            }
            if (patch.expectedVersion !== undefined && patch.expectedVersion !== doc.version) {
                throw new PatchError('VERSION_MISMATCH', `Expected version mismatch. Expected ${patch.expectedVersion}, got ${doc.version}`)
            }

            let content = doc.content;
            const before = content.slice(0, patch.position);
            if (patch.delete > 0) {
                content = before + content.slice(patch.position + patch.delete)
            }
            if (patch.insert.length > 0) {
                content = before + patch.insert + content.slice(patch.position);
            }
            doc.content = content;
            doc.version = doc.version + 1;

            const after = { content: doc.content, version: doc.version }
            doc.history.push({ version: doc.version, timestamp: Date.now(), content: doc.content, patchRequest: patch });
            return after;
        },
        getHistory(id: string): PatchHistoryEntry[] {
            const doc = documents.get(id);
            if (!doc) {
                return [];
            }
            return doc.history;
        },
        revertTo(id: string, version: number): Document {
            const doc = documents.get(id);
            if (!doc) {
                throw new PatchError('NOT_FOUND', `Document ${id} not found`);
            }
            if (version < 0 || version > doc.version) {
                throw new PatchError('OUT_OF_BOUNDS', `Version ${version} is out of bounds`);
            }
            if (version === 0) {
                return { ...doc, content: '', version: 0 };
            }

            const entry = doc.history.find(entry => entry.version === version);
            if (!entry) {
                throw new PatchError('NOT_FOUND', `Version ${version} not found`);
            }
            return { ...doc, content: entry.content, version: entry.version };
        },
    }
}
