/**
 * Bridge file — stub for BuildParameters.
 *
 * In unity-builder this is a 488-line god object that mixes local-build and
 * orchestrator concerns.  For the standalone orchestrator repo we only need
 * the shape consumed by orchestrator code (providers, services, options, tests).
 *
 * During Phase 3 of the extraction plan this will be replaced by a proper
 * lean interface supplied by the host (unity-builder or CLI).
 *
 * ── Engine-agnostic boundary ─────────────────────────────────────────
 *
 * Orchestrator's typed surfaces must NOT carry engine-specific vocabulary
 * (Unity-licensing fields, etc.). The plugin contract is opaque
 * (Record<string, any>) — hosts pass their full config through, plugins
 * pull what they need. Engine-specific concerns ride in the dict
 * untouched by orchestrator.
 *
 * Tracking issue: https://github.com/game-ci/orchestrator/issues/25
 */

import * as core from '@actions/core';
import { Cli } from './cli/cli';
import Input from './input';
import { initEngine } from './engine';

class BuildParameters {
  // ── engine ─────────────────────────────────────────────────────────
  engine!: string;
  enginePlugin!: string;

  // ── identity ────────────────────────────────────────────────────────
  editorVersion!: string;
  customImage!: string;
  runnerTempPath!: string;
  targetPlatform!: string;
  projectPath!: string;
  buildProfile!: string;
  buildName!: string;
  buildPath!: string;
  buildFile!: string;
  buildMethod!: string;
  buildVersion!: string;
  androidVersionCode!: string;

  // ── flags ───────────────────────────────────────────────────────────
  manualExit!: boolean;
  enableGpu!: boolean;
  isCliMode!: boolean;
  allowDirtyBuild!: boolean;
  cacheUnityInstallationOnMac!: boolean;

  // ── orchestrator ────────────────────────────────────────────────────
  providerStrategy!: string;
  maxRetainedWorkspaces!: number;
  maxCacheEntries!: number;
  minCacheEntries!: number;
  gcTimeoutMinutes!: number;
  useLargePackages!: boolean;
  useCompressionStrategy!: boolean;
  garbageMaxAge!: number;
  configFiles!: Record<string, string>;
  githubChecks!: boolean;
  asyncWorkflow!: boolean;
  githubCheckId!: string;
  finalHooks!: string[];
  skipLfs!: boolean;
  skipCache!: boolean;
  // Skip Unity license activation/return (SKIP_ACTIVATION env var consumed by
  // dist/platforms/ubuntu/steps/runsteps.sh). Distinct from `game-ci activate`'s
  // per-run ACTIVATE_ONLY flow -- this is for the `local`/`local-system`
  // provider's self-hosted-runner use case, where Unity is already licensed via
  // a long-lived Unity Hub session and per-run activation/return is unwanted.
  skipActivation!: boolean;
  // Command to prefix the engine's process invocation with (ENGINE_LAUNCH_WRAPPER
  // env var consumed by dist/platforms/*/steps/*.sh|ps1 and, for the local/local-system
  // provider, threaded into the generated script below). Empty by default: no wrapper.
  engineLaunchWrapper!: string;
  skipInContainerClone!: boolean;
  repoPathOverride!: string;
  lockedWorkspace!: string;
  cacheSaveOnFailure!: boolean;
  cacheSaveOnFailureFilter!: string;
  cacheRetentionDays!: number;

  // ── docker ──────────────────────────────────────────────────────────
  dockerWorkspacePath!: string;
  dockerCpuLimit!: string;
  dockerMemoryLimit!: string;
  dockerIsolationMode!: string;

  // ── networking / auth ───────────────────────────────────────────────
  gitPrivateToken!: string;
  sshAgent!: string;
  sshPublicKeysDirectoryPath!: string;
  chownFilesTo!: string;

  // ── cloud ───────────────────────────────────────────────────────────
  kubeConfig!: string;
  kubeVolumeSize!: string;
  kubeVolume!: string;
  kubeStorageClass!: string;
  containerMemory!: string;
  containerCpu!: string;
  readTimeout!: number;
  awsStackName!: string;
  awsBaseStackName!: string;
  awsUseSpot!: boolean;
  awsSpotFallback!: boolean;
  awsUseEphemeralStorage!: boolean;
  awsEphemeralStorageSize!: number;
  cloudRunnerCluster!: string;
  cloudRunnerCpu!: string;
  cloudRunnerMemory!: string;

  // ── storage ───────────────────────────────────────────────────────────
  storageProvider!: string;
  rcloneRemote!: string;

