# Kata 5 — Merkle Snapshot: Build + Diff + Proof

## Context / Product requirements

You’re building a backend primitive to efficiently detect changes between versions of a file set (e.g., repo snapshot, recording artifact bundle).

The system must:

- represent a snapshot with a single root hash,
- diff two snapshots by descending only into changed subtrees,
- produce a proof that a given file (path, bytes) is part of a snapshot.

This is a core building block for sync/dedup and “trust but verify” workflows.

---

## Goal

Implement a Merkle tree over a snapshot `{ path -> bytes }`.

---

## API (TypeScript)

```ts
export type Snapshot = { [path: string]: Buffer };

export type ProofStep = {
  siblingHashHex: string;
  siblingSide: "left" | "right"; // sibling relative to current node
};

export type MerkleProof = {
  path: string;
  leafHashHex: string;
  steps: ProofStep[];
};

export class MerkleSnapshot {
  // Root hash (lowercase hex)
  readonly rootHashHex: string;

  private constructor(rootHashHex: string) {
    this.rootHashHex = rootHashHex;
  }

  static build(s: Snapshot): MerkleSnapshot {
    throw new Error("TODO");
  }

  // Return changed file paths between two snapshots.
  static diff(a: MerkleSnapshot, b: MerkleSnapshot): string[] {
    throw new Error("TODO");
  }

  // Proof that a given path existed with given contents in this snapshot.
  prove(path: string): MerkleProof {
    throw new Error("TODO");
  }

  static verifyProof(rootHashHex: string, path: string, data: Buffer, proof: MerkleProof): boolean {
    throw new Error("TODO");
  }
}
```

---

## Hashing requirements

Use SHA-256.

### Leaf hash

- Canonical leaf order is by `path` ascending (lexicographic).
- Leaf hash must include path to avoid ambiguity:

`leafHash = SHA256(path + "\0" + bytes)`

Where:

- `path` encoded as UTF-8 bytes
- `"\0"` is a single zero byte delimiter
- `bytes` are the file contents

### Internal node hash

`nodeHash = SHA256(leftHash || rightHash)`

Where `||` is concatenation of the raw 32-byte digests.

### Odd node rule

If a level has an odd number of nodes, duplicate the last node:

- `parent = SHA256(last || last)`

---

## Snapshot validity

On `build(s)`:

- `s` may be empty.
- If empty snapshot:
  - define `rootHashHex = SHA256("")` (hash of empty byte array)
- All paths must be non-empty after trimming.

On invalid input, throw `Error("INVALID_ARGUMENT: <message>")`.

---

## Diff requirements

`diff(a, b)` returns file paths that differ between snapshots.

- If `a.rootHashHex === b.rootHashHex`, return `[]`.
- Otherwise, descend only into mismatching subtrees.
- When you reach differing leaves, return the corresponding `path`.

Constraints / assumptions:

- For this kata, you may assume both snapshots were built with the same canonical ordering rule.
- If the set of paths differs (added/removed files), diff must include those paths.

---

## Proof requirements

`prove(path)`:

- If the path does not exist in this snapshot, throw `Error("NOT_FOUND: path")`.
- Return a sequence of sibling hashes from leaf to root.

`verifyProof(rootHashHex, path, data, proof)`:

- Recompute leaf hash from `(path, data)`.
- Fold siblings from proof in order to compute a root.
- Return true iff computed root equals `rootHashHex`.

Proof ordering:

- `steps[0]` corresponds to the sibling at the leaf level.
- Each step indicates whether the sibling was on the left or right.

---

## Performance expectations

- Build: O(n log n) due to sorting paths and building levels.
- Diff: O(changed_subtrees) (should not scan entire tree when few changes).

---

## Tests you should write

- Empty snapshot root equals sha256(empty).
- Proof verifies for an existing path.
- Proof fails if data changes.
- Diff returns changed path when one file changes.
- Diff returns added/removed paths.
- Determinism: build twice yields same root.

---

## Follow-up ladder (do not implement unless asked)

1) Chunk large files (use CDC chunker, Merkle per file).
2) Incremental update: update one file without rebuilding whole tree.
3) Discuss collision resistance and trust model.
