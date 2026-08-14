/**
 * @game-ci/orchestrator — external dependency interfaces
 *
 * These interfaces define the contract between the orchestrator and its host
 * application (e.g., unity-builder). The host supplies implementations;
 * the orchestrator consumes them.
 */

// ── OrchestratorConfig ────────────────────────────────────────────────
// Replaces the BuildParameters god object with a lean, typed contract.
// Contains ONLY the ~83 properties the orchestrator actually reads.

export interface OrchestratorConfig {
  // Identity & Build
  targetPlatform: string;
  editorVersion: string;
  buildGuid: string;
  projectPath: string;
  buildPath: string;
  buildName: string;
  isCliMode: boolean;

  // Provider Strategy (mutable for fallback logic)
  providerStrategy: string;
  fallbackProviderStrategy?: string;
  providerExecutable?: string;
  providerInitTimeout?: number;

  // Runner Checks
  runnerCheckEnabled?: boolean;
  runnerCheckLabels?: string[];
  runnerCheckMinAvailable?: number;
  retryOnFallback?: boolean;

  // Container & Docker
  containerCpu: string;
  containerMemory: string;
  containerNamespace?: string;
  dockerWorkspacePath: string;
  dockerCpuLimit: string;
  dockerMemoryLimit: string;

  // Caching & Workspace
  useCompressionStrategy: boolean;
  useLargePackages: boolean;
  skipCache: boolean;
  skipLfs: boolean;
  skipInContainerClone: boolean;
  repoPathOverride?: string;
  maxRetainedWorkspaces: number; // mutable for retry logic
  maxCacheEntries?: number;
  minCacheEntries?: number;
  gcTimeoutMinutes?: number;
  configFiles?: Record<string, string>;
  localCacheRoot?: string;
  cacheKey: string;
  lockedWorkspace: string;

  // Sync & Storage
  syncStrategy?: string;
  syncInputRef?: string;
  syncStatePath?: string;
  syncStorageRemote?: string;
  syncRevertAfter?: boolean;
  storageProvider?: string;
  rcloneRemote?: string;

  // Kubernetes
  kubeConfig?: string;
  kubeVolume?: string;
  kubeVolumeSize?: string;
  kubeStorageClass?: string;

  // AWS
  awsStackName?: string;

  // Git Configuration
  branch: string;
  gitSha: string;
  gitPrivateToken?: string;
  gitAuthMode?: string;

  // LFS
  lfsTransferAgent?: string;
  lfsTransferAgentArgs?: string;
  lfsStoragePaths?: string;

  // Submodule
  submoduleProfilePath?: string;
  submoduleVariantPath?: string;
  submoduleToken?: string;

  // GitHub & CI Integration
  githubCheckId: string; // mutable: set after check creation
  finalHooks: string[];
  githubRepo?: string;
  githubChecks: boolean;
  asyncWorkflow: boolean;

  // Workflow & Hooks
  commandHooks?: string;
  postBuildContainerHooks?: string;
  preBuildContainerHooks?: string;
  customJob?: string;
  containerHookFiles?: string;

  // Orchestrator Metadata
  orchestratorBranch?: string;
  orchestratorRepoName?: string;
  orchestratorDebug: boolean;
  logId?: string;
  constantGarbageCollection?: boolean;
  garbageMaxAge: number;

  // Authentication
  // ── Note ───────────────────────────────────────────────────────────
  // Engine-specific licensing fields (e.g. unitySerial, unityLicensingServer,
  // unityLicensingToolset, skipActivation) are NOT declared here. They ride
  // opaquely inside the host's plugin-config dict; orchestrator does not read
  // them and must not name them. See https://github.com/game-ci/orchestrator/issues/25
  runnerTempPath?: string;
  manualExit?: boolean;
  enableGpu?: boolean;
  allowDirtyBuild?: boolean;
  customImage?: string;
  buildFile?: string;
  buildMethod?: string;
  buildVersion?: string;
  buildProfile?: string;
  chownFilesTo?: string;
  sshAgent?: string;
  sshPublicKeysDirectoryPath?: string;

