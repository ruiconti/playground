import { describe, it, expect, beforeEach } from 'bun:test';
import {
    createAutocompleteService,
    type AutocompleteService,
    type Suggestion,
} from './06_autocomplete';
import { isExtensionsEnabled } from './test_utils';

const describeExt = isExtensionsEnabled() ? describe : describe.skip;

// =============================================================================
// TEST SUITE: POST /terms - Term Registration
// =============================================================================

describe('POST /terms - Term Registration', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Basic term registration', () => {
        it('should register a new term with count 1', async () => {
            const result = await service.registerTerm('cursor');

            expect(result.term).toBe('cursor');
            expect(result.count).toBe(1);
        });

        it('should increment count for existing term', async () => {
            await service.registerTerm('cursor');
            const result = await service.registerTerm('cursor');

            expect(result.count).toBe(2);
        });

        it('should track multiple increments correctly', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            const result = await service.registerTerm('cursor');

            expect(result.count).toBe(4);
        });

        it('should register different terms independently', async () => {
            const result1 = await service.registerTerm('cursor');
            const result2 = await service.registerTerm('curly');

            expect(result1.count).toBe(1);
            expect(result2.count).toBe(1);
        });
    });

    describe('Case handling', () => {
        it('should treat same term with different cases as same entry', async () => {
            await service.registerTerm('Cursor');
            const result = await service.registerTerm('cursor');

            expect(result.count).toBe(2);
        });

        it('should treat UPPERCASE and lowercase as same entry', async () => {
            await service.registerTerm('CURSOR');
            await service.registerTerm('cursor');
            const result = await service.registerTerm('Cursor');

            expect(result.count).toBe(3);
        });

        it('should preserve original casing of first registration', async () => {
            await service.registerTerm('CuRsOr');
            const result = await service.registerTerm('cursor');

            expect(result.term).toBe('CuRsOr');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string term', async () => {
            const result = await service.registerTerm('');

            expect(result.term).toBe('');
            expect(result.count).toBe(1);
        });

        it('should handle single character term', async () => {
            const result = await service.registerTerm('a');

            expect(result.term).toBe('a');
            expect(result.count).toBe(1);
        });

        it('should handle very long terms', async () => {
            const longTerm = 'a'.repeat(1000);
            const result = await service.registerTerm(longTerm);

            expect(result.term).toBe(longTerm);
            expect(result.count).toBe(1);
        });

        it('should handle terms with special characters', async () => {
            const result = await service.registerTerm('hello-world_123');

            expect(result.term).toBe('hello-world_123');
            expect(result.count).toBe(1);
        });

        it('should handle terms with unicode characters', async () => {
            const unicodeTerm = 'hello world \u65E5\u672C\u8A9E';
            const result = await service.registerTerm(unicodeTerm);

            expect(result.term).toBe(unicodeTerm);
            expect(result.count).toBe(1);
        });

        it('should handle terms with whitespace', async () => {
            const result = await service.registerTerm('hello world');

            expect(result.term).toBe('hello world');
            expect(result.count).toBe(1);
        });

        it('should handle terms with leading/trailing whitespace as distinct', async () => {
            await service.registerTerm('  hello  ');
            const result = await service.registerTerm('  hello  ');

            expect(result.count).toBe(2);
        });
    });

    describe('Concurrent registration', () => {
        it('should handle concurrent registrations of same term', async () => {
            const promises = Array(10).fill(null).map(() => service.registerTerm('cursor'));
            const results = await Promise.all(promises);

            const maxCount = Math.max(...results.map(r => r.count));
            expect(maxCount).toBe(10);
        });

        it('should handle concurrent registrations of different terms', async () => {
            const terms = ['cursor', 'curly', 'current', 'cube', 'cup'];
            const promises = terms.map(t => service.registerTerm(t));
            const results = await Promise.all(promises);

            results.forEach(r => {
                expect(r.count).toBe(1);
            });
        });
    });
});

// =============================================================================
// TEST SUITE: GET /autocomplete - Prefix Matching
// =============================================================================

