import { describe, it, expect, beforeEach } from 'bun:test';
import {
    createDocumentStore,
    PatchError,
    type DocumentStore,
    type Document,
} from './patch';

// =============================================================================
// TEST SUITE: POST /docs - Document Creation
// =============================================================================

describe('POST /docs - Document Creation', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Basic creation', () => {
        it('should create a new document with empty content', () => {
            const doc = store.createDocument();

            expect(doc.content).toBe('');
        });

        it('should create a new document with version 0', () => {
            const doc = store.createDocument();

            expect(doc.version).toBe(0);
        });

        it('should return a document with id', () => {
            const doc = store.createDocument();

            expect(doc.id).toBeDefined();
            expect(typeof doc.id).toBe('string');
            expect(doc.id.length).toBeGreaterThan(0);
        });

        it('should create documents with unique ids', () => {
            const doc1 = store.createDocument();
            const doc2 = store.createDocument();
            const doc3 = store.createDocument();

            expect(doc1.id).not.toBe(doc2.id);
            expect(doc2.id).not.toBe(doc3.id);
            expect(doc1.id).not.toBe(doc3.id);
        });
    });

    describe('Response format', () => {
        it('should return object with id, content, and version', () => {
            const doc = store.createDocument();

            expect(doc).toHaveProperty('id');
            expect(doc).toHaveProperty('content');
            expect(doc).toHaveProperty('version');
        });
    });
});

// =============================================================================
// TEST SUITE: GET /docs/:id - Document Retrieval
// =============================================================================

describe('GET /docs/:id - Document Retrieval', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Existing document', () => {
        it('should return document by id', () => {
            const created = store.createDocument();
            const retrieved = store.getDocument(created.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(created.id);
        });

        it('should return current content and version', () => {
            const created = store.createDocument();
            store.applyPatch(created.id, { position: 0, delete: 0, insert: 'hello' });

            const retrieved = store.getDocument(created.id);

            expect(retrieved?.content).toBe('hello');
            expect(retrieved?.version).toBe(1);
        });
    });

    describe('Non-existent document', () => {
        it('should return null for non-existent id', () => {
            const retrieved = store.getDocument('nonexistent');

            expect(retrieved).toBeNull();
        });

        it('should return null for empty string id', () => {
            const retrieved = store.getDocument('');

            expect(retrieved).toBeNull();
        });
    });

    describe('Document isolation', () => {
        it('should return correct document when multiple exist', () => {
            const doc1 = store.createDocument();
            const doc2 = store.createDocument();

            store.applyPatch(doc1.id, { position: 0, delete: 0, insert: 'doc1' });
            store.applyPatch(doc2.id, { position: 0, delete: 0, insert: 'doc2' });

            expect(store.getDocument(doc1.id)?.content).toBe('doc1');
            expect(store.getDocument(doc2.id)?.content).toBe('doc2');
        });
    });
});

// =============================================================================
// TEST SUITE: POST /docs/:id/patch - Patch Application
// =============================================================================

