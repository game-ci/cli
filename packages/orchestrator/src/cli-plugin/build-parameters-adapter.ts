import BuildParameters from '../model/build-parameters';
import { customAlphabet } from 'nanoid';
import OrchestratorConstants from '../model/orchestrator/options/orchestrator-constants';
import { initEngine } from '../model/engine';

/**
 * Maps CLI yargs options (flat key-value pairs) into a BuildParameters object.
 *
 * When the orchestrator is consumed as a CLI plugin, the CLI collects options
 * via yargs and passes them as a plain object. This adapter bridges that format
 * to the BuildParameters class that all providers expect.
 */
export function createBuildParametersFromCliOptions(options: Record<string, any>): BuildParameters {
  const bp = new BuildParameters();

  // ── engine ────────────────────────────────────────────────────────
  bp.engine = options.engine || 'unity';
  bp.enginePlugin = options.enginePlugin || '';
  initEngine(bp.engine, bp.enginePlugin || undefined);

  // ── identity / build settings ─────────────────────────────────────
  bp.editorVersion = options.engineVersion || options.editorVersion || options.unityVersion || '';
  bp.customImage = options.customImage || '';
  // Engine-specific licensing fields (unitySerial, unityLicensingServer,
  // unityLicensingToolset, skipActivation, ...) are not assigned here.
  // They flow opaquely through BuildParameters' index signature when the host
  // populates them; orchestrator does not read them.
  // See https://github.com/game-ci/orchestrator/issues/25
  bp.runnerTempPath = options.runnerTempPath || process.env.RUNNER_TEMP || '';
  bp.targetPlatform = options.targetPlatform || 'StandaloneLinux64';
  bp.projectPath = options.projectPath || '.';
  bp.buildProfile = options.buildProfile || '';
  bp.buildName = options.buildName || options.targetPlatform || 'StandaloneLinux64';
  bp.buildPath = options.buildPath || options.buildsPath || `build/${bp.targetPlatform}`;
  bp.buildFile = options.buildFile || bp.buildName;
  bp.buildMethod = options.buildMethod || '';
  bp.buildVersion = options.buildVersion || '0.0.1';
  bp.androidVersionCode = options.androidVersionCode || '';

  // ── flags ─────────────────────────────────────────────────────────
  bp.manualExit = options.manualExit === true || options.manualExit === 'true';
  bp.enableGpu = options.enableGpu === true || options.enableGpu === 'true';
  bp.isCliMode = true;
  bp.allowDirtyBuild = options.allowDirtyBuild === true || options.allowDirtyBuild === 'true';
  bp.cacheUnityInstallationOnMac =
    options.cacheUnityInstallationOnMac === true || options.cacheUnityInstallationOnMac === 'true';

  // ── orchestrator ──────────────────────────────────────────────────
  bp.providerStrategy = options.providerStrategy || 'local-docker';
  bp.maxRetainedWorkspaces = Number(options.maxRetainedWorkspaces) || 0;
  bp.useLargePackages = options.useLargePackages === true || options.useLargePackages === 'true';
  bp.useCompressionStrategy =
    options.useCompressionStrategy === true || options.useCompressionStrategy === 'true';
  bp.garbageMaxAge = Number(options.garbageMaxAge) || 24;
  bp.githubChecks = options.githubChecks === true || options.githubChecks === 'true';
  bp.asyncWorkflow = options.asyncOrchestrator === true || options.asyncOrchestrator === 'true';
  bp.githubCheckId = options.githubCheckId || '';
  bp.finalHooks = options.finalHooks ? String(options.finalHooks).split(',') : [];
  bp.skipLfs = options.skipLfs === true || options.skipLfs === 'true';
  bp.skipCache = options.skipCache === true || options.skipCache === 'true';
  bp.skipInContainerClone =
    options.skipInContainerClone === true || options.skipInContainerClone === 'true';
  bp.repoPathOverride = options.repoPathOverride || '';
  bp.lockedWorkspace = '';
  bp.cacheSaveOnFailure =
    options.cacheSaveOnFailure === true || options.cacheSaveOnFailure === 'true';
  bp.cacheSaveOnFailureFilter = options.cacheSaveOnFailureFilter || 'all';
  bp.cacheRetentionDays = Number(options.cacheRetentionDays) || 0;

  // ── docker ────────────────────────────────────────────────────────
  bp.dockerWorkspacePath = options.dockerWorkspacePath || '/github/workspace';
  bp.dockerCpuLimit = options.dockerCpuLimit || '';
  bp.dockerMemoryLimit = options.dockerMemoryLimit || '';
  bp.dockerIsolationMode = options.dockerIsolationMode || 'default';

  // ── networking / auth ─────────────────────────────────────────────
  bp.gitPrivateToken = options.gitPrivateToken || process.env.GIT_PRIVATE_TOKEN || '';
  bp.sshAgent = options.sshAgent || '';
  bp.sshPublicKeysDirectoryPath = options.sshPublicKeysDirectoryPath || '';
  bp.chownFilesTo = options.chownFilesTo || '';

  // ── cloud: AWS ────────────────────────────────────────────────────
  bp.awsStackName = options.awsStackName || process.env.AWS_STACK_NAME || 'game-ci';
  bp.awsBaseStackName = options.awsBaseStackName || bp.awsStackName;
  bp.awsUseSpot = options.awsUseSpot === true || options.awsUseSpot === 'true';
  bp.awsSpotFallback = options.awsSpotFallback !== false && options.awsSpotFallback !== 'false';
  bp.awsUseEphemeralStorage =
    options.awsUseEphemeralStorage === true || options.awsUseEphemeralStorage === 'true';
  bp.awsEphemeralStorageSize = Number(options.awsEphemeralStorageSize) || 25;

  // ── cloud: Kubernetes ─────────────────────────────────────────────
  bp.kubeConfig = options.kubeConfig || '';
  bp.kubeVolume = options.kubeVolume || '';
  bp.kubeVolumeSize = options.kubeVolumeSize || '25Gi';
  bp.kubeStorageClass = options.kubeStorageClass || '';

  // ── container resources ───────────────────────────────────────────
  bp.containerMemory = options.containerMemory || '3072';
  bp.containerCpu = options.containerCpu || '1024';

  // ── storage ───────────────────────────────────────────────────────
  bp.storageProvider = options.storageProvider || process.env.STORAGE_PROVIDER || 's3';
  bp.rcloneRemote = options.rcloneRemote || process.env.RCLONE_REMOTE || '';

  // ── caching / workspace ───────────────────────────────────────────
  bp.localCacheEnabled = options.localCacheEnabled === true || options.localCacheEnabled === 'true';
  bp.localCacheLibrary = options.localCacheLibrary === true || options.localCacheLibrary === 'true';
  bp.localCacheLfs = options.localCacheLfs === true || options.localCacheLfs === 'true';
  bp.childWorkspacesEnabled =
    options.childWorkspacesEnabled === true || options.childWorkspacesEnabled === 'true';
  bp.childWorkspaceName = options.childWorkspaceName || '';
  bp.childWorkspaceCacheRoot = options.childWorkspaceCacheRoot || '';
  bp.childWorkspacePreserveGit = options.childWorkspacePreserveGit !== false;
  bp.childWorkspaceSeparateLibrary =
    options.childWorkspaceSeparateLibrary === true ||
    options.childWorkspaceSeparateLibrary === 'true';

  // ── hooks ─────────────────────────────────────────────────────────
  bp.commandHooks = options.commandHooks || '';
  bp.postBuildContainerHooks = options.postBuildContainerHooks || options.postBuildSteps || '';
  bp.preBuildContainerHooks = options.preBuildContainerHooks || options.preBuildSteps || '';
  bp.customJob = options.customJob || '';
  bp.gitHooksEnabled = options.gitHooksEnabled === true || options.gitHooksEnabled === 'true';
  bp.gitHooksSkipList = options.gitHooksSkipList || '';
  bp.middlewarePipeline = options.middlewarePipeline || '';

  // ── hot runner ────────────────────────────────────────────────────
  bp.hotRunnerEnabled = options.hotRunnerEnabled === true || options.hotRunnerEnabled === 'true';
  bp.hotRunnerTransport = options.hotRunnerTransport || 'tcp';
  bp.hotRunnerHost = options.hotRunnerHost || 'localhost';
  bp.hotRunnerPort = Number(options.hotRunnerPort) || 0;
  bp.hotRunnerHealthInterval = Number(options.hotRunnerHealthInterval) || 30000;
  bp.hotRunnerMaxIdle = Number(options.hotRunnerMaxIdle) || 300000;
  bp.hotRunnerFallbackToCold = options.hotRunnerFallbackToCold !== false;

  // ── sync ──────────────────────────────────────────────────────────
  bp.syncStrategy = options.syncStrategy || '';
  bp.syncStatePath = options.syncStatePath || '';
  bp.syncInputRef = options.syncInputRef || '';
  bp.syncStorageRemote = options.syncStorageRemote || '';
  bp.syncRevertAfter = options.syncRevertAfter === true || options.syncRevertAfter === 'true';

  // ── reliability ───────────────────────────────────────────────────
  bp.gitIntegrityCheck = options.gitIntegrityCheck === true || options.gitIntegrityCheck === 'true';
  bp.gitAutoRecover = options.gitAutoRecover === true || options.gitAutoRecover === 'true';
  bp.cleanReservedFilenames =
    options.cleanReservedFilenames === true || options.cleanReservedFilenames === 'true';
  bp.buildArchiveEnabled =
    options.buildArchiveEnabled === true || options.buildArchiveEnabled === 'true';
  bp.buildArchivePath = options.buildArchivePath || '';
  bp.buildArchiveRetention = Number(options.buildArchiveRetention) || 7;

  // ── submodule / lfs ───────────────────────────────────────────────
  bp.submoduleProfilePath = options.submoduleProfilePath || '';
  bp.submoduleVariantPath = options.submoduleVariantPath || '';
  bp.submoduleToken = options.submoduleToken || '';
  bp.lfsTransferAgent = options.lfsTransferAgent || '';
  bp.lfsTransferAgentArgs = options.lfsTransferAgentArgs || '';
  bp.lfsStoragePaths = options.lfsStoragePaths || '';

  // ── test workflow ─────────────────────────────────────────────────
  bp.testSuitePath = options.testSuitePath || '';
  bp.testFilterRefs = options.testFilterRefs || '';
  bp.testFilterInjection = options.testFilterInjection || '';
  bp.testFilterInjectionPath = options.testFilterInjectionPath || '';

  // ── artifact / output ─────────────────────────────────────────────
  bp.artifactCustomTypes = options.artifactCustomTypes || '';
  bp.artifactOutputTypes = options.artifactOutputTypes || '';
  bp.artifactUploadTarget = options.artifactUploadTarget || '';
  bp.artifactUploadPath = options.artifactUploadPath || '';
  bp.artifactCompression = options.artifactCompression || '';
  bp.artifactRetentionDays = Number(options.artifactRetentionDays) || 0;

  // ── provider-specific ─────────────────────────────────────────────
  bp.remotePowershellHost = options.remotePowershellHost || '';
  bp.remotePowershellTransport = options.remotePowershellTransport || '';
  bp.remotePowershellCredential = options.remotePowershellCredential || '';
  bp.githubActionsRepo = options.githubActionsRepo || '';
  bp.githubActionsWorkflow = options.githubActionsWorkflow || '';
  bp.githubActionsToken = options.githubActionsToken || '';
  bp.githubActionsRef = options.githubActionsRef || '';
  bp.gitlabProjectId = options.gitlabProjectId || '';
  bp.gitlabTriggerToken = options.gitlabTriggerToken || '';
  bp.gitlabApiUrl = options.gitlabApiUrl || '';
  bp.gitlabRef = options.gitlabRef || '';
  bp.ansibleInventory = options.ansibleInventory || '';
  bp.ansiblePlaybook = options.ansiblePlaybook || '';
  bp.ansibleExtraVars = options.ansibleExtraVars || '';
  bp.ansibleVaultPassword = options.ansibleVaultPassword || '';

  // ── git / CI ──────────────────────────────────────────────────────
  bp.branch =
    options.branch || process.env.GITHUB_REF?.replace('refs/', '').replace('heads/', '') || '';
  bp.gitSha = options.gitSha || process.env.GITHUB_SHA || '';
  bp.githubRepo = options.githubRepo || process.env.GITHUB_REPOSITORY || '';
  bp.orchestratorRepoName = options.orchestratorRepoName || 'game-ci/orchestrator';
  bp.orchestratorBranch = options.orchestratorBranch || 'main';
  bp.orchestratorDebug = options.orchestratorDebug === true || options.orchestratorDebug === 'true';
  bp.cacheKey = options.cacheKey || bp.branch;

  // ── IDs ───────────────────────────────────────────────────────────
  bp.logId = customAlphabet(OrchestratorConstants.alphabet, 9)();
  bp.buildGuid = options.buildGuid || `${options.runNumber || '0'}-${bp.targetPlatform}`;

  return bp;
}
