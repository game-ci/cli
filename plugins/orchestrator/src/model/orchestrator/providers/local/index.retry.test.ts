import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('node:fs');
vi.mock('../../services/core/orchestrator-system', () => ({
  OrchestratorSystem: { Run: vi.fn() },
}));
vi.mock('../../services/reliability/unity-retry-service', () => ({
  UnityRetryService: { executeWithRetry: vi.fn() },
}));
vi.mock('../../services/reliability/unity-recovery-service', () => ({
  UnityRecoveryService: { createDefaultBudgets: vi.fn(() => ({ mocked: true })) },
}));

import LocalOrchestrator from './index';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import { UnityRetryService } from '../../services/reliability/unity-retry-service';
import { UnityRecoveryService } from '../../services/reliability/unity-recovery-service';
import Orchestrator from '../../orchestrator';
import BuildParameters from '../../../build-parameters';

const mockFs = fs as Mocked<typeof fs>;
const mockRun = OrchestratorSystem.Run as unknown as Mocked<typeof OrchestratorSystem.Run>;
const mockExecuteWithRetry = UnityRetryService.executeWithRetry as unknown as Mocked<
  typeof UnityRetryService.executeWithRetry
>;

/**
 * Integration coverage for the --enableBuildRetry wiring point: the
 * isBareLocalProvider path inside LocalOrchestrator.runTaskInWorkflow that
 * decides between "single attempt, throw on failure" (today's behavior,
 * default) and "delegate to UnityRetryService.executeWithRetry" (opt-in).
 * UnityRetryService's own retry/recovery algorithm is covered exhaustively
 * in unity-retry-service.test.ts -- this file only asserts the call pattern
 * difference at the provider boundary.
 */
describe('LocalOrchestrator.runTaskInWorkflow -- enableBuildRetry wiring', () => {
  const originalPlatform = process.platform;
  const provider = new LocalOrchestrator();

  const runTask = () =>
    provider.runTaskInWorkflow('build-guid', 'unity-image', 'echo hi', '/mnt', '/mnt/', [], []);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'linux' });
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('enableBuildRetry=false (default): calls OrchestratorSystem.Run directly once and never touches UnityRetryService', async () => {
    Orchestrator.buildParameters = { enableBuildRetry: false, projectPath: '.' } as BuildParameters;
    mockRun.mockResolvedValue('build output');

    const result = await runTask();

    expect(result).toBe('build output');
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith('echo hi');
    expect(mockExecuteWithRetry).not.toHaveBeenCalled();
  });

  it('enableBuildRetry left unset behaves identically to false (safe default for hosts not on this build parameters version)', async () => {
    Orchestrator.buildParameters = { projectPath: '.' } as BuildParameters;
    mockRun.mockResolvedValue('build output');

    await runTask();

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockExecuteWithRetry).not.toHaveBeenCalled();
  });

  it('enableBuildRetry=false still throws exactly as before on failure -- zero behavior change for the common case', async () => {
    Orchestrator.buildParameters = { enableBuildRetry: false, projectPath: '.' } as BuildParameters;
    mockRun.mockRejectedValue('raw wrapper output');

    await expect(runTask()).rejects.toBe('raw wrapper output');
    expect(mockExecuteWithRetry).not.toHaveBeenCalled();
  });

  it('enableBuildRetry=true: delegates to UnityRetryService.executeWithRetry with UnityRecoveryService default budgets instead of calling OrchestratorSystem.Run directly', async () => {
    Orchestrator.buildParameters = {
      enableBuildRetry: true,
      projectPath: 'MyProject',
    } as BuildParameters;
    mockExecuteWithRetry.mockResolvedValue({
      succeeded: true,
      attempts: 2,
      lastDiagnostics: { failureCategory: 'SUCCESS' } as any,
      actionsPerformed: ['retry-licensing'],
    });

    const result = await runTask();

    expect(result).toBe('');
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockExecuteWithRetry).toHaveBeenCalledTimes(1);
    expect(UnityRecoveryService.createDefaultBudgets).toHaveBeenCalledTimes(1);

    const [projectPathArgument, runUnityArgument, optionsArgument] =
      mockExecuteWithRetry.mock.calls[0];
    expect(projectPathArgument).toBe(path.join(process.cwd(), 'MyProject'));
    expect(typeof runUnityArgument).toBe('function');
    expect(optionsArgument).toEqual({ budgets: { mocked: true } });
  });

  it('enableBuildRetry=true and the retry loop ultimately fails: throws a descriptive Error (not the raw output string)', async () => {
    Orchestrator.buildParameters = { enableBuildRetry: true, projectPath: '.' } as BuildParameters;
    mockExecuteWithRetry.mockResolvedValue({
      succeeded: false,
      attempts: 6,
      lastDiagnostics: {
        failureCategory: 'CRASH',
        failureSummary: { remediationHint: 'Clear ScriptAssemblies or nuke Library.' },
      } as any,
      actionsPerformed: ['nuke-library'],
    });

    await expect(runTask()).rejects.toThrow(
      /Unity build failed after 6 attempt\(s\).*\[CRASH\].*nuke-library/s,
    );
  });

  it('the runUnity callback passed to UnityRetryService runs the command with suppressError=true, captures the real exit code, and prefers the on-disk Editor log over wrapper stdout', async () => {
    Orchestrator.buildParameters = { enableBuildRetry: true, projectPath: '.' } as BuildParameters;

    let capturedRunUnity:
      | (() => Promise<{
          exitCode: number;
          logText: string;
          runtimeSeconds: number;
        }>)
      | undefined;

    mockExecuteWithRetry.mockImplementation(async (_projectPath, runUnity) => {
      capturedRunUnity = runUnity;

      return {
        succeeded: true,
        attempts: 1,
        lastDiagnostics: { failureCategory: 'SUCCESS' } as any,
        actionsPerformed: [],
      };
    });
    mockRun.mockImplementation(
      async (
        _command: string,
        _suppressError?: boolean,
        _suppressLogs?: boolean,
        _outputCallback?: (output: string) => void,
        onExitCode?: (code: number) => void,
      ) => {
        onExitCode?.(1);

        return 'wrapper stdout only';
      },
    );
    mockFs.readFileSync.mockReturnValue('genuine Unity Editor log content' as any);

    await runTask();

    expect(capturedRunUnity).toBeDefined();
    const attemptResult = await capturedRunUnity!();

    expect(mockRun).toHaveBeenCalledWith('echo hi', true, false, undefined, expect.any(Function));
    expect(attemptResult.exitCode).toBe(1);
    expect(attemptResult.logText).toBe('genuine Unity Editor log content');
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join(process.cwd(), 'temp', 'job-log.txt'),
      'utf8',
    );
  });

  it('falls back to wrapper stdout as logText when the Editor log file cannot be read', async () => {
    Orchestrator.buildParameters = { enableBuildRetry: true, projectPath: '.' } as BuildParameters;

    let capturedRunUnity: (() => Promise<{ exitCode: number; logText: string }>) | undefined;
    mockExecuteWithRetry.mockImplementation(async (_projectPath, runUnity) => {
      capturedRunUnity = runUnity as any;

      return {
        succeeded: true,
        attempts: 1,
        lastDiagnostics: { failureCategory: 'SUCCESS' } as any,
        actionsPerformed: [],
      };
    });
    mockRun.mockResolvedValue('wrapper stdout only');
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    await runTask();
    const attemptResult = await capturedRunUnity!();

    expect(attemptResult.logText).toBe('wrapper stdout only');
  });
});
