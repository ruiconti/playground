# Cursor Technical Interview Prep

## Interview Description

> You'll be pairing with one of our engineers to work on a backend coding problem. You will use a CoderPad pad which the interviewer will share in the chat. We encourage you to discuss your approach and reasoning out loud and to ask clarifying questions. We are interested in how you write and iterate on code, and your understanding of product requirements, API design, and low-level systems design.
>
> You can use any programming language you're comfortable with. The starter template is available in Python, TypeScript, JavaScript, Ruby, Java, Go, C++, Kotlin, and C#. You can use the web to search for syntax, documentation, and examples, but you cannot use AI tools.

---

## Research Findings

### Gist (1-minute read)

- **Pairing CoderPad, no AI**: You’ll code live with an engineer, explain tradeoffs, and ask clarifying questions. Autocomplete only; no AI tools. Expect time pressure.
- **Problems skew practical**: CRUD + REST endpoints, joins on relational data, data normalization, and streaming/buffering. The goal is to see how you iterate, not just correctness.
- **Low-level systems = pragmatic**: Efficient queries, avoiding N+1s, memory‑safe streaming, and sensible data structures (not formal LLD diagrams).
- **Onsite later is real‑project work**: The pairing round is about product/API reasoning and clean implementation under time constraints.

### Cursor Interview Process (Verified)

- **No AI tools** during technical screens (autocomplete only). CEO Michael Truell: "Programming without AI is still a really great time-boxed test for skill and intelligence."
- Questions are **practical, not complicated, but time-pressured**. Practice typing fast.
- Final round is 2-day onsite building real projects with the team.
- Pairing format: they watch how you iterate, not just whether you get the right answer.

### Reported Technical Problems (Higher-Signal)

| Problem | Source | Stage |
|---------|--------|-------|
| Streaming Markdown Parser (TypeScript) | 1Point3Acres | Take-home |
| Efficient streaming algorithm with starter code | Glassdoor | Take-home |
| Hash tree for repository data | Exponent | Phone screen |
| Binary tree top view | Exponent | Phone screen |
| Find duplicate files in filesystem | Exponent | Phone screen |

**Note**: These are not “official,” but they’re **higher signal for Cursor‑specific flavor** than generic CoderPad prompts. Treat them as **priority practice**, even if the exact question differs.

### CoderPad Backend Problem Patterns (Lower Signal / Good Warm‑ups)

From CoderPad's official question library and company blogs:

