import { describe, test, expect } from 'bun:test';
import * as fs from 'node:fs';

describe('integrity', () => {
  test('package.json exists', () => {
    expect(fs.existsSync(`${process.cwd()}/package.json`)).toBe(true);
  });

  test('package-lock.json does not exist', () => {
    expect(fs.existsSync(`${process.cwd()}/package-lock.json`)).toBe(false);
  });
});
