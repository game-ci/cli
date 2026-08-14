import { EnginePlugin } from './engine-plugin';

/**
 * Unreal Engine plugin — built-in.
 *
 * Uses third-party Docker images (user-supplied) rather than
 * game-ci-maintained images due to UE EULA restrictions.
 * Common community images:
 *   - ghcr.io/epicgames/unreal-engine (official, requires access)
 *   - evoverses/ue5-docker (community-built)
 *
 * The orchestrator only needs cache folders and lifecycle hooks.
 */
export const UnrealPlugin: EnginePlugin = {
  name: 'unreal',
  cacheFolders: ['Saved', 'Intermediate', 'DerivedDataCache'],
  // No preStop needed — UE has no license to return
};
