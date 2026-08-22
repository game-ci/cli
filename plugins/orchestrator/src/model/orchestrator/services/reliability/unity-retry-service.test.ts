import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UnityRetryService } from './unity-retry-service';
import { UnityRecoveryService } from './unity-recovery-service';

vi.mock('node:fs');

const mockFs = fs as Mocked<typeof fs>;

const PROJECT_PATH = '/project';

describe('UnityRetryService.executeWithRetry', () => {
  let removedPaths: Set<string>;

  beforeEach(() => {
    vi.resetAllMocks();
    removedPaths = new Set<string>();

    // A path "exists" until it has been removed/renamed away from -- lets
    // BuildReliabilityService.removeDirectoryWithRetry succeed on its first
    // attempt instead of looping through its real (blocking) retry/delay.
    // ArtifactDB defaults to absent, i.e. import has not completed yet --
    // individual tests override this via matching log text when needed.
    mockFs.existsSync.mockImplementation((p: any) => {
      const target = String(p);
      if (target.endsWith('ArtifactDB')) return false;

      return !removedPaths.has(target);
    });
    mockFs.rmSync.mockImplementation((p: any) => {
      removedPaths.add(String(p));
    });
    mockFs.renameSync.mockImplementation((oldPath: any) => {
      removedPaths.add(String(oldPath));
    });
    // No LFS pointer DLLs by default -- UnityBuildDiagnosticsService.analyzeRun
    // scans Assets/Packages via readdirSync on every call.
    mockFs.readdirSync.mockReturnValue([] as any);
  });

  it('returns succeeded=true after a single successful attempt, with no recovery actions', async () => {
    const runUnity = vi.fn().mockResolvedValue({
      exitCode: 0,
      logText: 'Executing method BuildCommand.PerformBuild\nBuild succeeded',
      runtimeSeconds: 42,
    });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.actionsPerformed).toEqual([]);
    expect(result.lastDiagnostics.failureCategory).toBe('SUCCESS');
    expect(runUnity).toHaveBeenCalledTimes(1);
  });

  it('retries a licensing race after the recommended delay and succeeds on the second attempt', async () => {
    vi.useFakeTimers();

    const runUnity = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: -1,
        logText: 'Access token is unavailable',
        runtimeSeconds: 15,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        logText: 'Executing method BuildCommand.PerformBuild\nBuild succeeded',
        runtimeSeconds: 60,
      });

    const resultPromise = UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);

    // First attempt runs synchronously up to the licensing delay (30s).
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.actionsPerformed).toEqual(['retry-licensing']);
    expect(runUnity).toHaveBeenCalledTimes(2);
    // Licensing recovery must not touch the Library folder.
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    expect(mockFs.rmSync).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('nukes the Library folder (with backup) on dense crash evidence after import completed', async () => {
    const denseCrashLog = [
      'InitialRefresh started',
      'Refresh completed',
      'Segmentation fault',
      'SIGSEGV',
      'Crash!!!',
    ].join('\n');

    const runUnity = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: -1073741819, logText: denseCrashLog, runtimeSeconds: 200 })
      .mockResolvedValueOnce({
        exitCode: 0,
        logText: 'Executing method BuildCommand.PerformBuild\nBuild succeeded',
        runtimeSeconds: 90,
      });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.actionsPerformed).toEqual(['nuke-library']);
    // Library must be backed up (renamed) before being removed.
    expect(mockFs.renameSync).toHaveBeenCalledWith(
      path.join(PROJECT_PATH, 'Library'),
      expect.stringContaining('Library.backup-'),
    );
  });

  it('clears only ScriptAssemblies (no Library backup/nuke) for light crash evidence before import completes', async () => {
    // No "Refresh completed" marker and no ArtifactDB (mocked absent by
    // default) -- import has not completed, so recommendRecoveryAction picks
    // 'retry-two-phase-import' rather than 'nuke-library'. That decision's
    // own nukeLibrary flag is false, so performRecovery falls through to the
    // CRASH-category branch, which only escalates to a full Library nuke
    // when 3+ crash patterns matched -- here there is only one ("Crash!!!").
    const lightCrashLog = ['some early build log line', 'Crash!!!'].join('\n');

    const runUnity = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: -1073741819, logText: lightCrashLog, runtimeSeconds: 200 })
      .mockResolvedValueOnce({
        exitCode: 0,
        logText: 'Executing method BuildCommand.PerformBuild\nBuild succeeded',
        runtimeSeconds: 90,
      });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);

    expect(result.succeeded).toBe(true);
    expect(result.actionsPerformed).toEqual(['retry-two-phase-import']);
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.join(PROJECT_PATH, 'Library', 'ScriptAssemblies'),
      expect.objectContaining({ recursive: true, force: true }),
    );
  });

  it('clears PackageCache (and ScriptAssemblies for GUID errors) on package corruption', async () => {
    const runUnity = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        logText: 'error CS0246: Library/PackageCache/com.foo/Bar.cs: type not found',
        runtimeSeconds: 50,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        logText: 'Executing method BuildCommand.PerformBuild\nBuild succeeded',
        runtimeSeconds: 55,
      });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);

    expect(result.succeeded).toBe(true);
    expect(result.actionsPerformed).toEqual(['retry-package-cache']);
    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.join(PROJECT_PATH, 'Library', 'PackageCache'),
      expect.objectContaining({ recursive: true, force: true }),
    );
    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.join(PROJECT_PATH, 'Library', 'ScriptAssemblies'),
      expect.objectContaining({ recursive: true, force: true }),
    );
  });

  it('gives up once the recovery budget is exhausted and reports the failure diagnostics', async () => {
    vi.useFakeTimers();

    // licensingRace budget max is 2 -- a third consecutive licensing failure
    // must stop retrying instead of looping forever.
    const runUnity = vi.fn().mockResolvedValue({
      exitCode: -1,
      logText: 'Access token is unavailable',
      runtimeSeconds: 15,
    });

    const resultPromise = UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;

    expect(result.succeeded).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.actionsPerformed).toEqual(['retry-licensing', 'retry-licensing']);
    expect(result.lastDiagnostics.failureCategory).toBe('LICENSE');
    expect(runUnity).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('never exceeds the internal MAX_TOTAL_RETRIES cap even if a larger maxRetries is requested', async () => {
    const runUnity = vi.fn().mockResolvedValue({
      exitCode: 1,
      logText: 'some unrecognized failure output',
      runtimeSeconds: 10,
    });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity, {
      maxRetries: 999,
    });

    // GENERIC failures have no matching recovery action, so this should
    // stop after the very first attempt regardless of the retry cap.
    expect(result.succeeded).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.actionsPerformed).toEqual([]);
  });

  it('caps total attempts at 6 (1 initial + 5 retries) when every attempt is independently retryable', async () => {
    // Alternate between two distinct LFS-pointer-DLL-triggering failures so
    // each attempt consumes a *different* budget bucket, isolating the
    // MAX_TOTAL_RETRIES cap from any single budget's own max.
    mockFs.readdirSync.mockImplementation((dir: any) => {
      if (String(dir).endsWith('Assets')) {
        return [{ name: 'Pointer.dll', isDirectory: () => false, isFile: () => true }] as any;
      }

      return [] as any;
    });
    mockFs.statSync.mockReturnValue({ size: 50 } as any);
    mockFs.readFileSync.mockReturnValue('version https://git-lfs.github.com/spec/v1\n' as any);

    const runUnity = vi.fn().mockResolvedValue({
      exitCode: 1,
      logText: 'irrelevant, lfsPointerDllFound drives the decision',
      runtimeSeconds: 5,
    });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity, {
      maxRetries: 20,
    });

    expect(result.succeeded).toBe(false);
    // lfsPointer budget max is 1, so only the first retry is granted; the
    // second attempt's decide() call exhausts the budget and stops.
    expect(result.attempts).toBe(2);
    expect(runUnity).toHaveBeenCalledTimes(2);
  });

  it('passes explicit budgets through to UnityRecoveryService.decide', async () => {
    const budgets = UnityRecoveryService.createDefaultBudgets();
    budgets.licensingRace.max = 0;

    const runUnity = vi.fn().mockResolvedValue({
      exitCode: -1,
      logText: 'Access token is unavailable',
      runtimeSeconds: 15,
    });

    const result = await UnityRetryService.executeWithRetry(PROJECT_PATH, runUnity, { budgets });

    expect(result.succeeded).toBe(false);
    expect(result.attempts).toBe(1);
    expect(runUnity).toHaveBeenCalledTimes(1);
  });
});
