import { sha256Hex } from "./test_utils";

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
  ) {
    if (avgSize < minSize) {
      throw new Error("INVALID_ARGUMENT: avgSize < minSize")
    }
    if (avgSize > maxSize) {
      throw new Error("INVALID_ARGUMENT: avgSize > maxSize")
    }
    if (minSize > maxSize) {
      throw new Error("INVALID_ARGUMENT: minSize > maxSize")
    }
    if (minSize < 16) {
      throw new Error("INVALID_ARGUMENT: minSize < 16b")
    }
    if (maxSize > 8 * 1024 * 1024) { 
      throw new Error("INVALID_ARGUMENT: maxSize > 8MB")
    }
  }

  private precomputePow(base: number, exp: number): number {
    let result = 1;
    for (let i = 0; i < exp; i++) {
      result = (result * base) >>> 0;
    }
    return result;
  }

  chunk(data: Uint8Array): Chunk[] {
    if (data === null || data === undefined) {
      throw new Error("INVALID_ARGUMENT: data is null or undefined")
    }

    const B = 257;
    const targetBits = Math.round(Math.log2(this.avgSize)); // i dont understand this
    const MOD = 0x100000000;  // 2^32
    const W = 48;  // window size (fixed by spec)
    const pow = this.precomputePow(B, W - 1);  // B^47 mod 2^32

    const mask = (1 << targetBits) - 1; // also dont understand this
    const chunks: Chunk[] = [];

    let hash = 0;
    let start = 0;
    let winCount = 0;
    for (let i=0; i<data.length; i++) {
      const byteIn = data[i];

      if (winCount < W) {
        // still filling the window
        hash = ((hash * B) + byteIn) >>> 0;
        winCount++;
      } else {
        // window full, roll it
        const byteOut = data[i - W];
        hash = ((hash - byteOut * pow) * B + byteIn) >>> 0;
      }

      const chunkLen = i - start + 1;
    
      // check for cut (only if window ready and min size met)
      if (winCount === W && chunkLen >= this.minSize) {
        if ((hash & mask) === 0) {
          chunks.push({ start, end: i + 1, hashHex: sha256Hex(data.slice(start, i + 1)) });
          start = i + 1;
          hash = 0;
          winCount = 0;
        }
      }
      
      // force cut at maxSize
      if (chunkLen === this.maxSize) {
        chunks.push({ start, end: i + 1, hashHex: sha256Hex(data.slice(start, i + 1)) });
        start = i + 1;
        hash = 0;
        winCount = 0;
      }
    }

    return chunks;
  }
}