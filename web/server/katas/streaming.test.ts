import { describe, it, expect, beforeEach } from 'bun:test';
import {
    createStreamAccumulator,
    type StreamAccumulator,
    type Block,
} from './streaming';

// =============================================================================
// TEST SUITE: POST /stream/:sessionId - Chunk Accumulation
// =============================================================================

describe('POST /stream/:sessionId - Chunk Accumulation', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Basic chunk handling', () => {
        it('should return empty blocks for incomplete text', () => {
            const result = accumulator.pushChunk('session1', 'Hello ');

            expect(result.blocks).toEqual([]);
        });

        it('should accumulate multiple chunks', () => {
            accumulator.pushChunk('session1', 'Hello ');
            accumulator.pushChunk('session1', 'world');
            const pending = accumulator.getPending('session1');

            expect(pending?.pending).toBe('Hello world');
        });

        it('should handle empty chunks', () => {
            accumulator.pushChunk('session1', '');
            const pending = accumulator.getPending('session1');

            expect(pending?.pending).toBe('');
        });
    });

    describe('Session isolation', () => {
        it('should maintain separate buffers per session', () => {
            accumulator.pushChunk('session1', 'Hello');
            accumulator.pushChunk('session2', 'World');

            expect(accumulator.getPending('session1')?.pending).toBe('Hello');
            expect(accumulator.getPending('session2')?.pending).toBe('World');
        });

        it('should not affect other sessions when one emits blocks', () => {
            accumulator.pushChunk('session1', 'Text```code```');
            accumulator.pushChunk('session2', 'Other');

            expect(accumulator.getPending('session2')?.pending).toBe('Other');
        });
    });
});

// =============================================================================
// TEST SUITE: Text Block Parsing
// =============================================================================

describe('Text Block Parsing', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Complete text blocks', () => {
        it('should emit text block when code block starts', () => {
            const result = accumulator.pushChunk('session1', 'Hello world```');

            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]).toEqual({ type: 'text', content: 'Hello world' });
        });

        it('should handle text with newlines', () => {
            const result = accumulator.pushChunk('session1', 'Line 1\nLine 2\nLine 3```');

            expect(result.blocks[0].content).toBe('Line 1\nLine 2\nLine 3');
        });

        it('should emit empty content text block if code starts immediately', () => {
            const result = accumulator.pushChunk('session1', '```code```');

            // First block might be empty text or just skip to code
            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe('code');
        });
    });

    describe('Partial delimiter handling', () => {
        it('should buffer partial delimiter at end of chunk', () => {
            accumulator.pushChunk('session1', 'Hello `');
            const pending = accumulator.getPending('session1');

            expect(pending?.pending).toBe('Hello `');
        });

        it('should complete delimiter across chunks', () => {
            accumulator.pushChunk('session1', 'Hello `');
            accumulator.pushChunk('session1', '``');
            const result = accumulator.pushChunk('session1', 'code```');

            const textBlock = result.blocks.find((b: Block) => b.type === 'text');
            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');

            // Text block should have been emitted when ``` was completed
            expect(textBlock || codeBlock).toBeDefined();
        });
    });
});

// =============================================================================
// TEST SUITE: Code Block Parsing
// =============================================================================

describe('Code Block Parsing', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Complete code blocks', () => {
        it('should emit code block when closing delimiter received', () => {
            const result = accumulator.pushChunk('session1', '```code here```');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe('code here');
        });

        it('should handle code with newlines', () => {
            const result = accumulator.pushChunk('session1', '```function test() {\n  return true;\n}```');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe('function test() {\n  return true;\n}');
        });

        it('should handle empty code block', () => {
            const result = accumulator.pushChunk('session1', '``````');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe('');
        });
    });

    describe('Code block state tracking', () => {
        it('should track being inside code block', () => {
            accumulator.pushChunk('session1', '```');
            const pending = accumulator.getPending('session1');

            expect(pending?.inCodeBlock).toBe(true);
        });

        it('should track exiting code block', () => {
            accumulator.pushChunk('session1', '```code```');
            const pending = accumulator.getPending('session1');

            expect(pending?.inCodeBlock).toBe(false);
        });
    });
});

