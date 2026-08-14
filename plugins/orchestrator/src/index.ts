/**
 * @game-ci/orchestrator — entry point
 *
 * Primary integration point for unity-builder:
 *   const { createPlugin } = await import('@game-ci/orchestrator');
 *   const plugin = createPlugin();
 *   await plugin.initialize(coreParams, workspace);
 *
 * Legacy / direct usage:
 *   import { Orchestrator } from '@game-ci/orchestrator';
 *   await Orchestrator.run(buildParameters, baseImage);
 */

// Plugin lifecycle — primary integration for unity-builder
export { createPlugin } from './plugin-lifecycle';
export type { OrchestratorPlugin } from './plugin-lifecycle';

export type {
  OrchestratorConfig,
  InputProvider,
  CIFeedbackProvider,
  ContainerRunner,
  CliContext,
  RuntimeEnvironment,
  OrchestratorResult,
  OrchestratorRunFn,
} from './model/orchestrator/interfaces';
export { default as Orchestrator } from './model/orchestrator/orchestrator';
export { default as loadProvider } from './model/orchestrator/providers/provider-loader';
export { ProviderLoader } from './model/orchestrator/providers/provider-loader';
export { ConfigProvider } from './model/orchestrator/providers/config/config-provider';
export { BuildParameters } from './model/build-parameters';
export { GitHub } from './model/github';
export { Input } from './model/input';
export { Cli } from './model/cli/cli';
export { Docker } from './model/docker';
export { ImageTag } from './model/image-tag';
export { Action } from './model/action';
export { Platform } from './model/platform';
export { StringKeyValuePair, DockerParameters } from './model/shared-types';

// Engine plugin system
export type { EnginePlugin } from './model/engine';
export { getEngine, setEngine, initEngine, UnityPlugin } from './model/engine';
export { loadEngineFromModule, loadEngineFromCli, loadEngineFromDocker } from './model/engine';

// Re-export services for direct access
export {
  BuildReliabilityService,
  UnityBuildDiagnosticsService,
  UnityProcessService,
  UnityRecoveryService,
} from './model/orchestrator/services/reliability';
export type {
  UnityRecoveryAction,
  UnityRunDiagnosticInput,
  UnityRunDiagnostics,
  UnityProcessCleanupResult,
  UnityRecoveryBudget,
  UnityRecoveryBudgets,
  UnityRecoveryDecision,
} from './model/orchestrator/services/reliability';
export { TestWorkflowService } from './model/orchestrator/services/test-workflow';
export {
  PreflightService,
  builtInChecks,
  listBuiltInCheckIds,
  listBuiltInChecks,
} from './model/orchestrator/services/preflight';
export type {
  PreflightCheck,
  PreflightCategory,
  PreflightScope,
  PreflightSuiteDefinition,
  PreflightResult,
  PreflightSuiteResult,
} from './model/orchestrator/services/preflight';
export { HotRunnerService } from './model/orchestrator/services/hot-runner';
export { OutputService } from './model/orchestrator/services/output/output-service';
export { OutputTypeRegistry } from './model/orchestrator/services/output/output-type-registry';
export { ArtifactUploadHandler } from './model/orchestrator/services/output/artifact-upload-handler';
export { Logs } from './model/orchestrator/services/output/logs-facade';
export type {
  LogsCollectOptions,
  LogsTailHandle,
} from './model/orchestrator/services/output/logs-facade';
export { UnityLogCollectorService } from './model/orchestrator/services/output/unity-log-collector-service';
export type {
  UnityLogCollectionOptions,
  UnityLogCollectionResult,
  UnityLogCollectionResultItem,
} from './model/orchestrator/services/output/unity-log-collector-service';
export { UnityLogTailService } from './model/orchestrator/services/output/unity-log-tail-service';
export type { UnityLogTailOptions } from './model/orchestrator/services/output/unity-log-tail-service';
export {
  UNITY_LOG_PATHS,
  getUnityLogPath,
  listAllUnityLogCategories,
  listSafeUnityLogCategories,
} from './model/orchestrator/services/output/unity-log-paths';
export type {
  UnityLogCategory,
  UnityLogPathDefinition,
  UnityLogPlatform,
} from './model/orchestrator/services/output/unity-log-paths';
export { IncrementalSyncService } from './model/orchestrator/services/sync';

// Advanced services (lazy-loaded by unity-builder plugin interface)
export { ChildWorkspaceService } from './model/orchestrator/services/cache/child-workspace-service';
export { LocalCacheService } from './model/orchestrator/services/cache/local-cache-service';
export type {
  LocalCacheRestoreOptions,
  LocalCacheSaveOptions,
} from './model/orchestrator/services/cache/local-cache-service';
export { CacheCheckpointService } from './model/orchestrator/services/cache/cache-checkpoint-service';
export { SubmoduleProfileService } from './model/orchestrator/services/submodule/submodule-profile-service';
export { LfsAgentService } from './model/orchestrator/services/lfs/lfs-agent-service';
export { GitHooksService } from './model/orchestrator/services/hooks/git-hooks-service';
