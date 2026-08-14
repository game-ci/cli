import { EnginePlugin } from './engine-plugin';

/**
 * Godot engine plugin — built-in.
 *
 * Uses third-party Docker images (barichello/godot-ci) rather than
 * game-ci-maintained images. The orchestrator only needs to know about
 * cache folders and container lifecycle — the actual image is supplied
 * by the user or resolved from the Godot version.
 */
export const GodotPlugin: EnginePlugin = {
  name: 'godot',
  cacheFolders: ['.godot/imported', '.godot/shader_cache'],
  // No preStop needed — Godot has no license to return
};
