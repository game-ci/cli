import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';
import { PluginRegistry } from '../plugin/plugin-registry.ts';

/**
 * Common remote options shared across all providers.
 * Provider-specific options (awsStackName, kubeConfig, etc.) are registered
 * by provider plugins via the PluginRegistry options system.
 */
export class RemoteOptions implements IOptions {
  public static async configure(yargs: YargsInstance): Promise<void> {
    yargs.option('customJob', {
      description: 'Custom job to run',
      type: 'string',
      demandOption: false,
      default: '',
    });

    yargs.option('providerStrategy', {
      description: `Provider strategy for remote builds (${PluginRegistry.getAvailableProviders().join(', ') || 'none registered'})`,
      type: 'string',
      demandOption: false,
      default: 'local-docker',
    });

    yargs.option('gitPrivateToken', {
      description: 'GitHub private token for remote repository access',
      type: 'string',
      demandOption: false,
      default: '',
    });

    yargs.option('containerMemory', {
      description: 'Container memory limit in MB',
      type: 'number',
      demandOption: false,
      default: 4096,
    });

    yargs.option('containerCpu', {
      description: 'Container CPU limit in millicores',
      type: 'number',
      demandOption: false,
      default: 1024,
    });

    yargs.option('containerHookFiles', {
      description: 'Comma-separated list of container hook files',
      type: 'string',
      demandOption: false,
      default: '',
    });

    yargs.option('preBuildSteps', {
      description: 'Pre-build steps to execute',
      type: 'string',
      demandOption: false,
      default: '',
    });

    yargs.option('postBuildSteps', {
      description: 'Post-build steps to execute',
      type: 'string',
      demandOption: false,
      default: '',
    });

    // Let provider plugins register their own options
    // This replaces the old commented-out orchestrator-specific fields
    const engine = (yargs as any).parsed?.argv?.engine || '*';
    await PluginRegistry.configureOptions(engine, yargs);
  }
}
