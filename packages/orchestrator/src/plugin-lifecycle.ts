/**
 * Plugin lifecycle implementation for unity-builder integration.
 *
 * This module implements the OrchestratorPlugin interface defined by
 * unity-builder. The plugin reads its OWN configuration from environment
 * variables and GitHub Actions inputs — unity-builder never proxies them.
 *
 * Usage by unity-builder:
 *   const { createPlugin } = await import('@game-ci/orchestrator');
 *   const plugin = createPlugin();
 *   await plugin.initialize(coreParams, workspace);
 *
 * ── Engine-agnostic contract ─────────────────────────────────────────
 *
 * `coreParams: Record<string, any>` is intentionally opaque. The host
 * (unity-builder today, @game-ci/cli in the future) passes its full
 * BuildParameters object through. This plugin only reads:
 *
 *   - Generic build context: targetPlatform, projectPath, buildPath,
 *     buildGuid, branch, gitSha, customParameters, gitPrivateToken,
 *     runnerTempPath, providerStrategy, cacheRetentionDays, testResultPath
 *   - Plugin-owned config (read directly from env/inputs via getInput, NOT
 *     from coreParams): everything in the `config` object below
 *
 * The plugin MUST NOT depend on engine-specific keys like `unitySerial` /
 * `unityLicensingServer` / `unityLicensingToolset` / `skipActivation`.
 * Those keys may be present in coreParams (the host put them there for
 * downstream consumers like the build container's env vars) but the
 * orchestrator plugin treats them as opaque pass-through.
 *
 * Future state — see https://github.com/game-ci/orchestrator/issues/25:
 * eventually @game-ci/cli becomes the top-level entry. cli composes
 * unity-builder (Unity runtime) and orchestrator (dispatch) and supplies
 * the same coreParams shape. Because the contract is opaque, no plugin
 * change is needed to support the future caller.
 */

import * as core from '@actions/core';
import path from 'node:path';
import Orchestrator from './model/orchestrator/orchestrator';
import { BuildReliabilityService } from './model/orchestrator/services/reliability';
import { TestWorkflowService } from './model/orchestrator/services/test-workflow';
import { HotRunnerService } from './model/orchestrator/services/hot-runner';
import { OutputService } from './model/orchestrator/services/output/output-service';
import { OutputTypeRegistry } from './model/orchestrator/services/output/output-type-registry';
import { ArtifactUploadHandler } from './model/orchestrator/services/output/artifact-upload-handler';
import { IncrementalSyncService } from './model/orchestrator/services/sync';

// ── Input helpers ────────────────────────────────────────────────────

function getInput(name: string): string {
  // core.getInput reads INPUT_<NAME> env vars (set by GitHub Actions or the composite action)
  const coreValue = core.getInput(name);
  if (coreValue && coreValue !== '') return coreValue;

  // Fallback to raw env vars (for CLI or manual usage)
  if (process.env[name] !== undefined) return process.env[name]!;

  // camelCase → UPPER_SNAKE_CASE fallback
  const envKey = name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toUpperCase()
    .replace(/ /g, '_');
  if (envKey !== name && process.env[envKey] !== undefined) return process.env[envKey]!;

  return '';
}

function getBool(name: string, defaultValue = false): boolean {
  const value = getInput(name);
  if (!value) return defaultValue;

  return value === 'true';
}

function getNumber(name: string, defaultValue: number): number {
  const value = getInput(name);
  if (!value) return defaultValue;

  return Number(value) || defaultValue;
}

// ── Plugin config ────────────────────────────────────────────────────
// Lazy getters — values are read from env/inputs at access time,
// so they pick up whatever the composite action or user has set.

