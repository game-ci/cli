/**
 * @game-ci/orchestrator CLI plugin adapter
 *
 * Exports a GameCIPlugin-compatible object that the @game-ci/cli can consume
 * via PluginRegistry.register(orchestratorPlugin).
 *
 * Usage in CLI:
 *   import orchestratorPlugin from '@game-ci/orchestrator/cli-plugin'
 *   await PluginRegistry.register(orchestratorPlugin)
 *
 * Or via plugin loader:
 *   await PluginLoader.load('@game-ci/orchestrator/cli-plugin')
 */

import AwsBuildPlatform from '../model/orchestrator/providers/aws';
import Kubernetes from '../model/orchestrator/providers/k8s';
import LocalDockerOrchestrator from '../model/orchestrator/providers/docker';
import LocalOrchestrator from '../model/orchestrator/providers/local';
import TestOrchestrator from '../model/orchestrator/providers/test';
import GcpCloudRunProvider from '../model/orchestrator/providers/gcp-cloud-run';
import AzureAciProvider from '../model/orchestrator/providers/azure-aci';
import GitHubActionsProvider from '../model/orchestrator/providers/github-actions';
import GitLabCiProvider from '../model/orchestrator/providers/gitlab-ci';
import RemotePowershellProvider from '../model/orchestrator/providers/remote-powershell';
import AnsibleProvider from '../model/orchestrator/providers/ansible';
import CliProvider from '../model/orchestrator/providers/cli';
import { configureOrchestratorOptions } from './orchestrator-options-plugin';
import { createProviderAdapter, createCliProviderAdapter } from './provider-adapter';

/**
 * GameCIPlugin-compatible export.
 *
 * This object matches the GameCIPlugin interface defined in @game-ci/cli:
 * - name, version: plugin metadata
 * - options: registers orchestrator-specific CLI options
 * - providers: maps strategy names to adapted provider constructors
 */
const orchestratorPlugin = {
  name: 'orchestrator',
  version: '1.0.0',

  /**
   * Options plugins — register orchestrator-specific yargs options.
   * engine: '*' means these options apply regardless of which engine is detected.
   */
  options: [
    {
      engine: '*' as const,
      configure: configureOrchestratorOptions,
    },
  ],

  /**
   * Provider constructors keyed by strategy name.
   * Each is wrapped via createProviderAdapter so the CLI can instantiate them
   * with yargs options (flat key-value) instead of BuildParameters directly.
   */
  providers: {
    aws: createProviderAdapter(AwsBuildPlatform),
    k8s: createProviderAdapter(Kubernetes),
    'local-docker': createProviderAdapter(LocalDockerOrchestrator),
    'local-system': createProviderAdapter(LocalOrchestrator),
    local: createProviderAdapter(LocalOrchestrator),
    test: createProviderAdapter(TestOrchestrator),
    'gcp-cloud-run': createProviderAdapter(GcpCloudRunProvider),
    'azure-aci': createProviderAdapter(AzureAciProvider),
    'github-actions': createProviderAdapter(GitHubActionsProvider),
    'gitlab-ci': createProviderAdapter(GitLabCiProvider),
    'remote-powershell': createProviderAdapter(RemotePowershellProvider),
    ansible: createProviderAdapter(AnsibleProvider),
    cli: createCliProviderAdapter(CliProvider),
  },
};

export default orchestratorPlugin;
export { orchestratorPlugin };
export { createBuildParametersFromCliOptions } from './build-parameters-adapter';
export { configureOrchestratorOptions } from './orchestrator-options-plugin';
export { createProviderAdapter } from './provider-adapter';
