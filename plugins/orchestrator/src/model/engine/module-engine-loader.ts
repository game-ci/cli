import { EnginePlugin } from './engine-plugin';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';

/**
 * Load an EnginePlugin from a TypeScript/JavaScript module.
 *
 * Accepts:
 * - npm package name: `@game-ci/godot-engine`
 * - Local file path: `./my-engine-plugin.js` or `/absolute/path/plugin.js`
 *
 * The module must export an EnginePlugin-compatible object as default or named `plugin`:
 *
 *   // ES module
 *   export default { name: 'godot', cacheFolders: ['.godot/imported'] };
 *
 *   // CommonJS
 *   module.exports = { name: 'godot', cacheFolders: ['.godot/imported'] };
 */
export function loadEngineFromModule(moduleId: string): EnginePlugin {
  let loaded: any;
  try {
    loaded = require(moduleId);
  } catch (error: any) {
    throw new Error(`Failed to load engine plugin module '${moduleId}': ${error.message}`);
  }

  // Support default export, named `plugin` export, or the module itself
  const config = loaded.default || loaded.plugin || loaded;

  if (!config || typeof config !== 'object') {
    throw new Error(`Engine plugin module '${moduleId}' did not export a valid object`);
  }

  if (!config.name || !Array.isArray(config.cacheFolders)) {
    throw new Error(
      `Engine plugin from module '${moduleId}' missing required fields (name, cacheFolders). Got: ${JSON.stringify(config)}`,
    );
  }

  OrchestratorLogger.log(`Loaded engine plugin '${config.name}' from module: ${moduleId}`);

  return {
    name: config.name,
    cacheFolders: config.cacheFolders,
    preStopCommand: config.preStopCommand || undefined,
  };
}