  // ── caching / workspace isolation ───────────────────────────────────
  localCacheEnabled!: boolean;
  localCacheLibrary!: boolean;
  localCacheLfs!: boolean;
  localCacheRoot!: string;
  localCacheFallback!: boolean;
  localCacheFallbackKeys!: string;
  localCacheMode!: string;
  // Opt-in (default false) "cache floor" save: when a build/test on the
  // bare-host `local`/`local-system` provider FAILS, still attempt a
  // best-effort Library/LFS cache save if diagnostics show asset import
  // completed and the failure isn't corruption-specific (see
  // UnityBuildDiagnosticsService / isCorruptionSpecificCategory in
  // BuildAutomationWorkflow). Off by default: previously a failed build
  // never touched the cache at all, so this is a meaningful behavior
  // change existing users must opt into -- same caution as
  // enableBuildRetry. Requires localCacheEnabled to also be on.
  localCacheSaveOnFailure!: boolean;
  childWorkspacesEnabled!: boolean;
  childWorkspaceName!: string;
  childWorkspaceCacheRoot!: string;
  childWorkspacePreserveGit!: boolean;
  childWorkspaceSeparateLibrary!: boolean;

  // ── hooks ───────────────────────────────────────────────────────────
  gitHooksEnabled!: boolean;
  gitHooksSkipList!: string;

  // ── hot runner ──────────────────────────────────────────────────────
  hotRunnerEnabled!: boolean;
  hotRunnerTransport!: string;
  hotRunnerHost!: string;
  hotRunnerPort!: number;
  hotRunnerHealthInterval!: number;
  hotRunnerMaxIdle!: number;
  hotRunnerFallbackToCold!: boolean;

  // ── sync ────────────────────────────────────────────────────────────
  syncStrategy!: string;
  syncStatePath!: string;
  syncInputRef!: string;
  syncStorageRemote!: string;
  syncRevertAfter!: boolean;

  // ── reliability ─────────────────────────────────────────────────────
  gitIntegrityCheck!: boolean;
  gitAutoRecover!: boolean;
  // Opt-in (default false) automatic classify -> decide -> retry loop for
  // failed Unity runs on the bare-host `local`/`local-system` provider's
  // build path only (see UnityRetryService). Off by default because retry
  // can nuke/backup the Library folder as a recovery action -- a meaningful
  // behavior change that must not silently activate for existing users.
  enableBuildRetry!: boolean;
  cleanReservedFilenames!: boolean;
  buildArchiveEnabled!: boolean;
  buildArchivePath!: string;
  buildArchiveRetention!: number;
  buildGuid!: string;
  branch!: string;
  gitSha!: string;

  // ── submodule / lfs ─────────────────────────────────────────────────
  submoduleProfilePath!: string;
  submoduleVariantPath!: string;
  submoduleToken!: string;
  lfsTransferAgent!: string;
  lfsTransferAgentArgs!: string;
  lfsStoragePaths!: string;

  // ── test workflow ───────────────────────────────────────────────────
  testSuitePath!: string;
  testFilterRefs!: string;
  testFilterInjection!: string;
  testFilterInjectionPath!: string;

  // ── preflight ───────────────────────────────────────────────────────
  // Path to the preflight suite YAML. Empty string disables preflight.
  // The literal string 'default' runs the built-in fallback suite when
  // no .game-ci/preflight-suite.yml exists.
  preflightSuite!: string;

  // ── artifact / output ───────────────────────────────────────────────
  artifactCustomTypes!: string;
  artifactOutputTypes!: string;
  artifactUploadTarget!: string;
  artifactUploadPath!: string;
  artifactCompression!: string;
  artifactRetentionDays!: number;

  // ── middleware ───────────────────────────────────────────────────────
  middlewarePipeline!: string;

  // ── provider-specific fields ────────────────────────────────────────
  remotePowershellHost!: string;
  remotePowershellTransport!: string;
  remotePowershellCredential!: string;
  githubActionsRepo!: string;
  githubActionsWorkflow!: string;
  githubActionsToken!: string;
  githubActionsRef!: string;
  gitlabProjectId!: string;
  gitlabTriggerToken!: string;
  gitlabApiUrl!: string;
  gitlabRef!: string;
  ansibleInventory!: string;
  ansiblePlaybook!: string;
  ansibleExtraVars!: string;
  ansibleVaultPassword!: string;

  // ── catch-all for any additional properties ─────────────────────────
  [key: string]: any;

