# Kata 1 — Content-Defined Chunking (CDC) for Dedup

## Context / Product requirements

You’re building a backend component for a developer tool that uploads large blobs (source trees, recordings, traces). To reduce bandwidth and speed up sync, the tool should **deduplicate** data across versions.

Fixed-size chunking breaks dedup when bytes are inserted near the beginning (all subsequent boundaries shift). **Content-defined chunking (CDC)** picks boundaries based on content so boundaries tend to re-align after local edits.

You will implement a deterministic CDC chunker that:

- splits input bytes into variable-sized chunks,
- enforces `minSize <= chunkSize <= maxSize` (except possibly final chunk),
- targets an average chunk size ~ `avgSize`,
- returns SHA-256 hashes for each chunk.

---

## Goal

Implement `Chunker.chunk(data)` as specified.

---

## API (TypeScript)

```ts
export type Chunk = {
  start: number;   // inclusive
  end: number;     // exclusive
  hashHex: string; // sha256(bytes[start..end)) lowercase hex
};

export class Chunker {
  constructor(
    readonly minSize: number,
    readonly avgSize: number,
    readonly maxSize: number
  ) {}

  chunk(data: Uint8Array): Chunk[] {
    throw new Error("TODO");
  }
}
```

---

## Inputs & validation

### Constructor

- `minSize`, `avgSize`, `maxSize` must be integers.
- Must satisfy: `0 < minSize <= avgSize <= maxSize`.
- Must satisfy: `minSize >= 16`.
- Must satisfy: `maxSize <= 8 * 1024 * 1024` (8 MiB).
- On failure, throw `Error("INVALID_ARGUMENT: <message>")`.

### `chunk(data)`

- `data` may be empty.
- If `data` is null/undefined, throw `Error("INVALID_ARGUMENT: data")`.

---

## Rolling hash requirements

Use a rolling hash for boundary detection (not crypto). A simplified Rabin-Karp polynomial rolling hash is acceptable.

### Parameters

- Window size: `W = 48` bytes.
- Base: `B = 257`.
- Modulus: `2^32` (uint32 wraparound).

### Definition

For a window of bytes `x0..x(W-1)` (each 0..255):

- `H = (x0 * B^(W-1) + x1 * B^(W-2) + ... + x(W-1)) mod 2^32`

When sliding the window by one byte (`out` removed, `in` added):

- `H = (H - out * B^(W-1)) * B + in (mod 2^32)`

Precompute:

- `pow = B^(W-1) mod 2^32`.

### Readiness

Boundary detection can only trigger once the rolling window is **ready** for the current chunk:

- `winCount == W` (you have seen at least W bytes since the chunk start).

### Uint32 behavior

All operations must wrap to uint32. In TS/JS, use `>>> 0` after arithmetic.

---

## Boundary rule

Scan forward from `chunkStart`.

Let `chunkLen = (i - chunkStart + 1)` after reading byte at position `i`.

### Allowed boundary

A boundary is allowed only if:

- `chunkLen >= minSize`.

### Targeting average size

Define `mask` from `avgSize`:

- `targetBits = Math.round(Math.log2(avgSize))`
- clamp `targetBits` to `[4..20]`
- `mask = (1 << targetBits) - 1`

Boundary trigger (only if window ready):

- cut at end index `i+1` when `(rollingHash & mask) === 0` and `chunkLen >= minSize`.

### Mandatory cuts

Regardless of the trigger:

- you must cut when `chunkLen == maxSize`, OR
- you must cut at end of input.

### Window reset on cut

When you cut a chunk boundary, you must reset the rolling window state for the next chunk (hash/window must be computed within each chunk).

---

## Output requirements

- If `data.length === 0`, return `[]`.
- Chunks must cover the input exactly with no gaps/overlaps:
  - first chunk `start = 0`
  - each chunk `start` equals previous `end`
  - last chunk `end = data.length`
- Size constraints:
  - each chunk `end-start <= maxSize`
  - each non-final chunk `end-start >= minSize`
  - final chunk may be `< minSize`
- Hash:
  - `hashHex = sha256(bytes[start..end))` lowercase hex.

---

## Allowed crypto implementation note

In Node environments:

```ts
import { createHash } from "crypto";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}
```

---

## Complexity expectations

- One pass over input for boundary detection.
- Time: O(n) + hashing per chunk.
- Space: O(W) rolling state + O(#chunks) output.

---

## Tests you should write

### Invariants

- empty input → `[]`
- coverage: concatenating chunk slices reconstructs the input
- bounds: every chunk `<= maxSize`; non-final chunks `>= minSize`
- determinism: running twice yields identical boundaries + hashes
- hash correctness: recompute sha256 per chunk and match

### Specific cases

- `min=avg=max=64`, input length 200 → sizes `[64, 64, 64, 8]`
- input length `< minSize` → exactly one chunk

---

## Follow-up ladder (do not implement unless asked)

1) Streaming API: `push(Uint8Array)` and emit chunks incrementally.
2) Tune boundary distribution (mask choice) and discuss expected chunk-size distribution.
3) Build Merkle tree over chunk hashes for fast diff.
