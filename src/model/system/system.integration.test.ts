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

        test('succeeds when a command writes to stderr but exits 0', async () => {
          // Was 'throws when command writes to stderr' - codified the bug
          // this fixes (game-ci/cli#84): docker writes informational
          // messages to stderr on otherwise-successful runs, so stderr
          // content alone can't mean failure. Exit code does.
          await expect(System.run('echo fail >&2')).resolves.not.toBeNull();
        });

        test('throws when a command exits non-zero', async () => {
          await expect(System.run('exit 1')).rejects.toThrow();
        });
      }
    });
  });
});
