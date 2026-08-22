import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BuildParameters from '../../build-parameters';
import Orchestrator from '../orchestrator';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';

// Same mocking approach as build-automation-workflow.local-cache.test.ts: the
// workflow dynamically imports LocalCacheService, so mock the module to
// assert call args/gating options without touching the filesystem or
// shelling out to `tar`.
vi.mock('../services/cache/local-cache-service', () => ({
  LocalCacheService: {
    resolveCacheRoot: vi.fn(() => '/fake/cache/root'),
    generateCacheKey: vi.fn(() => 'fake-cache-key'),
    generateCacheKeyCandidates: vi.fn(() => ['fake-cache-key']),
    restoreLfsCache: vi.fn(async () => true),
    restoreEngineCache: vi.fn(async () => true),
    saveEngineCache: vi.fn(async () => undefined),
    saveLfsCache: vi.fn(async () => undefined),
  },
}));

// eslint-disable-next-line import/first -- must follow vi.mock (hoisted anyway, but keep them adjacent)
import { BuildAutomationWorkflow } from './build-automation-workflow';
// eslint-disable-next-line import/first
import { LocalCacheService } from '../services/cache/local-cache-service';

function makeBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  const bp = new BuildParameters();
  bp.providerStrategy = 'local';
  bp.commandHooks = '';
  bp.preBuildContainerHooks = '';
  bp.postBuildContainerHooks = '';
  bp.cacheKey = 'test-cache-key';
  bp.projectPath = 'test-project';
  bp.targetPlatform = 'StandaloneLinux64';
  bp.editorVersion = '2021.3.0f1';
  bp.branch = 'main';
  bp.buildName = 'StandaloneLinux64';
  bp.buildPath = 'build/StandaloneLinux64';
  bp.buildFile = 'StandaloneLinux64';
  bp.buildMethod = '';
  bp.buildVersion = '0.0.1';
  bp.androidVersionCode = '';
  bp.chownFilesTo = '';
  bp.manualExit = false;
  bp.buildProfile = '';
  bp.skipActivation = false;
  bp.dockerWorkspacePath = '/github/workspace';
  bp.orchestratorRepoName = 'game-ci/orchestrator';
  bp.orchestratorBranch = 'main';
  bp.gitAuthMode = 'header';
  bp.logId = 'test-log-id';
  bp.buildGuid = 'test-build-guid';
  bp.maxRetainedWorkspaces = 0;
  bp.repoPathOverride = '';
  bp.preflightSuite = '';
  bp.localCacheEnabled = false;
  bp.localCacheLibrary = false;
  bp.localCacheLfs = false;
  bp.localCacheSaveOnFailure = false;
  bp.localCacheMode = 'tar';
  bp.maxCacheEntries = 2;

  return Object.assign(bp, overrides);
}

function makeStepState(): OrchestratorStepParameters {
  return new OrchestratorStepParameters('test-image', [], []);
}

const LOG_DIR = path.join(process.cwd(), 'temp');
const LOG_FILE = path.join(LOG_DIR, 'job-log.txt');

function writeJobLog(content: string): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, content, 'utf8');
}

function stubProviderToFail(errorMessage = 'simulated build failure'): void {
  Orchestrator.Provider = {
    runTaskInWorkflow: vi.fn(async () => {
      throw new Error(errorMessage);
    }),
  } as any;

  vi.spyOn(ContainerHookService, 'RunPreBuildSteps').mockResolvedValue('');
  vi.spyOn(ContainerHookService, 'RunPostBuildSteps').mockResolvedValue('');
}

function stubProviderToSucceed(): void {
  Orchestrator.Provider = {
    runTaskInWorkflow: vi.fn(async () => 'build output'),
  } as any;

  vi.spyOn(ContainerHookService, 'RunPreBuildSteps').mockResolvedValue('');
  vi.spyOn(ContainerHookService, 'RunPostBuildSteps').mockResolvedValue('');
}