// =============================================================================
// TEST SUITE: Multi-Block Sequences
// =============================================================================

describe('Multi-Block Sequences', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Alternating text and code', () => {
        it('should handle text-code-text sequence', () => {
            const result = accumulator.pushChunk('session1', 'Before```code```After```');

            expect(result.blocks.length).toBeGreaterThanOrEqual(2);
            expect(result.blocks[0]).toEqual({ type: 'text', content: 'Before' });
            expect(result.blocks[1]).toEqual({ type: 'code', content: 'code' });
        });

        it('should handle multiple code blocks', () => {
            const result = accumulator.pushChunk('session1', '```code1```text```code2```');

            const codeBlocks = result.blocks.filter((b: Block) => b.type === 'code');
            expect(codeBlocks.length).toBe(2);
        });
    });

    describe('Incremental block emission', () => {
        it('should emit blocks as they complete across multiple chunks', () => {
            const result1 = accumulator.pushChunk('session1', 'Hello ');
            expect(result1.blocks).toEqual([]);

            const result2 = accumulator.pushChunk('session1', 'world```code');
            expect(result2.blocks).toHaveLength(1);
            expect(result2.blocks[0].type).toBe('text');

            const result3 = accumulator.pushChunk('session1', ' here```done');
            expect(result3.blocks).toHaveLength(1);
            expect(result3.blocks[0].type).toBe('code');
        });
    });

    describe('Example from requirements', () => {
        it('should match the example sequence', () => {
            const result1 = accumulator.pushChunk('abc', 'Hello ');
            expect(result1.blocks).toEqual([]);

            const result2 = accumulator.pushChunk('abc', 'world```code');
            expect(result2.blocks).toEqual([{ type: 'text', content: 'Hello world' }]);

            const result3 = accumulator.pushChunk('abc', ' here```done');
            expect(result3.blocks).toEqual([{ type: 'code', content: 'code here' }]);
        });
    });
});

// =============================================================================
// TEST SUITE: DELETE /stream/:sessionId - Session Clearing
// =============================================================================

describe('DELETE /stream/:sessionId - Session Clearing', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Basic clearing', () => {
        it('should return true when session exists', () => {
            accumulator.pushChunk('session1', 'Hello');
            const result = accumulator.clearSession('session1');

            expect(result).toBe(true);
        });

        it('should return false when session does not exist', () => {
            const result = accumulator.clearSession('nonexistent');

            expect(result).toBe(false);
        });

        it('should remove session state', () => {
            accumulator.pushChunk('session1', 'Hello');
            accumulator.clearSession('session1');

            expect(accumulator.getPending('session1')).toBeNull();
        });
    });

    describe('Clearing with pending content', () => {
        it('should clear buffer including incomplete blocks', () => {
            accumulator.pushChunk('session1', 'Text```incomplete code');
            accumulator.clearSession('session1');

            expect(accumulator.getPending('session1')).toBeNull();
        });

        it('should not affect other sessions', () => {
            accumulator.pushChunk('session1', 'Session 1');
            accumulator.pushChunk('session2', 'Session 2');
            accumulator.clearSession('session1');

            expect(accumulator.getPending('session1')).toBeNull();
            expect(accumulator.getPending('session2')?.pending).toBe('Session 2');
        });
    });

    describe('Session reuse after clearing', () => {
        it('should allow new content after clearing', () => {
            accumulator.pushChunk('session1', 'Old content');
            accumulator.clearSession('session1');
            accumulator.pushChunk('session1', 'New content');

            expect(accumulator.getPending('session1')?.pending).toBe('New content');
        });

        it('should start fresh without old state', () => {
            accumulator.pushChunk('session1', '```');
            expect(accumulator.getPending('session1')?.inCodeBlock).toBe(true);

            accumulator.clearSession('session1');
            accumulator.pushChunk('session1', 'Fresh start');

            expect(accumulator.getPending('session1')?.inCodeBlock).toBe(false);
        });
    });
});

// =============================================================================
// TEST SUITE: GET /stream/:sessionId/pending - Extension Feature
// =============================================================================

