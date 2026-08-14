import type { YargsArguments, YargsInstance } from '../dependencies.ts';
import { UnityTargetPlatform } from '../model/unity/target-platform/unity-target-platform.ts';
import { IOptions } from './options-interface.ts';
import * as os from 'node:os';

function defaultDockerMemoryLimit(): string {
  const bytesInMegabyte = 1024 * 1024;

  let memoryMultiplier: number;
  switch (os.platform()) {
    case 'linux':
      memoryMultiplier = 0.95;
      break;
    case 'win32':
      memoryMultiplier = 0.8;
      break;
    default:
      memoryMultiplier = 0.75;
      break;
  }

  return `${Math.floor((os.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`;
}

export class BuildOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .demandOption('targetPlatform', 'Target platform is mandatory for builds')
      .option('buildName', {
        description: 'Name of the build (defaults to targetPlatform name)',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('buildsPath', {
        alias: 'o',
        description: 'Output folder for the builds',
        type: 'string',
        demandOption: false,
        default: 'build',
      })
      .default('buildPath', '')
      .default('buildFile', '')
      .middleware((argv: YargsArguments) => {
        const { buildName, buildsPath, targetPlatform, androidAppBundle, androidExportType, linux64RemoveExecutableExtension } = argv;
        const resolvedBuildName = buildName || targetPlatform;
        const resolvedAndroidExportType = androidExportType || (androidAppBundle ? 'androidAppBundle' : 'androidPackage');
        argv.buildName = resolvedBuildName;
        argv.buildPath = `${buildsPath}/${targetPlatform}`;
        argv.buildFile = UnityTargetPlatform.determineBuildFileName(
          resolvedBuildName,
          targetPlatform,
          resolvedAndroidExportType,
          Boolean(linux64RemoveExecutableExtension),
        );
      })
      .option('buildMethod', {
        alias: 'm',
        description: 'Build method to use',
        type: 'string',
        demandOption: false,
        default: 'UnityBuilderAction.Builder.BuildProject',
      })
      .option('dockerWorkspacePath', {
        description: String.dedent`The path to mount the workspace inside the docker container. For windows, leave out the drive letter. For example
        c:/github/workspace should be defined as /github/workspace`,
        type: 'string',
        demandOption: false,
        default: '/github/workspace',
      })
      .option('manualExit', {
        description: String.dedent`Skip passing -quit to the Unity editor, so it stays open after the build method returns.
        Use this if your build method needs to run further code in play mode before exiting (see
        https://github.com/game-ci/cli/issues/13). Your build method must call EditorApplication.Exit(0) itself,
        otherwise the build will hang until it times out.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('buildProfile', {
        description: String.dedent`Path to a Unity 6 Build Profile asset (relative to the project), used instead of
        --targetPlatform to determine the build's target and settings.`,
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('skipActivation', {
        description: String.dedent`Skip the license activation and return-license steps entirely. Useful when a
        license is already active in a long-lived container (e.g. some self-hosted runner setups).`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('runAsHostUser', {
        description: String.dedent`Linux only. Run the build as a user matching the host system's UID/GID instead of
        the container's default root user, so build artifacts aren't left root-owned on the host. Useful for
        fixing permission errors on self-hosted runners.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('enableGpu', {
        description: String.dedent`Windows only. Installs a Mesa llvmpipe software graphics driver before the build,
        for GPU-less compute-shader/graphics testing.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('gitConfigExtensions', {
        description: String.dedent`Linux only. Newline-separated list of extra git config entries to set before the
        build, in "key=value" form (e.g. for LFS/submodule auth setups not covered by gitPrivateToken).`,
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('linux64RemoveExecutableExtension', {
        description: String.dedent`When building for StandaloneLinux64, remove the default .x86_64 file extension
        Unity appends to the build's executable.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('useHostNetwork', {
        description: 'Linux only. Initialises Docker using the host network.',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('dockerCpuLimit', {
        description: 'Number of CPU cores to assign the docker container. Defaults to all available cores.',
        type: 'string',
        demandOption: false,
        default: os.cpus().length.toString(),
      })
      .option('dockerMemoryLimit', {
        description: String.dedent`Amount of memory to assign the docker container. Defaults to 95% of total system
        memory rounded down to the nearest megabyte on Linux and 80% on Windows. On unrecognized platforms, defaults
        to 75% of total system memory. To manually specify a value, use the format <number><unit>, where unit is
        either m or g. ie: 512m = 512 megabytes`,
        type: 'string',
        demandOption: false,
        default: defaultDockerMemoryLimit(),
      })
      .option('dockerIsolationMode', {
        description: String.dedent`Windows only. Isolation mode to use for the docker container. Can be one of
        process, hyperv, or default. Default will pick the default mode as described by Microsoft where server
        versions use process and desktop versions use hyperv.`,
        type: 'string',
        demandOption: false,
        default: 'default',
      })
      .option('containerRegistryRepository', {
        description: 'Container registry and repository to pull the Unity editor image from. Only applies if customImage is not set.',
        type: 'string',
        demandOption: false,
        default: 'unityci/editor',
      })
      .option('containerRegistryImageVersion', {
        description: 'Container registry image rolling version. Only applies if customImage is not set.',
        type: 'string',
        demandOption: false,
        default: '3',
      })
      .option('sshPublicKeysDirectoryPath', {
        description: 'Path to a directory containing SSH public keys to forward to the container.',
        type: 'string',
        demandOption: false,
        default: '',
      });
  }
}
