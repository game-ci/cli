import { strict as nodeAssert } from 'node:assert';

export const assert = (value: unknown, msg?: string) => { nodeAssert.ok(value, msg); };
export const assertFalse = (value: unknown, msg?: string) => { nodeAssert.ok(!value, msg); };
export const assertEquals = (actual: unknown, expected: unknown, msg?: string) => { nodeAssert.deepStrictEqual(actual, expected, msg); };
export const assertThrows = (fn: () => void, msg?: string) => { nodeAssert.throws(fn, undefined, msg); };
