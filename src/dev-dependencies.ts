// Dev dependencies also include all prod dependencies.
export * from './dependencies.ts';

// Test assertions - using bun:test or node:assert
import { strict as assert } from 'node:assert';
const asserts = {
  assertEquals: assert.deepStrictEqual,
  assertThrows: assert.throws,
};
export { asserts };
