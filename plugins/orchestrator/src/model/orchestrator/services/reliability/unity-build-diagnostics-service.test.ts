import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  type Mocked,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UnityBuildDiagnosticsService } from './unity-build-diagnostics-service';
import { UnityRecoveryService } from './unity-recovery-service';

vi.mock('node:fs');

const mockFs = fs as Mocked<typeof fs>;

describe('UnityBuildDiagnosticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects crash evidence and recommends two-phase import before import completes', () => {
    const diagnostics = UnityBuildDiagnosticsService.analyzeRun({
      exitCode: -1,
      runtimeSeconds: 300,
      logText: 'InitialRefresh started\nFatal Error!\nNative Crash Reporting',
    });

    expect(diagnostics.crashEvidenceFound).toBe(true);
    expect(diagnostics.importCompleted).toBe(false);
    expect(diagnostics.recommendedAction).toBe('retry-two-phase-import');
    expect(diagnostics.preserveLibrary).toBe(true);
  });

  it('detects licensing startup races without nuking Library', () => {
    const diagnostics = UnityBuildDiagnosticsService.analyzeRun({
      exitCode: 4294967295,
      runtimeSeconds: 20,
      logText: 'Access token is unavailable',
    });

    expect(diagnostics.exitCode).toBe(-1);
    expect(diagnostics.licensingFailure).toBe(true);
    expect(diagnostics.recommendedAction).toBe('retry-licensing');
    expect(diagnostics.nukeLibrary).toBe(false);
  });

  it('detects silent exit 0 when the build method was not invoked', () => {
    const diagnostics = UnityBuildDiagnosticsService.analyzeRun({
      exitCode: 0,
      logText: 'Build asset version error',
    });

    expect(diagnostics.silentSuccess).toBe(true);
    expect(diagnostics.recommendedAction).toBe('reset-source-asset-db');
  });

  it('finds Git LFS pointer DLLs under Assets and Packages', () => {
    const projectPath = '/project';
    const assetsPath = path.join(projectPath, 'Assets');
    const dllPath = path.join(assetsPath, 'Plugin.dll');

    mockFs.existsSync.mockImplementation((p: any) => p === assetsPath);
    mockFs.readdirSync.mockImplementation((p: any) => {
      if (p === assetsPath) {
        return [{ name: 'Plugin.dll', isDirectory: () => false, isFile: () => true }] as any;
      }

      return [] as any;
    });
    mockFs.statSync.mockReturnValue({ size: 120 } as any);
    mockFs.readFileSync.mockReturnValue('version https://git-lfs.github.com/spec/v1\n' as any);

    expect(UnityBuildDiagnosticsService.scanForLfsPointerDlls(projectPath)).toEqual([dllPath]);
  });
});

describe('UnityRecoveryService', () => {
  it('keeps retry budgets independent by recovery type', () => {
    const budgets = UnityRecoveryService.createDefaultBudgets();
    const licensingDiagnostics = UnityBuildDiagnosticsService.analyzeRun({
      exitCode: -1,
      runtimeSeconds: 10,
      logText: 'Access token is unavailable',
    });

    const packageDiagnostics = UnityBuildDiagnosticsService.analyzeRun({
      exitCode: 1,
      logText: 'Could not restore immutable package asset',
    });

    const licensingDecision = UnityRecoveryService.decide(licensingDiagnostics, budgets);
    const packageDecision = UnityRecoveryService.decide(packageDiagnostics, budgets);

    expect(licensingDecision.action).toBe('retry-licensing');
    expect(packageDecision.action).toBe('retry-package-cache');
    expect(budgets.licensingRace.used).toBe(1);
    expect(budgets.packageCache.used).toBe(1);
  });
});
