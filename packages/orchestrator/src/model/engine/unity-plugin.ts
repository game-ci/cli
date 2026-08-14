import { EnginePlugin } from './engine-plugin';

/**
 * Unity engine plugin — built-in.
 *
 * This is a plugin like any other, it just ships with the orchestrator.
 * unity-builder owns everything else (image resolution, versioning, build
 * scripts, licensing activation flow). This plugin only provides the
 * minimal config the orchestrator needs to handle caching and container
 * lifecycle generically.
 */
export const UnityPlugin: EnginePlugin = {
  name: 'unity',
  cacheFolders: ['Library'],
  preStopCommand:
    'cd /data/builder/action/steps && chmod +x /steps/return_license.sh 2>/dev/null || true; /steps/return_license.sh 2>/dev/null || true',
};
