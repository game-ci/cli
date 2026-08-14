import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { configureLogger, Verbosity } from './index.ts';

describe('logger groups', () => {
  const originalGithubActions = process.env.GITHUB_ACTIONS;
  const originalConsoleLog = console.log;
  let logLines: string[] = [];

  beforeEach(async () => {
    logLines = [];
    console.log = mock((...args: any[]) => {
      logLines.push(args.join(' '));
    });
    await configureLogger(Verbosity.normal);
  });

  afterEach(() => {
    // console.log is a shared global — restore it so other test files that
    // exercise real console output aren't affected by this file's mock.
    console.log = originalConsoleLog;
    if (originalGithubActions === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = originalGithubActions;
    }
  });

  it('emits ::group::/::endgroup:: markers when running in GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'true';

    (globalThis as any).log.startGroup('My Group');
    (globalThis as any).log.endGroup();

    expect(logLines).toContain('::group::My Group');
    expect(logLines).toContain('::endgroup::');
  });

  it('falls back to a plain separator outside GitHub Actions', () => {
    delete process.env.GITHUB_ACTIONS;

    (globalThis as any).log.startGroup('My Group');

    expect(logLines.some((line) => line.includes('My Group'))).toBe(true);
    expect(logLines.some((line) => line.includes('::group::'))).toBe(false);
  });

  it('group() closes the group even when the callback throws', async () => {
    process.env.GITHUB_ACTIONS = 'true';

    await expect(
      (globalThis as any).log.group('Failing group', () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(logLines).toContain('::endgroup::');
  });

  it('group() returns the callback result', async () => {
    const result = await (globalThis as any).log.group('Group', () => 42);
    expect(result).toBe(42);
  });
});

describe('logger error formatting', () => {
  const originalConsoleError = console.error;
  let errorLines: string[] = [];

  beforeEach(async () => {
    errorLines = [];
    console.error = mock((...args: any[]) => {
      errorLines.push(args.join(' '));
    });
    await configureLogger(Verbosity.normal);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('prints an Error object\'s message and stack, not "{}"', () => {
    // Real bug: Error's message/stack/name are non-enumerable own
    // properties, so JSON.stringify(error) - the previous fallback for any
    // non-string value - silently produced '{}', masking every uncaught
    // failure's actual message (see game-ci/unity-activate#111).
    (globalThis as any).log.error(new Error('something specific broke'));

    expect(errorLines.some((line) => line.includes('something specific broke'))).toBe(true);
    expect(errorLines.some((line) => line.trim() === '[ERROR] {}')).toBe(false);
  });
});