describe('POST /docs/:id/patch - Patch Application', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Insert operations', () => {
        it('should insert at beginning of empty document', () => {
            const doc = store.createDocument();
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            expect(result.content).toBe('hello');
        });

        it('should insert at end of document', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 5, delete: 0, insert: ' world' });

            expect(result.content).toBe('hello world');
        });

        it('should insert in middle of document', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'helloworld' });
            const result = store.applyPatch(doc.id, { position: 5, delete: 0, insert: ' ' });

            expect(result.content).toBe('hello world');
        });

        it('should handle empty insert', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 2, delete: 0, insert: '' });

            expect(result.content).toBe('hello');
        });
    });

    describe('Delete operations', () => {
        it('should delete from beginning', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 0, delete: 2, insert: '' });

            expect(result.content).toBe('llo');
        });

        it('should delete from end', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 3, delete: 2, insert: '' });

            expect(result.content).toBe('hel');
        });

        it('should delete from middle', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 1, delete: 3, insert: '' });

            expect(result.content).toBe('ho');
        });

        it('should delete entire content', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 0, delete: 5, insert: '' });

            expect(result.content).toBe('');
        });

        it('should handle zero delete', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 2, delete: 0, insert: '' });

            expect(result.content).toBe('hello');
        });
    });

    describe('Replace operations (delete + insert)', () => {
        it('should replace at beginning', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 0, delete: 5, insert: 'hi' });

            expect(result.content).toBe('hi');
        });

        it('should replace in middle', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello world' });
            const result = store.applyPatch(doc.id, { position: 6, delete: 5, insert: 'there' });

            expect(result.content).toBe('hello there');
        });

        it('should replace with longer content', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hi' });
            const result = store.applyPatch(doc.id, { position: 0, delete: 2, insert: 'hello' });

            expect(result.content).toBe('hello');
        });

        it('should replace with shorter content', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            const result = store.applyPatch(doc.id, { position: 0, delete: 5, insert: 'hi' });

            expect(result.content).toBe('hi');
        });
    });

    describe('Example from requirements', () => {
        it('should match the example sequence', () => {
            const doc = store.createDocument();
            expect(doc).toMatchObject({ content: '', version: 0 });

            const r1 = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            expect(r1).toMatchObject({ content: 'hello', version: 1 });

            const r2 = store.applyPatch(doc.id, { position: 5, delete: 0, insert: ' world' });
            expect(r2).toMatchObject({ content: 'hello world', version: 2 });

            const r3 = store.applyPatch(doc.id, { position: 0, delete: 5, insert: 'hi' });
            expect(r3).toMatchObject({ content: 'hi world', version: 3 });
        });
    });
});

// =============================================================================
// TEST SUITE: Version Management
// =============================================================================

describe('Version Management', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Version increment', () => {
        it('should increment version on each patch', () => {
            const doc = store.createDocument();

            const r1 = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'a' });
            expect(r1.version).toBe(1);

            const r2 = store.applyPatch(doc.id, { position: 1, delete: 0, insert: 'b' });
            expect(r2.version).toBe(2);

            const r3 = store.applyPatch(doc.id, { position: 2, delete: 0, insert: 'c' });
            expect(r3.version).toBe(3);
        });

        it('should track version independently per document', () => {
            const doc1 = store.createDocument();
            const doc2 = store.createDocument();

            store.applyPatch(doc1.id, { position: 0, delete: 0, insert: 'a' });
            store.applyPatch(doc1.id, { position: 1, delete: 0, insert: 'b' });
            store.applyPatch(doc2.id, { position: 0, delete: 0, insert: 'x' });

            expect(store.getDocument(doc1.id)?.version).toBe(2);
            expect(store.getDocument(doc2.id)?.version).toBe(1);
        });
    });
});

// =============================================================================
// TEST SUITE: Error Handling - Position Validation
// =============================================================================

describe('Error Handling - Position Validation', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Position out of bounds', () => {
        it('should throw for negative position', () => {
            const doc = store.createDocument();

            expect(() => {
                store.applyPatch(doc.id, { position: -1, delete: 0, insert: 'x' });
            }).toThrow(PatchError);
        });

        it('should throw for position beyond document length', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            expect(() => {
                store.applyPatch(doc.id, { position: 10, delete: 0, insert: 'x' });
            }).toThrow(PatchError);
        });

        it('should allow position at exactly document length for appending', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const result = store.applyPatch(doc.id, { position: 5, delete: 0, insert: '!' });
            expect(result.content).toBe('hello!');
        });

        it('should throw for position beyond empty document', () => {
            const doc = store.createDocument();

            expect(() => {
                store.applyPatch(doc.id, { position: 1, delete: 0, insert: 'x' });
            }).toThrow(PatchError);
        });
    });

    describe('Delete range out of bounds', () => {
        it('should throw when delete extends beyond document', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            expect(() => {
                store.applyPatch(doc.id, { position: 3, delete: 5, insert: '' });
            }).toThrow(PatchError);
        });

        it('should allow delete that ends exactly at document end', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const result = store.applyPatch(doc.id, { position: 3, delete: 2, insert: '' });
            expect(result.content).toBe('hel');
        });
    });

    describe('Document not found', () => {
        it('should throw for non-existent document', () => {
            expect(() => {
                store.applyPatch('nonexistent', { position: 0, delete: 0, insert: 'x' });
            }).toThrow(PatchError);
        });
    });

    describe('Error code validation', () => {
        it('should have OUT_OF_BOUNDS code for position errors', () => {
            const doc = store.createDocument();

            try {
                store.applyPatch(doc.id, { position: -1, delete: 0, insert: 'x' });
            } catch (e) {
                expect(e).toBeInstanceOf(PatchError);
                expect((e as PatchError).code).toBe('OUT_OF_BOUNDS');
            }
        });

        it('should have NOT_FOUND code for missing document', () => {
            try {
                store.applyPatch('nonexistent', { position: 0, delete: 0, insert: 'x' });
            } catch (e) {
                expect(e).toBeInstanceOf(PatchError);
                expect((e as PatchError).code).toBe('NOT_FOUND');
            }
        });
    });
});

