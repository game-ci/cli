import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';
import { PluginRegistry } from '../plugin/plugin-registry.ts';

/**
 * Remote build options.
 *
 * Only the minimal options needed to select and invoke a provider plugin.
 * All provider-specific options (aws, k8s, memory, cpu, hooks, etc.) are
 * registered by the provider plugins themselves via PluginRegistry.
 */
export class RemoteOptions implements IOptions {
  public static async configure(yargs: YargsInstance): Promise<void> {
    yargs.option('providerStrategy', {
      description: `Provider strategy for remote builds (${PluginRegistry.getAvailableProviders().join(', ') || 'none registered'})`,
      type: 'string',
      demandOption: false,
      default: 'local-docker',
    });

    yargs.option('customJob', {
      description: 'Custom job to run',
      type: 'string',
      demandOption: false,
      default: '',
    });

    // Provider plugins register their own options (containerMemory, awsStackName, kubeConfig, etc.)
    const engine = (yargs as any).parsed?.argv?.engine || '*';
    await PluginRegistry.configureOptions(engine, yargs);
  }
}