describe('GET /autocomplete - Prefix Matching', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Basic prefix matching', () => {
        it('should return empty suggestions for non-matching prefix', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('xyz');

            expect(result.suggestions).toEqual([]);
        });

        it('should return matching term for exact prefix', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(1);
            expect(result.suggestions[0].term).toBe('cursor');
        });

        it('should return multiple matching terms', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('current');

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(3);
        });

        it('should return term when prefix matches entire term', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('cursor');

            expect(result.suggestions).toHaveLength(1);
            expect(result.suggestions[0].term).toBe('cursor');
        });

        it('should return empty for prefix longer than any term', async () => {
            await service.registerTerm('cur');

            const result = await service.autocomplete('cursor');

            expect(result.suggestions).toEqual([]);
        });
    });

    describe('Case-insensitive matching', () => {
        it('should match prefix regardless of case', async () => {
            await service.registerTerm('Cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(1);
            expect(result.suggestions[0].term).toBe('Cursor');
        });

        it('should match uppercase prefix to lowercase term', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('CUR');

            expect(result.suggestions).toHaveLength(1);
            expect(result.suggestions[0].term).toBe('cursor');
        });

        it('should match mixed case prefix', async () => {
            await service.registerTerm('CURSOR');

            const result = await service.autocomplete('CuR');

            expect(result.suggestions).toHaveLength(1);
        });

        it('should preserve original casing in response', async () => {
            await service.registerTerm('CuRsOr');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0].term).toBe('CuRsOr');
        });
    });

    describe('Ranking by count (descending)', () => {
        it('should rank terms by count descending', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0].term).toBe('cursor');
            expect(result.suggestions[0].count).toBe(2);
            expect(result.suggestions[1].term).toBe('curly');
            expect(result.suggestions[1].count).toBe(1);
        });

        it('should update ranking when counts change', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('curly');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0].term).toBe('curly');
            expect(result.suggestions[0].count).toBe(3);
            expect(result.suggestions[1].term).toBe('cursor');
            expect(result.suggestions[1].count).toBe(1);
        });

        it('should handle multiple terms with same count', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('current');

            const result = await service.autocomplete('cur');

            expect(result.suggestions.every((s: Suggestion) => s.count === 1)).toBe(true);
            expect(result.suggestions).toHaveLength(3);
        });

        it('should correctly rank from example scenario', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('current');
            await service.registerTerm('current');
            await service.registerTerm('current');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0]).toEqual({ term: 'current', count: 3 });
            expect(result.suggestions[1]).toEqual({ term: 'cursor', count: 2 });
            expect(result.suggestions[2]).toEqual({ term: 'curly', count: 1 });
        });
    });

    describe('Top 5 limit', () => {
        it('should return at most 5 suggestions', async () => {
            const terms = ['cur1', 'cur2', 'cur3', 'cur4', 'cur5', 'cur6', 'cur7'];
            for (const term of terms) {
                await service.registerTerm(term);
            }

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(5);
        });

        it('should return top 5 by count when more than 5 match', async () => {
            for (let i = 1; i <= 7; i++) {
                for (let j = 0; j < i; j++) {
                    await service.registerTerm(`cur${i}`);
                }
            }

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(5);
            expect(result.suggestions[0].term).toBe('cur7');
            expect(result.suggestions[0].count).toBe(7);
            expect(result.suggestions[4].term).toBe('cur3');
            expect(result.suggestions[4].count).toBe(3);
        });

        it('should return fewer than 5 when fewer terms match', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toHaveLength(2);
        });

        it('should return empty array when no terms exist', async () => {
            const result = await service.autocomplete('cur');

            expect(result.suggestions).toEqual([]);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty prefix', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('apple');

            const result = await service.autocomplete('');

            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        it('should handle single character prefix', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('apple');

            const result = await service.autocomplete('c');

            expect(result.suggestions).toHaveLength(2);
        });

        it('should handle prefix with special characters', async () => {
            await service.registerTerm('hello-world');
            await service.registerTerm('hello_world');

            const result = await service.autocomplete('hello-');

            expect(result.suggestions).toHaveLength(1);
            expect(result.suggestions[0].term).toBe('hello-world');
        });

        it('should handle prefix with unicode', async () => {
            await service.registerTerm('\u65E5\u672C\u8A9E\u30C6\u30B9\u30C8');

            const result = await service.autocomplete('\u65E5\u672C');

            expect(result.suggestions).toHaveLength(1);
        });
    });
});

