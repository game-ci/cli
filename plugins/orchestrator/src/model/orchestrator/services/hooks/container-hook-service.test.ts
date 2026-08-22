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

vi.mock('../../workflows/custom-workflow', () => ({
  __esModule: true,
  CustomWorkflow: {
    runContainerJob: vi.fn().mockResolvedValue(''),
  },
}));

import { ContainerHookService } from './container-hook-service';
import Orchestrator from '../../orchestrator';
import { CustomWorkflow } from '../../workflows/custom-workflow';

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

describe('ContainerHookService.RunPreBuildSteps / RunPostBuildSteps -- middleware container-hook wiring', () => {
  let scratch: string;
  let originalCwd: string;
  const runContainerJobMock = CustomWorkflow.runContainerJob as unknown as ReturnType<typeof vi.fn>;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'container-hook-service-mw-test-'));
    process.chdir(scratch);
    runContainerJobMock.mockClear();
    runContainerJobMock.mockResolvedValue('');

    (Orchestrator as any).buildParameters = {
      buildGuid: 'test-guid',
      awsStackName: 'test-stack',
      useCompressionStrategy: false,
      providerStrategy: 'local',
      targetPlatform: 'StandaloneLinux64',
      middlewarePipeline: '',
      preBuildContainerHooks: '',
      postBuildContainerHooks: '',
    };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  const stepState = { environment: [], secrets: [] } as any;

  it('produces no container job call with no middleware and no legacy hooks configured (regression guard)', async () => {
    await ContainerHookService.RunPreBuildSteps(stepState);
    await ContainerHookService.RunPostBuildSteps(stepState);

    expect(runContainerJobMock).not.toHaveBeenCalled();
  });

  it('resolves a container-type middleware before/after command at the pre-build phase', async () => {
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: prebuild-mw
type: container
image: node:20
trigger:
  phase: [pre-build]
before:
  commands: echo "prebuild-before"
after:
  commands: echo "prebuild-after"
`;

    await ContainerHookService.RunPreBuildSteps(stepState);

    expect(runContainerJobMock).toHaveBeenCalledTimes(1);
    const steps = runContainerJobMock.mock.calls[0][0];
    const names = steps.map((s: any) => s.name);
    expect(names).toContain('middleware:prebuild-mw:before');
    expect(names).toContain('middleware:prebuild-mw:after');
  });

  it('resolves a container-type middleware before/after command at the post-build phase', async () => {
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: postbuild-mw
type: container
trigger:
  phase: [post-build]
before:
  commands: echo "postbuild-before"
after:
  commands: echo "postbuild-after"
`;

    await ContainerHookService.RunPostBuildSteps(stepState);

    expect(runContainerJobMock).toHaveBeenCalledTimes(1);
    const steps = runContainerJobMock.mock.calls[0][0];
    const names = steps.map((s: any) => s.name);
    expect(names).toContain('middleware:postbuild-mw:before');
    expect(names).toContain('middleware:postbuild-mw:after');
  });

  it('does not leak pre-build middleware into the post-build phase or vice versa', async () => {
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: prebuild-only-mw
type: container
trigger:
  phase: [pre-build]
before:
  commands: echo "prebuild-only"
`;

    await ContainerHookService.RunPostBuildSteps(stepState);

    expect(runContainerJobMock).not.toHaveBeenCalled();
  });

  it('propagates allowFailure onto the resolved ContainerHook', async () => {
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: allow-failure-mw
type: container
allowFailure: true
trigger:
  phase: [pre-build]
before:
  commands: echo "may-fail"
`;

    await ContainerHookService.RunPreBuildSteps(stepState);

    const steps = runContainerJobMock.mock.calls[0][0];
    const hook = steps.find((s: any) => s.name === 'middleware:allow-failure-mw:before');
    expect(hook.allowFailure).toBe(true);
  });

  it('filters out middleware whose trigger provider does not match providerStrategy', async () => {
    (Orchestrator as any).buildParameters.providerStrategy = 'local';
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: aws-only-container-mw
type: container
trigger:
  phase: [pre-build]
  provider: [aws]
before:
  commands: echo "aws-only"
`;

    await ContainerHookService.RunPreBuildSteps(stepState);

    expect(runContainerJobMock).not.toHaveBeenCalled();
  });

  it('merges legacy inline container hooks and middleware, legacy first', async () => {
    (Orchestrator as any).buildParameters.preBuildContainerHooks = `
- name: legacy-pre-hook
  hook: before
  commands: echo "legacy-pre-command"
`;
    (Orchestrator as any).buildParameters.middlewarePipeline = `
name: merge-container-mw
type: container
trigger:
  phase: [pre-build]
before:
  commands: echo "middleware-pre-command"
`;

    await ContainerHookService.RunPreBuildSteps(stepState);

    const steps = runContainerJobMock.mock.calls[0][0];
    const names = steps.map((s: any) => s.name);
    const legacyIndex = names.indexOf('legacy-pre-hook');
    const middlewareIndex = names.indexOf('middleware:merge-container-mw:before');
    expect(legacyIndex).toBeGreaterThanOrEqual(0);
    expect(middlewareIndex).toBeGreaterThan(legacyIndex);
  });

  it('does not crash and skips malformed inline middleware YAML', async () => {
    (Orchestrator as any).buildParameters.middlewarePipeline = `not: [valid, yaml, : : broken`;

    await expect(ContainerHookService.RunPreBuildSteps(stepState)).resolves.not.toThrow();
    expect(runContainerJobMock).not.toHaveBeenCalled();
  });
});
