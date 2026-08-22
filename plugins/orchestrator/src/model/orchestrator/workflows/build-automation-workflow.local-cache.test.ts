import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BuildParameters from '../../build-parameters';
import Orchestrator from '../orchestrator';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';

// The local-cache restore/save calls this workflow makes are dynamically
// imported (`await import('../services/cache/local-cache-service')`), same
// as plugin-lifecycle.ts does for its own beforeLocalBuild/afterLocalBuild
// calls. Mock the module so we can assert call args/order without touching
// the filesystem or shelling out to `tar`.
vi.mock('../services/cache/local-cache-service', () => ({
  LocalCacheService: {
    resolveCacheRoot: vi.fn(() => '/fake/cache/root'),
    generateCacheKey: vi.fn(() => 'fake-cache-key'),
    generateCacheKeyCandidates: vi.fn(() => ['fake-cache-key', 'fallback-key']),
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
  bp.maxCacheEntries = 2;

  return Object.assign(bp, overrides);
}

function makeStepState(): OrchestratorStepParameters {
  return new OrchestratorStepParameters('test-image', [], []);
}

describe('BuildAutomationWorkflow local cache wiring (isBareLocalProvider only)', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
    Orchestrator.Provider = undefined as any;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  function stubProviderAndHooks(): string[] {
    const callOrder: string[] = [];

    Orchestrator.Provider = {
      runTaskInWorkflow: vi.fn(async () => {
        callOrder.push('runTaskInWorkflow');

        return 'build output';
      }),
    } as any;

    vi.spyOn(ContainerHookService, 'RunPreBuildSteps').mockResolvedValue('');
    vi.spyOn(ContainerHookService, 'RunPostBuildSteps').mockResolvedValue('');

    return callOrder;
  }

  it('does not touch LocalCacheService when localCacheEnabled is unset/false (no behavior change from baseline)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      localCacheEnabled: false,
      localCacheLibrary: true,
      localCacheLfs: true,
    });
    stubProviderAndHooks();

    await new BuildAutomationWorkflow().run(makeStepState());

    expect(LocalCacheService.restoreEngineCache).not.toHaveBeenCalled();
    expect(LocalCacheService.restoreLfsCache).not.toHaveBeenCalled();
    expect(LocalCacheService.saveEngineCache).not.toHaveBeenCalled();
    expect(LocalCacheService.saveLfsCache).not.toHaveBeenCalled();
  });

  it('restores and saves the engine (Library) cache when localCacheEnabled + localCacheLibrary are set, around the Unity invocation', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheLfs: false,
    });
    const callOrder = stubProviderAndHooks();
    (LocalCacheService.restoreEngineCache as any).mockImplementation(async () => {
      callOrder.push('restoreEngineCache');

      return true;
    });
    (LocalCacheService.saveEngineCache as any).mockImplementation(async () => {
      callOrder.push('saveEngineCache');
    });

    await new BuildAutomationWorkflow().run(makeStepState());

    expect(LocalCacheService.resolveCacheRoot).toHaveBeenCalledWith(Orchestrator.buildParameters);
    expect(LocalCacheService.generateCacheKey).toHaveBeenCalledWith(
      'StandaloneLinux64',
      '2021.3.0f1',
      'main',
    );

    const expectedProjectPath = path.join(process.cwd(), 'test-project');
    expect(LocalCacheService.restoreEngineCache).toHaveBeenCalledWith(
      expectedProjectPath,
      '/fake/cache/root',
      'fake-cache-key',
      expect.objectContaining({ fallbackKeys: [] }),
    );
    expect(LocalCacheService.saveEngineCache).toHaveBeenCalledWith(
      expectedProjectPath,
      '/fake/cache/root',
      'fake-cache-key',
      expect.objectContaining({ maxCacheEntries: 2 }),
    );

    expect(LocalCacheService.restoreLfsCache).not.toHaveBeenCalled();
    expect(LocalCacheService.saveLfsCache).not.toHaveBeenCalled();

    expect(callOrder).toEqual(['restoreEngineCache', 'runTaskInWorkflow', 'saveEngineCache']);
  });

  it('restores and saves the LFS cache when localCacheEnabled + localCacheLfs are set, around the Unity invocation', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local-system',
      localCacheEnabled: true,
      localCacheLibrary: false,
      localCacheLfs: true,
    });
    const callOrder = stubProviderAndHooks();
    (LocalCacheService.restoreLfsCache as any).mockImplementation(async () => {
      callOrder.push('restoreLfsCache');

      return true;
    });
    (LocalCacheService.saveLfsCache as any).mockImplementation(async () => {
      callOrder.push('saveLfsCache');
    });

    await new BuildAutomationWorkflow().run(makeStepState());

    expect(LocalCacheService.restoreLfsCache).toHaveBeenCalledWith(
      process.cwd(),
      '/fake/cache/root',
      'fake-cache-key',
    );
    expect(LocalCacheService.saveLfsCache).toHaveBeenCalledWith(
      process.cwd(),
      '/fake/cache/root',
      'fake-cache-key',
      2,
    );

    expect(LocalCacheService.restoreEngineCache).not.toHaveBeenCalled();
    expect(LocalCacheService.saveEngineCache).not.toHaveBeenCalled();

    expect(callOrder).toEqual(['restoreLfsCache', 'runTaskInWorkflow', 'saveLfsCache']);
  });

  it.each(['aws', 'k8s', 'local-docker', 'test'])(
    'never touches LocalCacheService for providerStrategy=%s even when localCacheEnabled is set (scoped to isBareLocalProvider only)',
    async (providerStrategy) => {
      Orchestrator.buildParameters = makeBuildParameters({
        providerStrategy,
        localCacheEnabled: true,
        localCacheLibrary: true,
        localCacheLfs: true,
      });
      stubProviderAndHooks();

      await new BuildAutomationWorkflow().run(makeStepState());

      expect(LocalCacheService.restoreEngineCache).not.toHaveBeenCalled();
      expect(LocalCacheService.restoreLfsCache).not.toHaveBeenCalled();
      expect(LocalCacheService.saveEngineCache).not.toHaveBeenCalled();
      expect(LocalCacheService.saveLfsCache).not.toHaveBeenCalled();
    },
  );

  it('a cache restore failure is logged and does not abort the build (Unity still runs)', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheLfs: false,
    });
    const callOrder = stubProviderAndHooks();
    (LocalCacheService.restoreEngineCache as any).mockRejectedValue(
      new Error('simulated restore failure'),
    );

    await expect(new BuildAutomationWorkflow().run(makeStepState())).resolves.toBeTypeOf('string');

    expect(callOrder).toContain('runTaskInWorkflow');
  });

  it('a cache save failure after a successful build is logged and does not throw', async () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      localCacheEnabled: true,
      localCacheLibrary: true,
      localCacheLfs: false,
    });
    stubProviderAndHooks();
    (LocalCacheService.saveEngineCache as any).mockRejectedValue(
      new Error('simulated save failure'),
    );

    await expect(new BuildAutomationWorkflow().run(makeStepState())).resolves.toBeTypeOf('string');
  });
});
