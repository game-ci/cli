import { PluginRegistry } from './plugin-registry.ts';
import type { GameCIPlugin } from './plugin-interface.ts';
import { CliProtocolPlugin } from './cli-protocol-plugin.ts';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Loads plugins from various sources and registers them with PluginRegistry.
 */
export class PluginLoader {
  /**
   * Load a plugin from a source string. Supports:
   * - npm package name (e.g., "@game-ci/unity-plugin")
   * - Local path (e.g., "./plugins/my-plugin" or "/abs/path/to/plugin")
   * - GitHub repo (e.g., "github:game-ci/unity-builder")
   * - Executable binary (e.g., "executable:/path/to/game-ci-orchestrator")
   */
  static async load(source: string): Promise<GameCIPlugin> {
    let plugin: GameCIPlugin;

    if (source.startsWith('executable:')) {
      plugin = PluginLoader.loadFromExecutable(source.slice(11));
    } else if (source.startsWith('github:')) {
      plugin = await PluginLoader.loadFromGitHub(source.slice(7));
    } else if (source.startsWith('.') || source.startsWith('/') || path.isAbsolute(source)) {
      plugin = await PluginLoader.loadFromPath(source);
    } else {
      plugin = await PluginLoader.loadFromNpm(source);
    }

    PluginLoader.validate(plugin, source);
    await PluginRegistry.registerOnce(plugin);

    return plugin;
  }

  /**
   * Load multiple plugins from an array of sources.
   */
  static async loadAll(sources: string[]): Promise<GameCIPlugin[]> {
    const plugins: GameCIPlugin[] = [];
    for (const source of new Set(sources)) {
      try {
        const plugin = await PluginLoader.load(source);
        plugins.push(plugin);
      } catch (error: any) {
        log?.warning?.(`Failed to load plugin from "${source}": ${error.message}`);
      }
    }
    return plugins;
  }

  /**
   * Load from an npm package (already installed in node_modules).
   */
  private static async loadFromNpm(packageName: string): Promise<GameCIPlugin> {
    const mod = await import(packageName);
    return mod.default || mod;
  }

  /**
   * Load from a local file path.
   */
  private static async loadFromPath(localPath: string): Promise<GameCIPlugin> {
    const resolvedPath = path.resolve(localPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Plugin path does not exist: ${resolvedPath}`);
    }

    const mod = await import(resolvedPath);
    return mod.default || mod;
  }

  /**
   * Create a CLI protocol plugin from an external executable binary.
   *
   * The executable must implement the JSON-over-stdin/stdout protocol
   * (the `serve` command in the orchestrator binary).
   *
   * Registers a single execution strategy "cli-protocol" backed by the
   * executable and its JSON protocol.
   */
  private static loadFromExecutable(executablePath: string): GameCIPlugin {
    const resolvedPath = path.resolve(executablePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Executable plugin path does not exist: ${resolvedPath}`);
    }

    // Create a plugin that wraps the executable as a CliProtocolPlugin
    const CliProtocolPluginCtor = class extends CliProtocolPlugin {
      constructor(options: Record<string, any>) {
        super({ ...options, providerExecutable: resolvedPath });
      }
    };

    return {
      name: `executable:${path.basename(resolvedPath)}`,
      version: '1.0.0',
      providers: {
        'cli-protocol': CliProtocolPluginCtor as any,
      },
    };
  }

  /**
   * Load from a GitHub repo (clones to a temp directory and imports).
   */
  private static async loadFromGitHub(repo: string): Promise<GameCIPlugin> {
    // For now, assume the GitHub plugin is published to npm.
    // Full git-clone-based loading can be added later.
    throw new Error(
      `Direct GitHub repo loading not yet implemented for "${repo}". ` +
      `Publish the plugin to npm or use a local path instead.`,
    );
  }

  /**
   * Validate that a loaded module satisfies the GameCIPlugin interface.
   */
  private static validate(plugin: GameCIPlugin, source: string): void {
    if (!plugin || typeof plugin !== 'object') {
      throw new Error(`Plugin from "${source}" did not export a valid GameCIPlugin object`);
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error(`Plugin from "${source}" must export a "name" string`);
    }

    // Validate engine detectors
    if (plugin.engineDetectors) {
      for (const detector of plugin.engineDetectors) {
        if (typeof detector.detect !== 'function') {
          throw new Error(`Engine detector "${detector.name}" in plugin "${plugin.name}" must have a detect() method`);
        }
      }
    }

    // Validate command plugins
    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        if (!cmd.engine || typeof cmd.createCommand !== 'function') {
          throw new Error(`Command plugin in "${plugin.name}" must have engine and createCommand()`);
        }
      }
    }

    // Validate provider constructors
    if (plugin.providers) {
      for (const [name, Ctor] of Object.entries(plugin.providers)) {
        if (typeof Ctor !== 'function') {
          throw new Error(`Provider "${name}" in plugin "${plugin.name}" must be a constructor function`);
        }
      }
    }
  }
}