const config = {
  // Provider
  get providerStrategy() {
    return getInput('providerStrategy') || 'local';
  },
  get fallbackProviderStrategy() {
    return getInput('fallbackProviderStrategy');
  },
  get retryOnFallback() {
    return getBool('retryOnFallback');
  },

  // Test workflow
  get testSuitePath() {
    return getInput('testSuitePath');
  },
  get testSuiteEvent() {
    return getInput('testSuiteEvent');
  },
  get testFilterRefs() {
    return getInput('testFilterRefs');
  },
  get testFilterInjection() {
    return getInput('testFilterInjection');
  },
  get testFilterInjectionPath() {
    return getInput('testFilterInjectionPath');
  },

  // Hot runner
  get hotRunnerEnabled() {
    return getBool('hotRunnerEnabled');
  },
  get hotRunnerTransport() {
    return (getInput('hotRunnerTransport') || 'websocket') as 'websocket' | 'grpc' | 'named-pipe';
  },
  get hotRunnerHost() {
    return getInput('hotRunnerHost') || 'localhost';
  },
  get hotRunnerPort() {
    return getNumber('hotRunnerPort', 9090);
  },
  get hotRunnerHealthInterval() {
    return getNumber('hotRunnerHealthInterval', 30);
  },
  get hotRunnerMaxIdle() {
    return getNumber('hotRunnerMaxIdle', 3600);
  },
  get hotRunnerFallbackToCold() {
    return getBool('hotRunnerFallbackToCold', true);
  },

  // Git reliability
  get gitIntegrityCheck() {
    return getBool('gitIntegrityCheck');
  },
  get gitAutoRecover() {
    return getBool('gitAutoRecover');
  },
  get cleanReservedFilenames() {
    return getBool('cleanReservedFilenames');
  },
  get unityProcessCleanup() {
    return getBool('unityProcessCleanup');
  },
  get enableBuildDiagnostics() {
    return getBool('enableBuildDiagnostics');
  },
  get collectUnityLogs() {
    return getBool('collectUnityLogs');
  },
  get collectUnityLogsOnSuccess() {
    return getBool('collectUnityLogsOnSuccess', true);
  },
  get unityLogCategories() {
    return getInput('unityLogCategories');
  },
  get unityLogsIncludeSensitive() {
    return getBool('unityLogsIncludeSensitive');
  },
  get unityLogsOutputDir() {
    return getInput('unityLogsOutputDir');
  },
  get streamUnityLogs() {
    return getBool('streamUnityLogs');
  },
  get streamUnityLogPaths() {
    return getInput('streamUnityLogPaths');
  },
  get enableUnityRetry() {
    return getBool('enableUnityRetry');
  },
  get unityRetryMaxAttempts() {
    return getNumber('unityRetryMaxAttempts', 3);
  },
  get licensingStaggerDelay() {
    return getBool('licensingStaggerDelay');
  },
  get profileFingerprintEnabled() {
    return getBool('profileFingerprintEnabled');
  },
  get workerCount() {
    return getNumber('workerCount', 0);
  },
  get ilppCleanupEnabled() {
    return getBool('ilppCleanupEnabled');
  },
  get acceleratorMode() {
    return (getInput('acceleratorMode') || 'enabled') as 'enabled' | 'disabled' | 'download-only';
  },
  get testResultCleanup() {
    return getBool('testResultCleanup');
  },
  get disableAssemblyUpdater() {
    return getBool('disableAssemblyUpdater');
  },

  // Build archive
  get buildArchiveEnabled() {
    return getBool('buildArchiveEnabled');
  },
  get buildArchivePath() {
    return getInput('buildArchivePath') || './build-archives';
  },
  get buildArchiveRetention() {
    return getNumber('buildArchiveRetention', 30);
  },

  // Child workspaces
  get childWorkspacesEnabled() {
    return getBool('childWorkspacesEnabled');
  },
  get childWorkspaceName() {
    return getInput('childWorkspaceName');
  },
  get childWorkspaceCacheRoot() {
    return getInput('childWorkspaceCacheRoot');
  },
  get childWorkspacePreserveGit() {
    return getBool('childWorkspacePreserveGit', true);
  },
  get childWorkspaceSeparateLibrary() {
    return getBool('childWorkspaceSeparateLibrary', true);
  },

  // Submodule profiles
  get submoduleProfilePath() {
    return getInput('submoduleProfilePath');
  },
  get submoduleVariantPath() {
    return getInput('submoduleVariantPath');
  },
  get submoduleToken() {
    return getInput('submoduleToken');
  },

  // LFS
  get lfsTransferAgent() {
    return getInput('lfsTransferAgent');
  },
  get lfsTransferAgentArgs() {
    return getInput('lfsTransferAgentArgs');
  },
  get lfsStoragePaths() {
    return getInput('lfsStoragePaths');
  },

  // Local cache
  get localCacheEnabled() {
    return getBool('localCacheEnabled');
  },
  get localCacheRoot() {
    return getInput('localCacheRoot');
  },
  get localCacheLibrary() {
    return getBool('localCacheLibrary', true);
  },
  get localCacheLfs() {
    return getBool('localCacheLfs');
  },
  get localCacheFallback() {
    return getBool('localCacheFallback');
  },
  get localCacheFallbackKeys() {
    return getInput('localCacheFallbackKeys');
  },
  get localCacheMode() {
    const mode = getInput('localCacheMode') || 'tar';
    if (mode === 'canonical-overlay') {
      throw new Error(
        '[plugin-lifecycle] localCacheMode: canonical-overlay has been removed. ' +
          "Use 'move-directory' (recommended for retained runners/build farms) or 'tar' " +
          '(recommended for remote/ephemeral caches, or combine with rclone/S3 built-in ' +
          'container hooks — see the caching docs for details).',
      );
    }
    return mode;
  },
  get maxCacheEntries() {
    return Number(getInput('maxCacheEntries')) || 2;
  },
  get minCacheEntries() {
    return Number(getInput('minCacheEntries')) || 0;
  },
  get upmOfflineEnabled() {
    return getBool('upmOfflineEnabled');
  },
  get backgroundCacheSave() {
    return getBool('backgroundCacheSave');
  },

  // Git hooks
  get gitHooksEnabled() {
    return getBool('gitHooksEnabled');
  },
  get gitHooksSkipList() {
    return getInput('gitHooksSkipList');
  },

  // Sync
  get syncStrategy() {
    return getInput('syncStrategy') || 'full';
  },
  get syncInputRef() {
    return getInput('syncInputRef');
  },
  get syncStorageRemote() {
    return getInput('syncStorageRemote');
  },
  get syncRevertAfter() {
    return getBool('syncRevertAfter', true);
  },
  get syncStatePath() {
    return getInput('syncStatePath') || '.game-ci/sync-state.json';
  },

  // Artifacts
  get artifactOutputTypes() {
    return getInput('artifactOutputTypes') || 'build,logs,test-results';
  },
  get artifactUploadTarget() {
    return getInput('artifactUploadTarget') || 'github-artifacts';
  },
  get artifactUploadPath() {
    return getInput('artifactUploadPath');
  },
  get artifactCompression() {
    return getInput('artifactCompression') || 'gzip';
  },
  get artifactRetentionDays() {
    return getInput('artifactRetentionDays') || '30';
  },
  get artifactCustomTypes() {
    return getInput('artifactCustomTypes');
  },
};

