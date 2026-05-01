import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { System } from './system.ts';

describe('System', () => {
  describe('run', () => {
    describe('integration', () => {
      if (!process.env.CI) {
        test("doesn't run locally", () => {
          expect(true).toBe(true);
        });
      } else {
        test('runs a command successfully', async () => {
          await expect(System.run('true')).resolves.not.toBeNull();
        });

        test('outputs results', async () => {
          const result = await System.run('echo test');
          expect(result.output.trim()).toBe('test');
        });

        test('throws when command writes to stderr', async () => {
          await expect(System.run('echo fail >&2')).rejects.toThrow();
        });
      }
    });
  });
});
