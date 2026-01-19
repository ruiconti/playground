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

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Document = { id: string; content: string; version: number };
export type PatchRequest = { position: number; delete: number; insert: string; expectedVersion?: number };
export type PatchResponse = { content: string; version: number };
export type PatchHistoryEntry = { version: number; patch: PatchRequest; timestamp: number };

export class PatchError extends Error {
    constructor(public code: 'OUT_OF_BOUNDS' | 'VERSION_MISMATCH' | 'NOT_FOUND', message: string) {
        super(message);
        this.name = 'PatchError';
    }
}

export interface DocumentStore {
    createDocument(): Document;
    getDocument(id: string): Document | null;
    applyPatch(id: string, patch: PatchRequest): PatchResponse;
    getHistory(id: string): PatchHistoryEntry[];
    revertTo(id: string, version: number): Document;
}

// =============================================================================
// STUB IMPLEMENTATION
// =============================================================================

export function createDocumentStore(): DocumentStore {
    const documents = new Map<string, Document>();
    const history = new Map<string, PatchHistoryEntry[]>();
    let nextId = 1;

    return {
        createDocument(): Document {
            const id = String(nextId++);
            const doc: Document = { id, content: '', version: 0 };
            documents.set(id, doc);
            history.set(id, []);
            return { ...doc };
        },

        getDocument(id: string): Document | null {
            const doc = documents.get(id);
            return doc ? { ...doc } : null;
        },

        applyPatch(id: string, patch: PatchRequest): PatchResponse {
            const doc = documents.get(id);
            if (!doc) {
                throw new PatchError('NOT_FOUND', `Document ${id} not found`);
            }

            if (patch.expectedVersion !== undefined && patch.expectedVersion !== doc.version) {
                throw new PatchError('VERSION_MISMATCH', `Expected version ${patch.expectedVersion}, got ${doc.version}`);
            }

            if (patch.position < 0 || patch.position > doc.content.length) {
                throw new PatchError('OUT_OF_BOUNDS', `Position ${patch.position} is out of bounds`);
            }

            if (patch.position + patch.delete > doc.content.length) {
                throw new PatchError('OUT_OF_BOUNDS', `Delete range exceeds document length`);
            }

            const before = doc.content.slice(0, patch.position);
            const after = doc.content.slice(patch.position + patch.delete);
            doc.content = before + patch.insert + after;
            doc.version++;

            history.get(id)!.push({
                version: doc.version,
                patch: { ...patch },
                timestamp: Date.now()
            });

            return { content: doc.content, version: doc.version };
        },

        getHistory(id: string): PatchHistoryEntry[] {
            const entries = history.get(id);
            if (!entries) return [];
            return entries.map(e => ({ ...e, patch: { ...e.patch } }));
        },

        revertTo(id: string, version: number): Document {
            const doc = documents.get(id);
            if (!doc) {
                throw new PatchError('NOT_FOUND', `Document ${id} not found`);
            }

            const entries = history.get(id)!;
            if (version < 0 || version > doc.version) {
                throw new PatchError('OUT_OF_BOUNDS', `Version ${version} is invalid`);
            }

            // Reset and replay
            doc.content = '';
            doc.version = 0;

            for (const entry of entries) {
                if (entry.version > version) break;
                const before = doc.content.slice(0, entry.patch.position);
                const after = doc.content.slice(entry.patch.position + entry.patch.delete);
                doc.content = before + entry.patch.insert + after;
                doc.version = entry.version;
            }

            return { ...doc };
        }
    };
}