  // Cloud Provider Specific (optional, per-provider)
  // GCP
  gcpProject?: string;
  gcpRegion?: string;
  gcpBucket?: string;
  gcpMachineType?: string;
  gcpDiskSizeGb?: string;
  gcpFilestoreIp?: string;
  gcpFilestoreShare?: string;
  gcpServiceAccount?: string;
  gcpVpcConnector?: string;
  gcpStorageType?: string;
  // Azure
  azureResourceGroup?: string;
  azureLocation?: string;
  azureStorageType?: string;
  azureStorageAccount?: string;
  azureFileShareName?: string;
  azureBlobContainer?: string;
  azureSubscriptionId?: string;
  azureDiskSizeGb?: string;
  azureMemoryGb?: string;
  azureCpu?: string;
  azureSubnetId?: string;
  // GitLab
  gitlabProjectId?: string;
  gitlabTriggerToken?: string;
  gitlabApiUrl?: string;
  gitlabRef?: string;
  // GitHub Actions
  githubActionsRepo?: string;
  githubActionsWorkflow?: string;
  githubActionsToken?: string;
  githubActionsRef?: string;
  // Remote PowerShell
  remotePowershellHost?: string;
  remotePowershellTransport?: string;
  remotePowershellCredential?: string;
  // Ansible
  ansibleInventory?: string;
  ansiblePlaybook?: string;
  ansibleExtraVars?: string;
  ansibleVaultPassword?: string;

  // Index signature for additional/dynamic properties
  [key: string]: any;
}

// ── InputProvider ─────────────────────────────────────────────────────

export interface InputProvider {
  /** Convert camelCase input names to UPPER_SNAKE_CASE environment variable format */
  ToEnvVarFormat(input: string): string;

  /** Default cloud region */
  readonly region: string;

  /** Read an input value by key */
  getInput?(query: string): string | undefined;
}

// ── CIFeedbackProvider ────────────────────────────────────────────────

export interface CIFeedbackProvider {
  /** Whether CI feedback (GitHub Checks) is enabled */
  githubInputEnabled: boolean;

  /** Create a CI check run and return its ID */
  createGitHubCheck(summary: string): Promise<string>;

  /** Update an existing CI check run */
  updateGitHubCheck(
    longDescription: string,
    summary: string,
    result?: string,
    status?: string,
  ): Promise<void>;

  /** Trigger downstream workflows on build completion */
  triggerWorkflowOnComplete(workflows: string[]): Promise<void>;

  /** Test-only: force async test mode */
  forceAsyncTest?: boolean;
}

// ── ContainerRunner ───────────────────────────────────────────────────

export interface ContainerRunner {
  /** Execute a command inside a container */
  run(
    image: string,
    parameters: Record<string, any>,
    silent?: boolean,
    overrideCommands?: string,
    additionalVariables?: Array<{ name: string; value: string }>,
    options?: {
      listeners?: {
        stdout?: (data: Buffer) => void;
        stderr?: (data: Buffer) => void;
      };
    },
    entrypointBash?: boolean,
  ): Promise<number>;
}

// ── CliContext ─────────────────────────────────────────────────────────

export interface CliContext {
  /** Commander OptionValues from CLI parsing */
  options?: Record<string, any>;

  /** Whether running in CLI mode (vs GitHub Actions) */
  readonly isCliMode: boolean;

  /** Query CLI options with fallback key */
  query(key: string, alternativeKey: string): any;
}

// ── RuntimeEnvironment ────────────────────────────────────────────────

export interface RuntimeEnvironment {
  /** GitHub workspace directory or cwd */
  readonly workspace: string;

  /** Path to action's dist folder */
  readonly actionFolder: string;

  /** Whether running locally (not in CI) */
  readonly isRunningLocally: boolean;
}

// ── OrchestratorResult ────────────────────────────────────────────────

export interface OrchestratorResult {
  exitCode: number;
  BuildSucceeded: boolean;
  buildResults?: string;
}

// ── OrchestratorRunFn ─────────────────────────────────────────────────

export type OrchestratorRunFn = (
  config: OrchestratorConfig,
  baseImage: string,
) => Promise<OrchestratorResult>;