// =============================================================================
// TEST SUITE: Optimistic Locking Extension
// =============================================================================

describe('Optimistic Locking Extension', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Expected version matching', () => {
        it('should succeed when expectedVersion matches', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const result = store.applyPatch(doc.id, {
                position: 5, delete: 0, insert: ' world', expectedVersion: 1
            });

            expect(result.content).toBe('hello world');
        });

        it('should throw when expectedVersion does not match', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            expect(() => {
                store.applyPatch(doc.id, {
                    position: 5, delete: 0, insert: ' world', expectedVersion: 0
                });
            }).toThrow(PatchError);
        });

        it('should have VERSION_MISMATCH code for version errors', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            try {
                store.applyPatch(doc.id, {
                    position: 5, delete: 0, insert: ' world', expectedVersion: 0
                });
            } catch (e) {
                expect((e as PatchError).code).toBe('VERSION_MISMATCH');
            }
        });

        it('should work without expectedVersion (backwards compatible)', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const result = store.applyPatch(doc.id, { position: 5, delete: 0, insert: '!' });
            expect(result.content).toBe('hello!');
        });
    });
});

// =============================================================================
// TEST SUITE: GET /docs/:id/history Extension
// =============================================================================

describe('GET /docs/:id/history Extension', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('History retrieval', () => {
        it('should return empty history for new document', () => {
            const doc = store.createDocument();
            const history = store.getHistory(doc.id);

            expect(history).toEqual([]);
        });

        it('should return all patches applied', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            store.applyPatch(doc.id, { position: 5, delete: 0, insert: ' world' });

            const history = store.getHistory(doc.id);

            expect(history).toHaveLength(2);
        });

        it('should include version and patch details', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const history = store.getHistory(doc.id);

            expect(history[0].version).toBe(1);
            expect(history[0].patch).toMatchObject({
                position: 0,
                delete: 0,
                insert: 'hello'
            });
        });

        it('should include timestamp', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const history = store.getHistory(doc.id);

            expect(history[0].timestamp).toBeDefined();
            expect(typeof history[0].timestamp).toBe('number');
        });

        it('should return empty for non-existent document', () => {
            const history = store.getHistory('nonexistent');

            expect(history).toEqual([]);
        });
    });
});

// =============================================================================
// TEST SUITE: POST /docs/:id/revert Extension
// =============================================================================

describe('POST /docs/:id/revert Extension', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Revert to version', () => {
        it('should revert to version 0 (empty)', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            const reverted = store.revertTo(doc.id, 0);

            expect(reverted.content).toBe('');
            expect(reverted.version).toBe(0);
        });

        it('should revert to intermediate version', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });
            store.applyPatch(doc.id, { position: 5, delete: 0, insert: ' world' });
            store.applyPatch(doc.id, { position: 11, delete: 0, insert: '!' });

            const reverted = store.revertTo(doc.id, 2);

            expect(reverted.content).toBe('hello world');
            expect(reverted.version).toBe(2);
        });

        it('should throw for invalid version', () => {
            const doc = store.createDocument();
            store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'hello' });

            expect(() => {
                store.revertTo(doc.id, 5);
            }).toThrow(PatchError);
        });

        it('should throw for negative version', () => {
            const doc = store.createDocument();

            expect(() => {
                store.revertTo(doc.id, -1);
            }).toThrow(PatchError);
        });

        it('should throw for non-existent document', () => {
            expect(() => {
                store.revertTo('nonexistent', 0);
            }).toThrow(PatchError);
        });
    });
});

