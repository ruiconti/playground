// ## Problem 4: Prefix Autocomplete with Ranking
//
// You're building an autocomplete service that returns suggestions ranked by frequency.
//
// **Requirements:**
//
// - `POST /terms` with body `{"term": "..."}` registers a term (or increments its count if exists)
// - `GET /autocomplete?prefix=...` returns top 5 terms matching that prefix, sorted by count descending
// - Response format: `{"suggestions": [{"term": "...", "count": number}, ...]}`
// - Prefix matching is case-insensitive, but return original casing
//
// **Example:**
// ```
// POST /terms {"term": "cursor"}
// POST /terms {"term": "cursor"}
// POST /terms {"term": "curly"}
// POST /terms {"term": "current"}
// POST /terms {"term": "current"}
// POST /terms {"term": "current"}
// GET /autocomplete?prefix=cur → {"suggestions": [{"term": "current", "count": 3}, {"term": "cursor", "count": 2}, {"term": "curly", "count": 1}]}
// ```
//
// **What this tests:**
//
// - Efficient prefix lookup (trie or simpler approach under time pressure)
// - Sorting with secondary criteria
// - Case-insensitive matching with case preservation
// - Knowing when to optimize vs ship
//
// **Extensions:**
//
// - Add DELETE /terms/:term that decrements count (remove if zero)
// - Add recency weighting: recently added terms rank higher among equal counts
// - Add GET /autocomplete?prefix=...&boost=... where boost is a term that should rank first if it matches

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Suggestion = { term: string; count: number };
export type AutocompleteResponse = { suggestions: Suggestion[] };
export type TermResponse = { term: string; count: number };
export type DeleteTermResponse = { deleted: boolean; remaining: number };

export interface AutocompleteService {
    registerTerm(term: string): Promise<TermResponse>;
    autocomplete(prefix: string, options?: { boost?: string }): Promise<AutocompleteResponse>;
    deleteTerm(term: string): Promise<DeleteTermResponse>;
}

// =============================================================================
// STUB IMPLEMENTATION
// =============================================================================

export function createAutocompleteService(): AutocompleteService {
    const terms = new Map<string, { original: string; count: number; lastUpdated: number }>();

    return {
        async registerTerm(term: string): Promise<TermResponse> {
            const key = term.toLowerCase();
            const existing = terms.get(key);
            if (existing) {
                existing.count++;
                existing.lastUpdated = Date.now();
                return { term: existing.original, count: existing.count };
            }
            terms.set(key, { original: term, count: 1, lastUpdated: Date.now() });
            return { term, count: 1 };
        },

        async autocomplete(prefix: string, options?: { boost?: string }): Promise<AutocompleteResponse> {
            const lowerPrefix = prefix.toLowerCase();
            const matches: Suggestion[] = [];

            for (const [key, value] of terms.entries()) {
                if (key.startsWith(lowerPrefix)) {
                    matches.push({ term: value.original, count: value.count });
                }
            }

            matches.sort((a, b) => b.count - a.count);

            if (options?.boost) {
                const boostIndex = matches.findIndex(m => m.term.toLowerCase() === options.boost!.toLowerCase());
                if (boostIndex > 0) {
                    const [boosted] = matches.splice(boostIndex, 1);
                    matches.unshift(boosted);
                }
            }

            return { suggestions: matches.slice(0, 5) };
        },

        async deleteTerm(term: string): Promise<DeleteTermResponse> {
            const key = term.toLowerCase();
            const existing = terms.get(key);
            if (!existing) {
                return { deleted: false, remaining: 0 };
            }
            existing.count--;
            if (existing.count <= 0) {
                terms.delete(key);
                return { deleted: true, remaining: 0 };
            }
            return { deleted: false, remaining: existing.count };
        },
    };
}