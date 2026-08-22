import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';

/**
 * Build-identification options for `game-ci orchestrate`.
 *
 * `createBuildParametersFromCliOptions` (plugins/orchestrator/src/cli-plugin/
 * build-parameters-adapter.ts) reads all of these straight off the parsed
 * options object regardless of where they came from, but nothing previously
 * registered them as yargs options for the `orchestrate` command itself -
 * under yargs' global strict(true), that meant `game-ci orchestrate
 * --targetPlatform=... ` failed with "Unknown argument: targetPlatform"
 * before ever reaching the adapter, making `orchestrate` impossible to
 * invoke for any concrete build target via its own documented flags.
 *
 * Mirrors the option names `build-parameters-adapter.ts` actually reads;
 * does not duplicate anything `orchestrator-options-plugin.ts` (provider-
 * specific options: cloud provider knobs, caching, hooks, etc.) already
 * registers.
 */
export class OrchestrateBuildOptions implements IOptions {
  public static async configure(yargs: YargsInstance): Promise<void> {
    yargs
      .option('targetPlatform', {
        description: 'The platform to build your project for. Defaults to StandaloneLinux64.',
        type: 'string',
        demandOption: false,
      })
      .option('buildName', {
        description: 'Name of the build (defaults to targetPlatform name)',
        type: 'string',
        demandOption: false,
      })
      .option('buildsPath', {
        description: 'Path where the builds should be stored',
        type: 'string',
        demandOption: false,
      })
      .option('buildMethod', {
        description: 'Path to a Namespace.Class.StaticMethod to run to perform the build',
        type: 'string',
        demandOption: false,
      })
      .option('buildProfile', {
        description: 'Unity 6 build profile asset path (omits --buildTarget when set)',
        type: 'string',
        demandOption: false,
      })
      .option('buildVersion', {
        description: 'Build version string. Defaults to 0.0.1.',
        type: 'string',
        demandOption: false,
      })
      .option('androidVersionCode', {
        description: 'Android version code',
        type: 'string',
        demandOption: false,
      })
      .option('manualExit', {
        description: "Skip Unity's own -quit flag; the build method calls EditorApplication.Exit itself",
        type: 'boolean',
        demandOption: false,
      })
      .option('enableGpu', {
        description: 'Enable GPU access for the orchestrated job',
        type: 'boolean',
        demandOption: false,
      })
      .option('allowDirtyBuild', {
        description: 'Allow builds from a dirty (uncommitted-changes) working tree',
        type: 'boolean',
        demandOption: false,
      })
      .option('cacheUnityInstallationOnMac', {
        description: 'Cache the Unity installation on macOS runners',
        type: 'boolean',
        demandOption: false,
      })
      .option('chownFilesTo', {
        description: 'User to chown output files to after the build',
        type: 'string',
        demandOption: false,
      })
      .option('sshAgent', {
        description: 'Path to an SSH agent socket, for private git dependency access',
        type: 'string',
        demandOption: false,
      })
      .option('sshPublicKeysDirectoryPath', {
        description: 'Directory of SSH public keys to trust for private git dependency access',
        type: 'string',
        demandOption: false,
      })
      .option('gitPrivateToken', {
        description: 'Git private token for repository/submodule access',
        type: 'string',
        demandOption: false,
      });
  }
}
