import { describe, it, expect } from 'vitest';
import { UnityRecoveryService, UnityRecoveryBudgets } from './unity-recovery-service';
import {
  UnityBuildDiagnosticsService,
  UnityRunDiagnostics,
} from './unity-build-diagnostics-service';

function diagnosticsFor(
  overrides: Partial<Parameters<typeof UnityBuildDiagnosticsService.analyzeRun>[0]>,
): UnityRunDiagnostics {
  return UnityBuildDiagnosticsService.analyzeRun({
    exitCode: 1,
    runtimeSeconds: 100,
    logText: '',
    ...overrides,
  });
}

describe('UnityRecoveryService.createDefaultBudgets', () => {
  it('returns the documented default budget caps with zero usage', () => {
    const budgets = UnityRecoveryService.createDefaultBudgets();

    expect(budgets).toEqual({
      licensingRace: { max: 2, used: 0 },
      lfsPointer: { max: 1, used: 0 },
      packageCache: { max: 1, used: 0 },
      apiUpdater: { max: 1, used: 0 },
      twoPhaseImport: { max: 1, used: 0 },
      libraryNuke: { max: 1, used: 0 },
      sourceAssetDbReset: { max: 1, used: 0 },
    });
  });

  it('returns a fresh object on every call (no shared mutable state across builds)', () => {
    const a = UnityRecoveryService.createDefaultBudgets();
    const b = UnityRecoveryService.createDefaultBudgets();

    a.licensingRace.used = 99;

    expect(b.licensingRace.used).toBe(0);
  });
});

describe('UnityRecoveryService.decide', () => {
  it('recommends a delayed retry-licensing decision without touching Library', () => {
    const diagnostics = diagnosticsFor({
      exitCode: -1,
      runtimeSeconds: 20,
      logText: 'Access token is unavailable',
    });
    const budgets = UnityRecoveryService.createDefaultBudgets();

    const decision = UnityRecoveryService.decide(diagnostics, budgets);

    expect(decision.action).toBe('retry-licensing');
    expect(decision.shouldRetry).toBe(true);
    expect(decision.nukeLibrary).toBe(false);
    expect(decision.preserveLibrary).toBe(true);
    expect(decision.clearSubfolders).toEqual([]);
    expect(decision.delaySeconds).toBe(30);
    expect(budgets.licensingRace.used).toBe(1);
  });

  it('recommends nuke-library for crash evidence found after import completed', () => {
    const diagnostics = diagnosticsFor({
      exitCode: -1073741819,
      runtimeSeconds: 300,
      logText: 'InitialRefresh started\nRefresh completed\nSegmentation fault',
    });
    const budgets = UnityRecoveryService.createDefaultBudgets();

    const decision = UnityRecoveryService.decide(diagnostics, budgets);

    expect(decision.action).toBe('nuke-library');
    expect(decision.shouldRetry).toBe(true);
    expect(decision.nukeLibrary).toBe(true);
    expect(decision.preserveLibrary).toBe(false);
    expect(decision.clearSubfolders).toEqual(['Library']);
    expect(budgets.libraryNuke.used).toBe(1);
  });

  it('recommends clearing PackageCache for GUID compile errors', () => {
    const diagnostics = diagnosticsFor({
      exitCode: 1,
      logText: 'error CS0246: Library/PackageCache/com.foo/Bar.cs: type not found',
    });
    const budgets = UnityRecoveryService.createDefaultBudgets();

    const decision = UnityRecoveryService.decide(diagnostics, budgets);

    expect(decision.action).toBe('retry-package-cache');
    expect(decision.clearSubfolders).toEqual(['PackageCache']);
    expect(decision.nukeLibrary).toBe(false);
  });

  it('recommends retry-lfs-pull when LFS pointer DLLs are present', () => {
    const diagnostics = diagnosticsFor({ exitCode: 1, logText: '' });
    diagnostics.lfsPointerDllFound = true;
    diagnostics.recommendedAction =
      UnityBuildDiagnosticsService.recommendRecoveryAction(diagnostics);

    const decision = UnityRecoveryService.decide(
      diagnostics,
      UnityRecoveryService.createDefaultBudgets(),
    );

    expect(decision.action).toBe('retry-lfs-pull');
    expect(decision.delaySeconds).toBe(0);
  });

  it('returns shouldRetry=false with a success decision on a successful run', () => {
    const diagnostics = diagnosticsFor({
      exitCode: 0,
      logText: 'Executing method BuildCommand.PerformBuild',
    });

    const decision = UnityRecoveryService.decide(
      diagnostics,
      UnityRecoveryService.createDefaultBudgets(),
    );

    expect(decision.action).toBe('success');
    expect(decision.shouldRetry).toBe(false);
    expect(decision.preserveLibrary).toBe(true);
  });

  it('returns shouldRetry=false with fail when nothing matched (generic failure)', () => {
    const diagnostics = diagnosticsFor({
      exitCode: 1,
      runtimeSeconds: 500,
      logText: 'some unrecognized failure output',
    });

    const decision = UnityRecoveryService.decide(
      diagnostics,
      UnityRecoveryService.createDefaultBudgets(),
    );

    expect(decision.action).toBe('fail');
    expect(decision.shouldRetry).toBe(false);
  });

  it('stops retrying once a budget is exhausted (circuit breaker)', () => {
    const diagnostics = diagnosticsFor({
      exitCode: -1,
      runtimeSeconds: 20,
      logText: 'Access token is unavailable',
    });
    const budgets: UnityRecoveryBudgets = UnityRecoveryService.createDefaultBudgets();
    budgets.licensingRace.used = budgets.licensingRace.max;

    const decision = UnityRecoveryService.decide(diagnostics, budgets);

    expect(decision.action).toBe('fail');
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toMatch(/budget exhausted/i);
    // Budget usage must not be incremented past max by the exhausted attempt.
    expect(budgets.licensingRace.used).toBe(budgets.licensingRace.max);
  });

  it('increments budget usage across successive decide() calls for the same category', () => {
    const diagnostics = diagnosticsFor({
      exitCode: -1,
      runtimeSeconds: 20,
      logText: 'Access token is unavailable',
    });
    const budgets = UnityRecoveryService.createDefaultBudgets();

    const first = UnityRecoveryService.decide(diagnostics, budgets);
    expect(first.shouldRetry).toBe(true);
    expect(budgets.licensingRace.used).toBe(1);

    const second = UnityRecoveryService.decide(diagnostics, budgets);
    expect(second.shouldRetry).toBe(true);
    expect(budgets.licensingRace.used).toBe(2);

    // licensingRace max is 2 -- a third attempt must exhaust the budget.
    const third = UnityRecoveryService.decide(diagnostics, budgets);
    expect(third.shouldRetry).toBe(false);
    expect(third.action).toBe('fail');
  });

  it('always echoes the (possibly-mutated) budgets object back on the decision', () => {
    const diagnostics = diagnosticsFor({ exitCode: 0, logText: 'executeMethod invoked' });
    const budgets = UnityRecoveryService.createDefaultBudgets();

    const decision = UnityRecoveryService.decide(diagnostics, budgets);

    expect(decision.budgets).toBe(budgets);
  });

  it('defaults to a fresh budget set when none is supplied', () => {
    const diagnostics = diagnosticsFor({
      exitCode: -1,
      runtimeSeconds: 20,
      logText: 'Access token is unavailable',
    });

    const decision = UnityRecoveryService.decide(diagnostics);

    expect(decision.shouldRetry).toBe(true);
    expect(decision.budgets.licensingRace.used).toBe(1);
  });
});