describe('BuildAutomationWorkflow cache-floor-on-failure wiring (isBareLocalProvider only)', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
    Orchestrator.Provider = undefined as any;
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // clearAllMocks() resets call history but not a mockRejectedValue/
    // mockResolvedValue override from a prior test -- restore the module's
    // default resolved behavior explicitly so tests don't leak into each other.
    (LocalCacheService.saveEngineCache as any).mockResolvedValue(undefined);
    try {
      fs.rmSync(LOG_FILE, { force: true });
    } catch {
      // ignore
    }
  });

  it('(f) always propagates the original build failure, even when a floor save happens', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog('AssetDatabase Refresh completed\nRUNSTEPS_EXIT_CODE:134\n');
    stubProviderToFail('boom: unity crashed');

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow(
      'boom: unity crashed',
    );
  });

  it('(a) banks the cache when import completed and the failure category is generic (CRASH)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    // "Segmentation fault" -> crashEvidenceFound -> CRASH category.
    // "Refresh completed" -> importCompleted true.
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\nSegmentation fault\nRUNSTEPS_EXIT_CODE:139\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(false);
    expect(options.skipOnCrashEvidence).toBe(true);
    expect(options.diagnostics.importCompleted).toBe(true);
  });

  it('(a) banks the cache for a LICENSE failure with import completed', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\nNo valid license\nRUNSTEPS_EXIT_CODE:1\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(false);
  });

  it('(b) does NOT bank the cache when import completed but the category is COMPILE (corruption-specific)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\nerror CS0246: some type not found\nRUNSTEPS_EXIT_CODE:1\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(true);
  });

  it('(b) does NOT bank the cache when import completed but the category is PACKAGE (corruption-specific)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\n' +
        'error CS0246: type or namespace not found Library/PackageCache/foo\n' +
        'RUNSTEPS_EXIT_CODE:1\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(true);
  });

  it('localCacheFloorCorruptionCategories override narrows the default: PACKAGE removed -> banks despite the built-in default treating it as corruption-specific', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
      localCacheFloorCorruptionCategories: 'COMPILE',
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\n' +
        'error CS0246: type or namespace not found Library/PackageCache/foo\n' +
        'RUNSTEPS_EXIT_CODE:1\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(false);
  });

  it('localCacheFloorCorruptionCategories override widens the default: CRASH added -> blocks a category the built-in default would bank', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
      localCacheFloorCorruptionCategories: 'COMPILE, PACKAGE, CRASH',
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\nSegmentation fault\nRUNSTEPS_EXIT_CODE:139\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCorruptionEvidence).toBe(true);
  });

  it('localCacheFloorCorruptionCategories with only unrecognized entries falls back to the built-in default rather than treating everything as bankable', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
      localCacheFloorCorruptionCategories: 'NOT_A_REAL_CATEGORY',
    });
    writeJobLog(
      'Unity Editor log\nAssetDatabase Refresh completed\n' +
        'error CS0246: type or namespace not found Library/PackageCache/foo\n' +
        'RUNSTEPS_EXIT_CODE:1\n',
    );
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    // Falls back to the default (COMPILE, PACKAGE) since the override had
    // nothing usable in it -- PACKAGE is still blocked.
    expect(options.skipOnCorruptionEvidence).toBe(true);
  });

  it('(c) does NOT bank the cache when import never completed, regardless of category (GENERIC)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    // No "Refresh completed" marker and no projectPath-based ArtifactDB ->
    // importCompleted stays false. No crash/license/compile signal -> GENERIC.
    writeJobLog('Unity Editor log\nsomething went wrong\nRUNSTEPS_EXIT_CODE:1\n');
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.diagnostics.importCompleted).toBe(false);
    expect(options.skipOnCorruptionEvidence).toBe(false);
    expect(options.skipOnCrashEvidence).toBe(true);
  });

  it('(e) --localCacheEnabled off means zero new failure-path behavior (regression guard)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: false,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog('AssetDatabase Refresh completed\nRUNSTEPS_EXIT_CODE:139\n');
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).not.toHaveBeenCalled();
    expect(LocalCacheService.restoreEngineCache).not.toHaveBeenCalled();
  });

  it('localCacheEnabled on but localCacheSaveOnFailure off means zero new failure-path behavior (opt-in guard)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: false,
    });
    writeJobLog('AssetDatabase Refresh completed\nRUNSTEPS_EXIT_CODE:139\n');
    stubProviderToFail();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow();

    expect(LocalCacheService.saveEngineCache).not.toHaveBeenCalled();
  });

  it('(d) a successful build keeps calling saveEngineCache exactly as before, with no failure-path options (regression guard)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    stubProviderToSucceed();

    await expect(new BuildAutomationWorkflow().run(makeStepState())).resolves.toBeTypeOf('string');

    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.skipOnCrashEvidence).toBeUndefined();
    expect(options.skipOnCorruptionEvidence).toBeUndefined();
    expect(options.diagnostics).toBeUndefined();
  });

  it('a floor save failure is logged and does not mask or replace the original build failure', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    writeJobLog('AssetDatabase Refresh completed\nRUNSTEPS_EXIT_CODE:139\n');
    stubProviderToFail('the real build failure');
    (LocalCacheService.saveEngineCache as any).mockRejectedValue(
      new Error('simulated floor save failure'),
    );

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow(
      'the real build failure',
    );
  });

  it('no LOG_FILE present -> diagnostics analysis still runs (empty log) and does not throw out of the workflow', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheSaveOnFailure: true,
    });
    // Deliberately do not write a log file.
    stubProviderToFail('build failed, no log file');

    await expect(new BuildAutomationWorkflow().run(makeStepState())).rejects.toThrow(
      'build failed, no log file',
    );
    // Empty log -> importCompleted false -> not banked, but must not throw.
    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledTimes(1);
    const [, , , options] = (LocalCacheService.saveEngineCache as any).mock.calls[0];
    expect(options.diagnostics.importCompleted).toBe(false);
  });
});
