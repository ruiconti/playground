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