// ── Plugin interface ─────────────────────────────────────────────────

export interface OrchestratorPlugin {
  initialize(coreParams: Record<string, any>, workspace: string): Promise<void>;
  canHandleBuild(): boolean;
  handleBuild(baseImage: string): Promise<{ exitCode: number; fallbackToLocal?: boolean }>;
  beforeLocalBuild(workspace: string): Promise<void>;
  afterLocalBuild(workspace: string, exitCode: number): Promise<void>;
  handlePostBuild(exitCode: number): Promise<void>;
}

type SyncStrategy = 'full' | 'git-delta' | 'direct-input' | 'storage-pull';

// ── Factory ──────────────────────────────────────────────────────────

export function createPlugin(): OrchestratorPlugin {
  let coreParams: Record<string, any> = {};
  let workspace = '';

  // State that needs to persist between beforeLocalBuild / afterLocalBuild
  let childWorkspaceConfig: any;
  let localCacheState: { cacheRoot: string; cacheKey: string } | undefined;
  let unityLogTail: { stop: () => void } | undefined;

  return {
    async initialize(params, ws) {
      coreParams = params;
      workspace = ws;

      // Configure git environment for CI reliability (opt-in)
      if (getBool('configureGitEnvironment')) {
        BuildReliabilityService.configureGitEnvironment();
      }
    },

    canHandleBuild(): boolean {
      if (config.testSuitePath) return true;
      if (config.hotRunnerEnabled) return true;
      if (coreParams.providerStrategy !== 'local') return true;

      return false;
    },

    async handleBuild(baseImage: string): Promise<{ exitCode: number; fallbackToLocal?: boolean }> {
      // ── Test workflow ──────────────────────────────────────────
      if (config.testSuitePath) {
        core.info('[TestWorkflow] Test suite path detected, using test workflow engine');
        const results = await TestWorkflowService.executeTestSuite(config.testSuitePath, {
          ...(coreParams as any),
          testFilterRefs: config.testFilterRefs,
          testFilterInjection: config.testFilterInjection,
          testFilterInjectionPath: config.testFilterInjectionPath,
        });

        let totalFailed = 0;
        for (const result of results || []) {
          totalFailed += result.failed;
        }

        if (totalFailed > 0) {
          core.setFailed(`Test workflow completed with ${totalFailed} failure(s)`);

          return { exitCode: 1 };
        }
        core.info('[TestWorkflow] All test runs passed');

        return { exitCode: 0 };
      }

      // ── Hot runner ─────────────────────────────────────────────
      if (config.hotRunnerEnabled) {
        core.info('[HotRunner] Hot runner mode enabled, attempting hot build...');
        const hotRunnerService = new HotRunnerService();

        try {
          await hotRunnerService.initialize({
            enabled: true,
            transport: config.hotRunnerTransport,
            host: config.hotRunnerHost,
            port: config.hotRunnerPort,
            healthCheckInterval: config.hotRunnerHealthInterval,
            maxIdleTime: config.hotRunnerMaxIdle,
            maxJobsBeforeRecycle: 0,
          });

          const result = await hotRunnerService.submitBuild(coreParams as any, (output: string) => {
            core.info(output);
          });

          core.info(`[HotRunner] Build completed with exit code ${result.exitCode}`);
          await hotRunnerService.shutdown();

          return { exitCode: result.exitCode };
        } catch (hotRunnerError) {
          await hotRunnerService.shutdown();

          if (config.hotRunnerFallbackToCold) {
            core.warning(
              `[HotRunner] Hot runner failed: ${(hotRunnerError as Error).message}. Falling back to cold build.`,
            );

            // If the base strategy is remote, do the remote build here
            if (coreParams.providerStrategy !== 'local') {
              const result = await Orchestrator.run(coreParams as any, baseImage);

              return { exitCode: result.BuildSucceeded ? 0 : 1 };
            }

            // Signal unity-builder to do a local build
            return { exitCode: -1, fallbackToLocal: true };
          }

          throw hotRunnerError;
        }
      }

      // ── Remote build ───────────────────────────────────────────
      const result = await Orchestrator.run(coreParams as any, baseImage);

      return { exitCode: result.BuildSucceeded ? 0 : 1 };
    },

    async beforeLocalBuild(ws: string): Promise<void> {
      // ── Git integrity checks ───────────────────────────────────
      if (config.gitIntegrityCheck) {
        core.info('Running git integrity checks...');
        const isHealthy = BuildReliabilityService.checkGitIntegrity(ws);
        BuildReliabilityService.cleanStaleLockFiles(ws);
        BuildReliabilityService.validateSubmoduleBackingStores(ws);

        if (config.cleanReservedFilenames) {
          BuildReliabilityService.cleanReservedFilenames(coreParams.projectPath);
        }

        if (!isHealthy && config.gitAutoRecover) {
          core.info('Git corruption detected, attempting automatic recovery...');
          const recovered = BuildReliabilityService.recoverCorruptedRepo(ws);
          if (!recovered) {
            core.warning('Automatic recovery failed. Build may encounter issues.');
          }
        }
      } else if (config.cleanReservedFilenames) {
        BuildReliabilityService.cleanReservedFilenames(coreParams.projectPath);
      }

      if (config.unityProcessCleanup) {
        const { UnityProcessService } = await import('./model/orchestrator/services/reliability');
        UnityProcessService.cleanupWorkspaceProcesses(path.join(ws, coreParams.projectPath));
      }

      // ── ILPP process cleanup ──────────────────────────────────
      if (config.ilppCleanupEnabled) {
        const { UnityProcessService } = await import('./model/orchestrator/services/reliability');
        UnityProcessService.cleanupIlppProcesses(path.join(ws, coreParams.projectPath));
      }

      // ── Child workspace restore ────────────────────────────────
      if (config.childWorkspacesEnabled && config.childWorkspaceName) {
        const { ChildWorkspaceService } =
          await import('./model/orchestrator/services/cache/child-workspace-service');
        const cacheRoot =
          config.childWorkspaceCacheRoot ||
          path.join(
            coreParams.runnerTempPath || process.env.RUNNER_TEMP || '',
            'game-ci-workspaces',
          );

        childWorkspaceConfig = ChildWorkspaceService.buildConfig({
          childWorkspacesEnabled: config.childWorkspacesEnabled,
          childWorkspaceName: config.childWorkspaceName,
          childWorkspaceCacheRoot: cacheRoot,
          childWorkspacePreserveGit: config.childWorkspacePreserveGit,
          childWorkspaceSeparateLibrary: config.childWorkspaceSeparateLibrary,
        });

        const projectFullPath = path.join(ws, coreParams.projectPath);
        const restored = ChildWorkspaceService.initializeWorkspace(
          projectFullPath,
          childWorkspaceConfig,
        );
        core.info(
          `Child workspace "${config.childWorkspaceName}": ${restored ? 'restored from cache' : 'starting fresh'}`,
        );

        const size = ChildWorkspaceService.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size after restore: ${size}`);
      }

      // ── Submodule profiles ─────────────────────────────────────
      if (config.submoduleProfilePath) {
        core.info('Initializing submodules from profile...');
        const { SubmoduleProfileService } =
          await import('./model/orchestrator/services/submodule/submodule-profile-service');
        const plan = await SubmoduleProfileService.createInitPlan(
          config.submoduleProfilePath,
          config.submoduleVariantPath,
          ws,
        );

        if (plan) {
          await SubmoduleProfileService.execute(
            plan,
            ws,
            config.submoduleToken || coreParams.gitPrivateToken,
          );
        }
      }

      // ── Profile fingerprinting ─────────────────────────────────
      if (config.profileFingerprintEnabled && config.submoduleProfilePath) {
        const { ProfileFingerprintService } =
          await import('./model/orchestrator/services/cache/profile-fingerprint-service');
        const projectFullPath = path.join(ws, coreParams.projectPath);
        const changed = ProfileFingerprintService.detectAndClear(
          projectFullPath,
          config.submoduleProfilePath,
          config.submoduleVariantPath || undefined,
        );
        if (changed) {
          core.info('Profile fingerprint changed — stale compilation artifacts cleared');
        }
      }

      // ── Custom LFS transfer agent ─────────────────────────────
      if (config.lfsTransferAgent) {
        core.info('Configuring custom LFS transfer agent...');
        const { LfsAgentService } =
          await import('./model/orchestrator/services/lfs/lfs-agent-service');
        await LfsAgentService.configure(
          config.lfsTransferAgent,
          config.lfsTransferAgentArgs,
          config.lfsStoragePaths ? config.lfsStoragePaths.split(';') : [],
          ws,
        );
      }

      // ── Local cache restore ────────────────────────────────────
      if (config.localCacheEnabled) {
        const { LocalCacheService } =
          await import('./model/orchestrator/services/cache/local-cache-service');
        const cacheRoot = LocalCacheService.resolveCacheRoot(coreParams as any) || '';
        const cacheKey =
          LocalCacheService.generateCacheKey(
            coreParams.targetPlatform,
            coreParams.editorVersion,
            coreParams.branch || '',
          ) || '';

        localCacheState = { cacheRoot, cacheKey };

        if (config.localCacheLfs) {
          await LocalCacheService.restoreLfsCache(ws, cacheRoot, cacheKey);
        }
        if (config.localCacheLibrary) {
          const projectFullPath = path.join(ws, coreParams.projectPath);
          const fallbackKeys = config.localCacheFallback
            ? LocalCacheService.generateCacheKeyCandidates(
                cacheRoot,
                coreParams.targetPlatform,
                coreParams.editorVersion,
                coreParams.branch || '',
                config.localCacheFallbackKeys
                  .split(',')
                  .map((key) => key.trim())
                  .filter(Boolean),
              ).filter((key) => key !== cacheKey)
            : [];
          await LocalCacheService.restoreEngineCache(projectFullPath, cacheRoot, cacheKey, {
            fallbackKeys,
            restoreMode: config.localCacheMode as any,
          });
        }
      }

      // ── UPM offline fingerprinting ─────────────────────────────
      if (config.upmOfflineEnabled && config.localCacheEnabled && localCacheState) {
        const { UpmCacheService } =
          await import('./model/orchestrator/services/cache/upm-cache-service');
        const projectFullPath = path.join(ws, coreParams.projectPath);
        const upmCachePath = path.join(localCacheState.cacheRoot, localCacheState.cacheKey);
        UpmCacheService.applyOfflineMode(projectFullPath, upmCachePath);
      }

      // ── Git hooks ──────────────────────────────────────────────
      if (config.gitHooksEnabled) {
        const { GitHooksService } =
          await import('./model/orchestrator/services/hooks/git-hooks-service');
        await GitHooksService.installHooks(ws);
        if (config.gitHooksSkipList) {
          const environment = GitHooksService.configureSkipList(config.gitHooksSkipList.split(','));
          if (environment) {
            Object.assign(process.env, environment);
          }
        }
      }

      // ── Accelerator mode ────────────────────────────────────────
      if (config.acceleratorMode !== 'enabled') {
        const { AcceleratorService } =
          await import('./model/orchestrator/services/reliability/accelerator-service');
        const projectFullPath = path.join(ws, coreParams.projectPath);
        AcceleratorService.patchEditorSettings(projectFullPath, config.acceleratorMode);
      }

      // ── Test result cleanup ───────────────────────────────────
      if (config.testResultCleanup) {
        const { PreBuildCleanupService } =
          await import('./model/orchestrator/services/reliability/pre-build-cleanup-service');
        const testResultPath = coreParams.testResultPath || path.join(ws, 'test-results');
        PreBuildCleanupService.cleanTestResults(testResultPath);
      }

      // ── Disable assembly updater ──────────────────────────────
      if (config.disableAssemblyUpdater && coreParams.customParameters !== undefined) {
        const { PreBuildCleanupService } =
          await import('./model/orchestrator/services/reliability/pre-build-cleanup-service');
        const arg = PreBuildCleanupService.getDisableAssemblyUpdaterArg(
          coreParams.customParameters || '',
        );
        if (arg) {
          coreParams.customParameters = `${coreParams.customParameters || ''} ${arg}`.trim();
          core.info(`[PreBuild] Added ${arg} to custom parameters`);
        }
      }

      // ── Worker count ──────────────────────────────────────────
      if (config.workerCount > 0) {
        const workerArg = `-job-worker-count ${config.workerCount}`;
        if (
          coreParams.customParameters !== undefined &&
          !coreParams.customParameters.includes('-job-worker-count')
        ) {
          coreParams.customParameters = `${coreParams.customParameters || ''} ${workerArg}`.trim();
          core.info(`[PreBuild] Set Unity worker count: ${config.workerCount}`);
        }
      }

      // ── Licensing stagger delay ─────────────────────────────────
      if (config.licensingStaggerDelay) {
        const { LicensingRaceService } =
          await import('./model/orchestrator/services/reliability/licensing-race-service');
        const staggerConfig = LicensingRaceService.createConfig(true);
        await LicensingRaceService.applyStaggerDelay(staggerConfig);
      }

      // ── Incremental sync strategy ─────────────────────────────
      const syncStrategy = config.syncStrategy;
      if (syncStrategy !== 'full') {
        core.info(`[Sync] Applying sync strategy: ${syncStrategy}`);
        await this.applySyncStrategy(ws);
      }

      // ── Live Unity log streaming ───────────────────────────────
      if (config.streamUnityLogs) {
        const { UnityLogTailService } =
          await import('./model/orchestrator/services/output/unity-log-tail-service');
        const projectFullPath = path.join(ws, coreParams.projectPath);
        const explicit = (config.streamUnityLogPaths || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const defaults = [
          path.join(projectFullPath, 'Builds', 'Logs', 'Editor.log'),
          path.join(projectFullPath, 'Logs', 'UnityDiagnostics', 'editor-log', 'Editor.log'),
        ];
        const filesToTail = explicit.length > 0 ? explicit : defaults;
        const tail = new UnityLogTailService({
          files: filesToTail,
          onLine: (_filePath, line) => core.info(line),
        });
        tail.start();
        unityLogTail = tail;
        core.info(`[UnityLogs] Live log streaming started for: ${filesToTail.join(', ')}`);
      }
    },

    async afterLocalBuild(ws: string, exitCode: number): Promise<void> {
      // ── Stop live log streaming ───────────────────────────────
      if (unityLogTail) {
        try {
          unityLogTail.stop();
        } catch (error: any) {
          core.warning(`[UnityLogs] Failed to stop log tail: ${error.message}`);
        }
        unityLogTail = undefined;
      }

      // ── Unity log collection (Editor.log, licensing, audit, services-config, …) ──
      if (config.collectUnityLogs && (exitCode !== 0 || config.collectUnityLogsOnSuccess)) {
        try {
          const { UnityLogCollectorService } =
            await import('./model/orchestrator/services/output/unity-log-collector-service');
          const result = UnityLogCollectorService.collect({
            workspace: ws,
            projectPath: coreParams.projectPath || '',
            outputDir: config.unityLogsOutputDir || undefined,
            categories: UnityLogCollectorService.parseCategories(config.unityLogCategories),
            includeSensitive: config.unityLogsIncludeSensitive,
          });
          core.setOutput('unityLogsPath', result.outputDir);
          core.setOutput('unityLogsManifest', result.manifestPath);
          core.info(
            `[UnityLogs] ${result.collected.length} item(s), ${result.totalBytes} bytes → ${result.outputDir}`,
          );

          // Auto-register a 'unity-logs' output type so the artifact upload
          // step picks the diagnostics directory up alongside the build.
          OutputTypeRegistry.registerType({
            name: 'unity-logs',
            defaultPath:
              path.relative(coreParams.projectPath || '.', result.outputDir) ||
              './Logs/UnityDiagnostics/',
            description: 'Unity Editor / licensing / audit / services-config logs',
            builtIn: false,
          });
        } catch (error: any) {
          core.warning(`[UnityLogs] collection failed: ${error.message}`);
        }
      }

      // ── Build diagnostics ─────────────────────────────────────
      if (config.enableBuildDiagnostics && exitCode !== 0) {
        const { UnityBuildDiagnosticsService } =
          await import('./model/orchestrator/services/reliability');
        const projectFullPath = path.join(ws, coreParams.projectPath);

        // Attempt to read Unity Editor log for diagnostics
        let logText = '';
        const editorLogPath = path.join(projectFullPath, 'Builds', 'Logs', 'Editor.log');
        try {
          const fs = await import('node:fs');
          if (fs.existsSync(editorLogPath)) {
            logText = fs.readFileSync(editorLogPath, 'utf8');
          }
        } catch {
          // Log not available -- diagnostics will work with exit code only
        }

        const diagnostics = UnityBuildDiagnosticsService.analyzeRun({
          exitCode,
          logText,
          projectPath: projectFullPath,
        });
        UnityBuildDiagnosticsService.emitSummary(diagnostics);
      }

      // ── Local cache save ───────────────────────────────────────
      if (config.localCacheEnabled && localCacheState) {
        const { LocalCacheService } =
          await import('./model/orchestrator/services/cache/local-cache-service');
        const { cacheRoot, cacheKey } = localCacheState;

        if (config.localCacheLibrary) {
          const projectFullPath = path.join(ws, coreParams.projectPath);
          await LocalCacheService.saveEngineCache(projectFullPath, cacheRoot, cacheKey, {
            saveMode: config.localCacheMode as any,
            skipOnLfsPointerPoisoning: true,
            backgroundSave: config.backgroundCacheSave,
            maxCacheEntries: config.maxCacheEntries,
          });
        }
        if (config.localCacheLfs) {
          await LocalCacheService.saveLfsCache(ws, cacheRoot, cacheKey, config.maxCacheEntries);
        }

        // Run local cache age-based GC if cacheRetentionDays is configured
        const retentionDays = Number(coreParams.cacheRetentionDays) || 0;
        if (retentionDays > 0) {
          await LocalCacheService.garbageCollect(cacheRoot, retentionDays, config.minCacheEntries);
        }

        // Save UPM fingerprint alongside cache (only on successful builds)
        if (config.upmOfflineEnabled && exitCode === 0) {
          const { UpmCacheService } =
            await import('./model/orchestrator/services/cache/upm-cache-service');
          const projectFullPath = path.join(ws, coreParams.projectPath);
          const upmCachePath = path.join(cacheRoot, cacheKey);
          UpmCacheService.saveFingerprint(projectFullPath, upmCachePath);
        }
      }

      // ── Child workspace save ───────────────────────────────────
      if (childWorkspaceConfig?.enabled) {
        const { ChildWorkspaceService } =
          await import('./model/orchestrator/services/cache/child-workspace-service');
        const projectFullPath = path.join(ws, coreParams.projectPath);

        const preSaveSize = ChildWorkspaceService.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size before save: ${preSaveSize}`);

        ChildWorkspaceService.saveWorkspace(projectFullPath, childWorkspaceConfig);
        core.info(`Child workspace "${config.childWorkspaceName}" saved to cache`);
      }

      // ── Sync revert ────────────────────────────────────────────
      if (config.syncRevertAfter && config.syncStrategy !== 'full') {
        core.info('[Sync] Reverting overlay changes after job completion');
        try {
          await IncrementalSyncService.revertOverlays(ws, config.syncStatePath);
        } catch (revertError) {
          core.warning(`[Sync] Overlay revert failed: ${(revertError as Error).message}`);
        }
      }
    },

    async handlePostBuild(exitCode: number): Promise<void> {
      // ── Build archiving ────────────────────────────────────────
      if (config.buildArchiveEnabled && exitCode === 0) {
        core.info('Archiving build output...');
        BuildReliabilityService.archiveBuildOutput(coreParams.buildPath, config.buildArchivePath);
        BuildReliabilityService.enforceRetention(
          config.buildArchivePath,
          config.buildArchiveRetention,
        );
      }

      // ── Artifact collection and upload ─────────────────────────
      try {
        // Register custom output types
        if (config.artifactCustomTypes) {
          try {
            const customTypes = JSON.parse(config.artifactCustomTypes);
            if (Array.isArray(customTypes)) {
              for (const ct of customTypes) {
                OutputTypeRegistry.registerType({
                  name: ct.name,
                  defaultPath: ct.defaultPath || ct.pattern || `./${ct.name}/`,
                  description: ct.description || `Custom output type: ${ct.name}`,
                  builtIn: false,
                });
              }
            }
          } catch (parseError) {
            core.warning(`Failed to parse artifactCustomTypes: ${(parseError as Error).message}`);
          }
        }

        // Collect outputs and generate manifest
        const manifestPath = path.join(coreParams.projectPath, 'output-manifest.json');
        const manifest = await OutputService.collectOutputs(
          coreParams.projectPath,
          coreParams.buildGuid,
          config.artifactOutputTypes,
          manifestPath,
        );

        core.setOutput('artifactManifestPath', manifestPath);

        if (manifest) {
          const uploadConfig = ArtifactUploadHandler.parseConfig(
            config.artifactUploadTarget,
            config.artifactUploadPath || undefined,
            config.artifactCompression,
            config.artifactRetentionDays,
          );

          if (uploadConfig) {
            const uploadResult = await ArtifactUploadHandler.uploadArtifacts(
              manifest,
              uploadConfig,
              coreParams.projectPath,
            );

            if (uploadResult && !uploadResult.success) {
              core.warning(
                `Artifact upload completed with errors: ${uploadResult.entries
                  .filter((entry: any) => !entry.success)
                  .map((entry: any) => `${entry.type}: ${entry.error}`)
                  .join('; ')}`,
              );
            }
          }
        }
      } catch (artifactError) {
        core.warning(`Artifact collection/upload failed: ${(artifactError as Error).message}`);
      }
    },

    // Internal helper — not part of the public interface
    async applySyncStrategy(ws: string): Promise<void> {
      const strategy = config.syncStrategy;
      const resolvedStrategy = IncrementalSyncService.resolveStrategy(
        strategy as SyncStrategy,
        ws,
        config.syncStatePath,
      );

      if (resolvedStrategy === 'full') {
        core.info('[Sync] Resolved to full sync (no incremental state available)');

        return;
      }

      switch (resolvedStrategy) {
        case 'git-delta': {
          const targetReference = coreParams.gitSha || coreParams.branch;
          const changedFiles = await IncrementalSyncService.syncGitDelta(
            ws,
            targetReference,
            config.syncStatePath,
          );
          core.info(`[Sync] Git delta sync applied: ${changedFiles} file(s) changed`);
          break;
        }
        case 'direct-input': {
          if (!config.syncInputRef) {
            throw new Error('[Sync] direct-input strategy requires syncInputRef to be set');
          }
          const overlays = await IncrementalSyncService.applyDirectInput(
            ws,
            config.syncInputRef,
            config.syncStorageRemote || undefined,
            config.syncStatePath,
          );
          core.info(`[Sync] Direct input applied: ${overlays.length} overlay(s)`);
          break;
        }
        case 'storage-pull': {
          if (!config.syncInputRef) {
            throw new Error('[Sync] storage-pull strategy requires syncInputRef to be set');
          }
          const pulledFiles = await IncrementalSyncService.syncStoragePull(
            ws,
            config.syncInputRef,
            {
              rcloneRemote: config.syncStorageRemote || undefined,
              syncRevertAfter: config.syncRevertAfter,
              statePath: config.syncStatePath,
            },
          );
          core.info(`[Sync] Storage pull complete: ${pulledFiles.length} file(s)`);
          break;
        }
        default:
          core.warning(`[Sync] Unknown sync strategy: ${resolvedStrategy}`);
      }
    },
  } as OrchestratorPlugin & { applySyncStrategy(ws: string): Promise<void> };
}
