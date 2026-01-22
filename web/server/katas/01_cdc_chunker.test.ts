// Update the import path if your implementation file is named differently.
import { describe, it, expect } from "bun:test";
import { Chunker } from "./01_cdc_chunker";
import { randBytes, insertBytes, sha256Hex, concatBytes } from "./test_utils";

function chunkSizes(chunks: { start: number; end: number }[]): number[] {
  return chunks.map((c) => c.end - c.start);
}

describe("CDC Chunker", () => {
  it("empty input -> []", () => {
    const c = new Chunker(64, 1024, 2048);
    expect(c.chunk(new Uint8Array(0))).toEqual([]);
  });

  it("input smaller than minSize -> single chunk", () => {
    const c = new Chunker(64, 1024, 2048);
    const data = randBytes(63, 1);
    const chunks = c.chunk(data);
    expect(chunks.length).toBe(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(data.length);
  });

  it("maxSize == minSize forces fixed chunking", () => {
    const c = new Chunker(64, 64, 64);
    const data = randBytes(200, 2);
    const chunks = c.chunk(data);
    expect(chunkSizes(chunks)).toEqual([64, 64, 64, 8]);
  });

  it("coverage: chunks reconstruct the original bytes", () => {
    const c = new Chunker(64, 1024, 2048);
    const data = randBytes(5000, 3);
    const chunks = c.chunk(data);
    const pieces = chunks.map((ch) => data.subarray(ch.start, ch.end));
    const rebuilt = concatBytes(pieces);
    expect(Buffer.from(rebuilt).compare(Buffer.from(data))).toBe(0);
  });

  it("bounds: all chunks <= maxSize, non-final chunks >= minSize", () => {
    const minSize = 128;
    const maxSize = 1024;
    const c = new Chunker(minSize, 512, maxSize);
    const data = randBytes(20000, 4);
    const chunks = c.chunk(data);
    expect(chunks.length).toBeGreaterThan(0);
    for (let i = 0; i < chunks.length; i++) {
      const size = chunks[i].end - chunks[i].start;
      expect(size).toBeLessThanOrEqual(maxSize);
      if (i !== chunks.length - 1) {
        expect(size).toBeGreaterThanOrEqual(minSize);
      }
    }
  });

  it("hash correctness: each hashHex matches sha256(slice)", () => {
    const c = new Chunker(64, 1024, 2048);
    const data = randBytes(10000, 5);
    const chunks = c.chunk(data);
    for (const ch of chunks) {
      const slice = data.subarray(ch.start, ch.end);
      expect(ch.hashHex).toBe(sha256Hex(slice));
    }
  });

  it("determinism: same input yields identical boundaries + hashes", () => {
    const c = new Chunker(64, 1024, 2048);
    const data = randBytes(20000, 6);
    const a = c.chunk(data);
    const b = c.chunk(data);
    expect(a).toEqual(b);
  });

  it("constructor validation rejects invalid parameters", () => {
    expect(() => new Chunker(0, 1024, 2048)).toThrow(/INVALID_ARGUMENT/);
    expect(() => new Chunker(64, 32, 2048)).toThrow(/INVALID_ARGUMENT/);
    expect(() => new Chunker(64, 1024, 63)).toThrow(/INVALID_ARGUMENT/);
  });

  it("CDC stability smoke test (prints alignment score)", () => {
    const c = new Chunker(256, 2048, 8192);
    const data1 = randBytes(200_000, 7);
    const data2 = insertBytes(data1, 100, randBytes(20, 8));

    const ch1 = c.chunk(data1);
    const ch2 = c.chunk(data2);

    // Compare boundary end positions after an offset.
    const offset = 10_000;
    const b1 = new Set(ch1.map((x) => x.end).filter((p) => p >= offset));
    const b2 = new Set(ch2.map((x) => x.end).filter((p) => p >= offset));

    let inter = 0;
    for (const p of b1) if (b2.has(p)) inter++;
    const union = b1.size + b2.size - inter;
    const jaccard = union === 0 ? 1 : inter / union;

    // Not asserted; just output for your own sanity check.
    console.log(`CDC boundary alignment (Jaccard after ${offset}B): ${jaccard.toFixed(3)}`);
  });
});
