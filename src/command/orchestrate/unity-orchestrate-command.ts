import { CommandInterface } from '../command-interface.ts';
import type { YargsArguments, YargsInstance } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';
import { RemoteOptions } from '../../command-options/remote-options.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';
import { PluginRegistry } from '../../plugin/plugin-registry.ts';

/**
 * Provider-backed orchestration command.
 *
 * Delegates to the provider plugin selected by --providerStrategy. The actual
 * job execution (setupWorkflow, runTaskInWorkflow, etc.) is handled by the
 * provider implementation, usually the Orchestrator plugin.
 */
export class UnityOrchestrateCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const { providerStrategy } = options;

    const provider = PluginRegistry.createProvider(providerStrategy as string, options);
    if (!provider) {
      throw new Error(
        `No provider registered for strategy "${providerStrategy}". ` +
          `Available: ${PluginRegistry.getAvailableProviders().join(', ') || 'none'}. ` +
          `Install a provider plugin (e.g. @game-ci/orchestrator-plugin).`,
      );
    }

    log.info(`Using provider strategy: ${providerStrategy}`);

    const result = await provider.runTaskInWorkflow(
      '', // buildGuid — provided by provider
      '', // image — provider determines this
      '', // commands
      '', // mountdir
      '', // workingdir
      [], // environment
      [], // secrets
    );

    log.info('Orchestrated job result:', result);
    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await RemoteOptions.configure(yargs);
  }
}
