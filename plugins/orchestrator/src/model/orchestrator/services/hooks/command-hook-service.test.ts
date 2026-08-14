import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { CommandHookService } from './command-hook-service';

describe('CommandHookService.GetCustomHooksFromFiles', () => {
  let scratch: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'command-hook-service-test-'));
    process.chdir(scratch);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('returns an empty array when game-ci/command-hooks does not exist (common case)', () => {
    // No game-ci/command-hooks directory exists under scratch.
    const before = CommandHookService.GetCustomHooksFromFiles('before');
    const after = CommandHookService.GetCustomHooksFromFiles('after');

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it('returns an empty array when game-ci/command-hooks exists but is empty', () => {
    fs.mkdirSync(path.join(scratch, 'game-ci', 'command-hooks'), { recursive: true });

    const before = CommandHookService.GetCustomHooksFromFiles('before');
    const after = CommandHookService.GetCustomHooksFromFiles('after');

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it('does not throw or log ENOENT when the hooks directory is absent', () => {
    // Spy on console.log/console.error so we can assert the missing-dir
    // case does not generate noise. RemoteClientLogger.log routes through
    // these in Node CLI mode.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => CommandHookService.GetCustomHooksFromFiles('before')).not.toThrow();
    expect(() => CommandHookService.GetCustomHooksFromFiles('after')).not.toThrow();

    const allOutput = [...logSpy.mock.calls, ...errSpy.mock.calls]
      .flat()
      .map((value) => String(value))
      .join('\n');
    expect(allOutput).not.toMatch(/Failed Getting/);
    expect(allOutput).not.toMatch(/ENOENT/);

    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
