// ## Problem: Merkle Snapshot - Build + Diff + Proof
//
// You're building a backend primitive to efficiently detect changes between versions
// of a file set (e.g., repo snapshot, recording artifact bundle).
//
// **Requirements:**
//
// - `MerkleSnapshot.build(snapshot)` creates a Merkle tree from a `{ path -> bytes }` map
// - `MerkleSnapshot.diff(a, b)` returns file paths that differ between two snapshots
// - `snapshot.prove(path)` produces a proof that a file exists in the snapshot
// - `MerkleSnapshot.verifyProof(rootHash, path, data, proof)` verifies the proof
//
// **Hashing (SHA-256):**
//
// Leaf hash (includes path to avoid ambiguity):
// ```
// leafHash = SHA256(path + "\0" + bytes)
// ```
//
// Internal node hash:
// ```
// nodeHash = SHA256(leftHash || rightHash)
// ```
//
// Odd node rule: duplicate last node → `parent = SHA256(last || last)`
//
// **Canonical ordering:** Leaves sorted by path ascending (lexicographic)
//
// **Empty snapshot:** `rootHashHex = SHA256("")` (hash of empty byte array)
//
// **Validation:**
// Throw `Error("INVALID_ARGUMENT: <message>")` for empty/whitespace-only paths
// Throw `Error("NOT_FOUND: path")` when proving a non-existent path
//
// **What this tests:**
// - Merkle tree construction and traversal
// - Content-addressable hashing
// - Efficient change detection via tree diffing
// - Cryptographic proof generation and verification
//
// **Extensions:**
// 1. Chunk large files (use CDC chunker, Merkle per file)
// 2. Incremental update: update one file without rebuilding whole tree
// 3. Discuss collision resistance and trust model
//
// NOTE: Spec details in ./specs/05_merkle_snapshot.md

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Snapshot = { [path: string]: Buffer };

export type ProofStep = {
    siblingHashHex: string;
    siblingSide: 'left' | 'right'; // sibling relative to current node
};

export type MerkleProof = {
    path: string;
    leafHashHex: string;
    steps: ProofStep[];
};

export class MerkleSnapshot {
    readonly rootHashHex: string;

    private constructor(rootHashHex: string) {
        this.rootHashHex = rootHashHex;
    }

    static build(s: Snapshot): MerkleSnapshot {
        throw new Error('NotImplemented');
    }

    static diff(a: MerkleSnapshot, b: MerkleSnapshot): string[] {
        throw new Error('NotImplemented');
    }

    prove(path: string): MerkleProof {
        throw new Error('NotImplemented');
    }

    static verifyProof(rootHashHex: string, path: string, data: Buffer, proof: MerkleProof): boolean {
        throw new Error('NotImplemented');
    }
}
