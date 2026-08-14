import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// GetContainerHooksFromFiles is followed (inside the same function) by
// built-in hook templates that interpolate Orchestrator.buildParameters
// fields (buildGuid, awsStackName, etc.). Stub Orchestrator so the test
// can reach the return value without throwing on those interpolations --
// the suppression we are testing is the `fs.existsSync` gate BEFORE the
// readdir/readFile loop, so the stub need only satisfy the template
// expressions to keep the function returning normally.
vi.mock('../../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      buildGuid: 'test-guid',
      awsStackName: 'test-stack',
      useCompressionStrategy: false,
    },
  },
}));

import { ContainerHookService } from './container-hook-service';

describe('ContainerHookService.GetContainerHooksFromFiles', () => {
  let scratch: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'container-hook-service-test-'));
    process.chdir(scratch);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('returns an empty array when game-ci/container-hooks does not exist (common case)', () => {
    // No game-ci/container-hooks directory exists under scratch.
    const before = ContainerHookService.GetContainerHooksFromFiles('before');
    const after = ContainerHookService.GetContainerHooksFromFiles('after');

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it('returns an empty array when game-ci/container-hooks exists but is empty', () => {
    fs.mkdirSync(path.join(scratch, 'game-ci', 'container-hooks'), { recursive: true });

    const before = ContainerHookService.GetContainerHooksFromFiles('before');
    const after = ContainerHookService.GetContainerHooksFromFiles('after');

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it('does not throw or log ENOENT when the hooks directory is absent', () => {
    // Spy on console.log/console.error so we can assert the missing-dir
    // case does not generate noise. RemoteClientLogger.log routes through
    // these in Node CLI mode.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => ContainerHookService.GetContainerHooksFromFiles('before')).not.toThrow();
    expect(() => ContainerHookService.GetContainerHooksFromFiles('after')).not.toThrow();

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