1. **Family Tree API** (CoderPad's featured problem): Given a database with Person table (self-referential parent links), implement endpoints like `/orphans/`, `/grandparents/:id`, `/siblings/:id` with query params. Tests JOIN operations, recursive queries, and API design.

2. **Data Ingestion + CRUD**: Fetch from external source → model → persist → expose REST endpoints. Example: Star Wars planets from GraphQL → local DB → REST API.

3. **Date/Timezone Normalization**: Consolidate datasets with different date formats and timezones, normalize to UTC ISO 8601, sort chronologically.

### What "Low-Level Systems Design" Means Here

Based on research, this likely means:
- **Not** traditional LLD (class diagrams, OOP patterns)
- **Yes**: Streaming/chunking, buffering strategies, efficient data structures, memory-conscious implementations
- Cursor's backend handles 1M+ queries/sec, streams AI responses, manages codebase indexes via Merkle trees

---

## Key Evaluation Criteria

From the interview description + pairing interview research:

| Area | What They're Looking For |
|------|--------------------------|
| **Iteration** | Start simple, refactor as requirements evolve |
| **Product requirements** | Ask clarifying questions before coding |
| **API design** | HTTP methods, status codes, error handling, idempotency |
| **Low-level systems** | Streaming, buffering, JOIN optimization, memory efficiency |
| **Communication** | Verbalize reasoning, explain tradeoffs as you go |

---

## Practice Exercises (Revised)

### Exercises for Tomorrow (highest signal first)

Prioritize the **reported Cursor-style problems**. They’re not official, but they’re the most **Cursor-flavored** and therefore highest signal. Use CoderPad-style CRUD/API exercises as **warm‑ups** or backups if you have time.

**Time budget (total ~4–4.5 hours)**
- Warm-up (15 min): HTTP semantics + status codes + idempotency quick recall.
- Exercise 1 (75 min): Streaming Markdown Parser.
- Exercise 2 (60 min): Efficient streaming algorithm.
- Exercise 3 (45 min): Hash/Merkle tree for change detection.
- Exercise 4 (40 min): File deduplication.
- Exercise 5 (30 min): Binary tree top view.
- Optional warm‑up (60–75 min): Family Tree API or Data Ingestion CRUD.

---

### Exercise 1: Streaming Markdown Parser (Reported)

Build a **streaming markdown parser** that processes input in chunks and emits HTML incrementally.

```typescript
// Given: chunks of markdown arriving over time
// Goal: emit HTML as soon as it is safe, while preserving correctness
// Constraints:
// - Do not buffer the entire document
// - Handle tokens split across chunk boundaries
// - Correctly handle fenced code blocks across chunks

interface ParserState { /* your state */ }
function ingestChunk(chunk: string, state: ParserState): { html: string; state: ParserState } { }
```

**Key skills tested**:
- Incremental parsing / state machines
- Buffering only what’s necessary
- Clear reasoning about edge cases (partial tokens, fence boundaries)

---

### Exercise 2: Efficient Streaming Algorithm (Reported)

Implement a **streaming algorithm** with limited memory.

```typescript
// Example: rolling unique-user counts per 5-minute window
// Input: stream of events { userId, timestamp }
// Output: every minute, emit unique count for the last 5 minutes
// Constraint: do not store all events forever
```

**Key skills tested**:
- Sliding window data structures
- Time complexity vs memory tradeoffs
- Clean incremental updates

---

### Exercise 3: Hash/Merkle Tree for Change Detection (Reported)

Cursor uses Merkle trees to track file changes. Practice building one.

```typescript
// Given: A directory tree
// Build: A content-addressable hash tree
// Use case: Detect which files changed since last sync

interface TreeNode {
  hash: string;  // Hash of content (files) or children hashes (dirs)
  children?: Map<string, TreeNode>;
}

function buildMerkleTree(root: string): TreeNode { }
function findChangedPaths(oldTree: TreeNode, newTree: TreeNode): string[] { }
```

---

### Exercise 4: File Deduplication (Reported)

```typescript
async function findDuplicates(root: string): Promise<string[][]> {
  // Return groups of duplicate file paths
}

// Optimization path to discuss:
// 1. Group by size (O(1) comparison, eliminates most files)
// 2. For same-size: compare first 4KB
// 3. Still ambiguous: full content hash
// 4. Large files: stream hash without loading entire file
```

**Key insight**: The naive solution (hash everything) is O(n * filesize). The optimized solution is O(n) for most real codebases where duplicates are rare.

---

### Exercise 5: Binary Tree Top View (Reported)

```typescript
// Given: a binary tree
// Return: nodes visible from the top view, left-to-right
// Approach: BFS by horizontal distance, first node wins
```

**Key skills tested**:
- Tree traversal + BFS
- Mapping horizontal distance to first-seen node

---

### Exercise 6: Family Tree API (CoderPad baseline / warm‑up)

This is CoderPad's featured backend problem. Given starter code with a Person model:

```typescript
// Schema (provided):
// Person { id, name, age, parent1_id, parent2_id }
// Database pre-populated with test data

// Task 1: Modify GET /persons/:id to return only useful fields
// Task 2: Add GET /orphans - persons where both parents are null
// Task 3: Add GET /grandparents/:id - return all 4 grandparents
// Task 4: Add query param GET /orphans?monoparental=true - single parent
// Task 5: Add GET /siblings/:id?half=true - include half-siblings
```

**Key skills tested**:
- SQL JOINs on self-referential tables
- Building single efficient queries vs multiple round-trips
- Query parameter handling
- Error cases (person not found, invalid params)

**Red flags interviewers look for**:
- N+1 queries (fetching parents in a loop)
- Not asking about error handling behavior
- Ignoring a "debug-only" endpoint that leaks data

---

### Exercise 7: Data Ingestion + REST API (CoderPad baseline / warm‑up)

Classic CoderPad pattern. You'll get starter code with a framework set up.

```typescript
// Given: GraphQL endpoint returning planets data
// Task: Build REST API backed by local database

// Part 1: Fetch and persist
async function seedDatabase() {
  // Query: { allPlanets { planets { name, population, terrains, climates } } }
  // Model decision: planet has many terrains (1:N? JSON array?)
}

// Part 2: Implement CRUD
// GET  /planets         - list with pagination (?page=2&limit=10)
// GET  /planets/:id     - single planet, 404 if not found
// POST /planets         - create, return 201 + Location header
// PUT  /planets/:id     - update, 404 if not found
// DELETE /planets/:id   - delete, 204 on success

// Part 3: Add filtering
// GET /planets?climate=arid&terrain=desert
```

**Key skills tested**:
- Data modeling decisions (normalize vs denormalize terrains/climates)
- Pagination (offset vs cursor-based)
- Proper HTTP semantics
- Input validation and error responses

**Questions to ask**:
- "Should filtering be AND or OR for multiple values?"
- "What should happen if we POST a planet that already exists?"
- "Is pagination offset-based or cursor-based?"

---

### Exercise 8: Date Normalization Service (CoderPad baseline / warm‑up)

Another CoderPad official problem. Tests library usage and data transformation.

```typescript
// Given: Three datasets with dates in different formats/timezones
// facebook_events: UTC, "dd/mm/yy HH:MM AM/PM"
// tastewine_events: Europe/Paris, "dd/mm/yyyy HH:MM"
// vwyz_events: America/Los_Angeles, "m/d/yyyy HH:MM:SS"

// Task: Merge all events, normalize to UTC ISO 8601, sort chronologically
// Output: Array of { source, id, timestamp }

// Key insight: Use a library (date-fns-tz, luxon, dayjs) - don't roll your own
```

**Key skills tested**:
- Knowing when to use libraries vs implement yourself
- Timezone handling (DST edge cases)
- Data transformation patterns

---

## Language Choice

**TypeScript** is the strongest choice:
- Cursor's business logic is TypeScript
- CoderPad has good TS support with Node.js backend frameworks
- Type annotations help communicate intent during pairing

**Go** is solid if you're faster in it:
- Shows systems thinking
- Good for concurrent/streaming discussions

**Avoid Python** unless you're significantly faster - the time pressure is real.

---

## During the Interview

### First 2-3 minutes: Clarify requirements

Ask questions like:
- "What should the response look like when X is not found?"
- "Should I prioritize read performance or write performance?"
- "Is there an existing error format I should follow?"
- "What's the expected data scale?"

### While coding

- **Verbalize tradeoffs**: "I'll use a Map here for O(1) lookups. If memory were constrained, we could..."
- **Name things well**: `findOrphanPersonIds()` not `query()`
- **Start simple**: Get something working, then iterate. They said they watch how you iterate.
- **Don't gold-plate**: If they didn't ask for pagination, don't add it unprompted

### When stuck

- Say what you're thinking: "I'm trying to figure out how to handle the case where..."
- Ask for hints: The interviewer is there to help, not just evaluate

---

## What to Practice

1. **Set up CoderPad environment locally**: Create an Express/Fastify server, wire up a SQLite DB, practice building endpoints quickly.

2. **Time yourself**: 20 minutes per endpoint with follow-up questions. Real interview will have ~45 minutes of coding.

3. **Practice without AI**: This is harder than it sounds if you've been using Copilot/Cursor daily.

4. **SQL JOINs**: Self-referential joins (parent → grandparent), filtering with query params.

5. **HTTP semantics**: Know which status codes for which situations. Know idempotency.

---

## Sources

- [Glassdoor - Cursor Interviews](https://www.glassdoor.com/Interview/Cursor-CA-Interview-Questions-E10123048.htm)
- [TeamBlind - Cursor Tips](https://www.teamblind.com/post/got-a-cursor-interview-any-preparation-tips-bf4zakxi)
- [1Point3Acres - Cursor Questions](https://www.1point3acres.com/interview/company/cursor)
- [Cursor Hiring Strategy (AOL/BI)](https://www.aol.com/inside-cursors-hiring-strategy-no-052015324.html)
- [Exponent - Cursor Guide](https://www.tryexponent.com/guides/cursor-software-engineer-interview-guide)
- [CoderPad Backend Questions](https://coderpad.io/interview-questions/backend-interview-questions/)
- [CoderPad - Intermediate Backend Questions](https://coderpad.io/blog/interviewing/2-interview-questions-to-assess-your-next-intermediate-backend-engineer/)
- [Monzo - Backend Interview Process](https://monzo.com/blog/demystifying-the-backend-engineering-interview-process)
- [Wise - Pair Programming Interviews](https://wise.jobs/pair-programming-interviews)
- [Pragmatic Engineer - Building Cursor](https://newsletter.pragmaticengineer.com/p/cursor)
- [Shopify - Streaming Markdown](https://shopify.engineering/sidekicks-improved-streaming)