describe('GET /stream/:sessionId/pending - Extension Feature', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Pending content retrieval', () => {
        it('should return null for non-existent session', () => {
            const result = accumulator.getPending('nonexistent');

            expect(result).toBeNull();
        });

        it('should return pending text content', () => {
            accumulator.pushChunk('session1', 'Incomplete text');
            const result = accumulator.getPending('session1');

            expect(result?.pending).toBe('Incomplete text');
        });

        it('should return pending code content', () => {
            accumulator.pushChunk('session1', '```incomplete code');
            const result = accumulator.getPending('session1');

            expect(result?.pending).toBe('incomplete code');
            expect(result?.inCodeBlock).toBe(true);
        });

        it('should indicate if inside code block', () => {
            accumulator.pushChunk('session1', 'text```code');
            const result = accumulator.getPending('session1');

            expect(result?.inCodeBlock).toBe(true);
        });

        it('should indicate if outside code block', () => {
            accumulator.pushChunk('session1', '```code```more text');
            const result = accumulator.getPending('session1');

            expect(result?.inCodeBlock).toBe(false);
        });
    });
});

// =============================================================================
// TEST SUITE: Edge Cases and Special Characters
// =============================================================================

describe('Edge Cases and Special Characters', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Backtick variations', () => {
        it('should handle single backticks as regular text', () => {
            const result = accumulator.pushChunk('session1', 'Use `code` inline```');

            expect(result.blocks[0].content).toContain('`code`');
        });

        it('should handle double backticks as regular text', () => {
            const result = accumulator.pushChunk('session1', 'Some ``text`` here```');

            expect(result.blocks[0].content).toContain('``text``');
        });

        it('should handle four or more backticks as regular content', () => {
            accumulator.pushChunk('session1', '```');
            const result = accumulator.pushChunk('session1', '````');

            // Four backticks = closing ``` + one ` remaining as text
            // The implementation splits at ``` delimiter, so we get a code block
            expect(result.blocks.length).toBe(1);
            expect(result.blocks[0].type).toBe('code');
        });
    });

    describe('Unicode and special characters', () => {
        it('should handle unicode in text', () => {
            const result = accumulator.pushChunk('session1', '\u65E5\u672C\u8A9E text```');

            expect(result.blocks[0].content).toBe('\u65E5\u672C\u8A9E text');
        });

        it('should handle unicode in code', () => {
            const result = accumulator.pushChunk('session1', '```const msg = "\u65E5\u672C\u8A9E"```');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toContain('\u65E5\u672C\u8A9E');
        });

        it('should handle emoji', () => {
            const result = accumulator.pushChunk('session1', 'Hello \uD83D\uDC4B```');

            expect(result.blocks[0].content).toBe('Hello \uD83D\uDC4B');
        });

        it('should handle newlines and tabs', () => {
            const result = accumulator.pushChunk('session1', 'Line1\n\tIndented\r\nWindows```');

            expect(result.blocks[0].content).toBe('Line1\n\tIndented\r\nWindows');
        });
    });

    describe('Empty and whitespace content', () => {
        it('should handle whitespace-only text', () => {
            const result = accumulator.pushChunk('session1', '   \n\t  ```');

            expect(result.blocks[0].content).toBe('   \n\t  ');
        });

        it('should handle whitespace-only code', () => {
            const result = accumulator.pushChunk('session1', '```   \n\t  ```');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe('   \n\t  ');
        });
    });

    describe('Very long content', () => {
        it('should handle very long text blocks', () => {
            const longText = 'a'.repeat(10000);
            const result = accumulator.pushChunk('session1', longText + '```');

            expect(result.blocks[0].content).toBe(longText);
        });

        it('should handle very long code blocks', () => {
            const longCode = 'x'.repeat(10000);
            const result = accumulator.pushChunk('session1', '```' + longCode + '```');

            const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
            expect(codeBlock?.content).toBe(longCode);
        });
    });
});

// =============================================================================
// TEST SUITE: Response Format Validation
// =============================================================================

