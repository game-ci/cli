/**
 * Engine plugin interface — allows the orchestrator to support
 * different game engines (Unity, Godot, Unreal, etc.) without
 * hardcoding engine-specific behavior.
 *
 * Each engine provides:
 * - Cache folder names (e.g. 'Library' for Unity, '.godot/imported' for Godot)
 * - Optional container preStop command (e.g. license cleanup for Unity)
 */
export interface EnginePlugin {
  /** Engine identifier: 'unity', 'godot', 'unreal', etc. */
  readonly name: string;

  /**
   * Folders to cache between builds, relative to projectPath.
   * Examples: ['Library'] for Unity, ['.godot/imported', '.godot/shader_cache'] for Godot.
   */
  readonly cacheFolders: string[];

  /**
   * Shell command for container preStop hook (e.g. license cleanup).
   * Undefined means no preStop hook.
   */
  readonly preStopCommand?: string;
}
