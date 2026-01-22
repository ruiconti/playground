import assert from "node:assert/strict";

export type TestFn = () => void | Promise<void>;

const tests: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

export function expect(condition: unknown, message?: string) {
  assert.ok(condition, message);
}

export function expectEq<T>(actual: T, expected: T, message?: string) {
  assert.strictEqual(actual as unknown as any, expected as unknown as any, message);
}

export function expectDeepEq<T>(actual: T, expected: T, message?: string) {
  assert.deepStrictEqual(actual, expected, message);
}

export function expectThrows(fn: () => unknown, pattern?: RegExp) {
  try {
    fn();
  } catch (e) {
    if (pattern) assert.match(String(e), pattern);
    return;
  }
  throw new Error("Expected function to throw");
}

export async function expectReject(factory: () => Promise<unknown>, pattern?: RegExp) {
  try {
    await factory();
  } catch (e) {
    if (pattern) assert.match(String(e), pattern);
    return;
  }
  throw new Error("Expected promise to reject");
}

export async function run() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${t.name}`);
      console.error(e);
    }
  }
  if (failed > 0) process.exitCode = 1;
}
