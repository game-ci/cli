export { EnginePlugin } from './engine-plugin';
export { UnityPlugin } from './unity-plugin';
export { GodotPlugin } from './godot-plugin';
export { UnrealPlugin } from './unreal-plugin';
export { loadEngineFromModule } from './module-engine-loader';
export { loadEngineFromCli } from './cli-engine-loader';
export { loadEngineFromDocker } from './docker-engine-loader';

import { EnginePlugin } from './engine-plugin';
import { UnityPlugin } from './unity-plugin';
import { GodotPlugin } from './godot-plugin';
import { UnrealPlugin } from './unreal-plugin';
import { loadEngineFromModule } from './module-engine-loader';
import { loadEngineFromCli } from './cli-engine-loader';
import { loadEngineFromDocker } from './docker-engine-loader';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';

/** Current engine plugin — defaults to Unity. */
let currentEngine: EnginePlugin = UnityPlugin;

/** Get the current engine plugin. */
export function getEngine(): EnginePlugin {
  return currentEngine;
}

/** Replace the engine plugin (e.g. for Godot, Unreal, or testing). */
export function setEngine(engine: EnginePlugin): void {
  currentEngine = engine;
}

/**
 * Initialize the engine from a plugin source string.
 *
 * Source formats:
 *   - `docker:<image>`  — load from a Docker image
 *   - `cli:<path>`      — load from an external CLI executable
 *   - `module:<id>`     — load from an npm package or local JS/TS file
 *   - `<id>` (no prefix) — treated as a module (npm package or local path)
 *
 * When engine is 'unity' (or unset) with no enginePlugin, the built-in
 * UnityPlugin is used — no loading needed.
 */
export function initEngine(engine: string, enginePlugin?: string): void {
  // Built-in engines — no external plugin source needed
  if (!enginePlugin) {
    const builtinEngines: Record<string, EnginePlugin> = {
      unity: UnityPlugin,
      godot: GodotPlugin,
      unreal: UnrealPlugin,
    };

    if (engine in builtinEngines) {
      currentEngine = builtinEngines[engine];
      OrchestratorLogger.log(`Using built-in ${engine} engine plugin`);
      return;
    }

    throw new Error(
      `Engine '${engine}' requires an enginePlugin source. ` +
        `Use one of: module:<npm-package>, cli:<executable-path>, docker:<image>`,
    );
  }

  OrchestratorLogger.log(`Loading engine plugin for '${engine}' from: ${enginePlugin}`);

  let loaded: EnginePlugin;

  if (enginePlugin.startsWith('docker:')) {
    loaded = loadEngineFromDocker(enginePlugin.slice('docker:'.length));
  } else if (enginePlugin.startsWith('cli:')) {
    loaded = loadEngineFromCli(enginePlugin.slice('cli:'.length));
  } else if (enginePlugin.startsWith('module:')) {
    loaded = loadEngineFromModule(enginePlugin.slice('module:'.length));
  } else {
    // No prefix — default to module loader (npm package or local path)
    loaded = loadEngineFromModule(enginePlugin);
  }

  currentEngine = loaded;
  OrchestratorLogger.log(`Engine plugin '${loaded.name}' initialized successfully`);
}
