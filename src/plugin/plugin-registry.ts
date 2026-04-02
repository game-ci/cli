import type {
  GameCIPlugin,
  EngineDetectorPlugin,
  CommandPlugin,
  OptionsPlugin,
  ProviderPlugin,
} from './plugin-interface.ts';
import type { YargsInstance } from '../dependencies.ts';
import { CommandInterface } from '../command/command-interface.ts';

/**
 * Central plugin registry.
 *
 * Plugins register themselves here. The CLI core queries the registry
 * when it needs to detect engines, create commands, configure options,
 * or instantiate remote providers.
 */
export class PluginRegistry {
  private static plugins: GameCIPlugin[] = [];
  private static engineDetectors: EngineDetectorPlugin[] = [];
  private static commandPlugins: CommandPlugin[] = [];
  private static optionsPlugins: OptionsPlugin[] = [];
  private static providerConstructors: Map<string, new (bp: any) => ProviderPlugin> = new Map();

  /**
   * Register a plugin. Indexes its engine detectors, commands, options, and providers.
   */
  static async register(plugin: GameCIPlugin): Promise<void> {
    PluginRegistry.plugins.push(plugin);

    if (plugin.engineDetectors) {
      PluginRegistry.engineDetectors.push(...plugin.engineDetectors);
    }

    if (plugin.commands) {
      PluginRegistry.commandPlugins.push(...plugin.commands);
    }

    if (plugin.options) {
      PluginRegistry.optionsPlugins.push(...plugin.options);
    }

    if (plugin.providers) {
      for (const [name, ctor] of Object.entries(plugin.providers)) {
        PluginRegistry.providerConstructors.set(name, ctor);
      }
    }

    if (plugin.onLoad) {
      await plugin.onLoad();
    }

    log?.info?.(`Plugin registered: ${plugin.name}${plugin.version ? ` v${plugin.version}` : ''}`);
  }

  /**
   * Register a plugin only once by name.
   */
  static async registerOnce(plugin: GameCIPlugin): Promise<void> {
    if (PluginRegistry.hasPlugin(plugin.name)) {
      return;
    }

    await PluginRegistry.register(plugin);
  }

  /**
   * Check whether a plugin with the given name is already registered.
   */
  static hasPlugin(name: string): boolean {
    return PluginRegistry.plugins.some((plugin) => plugin.name === name);
  }

  /**
   * Detect engine from project path by querying all registered engine detectors.
   * Returns the first match, or { engine: 'unknown', engineVersion: 'unknown' }.
   */
  static detectEngine(projectPath: string): { engine: string; engineVersion: string } {
    for (const detector of PluginRegistry.engineDetectors) {
      const result = detector.detect(projectPath);
      if (result && result.engine !== 'unknown') {
        return result;
      }
    }

    return { engine: 'unknown', engineVersion: 'unknown' };
  }

  /**
   * Create a command for the given engine. Queries registered command plugins
   * for the engine, returning the first match.
   */
  static createCommand(engine: string, command: string, subCommands: string[]): CommandInterface | null {
    for (const plugin of PluginRegistry.commandPlugins) {
      if (plugin.engine === engine) {
        const cmd = plugin.createCommand(command, subCommands);
        if (cmd) return cmd;
      }
    }

    return null;
  }

  /**
   * Configure options from all plugins matching the given engine.
   */
  static async configureOptions(engine: string, yargs: YargsInstance): Promise<void> {
    for (const plugin of PluginRegistry.optionsPlugins) {
      if (plugin.engine === engine || plugin.engine === '*') {
        await plugin.configure(yargs);
      }
    }
  }

  /**
   * Instantiate a provider by strategy name.
   */
  static createProvider(strategy: string, buildParameters: any): ProviderPlugin | null {
    const Ctor = PluginRegistry.providerConstructors.get(strategy);
    if (!Ctor) return null;
    return new Ctor(buildParameters);
  }

  /**
   * List all registered provider strategy names.
   */
  static getAvailableProviders(): string[] {
    return Array.from(PluginRegistry.providerConstructors.keys());
  }

  /**
   * List all registered engine detector names.
   */
  static getRegisteredEngines(): string[] {
    return PluginRegistry.engineDetectors.map((d) => d.name);
  }

  /**
   * List all registered plugins.
   */
  static getRegisteredPlugins(): GameCIPlugin[] {
    return [...PluginRegistry.plugins];
  }

  /**
   * Reset the registry (for testing).
   */
  static reset(): void {
    PluginRegistry.plugins = [];
    PluginRegistry.engineDetectors = [];
    PluginRegistry.commandPlugins = [];
    PluginRegistry.optionsPlugins = [];
    PluginRegistry.providerConstructors = new Map();
  }
}