// =============================================================================
// TEST SUITE: DELETE /terms/:term - Extension Feature
// =============================================================================

describeExt('DELETE /terms/:term - Extension Feature', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Basic deletion', () => {
        it('should decrement count on delete', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');

            const result = await service.deleteTerm('cursor');

            expect(result.deleted).toBe(false);
            expect(result.remaining).toBe(1);
        });

        it('should remove term when count reaches zero', async () => {
            await service.registerTerm('cursor');

            const result = await service.deleteTerm('cursor');

            expect(result.deleted).toBe(true);
            expect(result.remaining).toBe(0);
        });

        it('should return deleted=false for non-existent term', async () => {
            const result = await service.deleteTerm('nonexistent');

            expect(result.deleted).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('Case handling in deletion', () => {
        it('should delete case-insensitively', async () => {
            await service.registerTerm('Cursor');

            const result = await service.deleteTerm('cursor');

            expect(result.deleted).toBe(true);
        });

        it('should handle mixed case deletion', async () => {
            await service.registerTerm('CURSOR');
            await service.registerTerm('cursor');

            const result = await service.deleteTerm('CuRsOr');

            expect(result.remaining).toBe(1);
        });
    });

    describe('Integration with autocomplete', () => {
        it('should not appear in autocomplete after full deletion', async () => {
            await service.registerTerm('cursor');
            await service.deleteTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions).toEqual([]);
        });

        it('should appear with decremented count after partial deletion', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.deleteTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0].count).toBe(2);
        });

        it('should update ranking after deletion', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');
            await service.registerTerm('curly');

            await service.deleteTerm('cursor');
            await service.deleteTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0].term).toBe('curly');
            expect(result.suggestions[0].count).toBe(2);
            expect(result.suggestions[1].term).toBe('cursor');
            expect(result.suggestions[1].count).toBe(1);
        });
    });
});

// =============================================================================
// TEST SUITE: Boost Extension Feature
// =============================================================================

describeExt('Boost Extension Feature', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Basic boost functionality', () => {
        it('should rank boosted term first if it matches', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: 'curly' });

            expect(result.suggestions[0].term).toBe('curly');
            expect(result.suggestions[1].term).toBe('cursor');
        });

        it('should not affect ranking if boosted term does not match prefix', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: 'apple' });

            expect(result.suggestions[0].count).toBeGreaterThanOrEqual(result.suggestions[1]?.count ?? 0);
        });

        it('should handle case-insensitive boost', async () => {
            await service.registerTerm('CURSOR');
            await service.registerTerm('CURSOR');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: 'CURLY' });

            expect(result.suggestions[0].term).toBe('curly');
        });

        it('should keep original count when boosting', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: 'curly' });

            expect(result.suggestions[0].count).toBe(1);
            expect(result.suggestions[1].count).toBe(2);
        });
    });

    describe('Boost edge cases', () => {
        it('should handle boost when term is already first', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: 'cursor' });

            expect(result.suggestions[0].term).toBe('cursor');
        });

        it('should handle boost with empty results', async () => {
            const result = await service.autocomplete('xyz', { boost: 'cursor' });

            expect(result.suggestions).toEqual([]);
        });

        it('should handle undefined boost', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const result = await service.autocomplete('cur', { boost: undefined });

            expect(result.suggestions).toHaveLength(2);
        });
    });
});

// =============================================================================
// TEST SUITE: Response Format Validation
// =============================================================================