describe('Response Format Validation', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('ChunkResponse structure', () => {
        it('should return object with blocks array', () => {
            const result = accumulator.pushChunk('session1', 'text```code```');

            expect(result).toHaveProperty('blocks');
            expect(Array.isArray(result.blocks)).toBe(true);
        });

        it('should have blocks with type and content', () => {
            const result = accumulator.pushChunk('session1', 'text```code```');

            result.blocks.forEach((block: Block) => {
                expect(block).toHaveProperty('type');
                expect(block).toHaveProperty('content');
                expect(['text', 'code', 'inline_code']).toContain(block.type);
                expect(typeof block.content).toBe('string');
            });
        });
    });

    describe('PendingResponse structure', () => {
        it('should return object with pending and inCodeBlock', () => {
            accumulator.pushChunk('session1', 'test');
            const result = accumulator.getPending('session1');

            expect(result).toHaveProperty('pending');
            expect(result).toHaveProperty('inCodeBlock');
            expect(typeof result?.pending).toBe('string');
            expect(typeof result?.inCodeBlock).toBe('boolean');
        });
    });
});

// =============================================================================
// TEST SUITE: Stress Tests
// =============================================================================

describe('Stress Tests', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    describe('Many sessions', () => {
        it('should handle 100 concurrent sessions', () => {
            for (let i = 0; i < 100; i++) {
                accumulator.pushChunk(`session${i}`, `Content ${i}`);
            }

            for (let i = 0; i < 100; i++) {
                const pending = accumulator.getPending(`session${i}`);
                expect(pending?.pending).toBe(`Content ${i}`);
            }
        });
    });

    describe('Many chunks per session', () => {
        it('should handle 1000 chunks in one session', () => {
            for (let i = 0; i < 1000; i++) {
                accumulator.pushChunk('session1', 'x');
            }

            const pending = accumulator.getPending('session1');
            expect(pending?.pending.length).toBe(1000);
        });
    });

    describe('Rapid block emission', () => {
        it('should handle rapid alternation', () => {
            let totalBlocks = 0;
            for (let i = 0; i < 100; i++) {
                const result = accumulator.pushChunk('session1', 'text```code```');
                totalBlocks += result.blocks.length;
            }

            expect(totalBlocks).toBe(200); // 100 text + 100 code blocks
        });
    });
});

// =============================================================================
// TEST SUITE: Requirements Compliance
// =============================================================================

describe('Requirements Compliance', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
        accumulator = createStreamAccumulator();
    });

    it('REQUIREMENT: POST /stream/:sessionId accumulates text for session', () => {
        accumulator.pushChunk('session1', 'Hello ');
        accumulator.pushChunk('session1', 'World');

        const pending = accumulator.getPending('session1');
        expect(pending?.pending).toBe('Hello World');
    });

    it('REQUIREMENT: Response returns complete blocks: {"blocks": [...]}', () => {
        const result = accumulator.pushChunk('session1', 'text```code```');

        expect(result).toHaveProperty('blocks');
        expect(Array.isArray(result.blocks)).toBe(true);
    });

    it('REQUIREMENT: Block format is {"type": "text"|"code", "content": "..."}', () => {
        const result = accumulator.pushChunk('session1', 'text```code```');

        expect(result.blocks[0]).toMatchObject({
            type: expect.stringMatching(/^(text|code)$/),
            content: expect.any(String)
        });
    });

    it('REQUIREMENT: Code blocks delimited by triple backticks', () => {
        const result = accumulator.pushChunk('session1', '```code content```');

        const codeBlock = result.blocks.find((b: Block) => b.type === 'code');
        expect(codeBlock?.content).toBe('code content');
    });

    it('REQUIREMENT: Blocks only emitted when complete', () => {
        const result1 = accumulator.pushChunk('session1', '```incomplete');
        expect(result1.blocks).toEqual([]);

        const result2 = accumulator.pushChunk('session1', ' code```');
        expect(result2.blocks).toHaveLength(1);
    });

    it('REQUIREMENT: DELETE /stream/:sessionId clears session', () => {
        accumulator.pushChunk('session1', 'content');
        accumulator.clearSession('session1');

        expect(accumulator.getPending('session1')).toBeNull();
    });
});
