import { createHash } from "node:crypto";

export function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// Deterministic pseudo-random bytes (xorshift32)
export function randBytes(len: number, seed = 123456789): Uint8Array {
  let x = seed >>> 0;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

export function insertBytes(orig: Uint8Array, insertAt: number, insert: Uint8Array): Uint8Array {
  const out = new Uint8Array(orig.length + insert.length);
  out.set(orig.subarray(0, insertAt), 0);
  out.set(insert, insertAt);
  out.set(orig.subarray(insertAt), insertAt + insert.length);
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function isExtensionsEnabled(): boolean {
  const flag = process.env.KATA_EXTENSIONS;
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}