// =============================================================================
// TEST SUITE: Edge Cases and Special Content
// =============================================================================

describe('Edge Cases and Special Content', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Unicode content', () => {
        it('should handle unicode characters', () => {
            const doc = store.createDocument();
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: '\u65E5\u672C\u8A9E' });

            expect(result.content).toBe('\u65E5\u672C\u8A9E');
        });

        it('should handle emoji', () => {
            const doc = store.createDocument();
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'Hello \uD83D\uDC4B' });

            expect(result.content).toBe('Hello \uD83D\uDC4B');
        });
    });

    describe('Whitespace content', () => {
        it('should handle newlines', () => {
            const doc = store.createDocument();
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'line1\nline2\nline3' });

            expect(result.content).toBe('line1\nline2\nline3');
        });

        it('should handle tabs', () => {
            const doc = store.createDocument();
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: '\t\tindented' });

            expect(result.content).toBe('\t\tindented');
        });
    });

    describe('Very long content', () => {
        it('should handle very long inserts', () => {
            const doc = store.createDocument();
            const longContent = 'a'.repeat(10000);
            const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: longContent });

            expect(result.content).toBe(longContent);
        });

        it('should handle many small patches', () => {
            const doc = store.createDocument();

            for (let i = 0; i < 100; i++) {
                store.applyPatch(doc.id, { position: i, delete: 0, insert: 'x' });
            }

            const final = store.getDocument(doc.id);
            expect(final?.content.length).toBe(100);
            expect(final?.version).toBe(100);
        });
    });
});

// =============================================================================
// TEST SUITE: Concurrent Operations
// =============================================================================

describe('Concurrent Operations', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    describe('Multiple documents concurrently', () => {
        it('should handle operations on multiple documents', () => {
            const docs = Array(10).fill(null).map(() => store.createDocument());

            docs.forEach((doc, i) => {
                store.applyPatch(doc.id, { position: 0, delete: 0, insert: `doc${i}` });
            });

            docs.forEach((doc, i) => {
                expect(store.getDocument(doc.id)?.content).toBe(`doc${i}`);
            });
        });
    });
});

// =============================================================================
// TEST SUITE: Requirements Compliance
// =============================================================================

describe('Requirements Compliance', () => {
    let store: DocumentStore;

    beforeEach(() => {
        store = createDocumentStore();
    });

    it('REQUIREMENT: POST /docs creates document with id, content:"", version:0', () => {
        const doc = store.createDocument();

        expect(doc.id).toBeDefined();
        expect(doc.content).toBe('');
        expect(doc.version).toBe(0);
    });

    it('REQUIREMENT: GET /docs/:id returns id, content, version', () => {
        const doc = store.createDocument();
        const retrieved = store.getDocument(doc.id);

        expect(retrieved).toHaveProperty('id');
        expect(retrieved).toHaveProperty('content');
        expect(retrieved).toHaveProperty('version');
    });

    it('REQUIREMENT: POST /docs/:id/patch applies edit with position, delete, insert', () => {
        const doc = store.createDocument();
        const result = store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'test' });

        expect(result.content).toBe('test');
    });

    it('REQUIREMENT: Each patch increments version', () => {
        const doc = store.createDocument();

        store.applyPatch(doc.id, { position: 0, delete: 0, insert: 'a' });
        store.applyPatch(doc.id, { position: 1, delete: 0, insert: 'b' });
        store.applyPatch(doc.id, { position: 2, delete: 0, insert: 'c' });

        expect(store.getDocument(doc.id)?.version).toBe(3);
    });

    it('REQUIREMENT: Return 400 (throw error) if position is out of bounds', () => {
        const doc = store.createDocument();

        expect(() => {
            store.applyPatch(doc.id, { position: 100, delete: 0, insert: 'x' });
        }).toThrow();
    });
});
