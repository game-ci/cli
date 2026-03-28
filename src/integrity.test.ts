import { describe, test, expect } from 'bun:test';
import * as fs from 'node:fs';
import { Foo } from './foo.ts';

describe('integrity', () => {
  test('Foo.bar() returns bar', () => {
    expect(Foo.bar()).toBe('bar');
  });

  test('package-lock.json does not exist', () => {
    expect(fs.existsSync(`${process.cwd()}/package-lock.json`)).toBe(false);
  });
});