  /**
   * Factory — builds a BuildParameters instance from action inputs or CLI options.
   *
   * TODO(extraction): During Phase 3, the host will supply a pre-built config
   * object rather than reading inputs directly.
   */
  static async create(): Promise<BuildParameters> {
    const p = new BuildParameters();

    // Minimal stub: populate from Input (which reads core.getInput / Cli.query)
    p.editorVersion = Input.editorVersion || '2021.3.0f1';
    p.targetPlatform = Input.targetPlatform || 'StandaloneLinux64';
    p.projectPath = Input.projectPath || '.';
    p.buildName = Input.buildName || p.targetPlatform;
    p.buildPath = Input.buildsPath || './build';
    p.buildFile = '';
    p.buildMethod = '';
    p.buildVersion = '1.0.0';
    p.androidVersionCode = '';
    p.customImage = Input.customImage || Input.getInput('image') || '';
    p.runnerTempPath = process.env.RUNNER_TEMP || '';
    p.manualExit = Input.manualExit;
    p.enableGpu = Input.enableGpu;
    p.isCliMode = Cli.isCliMode;
    p.allowDirtyBuild = Input.allowDirtyBuild;

    // Orchestrator fields
    p.providerStrategy = Input.providerStrategy || 'local';
    p.maxRetainedWorkspaces = Number(Input.getInput('maxRetainedWorkspaces')) || 0;
    p.maxCacheEntries = Number(Input.getInput('maxCacheEntries')) || 2;
    p.minCacheEntries = Number(Input.getInput('minCacheEntries')) || 0;
    p.gcTimeoutMinutes = Number(Input.getInput('gcTimeoutMinutes')) || 0;
    try {
      p.configFiles = JSON.parse(Input.getInput('configFiles') || '{}');
    } catch {
      p.configFiles = {};
    }
    p.githubChecks = false;
    p.asyncWorkflow = false;
    p.githubCheckId = '';
    p.finalHooks = [];
    p.skipLfs = false;
    p.skipCache = false;
    p.skipActivation = Cli.options?.skipActivation ?? Input.getInput('skipActivation') === 'true';
    p.engineLaunchWrapper =
      Cli.options?.engineLaunchWrapper ??
      Input.getInput('engineLaunchWrapper') ??
      process.env.ENGINE_LAUNCH_WRAPPER ??
      '';
    p.skipInContainerClone =
      Cli.options?.skipInContainerClone ?? Input.getInput('skipInContainerClone') === 'true';
    p.repoPathOverride = Cli.options?.repoPathOverride ?? Input.getInput('repoPathOverride') ?? '';
    p.lockedWorkspace = '';
    p.cacheSaveOnFailure = false;
    p.cacheSaveOnFailureFilter = 'all';
    p.cacheRetentionDays = 0;
    p.awsStackName = Input.getInput('awsStackName') || process.env.AWS_STACK_NAME || 'game-ci';
    p.storageProvider = Input.getInput('storageProvider') || process.env.STORAGE_PROVIDER || 's3';
    p.rcloneRemote = Input.getInput('rcloneRemote') || process.env.RCLONE_REMOTE || '';
    p.awsUseSpot = Input.getInput('awsUseSpot') === 'true';
    p.awsSpotFallback = Input.getInput('awsSpotFallback') !== 'false';
    p.awsUseEphemeralStorage = Input.getInput('awsUseEphemeralStorage') === 'true';
    p.awsEphemeralStorageSize = Number(Input.getInput('awsEphemeralStorageSize')) || 25;
    p.dockerWorkspacePath = Input.dockerWorkspacePath || '/github/workspace';
    p.dockerCpuLimit = '';
    p.dockerMemoryLimit = '';
    p.dockerIsolationMode = '';
    p.gitPrivateToken = Input.getInput('gitPrivateToken') || process.env.GIT_PRIVATE_TOKEN || '';
    p.engine = Input.getInput('engine') || 'unity';
    p.enginePlugin = Input.getInput('enginePlugin') || '';
    p.preflightSuite = Input.getInput('preflightSuite') || '';
    p.testSuitePath = Input.getInput('testSuitePath') || '';
    p.testFilterRefs = Input.getInput('testFilterRefs') || '';
    p.testFilterInjection = Input.getInput('testFilterInjection') || '';
    p.testFilterInjectionPath = Input.getInput('testFilterInjectionPath') || '';

    // Initialize the engine plugin (Unity is built-in, others require enginePlugin source)
    initEngine(p.engine, p.enginePlugin || undefined);

    p.orchestratorRepoName =
      Input.getInput('orchestratorRepoName') ||
      process.env.GITHUB_REPOSITORY ||
      'game-ci/unity-builder';
    p.orchestratorBranch = Input.getInput('orchestratorBranch') || 'main';
    p.githubRepo = Input.getInput('githubRepo') || process.env.GITHUB_REPOSITORY || '';
    p.gitAuthMode = Input.getInput('gitAuthMode') || 'header';
    p.buildGuid = '';
    p.branch = '';
    p.gitSha = '';
    p.customJob = '';
    p.preBuildContainerHooks = '';
    p.postBuildContainerHooks = '';
    p.commandHooks = '';

    // Pass through any CLI overrides not explicitly handled above
    if (Cli.options) {
      for (const [key, value] of Object.entries(Cli.options)) {
        if (value !== undefined && !(key in p && p[key] !== undefined)) {
          p[key] = value;
        }
      }
    }

    return p;
  }

  static shouldUseRetainedWorkspaceMode(buildParameters: BuildParameters): boolean {
    return buildParameters.maxRetainedWorkspaces > 0 && buildParameters.lockedWorkspace !== '';
  }

  static parseBuildFile(filename: string, _platform: string, _androidExportType: string): string {
    return filename;
  }

  static getSerialFromLicenseFile(_license: string): string {
    return '';
  }
}

export default BuildParameters;
export { BuildParameters };
