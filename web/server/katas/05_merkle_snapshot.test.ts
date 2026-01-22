// Update the import path if your implementation file is named differently.
import { describe, it, expect } from "bun:test";
import { MerkleSnapshot } from "./05_merkle_snapshot";
import { sha256Hex } from "./test_utils";

function b(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

describe("Merkle Snapshot", () => {
  it("empty snapshot root is sha256(empty)", () => {
    const snap = MerkleSnapshot.build({});
    expect(snap.rootHashHex).toBe(sha256Hex(new Uint8Array(0)));
  });

  it("determinism: build twice yields same root", () => {
    const a = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("world") });
    const c = MerkleSnapshot.build({ "b.txt": b("world"), "a.txt": b("hello") });
    expect(a.rootHashHex).toBe(c.rootHashHex);
  });

  it("proof verifies for existing path", () => {
    const snap = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("world") });
    const proof = snap.prove("a.txt");
    expect(MerkleSnapshot.verifyProof(snap.rootHashHex, "a.txt", b("hello"), proof)).toBe(true);
  });

  it("proof fails if data changes", () => {
    const snap = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("world") });
    const proof = snap.prove("a.txt");
    expect(MerkleSnapshot.verifyProof(snap.rootHashHex, "a.txt", b("HELLO"), proof)).toBe(false);
  });

  it("prove throws on missing path", () => {
    const snap = MerkleSnapshot.build({ "a.txt": b("hello") });
    expect(() => snap.prove("missing.txt")).toThrow(/NOT_FOUND/);
  });

  it("diff empty when roots equal", () => {
    const a = MerkleSnapshot.build({ "a.txt": b("hello") });
    const c = MerkleSnapshot.build({ "a.txt": b("hello") });
    expect(MerkleSnapshot.diff(a, c)).toEqual([]);
  });

  it("diff returns changed path when one file changes", () => {
    const a = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("world") });
    const c = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("WORLD") });
    const d = MerkleSnapshot.diff(a, c).sort();
    expect(d).toEqual(["b.txt"]);
  });

  it("diff returns added/removed paths", () => {
    const a = MerkleSnapshot.build({ "a.txt": b("hello"), "b.txt": b("world") });
    const c = MerkleSnapshot.build({ "a.txt": b("hello"), "c.txt": b("new") });
    const d = MerkleSnapshot.diff(a, c).sort();
    // b.txt removed, c.txt added
    expect(d).toEqual(["b.txt", "c.txt"]);
  });

  it("validation: empty/blank path rejected", () => {
    expect(() => MerkleSnapshot.build({ "": b("x") } as any)).toThrow(/INVALID_ARGUMENT/);
    expect(() => MerkleSnapshot.build({ "   ": b("x") } as any)).toThrow(/INVALID_ARGUMENT/);
  });
});