describe('Response Format Validation', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Autocomplete response structure', () => {
        it('should return object with suggestions array', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result).toHaveProperty('suggestions');
            expect(Array.isArray(result.suggestions)).toBe(true);
        });

        it('should return suggestions with term and count properties', async () => {
            await service.registerTerm('cursor');

            const result = await service.autocomplete('cur');

            expect(result.suggestions[0]).toHaveProperty('term');
            expect(result.suggestions[0]).toHaveProperty('count');
            expect(typeof result.suggestions[0].term).toBe('string');
            expect(typeof result.suggestions[0].count).toBe('number');
        });

        it('should return empty suggestions array when no matches', async () => {
            const result = await service.autocomplete('xyz');

            expect(result.suggestions).toEqual([]);
        });
    });

    describe('Term registration response structure', () => {
        it('should return object with term and count properties', async () => {
            const result = await service.registerTerm('cursor');

            expect(result).toHaveProperty('term');
            expect(result).toHaveProperty('count');
            expect(typeof result.term).toBe('string');
            expect(typeof result.count).toBe('number');
        });
    });
});

// =============================================================================
// TEST SUITE: Performance and Stress Tests
// =============================================================================

describe('Performance and Stress Tests', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    describe('Large dataset handling', () => {
        it('should handle 1000 unique terms', async () => {
            for (let i = 0; i < 1000; i++) {
                await service.registerTerm(`term${i}`);
            }

            const result = await service.autocomplete('term');

            expect(result.suggestions).toHaveLength(5);
        });

        it('should handle term with 10000 registrations', async () => {
            for (let i = 0; i < 10000; i++) {
                await service.registerTerm('popular');
            }

            const result = await service.autocomplete('pop');

            expect(result.suggestions[0].count).toBe(10000);
        });

        it('should handle concurrent autocomplete queries', async () => {
            await service.registerTerm('cursor');
            await service.registerTerm('curly');

            const promises = Array(100).fill(null).map(() => service.autocomplete('cur'));
            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result.suggestions).toHaveLength(2);
            });
        });
    });

    describe('Mixed operations stress test', () => {
        it('should handle interleaved register and autocomplete operations', async () => {
            const operations: Promise<unknown>[] = [];

            for (let i = 0; i < 50; i++) {
                operations.push(service.registerTerm(`cursor${i % 5}`));
                operations.push(service.autocomplete('cursor'));
            }

            const results = await Promise.all(operations);

            expect(results.length).toBe(100);
        });
    });
});

// =============================================================================
// TEST SUITE: Requirements Compliance
// =============================================================================

describe('Requirements Compliance', () => {
    let service: AutocompleteService;

    beforeEach(() => {
        service = createAutocompleteService();
    });

    it('REQUIREMENT: POST /terms registers a term or increments count', async () => {
        const first = await service.registerTerm('cursor');
        const second = await service.registerTerm('cursor');

        expect(first.count).toBe(1);
        expect(second.count).toBe(2);
    });

    it('REQUIREMENT: GET /autocomplete returns top 5 terms matching prefix', async () => {
        for (let i = 0; i < 10; i++) {
            await service.registerTerm(`term${i}`);
        }

        const result = await service.autocomplete('term');

        expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('REQUIREMENT: Results sorted by count descending', async () => {
        await service.registerTerm('cursor');
        await service.registerTerm('cursor');
        await service.registerTerm('curly');

        const result = await service.autocomplete('cur');

        for (let i = 0; i < result.suggestions.length - 1; i++) {
            expect(result.suggestions[i].count).toBeGreaterThanOrEqual(result.suggestions[i + 1].count);
        }
    });

    it('REQUIREMENT: Prefix matching is case-insensitive', async () => {
        await service.registerTerm('Cursor');

        const result = await service.autocomplete('CUR');

        expect(result.suggestions).toHaveLength(1);
    });

    it('REQUIREMENT: Return original casing in response', async () => {
        await service.registerTerm('CuRsOr');

        const result = await service.autocomplete('cursor');

        expect(result.suggestions[0].term).toBe('CuRsOr');
    });

    it('REQUIREMENT: Response format is {"suggestions": [{"term": "...", "count": number}, ...]}', async () => {
        await service.registerTerm('cursor');

        const result = await service.autocomplete('cur');

        expect(result).toHaveProperty('suggestions');
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(result.suggestions[0]).toMatchObject({
            term: expect.any(String),
            count: expect.any(Number),
        });
    });
});
